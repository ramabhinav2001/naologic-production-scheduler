import { DateTime, Interval } from "luxon";
import type { MaintenanceWindow, Shift } from "../reflow/types";

export const UTC = "utc";

/*
Helper to parse ISO date safely
*/
export function dt(isoUtc: string): DateTime {
  const d = DateTime.fromISO(isoUtc, { zone: UTC });

  if (!d.isValid) {
    throw new Error(`Invalid ISO date: ${isoUtc}`);
  }

  return d;
}

/*
Convert DateTime → ISO string
*/
export function toIso(d: DateTime): string {
  return d.toUTC().toISO({ suppressMilliseconds: true })!;
}

/*
Create shift interval for a given day
*/
function shiftIntervalOnDay(day: DateTime, shift: Shift): Interval | null {

  const start = day.startOf("day").set({
    hour: shift.startHour,
    minute: 0,
    second: 0,
    millisecond: 0
  });

  const end = day.startOf("day").set({
    hour: shift.endHour,
    minute: 0,
    second: 0,
    millisecond: 0
  });

  if (end <= start) return null;

  return Interval.fromDateTimes(start, end);
}

/*
Convert maintenance windows → intervals
*/
export function maintenanceIntervals(windows: MaintenanceWindow[]): Interval[] {

  return windows
    .map(w =>
      Interval.fromDateTimes(
        dt(w.startDate),
        dt(w.endDate)
      )
    )
    .filter(i => i.isValid) as Interval[];
}

/*
Check overlap
*/
export function overlapsAny(interval: Interval, blocks: Interval[]): boolean {

  return blocks.some(b => interval.overlaps(b));
}

/*
Move time outside maintenance window
*/
export function nextNonBlockedInstant(
  time: DateTime,
  blocks: Interval[]
): DateTime {

  let current = time;

  while (true) {

    const block = blocks.find(b => b.contains(current));

    if (!block) return current;

    current = block.end!;
  }
}

/*
Check if time is within shift
*/
export function isWithinShift(
  time: DateTime,
  shifts: Shift[]
): boolean {

  const weekday = time.weekday === 7 ? 0 : time.weekday;

  const dayShifts = shifts.filter(s => s.dayOfWeek === weekday);

  for (const s of dayShifts) {

    const iv = shiftIntervalOnDay(time, s);

    if (iv && iv.contains(time)) {
      return true;
    }
  }

  return false;
}

/*
Find next shift start
*/
export function nextShiftStart(
  time: DateTime,
  shifts: Shift[]
): DateTime | null {

  let day = time.startOf("day");

  for (let i = 0; i < 14; i++) {

    const currentDay = day.plus({ days: i });

    const weekday = currentDay.weekday === 7 ? 0 : currentDay.weekday;

    const dayShifts = shifts
      .filter(s => s.dayOfWeek === weekday)
      .map(s => shiftIntervalOnDay(currentDay, s))
      .filter(Boolean) as Interval[];

    dayShifts.sort(
      (a, b) => a.start!.toMillis() - b.start!.toMillis()
    );

    for (const shift of dayShifts) {

      if (i === 0) {

        if (shift.contains(time)) {
          return time;
        }

        if (shift.start! >= time) {
          return shift.start!;
        }

      } else {

        return shift.start!;
      }
    }
  }

  return null;
}

/*
Find shift end if currently inside shift
*/
export function currentShiftEnd(
  time: DateTime,
  shifts: Shift[]
): DateTime | null {

  const day = time.startOf("day");

  const weekday = day.weekday === 7 ? 0 : day.weekday;

  const dayShifts = shifts.filter(s => s.dayOfWeek === weekday);

  for (const s of dayShifts) {

    const iv = shiftIntervalOnDay(day, s);

    if (iv && iv.contains(time)) {
      return iv.end!;
    }
  }

  return null;
}

/*
Add working minutes considering shifts and maintenance
*/
export function addWorkingMinutes(params: {
  start: DateTime
  durationMinutes: number
  shifts: Shift[]
  maintenanceBlocks: Interval[]
}): DateTime {

  const { shifts, maintenanceBlocks } = params;

  let remaining = params.durationMinutes;

  let current = nextShiftStart(params.start, shifts);

  if (!current) {
    throw new Error("No shifts available within search window");
  }

  current = nextNonBlockedInstant(current, maintenanceBlocks);

  while (remaining > 0) {

    if (!isWithinShift(current, shifts)) {

      const nextShift = nextShiftStart(current, shifts);

      if (!nextShift) {
        throw new Error("Cannot find next shift");
      }

      current = nextShift;

      continue;
    }

    const shiftEnd = currentShiftEnd(current, shifts);

    if (!shiftEnd) {
      current = current.plus({ minutes: 1 });
      continue;
    }

    let availableEnd = shiftEnd;

    for (const block of maintenanceBlocks) {

      const intersect = block.intersection(
        Interval.fromDateTimes(current, shiftEnd)
      );

      if (intersect && intersect.start! < availableEnd) {
        availableEnd = intersect.start!;
      }
    }

    const availableMinutes = Math.floor(
      availableEnd.diff(current, "minutes").minutes
    );

    if (availableMinutes <= 0) {

      current = availableEnd.plus({ minutes: 1 });

      continue;
    }

    const consume = Math.min(remaining, availableMinutes);

    current = current.plus({ minutes: consume });

    remaining -= consume;
  }

  return current;
}

/*
Schedule job ASAP respecting constraints
*/
export function scheduleAsap(params: {
  earliestStart: DateTime
  durationMinutes: number
  shifts: Shift[]
  maintenanceBlocks: Interval[]
}) {

  const reasons: string[] = [];

  let start = nextShiftStart(
    params.earliestStart,
    params.shifts
  );

  if (!start) {
    throw new Error("No shift available");
  }

  if (start.toMillis() !== params.earliestStart.toMillis()) {
    reasons.push("shift-boundary");
  }

  start = nextNonBlockedInstant(
    start,
    params.maintenanceBlocks
  );

  const end = addWorkingMinutes({
    start,
    durationMinutes: params.durationMinutes,
    shifts: params.shifts,
    maintenanceBlocks: params.maintenanceBlocks
  });

  return {
    start,
    end,
    reasons
  };
}