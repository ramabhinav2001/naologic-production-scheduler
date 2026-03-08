import fs from "fs";
import { ReflowService } from "./reflow/reflow.service";
import { printGantt } from "./utils/gantt";

const data = JSON.parse(
  fs.readFileSync("./src/sample-data/scenarios.json", "utf8")
);

const reflowService = new ReflowService();

for (const scenario of data.scenarios.slice(0, 3)) {

  console.log("\n=====================");
  console.log("Scenario:", scenario.name);

  const result = reflowService.reflow({
    workOrders: scenario.workOrders,
    workCenters: scenario.workCenters
  });

  console.log("\nUpdated Schedule:");
  console.table(
    result.updatedWorkOrders.map((w: any) => ({
      workOrder: w.data.workOrderNumber,
      workCenter: w.data.workCenterId,
      start: w.data.startDate,
      end: w.data.endDate
    }))
  );

  console.log("\nChanges:");
  console.table(result.changes);

  console.log("\nExplanation:");

  for (const [id, text] of Object.entries(result.explanation)) {
    console.log(`\n${id}`);
    console.log(text);
  }

  console.log("\nGantt Timeline:");
  printGantt(result.updatedWorkOrders);
}