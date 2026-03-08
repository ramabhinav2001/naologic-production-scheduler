export type DocBase<TDocType extends string, TData> = {
  docId: string;
  docType: TDocType;
  data: TData;
};

export type Shift = {
  dayOfWeek: number; // 0-6 (Sunday=0)
  startHour: number; // 0-23
  endHour: number;   // 0-23 (must be > startHour)
};

export type MaintenanceWindow = {
  startDate: string; // ISO UTC
  endDate: string;   // ISO UTC
  reason?: string;
};

export type WorkCenterDoc = DocBase<
  "workCenter",
  {
    name: string;
    shifts: Shift[];
    maintenanceWindows: MaintenanceWindow[];
  }
>;

export type WorkOrderDoc = DocBase<
  "workOrder",
  {
    workOrderNumber: string;
    manufacturingOrderId: string;
    workCenterId: string;

    startDate: string; // ISO UTC
    endDate: string;   // ISO UTC
    durationMinutes: number;

    isMaintenance: boolean; // if true, locked
    dependsOnWorkOrderIds: string[];
  }
>;

export type ManufacturingOrderDoc = DocBase<
  "manufacturingOrder",
  {
    manufacturingOrderNumber: string;
    itemId: string;
    quantity: number;
    dueDate: string; // ISO UTC
  }
>;

export type ReflowInput = {
  workOrders: WorkOrderDoc[];
  workCenters: WorkCenterDoc[];
  manufacturingOrders?: ManufacturingOrderDoc[];
  options?: {
    /**
     * If true, scheduler will never move an order earlier than its original startDate.
     * (This is usually what people want in “reflow after disruptions”.)
     */
    noEarlierThanOriginalStart?: boolean;
  };
};

export type ReflowChange = {
  workOrderId: string;
  workOrderNumber: string;
  oldStartDate: string;
  oldEndDate: string;
  newStartDate: string;
  newEndDate: string;
  deltaStartMinutes: number;
  deltaEndMinutes: number;
  reasons: string[];
};

export type ReflowResult = {
  updatedWorkOrders: WorkOrderDoc[];
  changes: ReflowChange[];
  explanation: Record<string, string>;
  metrics: {
    totalDelayMinutes: number; // Σ positive (new_end - old_end)
    movedCount: number;
  };
};