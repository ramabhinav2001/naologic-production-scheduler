import { Interval } from "luxon";
import type { ReflowResult, WorkCenterDoc, WorkOrderDoc } from "./types.js";
import { dt, maintenanceIntervals } from "../utils/date-utils.js";

export type ValidationError = { code: string; message: string; workOrderId?: string; workCenterId?: string };

export function validateSchedule(params: {
  workOrders: WorkOrderDoc[];
  workCenters: WorkCenterDoc[];
}): ValidationError[] {
  const { workOrders, workCenters } = params;
  const errors: ValidationError[] = [];

  const wcById = new Map(workCenters.map(w => [w.docId, w]));
  const woById = new Map(workOrders.map(w => [w.docId, w]));

  // Dependencies
  for (const wo of workOrders) {
    const end = dt(wo.data.endDate);
    for (const pId of wo.data.dependsOnWorkOrderIds) {
      const p = woById.get(pId);
      if (!p) {
        errors.push({ code: "MISSING_PARENT", message: `Missing parent ${pId}`, workOrderId: wo.docId });
        continue;
      }
      const pEnd = dt(p.data.endDate);
      if (pEnd > dt(wo.data.startDate)) {
        errors.push({
          code: "DEPENDENCY_VIOLATION",
          message: `WO ${wo.docId} starts before parent ${pId} completes`,
          workOrderId: wo.docId
        });
      }
    }
    if (dt(wo.data.startDate) > end) {
      errors.push({ code: "NEGATIVE_DURATION", message: `WO ${wo.docId} has start after end`, workOrderId: wo.docId });
    }
  }

  // Work center overlaps + maintenance window overlaps
  for (const wc of workCenters) {
    const wos = workOrders
      .filter(w => w.data.workCenterId === wc.docId)
      .slice()
      .sort((a, b) => dt(a.data.startDate).toMillis() - dt(b.data.startDate).toMillis());

    // overlap
    for (let i = 1; i < wos.length; i++) {
      const prev = wos[i - 1];
      const cur = wos[i];
      const prevEnd = dt(prev.data.endDate);
      const curStart = dt(cur.data.startDate);
      if (curStart < prevEnd) {
        errors.push({
          code: "WORKCENTER_OVERLAP",
          message: `Overlap on WC ${wc.docId} between ${prev.docId} and ${cur.docId}`,
          workCenterId: wc.docId
        });
      }
    }

    // maintenance overlap
    const blocks = maintenanceIntervals(wc.data.maintenanceWindows);
    for (const wo of wos) {
      const iv = Interval.fromDateTimes(dt(wo.data.startDate), dt(wo.data.endDate));
      for (const b of blocks) {
        if (iv.overlaps(b)) {
          errors.push({
            code: "MAINTENANCE_OVERLAP",
            message: `WO ${wo.docId} overlaps maintenance window on WC ${wc.docId}`,
            workOrderId: wo.docId,
            workCenterId: wc.docId
          });
          break;
        }
      }
    }
  }

  return errors;
}

export function assertValidOrThrow(result: ReflowResult, workCenters: WorkCenterDoc[]) {
  const errors = validateSchedule({ workOrders: result.updatedWorkOrders, workCenters });
  if (errors.length) {
    const msg = errors.map(e => `${e.code}: ${e.message}`).join("\n");
    throw new Error(`Schedule validation failed:\n${msg}`);
  }
}