import { DateTime } from "luxon";

export function printGantt(workOrders: any[]) {

  const grouped: Record<string, any[]> = {};

  for (const wo of workOrders) {
    const wc = wo.data.workCenterId;

    if (!grouped[wc]) {
      grouped[wc] = [];
    }

    grouped[wc].push(wo);
  }

  for (const wc in grouped) {

    console.log("\nWork Center:", wc);

    const orders = grouped[wc].sort(
      (a, b) =>
        DateTime.fromISO(a.data.startDate).toMillis() -
        DateTime.fromISO(b.data.startDate).toMillis()
    );

    for (const wo of orders) {

      const start = DateTime.fromISO(wo.data.startDate).toFormat("HH:mm");
      const end = DateTime.fromISO(wo.data.endDate).toFormat("HH:mm");

      const duration =
        DateTime.fromISO(wo.data.endDate)
          .diff(DateTime.fromISO(wo.data.startDate), "minutes")
          .minutes;

      const blocks = Math.round(duration / 10);

      const bar = "█".repeat(blocks);

      console.log(`${start}-${end} | ${wo.data.workOrderNumber} ${bar}`);
    }
  }
}