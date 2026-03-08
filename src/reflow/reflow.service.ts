import { DateTime } from "luxon";
import { topoSortOrThrow } from "./dag.js";
import type { ReflowChange, ReflowInput, ReflowResult, WorkCenterDoc, WorkOrderDoc } from "./types.js";
import { dt, scheduleAsap, toIso, maintenanceIntervals } from "../utils/date-utils.js";

type WoState = {
  wo: WorkOrderDoc;
  newStart: DateTime;
  newEnd: DateTime;
  reasons: string[];
  locked: boolean;
};

export class ReflowService {
  reflow(input: ReflowInput): ReflowResult {
    const options = {
      noEarlierThanOriginalStart: true,
      ...(input.options ?? {})
    };

    const wcById = new Map<string, WorkCenterDoc>(input.workCenters.map(w => [w.docId, w]));
    const woById = new Map<string, WorkOrderDoc>(input.workOrders.map(w => [w.docId, w]));

    // 1) Build edges from dependencies
    const nodes = input.workOrders.map(w => w.docId);
    const edges: Array<[string, string]> = [];
    for (const wo of input.workOrders) {
      for (const p of wo.data.dependsOnWorkOrderIds) edges.push([p, wo.docId]);
    }

    // 2) Preserve original order on each work center (stable sequencing)
    // This prevents the greedy topo walk from reordering jobs on the same line.
    const byWc = new Map<string, WorkOrderDoc[]>();
    for (const wo of input.workOrders) {
      const arr = byWc.get(wo.data.workCenterId) ?? [];
      arr.push(wo);
      byWc.set(wo.data.workCenterId, arr);
    }
    for (const [wcId, arr] of byWc.entries()) {
      arr.sort((a, b) => dt(a.data.startDate).toMillis() - dt(b.data.startDate).toMillis());
      for (let i = 1; i < arr.length; i++) edges.push([arr[i - 1].docId, arr[i].docId]);
    }

    // 3) Topo sort (throws if cycle)
    let order: string[];
    try {
        order = topoSortOrThrow(nodes, edges);
    } catch (err) {
    throw new Error(
        `Invalid schedule: ${(err as Error).message}`
    );
    }
    // 4) Greedy schedule in topo order
    const state = new Map<string, WoState>();

    // Track last end per work center among *scheduled* work orders
    const lastEndByWc = new Map<string, DateTime>();

    for (const id of order) {
      const wo = woById.get(id);
      if (!wo) continue;

      const wc = wcById.get(wo.data.workCenterId);
      if (!wc) throw new Error(`Missing work center ${wo.data.workCenterId} for work order ${wo.docId}`);

      const originalStart = dt(wo.data.startDate);
      const originalEnd = dt(wo.data.endDate);

      const locked = wo.data.isMaintenance === true;
      if (locked) {
        state.set(id, { wo, newStart: originalStart, newEnd: originalEnd, reasons: ["locked-maintenance-workorder"], locked: true });

        // Locked orders still occupy the work center timeline
        const prev = lastEndByWc.get(wc.docId);
        if (!prev || originalEnd > prev) lastEndByWc.set(wc.docId, originalEnd);
        continue;
      }

      // Earliest due to dependencies
      let depsReady = originalStart;
      const depReasons: string[] = [];
      for (const pId of wo.data.dependsOnWorkOrderIds) {
        const p = state.get(pId);
        if (!p) throw new Error(`Internal error: parent ${pId} not scheduled before child ${wo.docId}`);
        if (p.newEnd > depsReady) depsReady = p.newEnd;
      }
      if (depsReady > originalStart) depReasons.push("dependency");

      // Earliest due to work center previous job
      const wcReady = lastEndByWc.get(wc.docId) ?? originalStart;
      let earliest = depsReady > wcReady ? depsReady : wcReady;

      const reasons: string[] = [];
      if (wcReady > originalStart) reasons.push("workcenter-conflict");
      reasons.push(...depReasons);

      if (options.noEarlierThanOriginalStart && earliest < originalStart) earliest = originalStart;

      const blocks = maintenanceIntervals(wc.data.maintenanceWindows);

      const scheduled = scheduleAsap({
        earliestStart: earliest,
        durationMinutes: wo.data.durationMinutes,
        shifts: wc.data.shifts,
        maintenanceBlocks: blocks
      });

      reasons.push(...scheduled.reasons);

      const newStart = scheduled.start;
      const newEnd = scheduled.end;
      // Detect if job duration caused delay
      if (newEnd > originalEnd) {
        reasons.push("duration-change");
       }
      state.set(id, { wo, newStart, newEnd, reasons: uniq(reasons), locked: false });
      lastEndByWc.set(wc.docId, newEnd);
    }

    // 5) Produce updated docs + changes + explanation
    const updatedWorkOrders: WorkOrderDoc[] = [];
    const changes: ReflowChange[] = [];
    const explanation: Record<string, string> = {};
    let totalDelayMinutes = 0;
    let movedCount = 0;

    for (const wo of input.workOrders) {
      const s = state.get(wo.docId);
      if (!s) throw new Error(`Work order ${wo.docId} missing from schedule state`);

      const newDoc: WorkOrderDoc = {
        ...wo,
        data: {
          ...wo.data,
          startDate: toIso(s.newStart),
          endDate: toIso(s.newEnd)
        }
      };
      updatedWorkOrders.push(newDoc);

      const oldStart = dt(wo.data.startDate);
      const oldEnd = dt(wo.data.endDate);

      const ds = Math.round(s.newStart.diff(oldStart, "minutes").minutes);
      const de = Math.round(s.newEnd.diff(oldEnd, "minutes").minutes);

      if (ds !== 0 || de !== 0) {
        movedCount++;
        if (de > 0) totalDelayMinutes += de;

        changes.push({
          workOrderId: wo.docId,
          workOrderNumber: wo.data.workOrderNumber,
          oldStartDate: wo.data.startDate,
          oldEndDate: wo.data.endDate,
          newStartDate: newDoc.data.startDate,
          newEndDate: newDoc.data.endDate,
          deltaStartMinutes: ds,
          deltaEndMinutes: de,
          reasons: s.reasons
        });

        explanation[wo.docId] = buildExplanation({
          wo,
          ds,
          de,
          reasons: s.reasons
        });
      } else {
        explanation[wo.docId] = s.locked
          ? `Locked maintenance work order; schedule unchanged.`
          : `No change needed; earliest feasible time matched existing schedule.`;
      }
    }

    return {
      updatedWorkOrders,
      changes,
      explanation,
      metrics: { totalDelayMinutes, movedCount }
    };
  }
}

function uniq(xs: string[]) {
  return [...new Set(xs)];
}

function buildExplanation(params: { wo: WorkOrderDoc; ds: number; de: number; reasons: string[] }) {
  const parts: string[] = [];
  const { wo, ds, de, reasons } = params;

  parts.push(`WO ${wo.data.workOrderNumber} moved: start ${fmtDelta(ds)}, end ${fmtDelta(de)}.`);

  const friendly: Record<string, string> = {
  "duration-change": "The work order required more processing time than originally scheduled.",
  "locked-maintenance-workorder": "This is a maintenance work order and cannot be rescheduled.",
  "dependency": "It waited for one or more parent work orders to complete.",
  "workcenter-conflict": "Its work center was busy with a prior work order.",
  "shift-boundary": "It had to start/continue within shift hours (pauses outside shifts).",
  "maintenance-window": "It had to avoid a maintenance window on the work center."
};

  const bullets = reasons.map(r => `- ${friendly[r] ?? r}`);
  if (bullets.length) {
    parts.push("Reasons:");
    parts.push(...bullets);
  }

  return parts.join("\n");
}

function fmtDelta(mins: number) {
  if (mins === 0) return "no change";
  const sign = mins > 0 ? "+" : "";
  return `${sign}${mins} min`;
}