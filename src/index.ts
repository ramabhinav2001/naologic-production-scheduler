import fs from "fs";
import { ReflowService } from "./reflow/reflow.service";

const data = JSON.parse(
  fs.readFileSync("./src/sample-data/scenarios.json", "utf8")
);

const reflowService = new ReflowService();

for (const scenario of data.scenarios) {

  console.log("\n=====================");
  console.log("Scenario:", scenario.name);

  const result = reflowService.reflow({
    workOrders: scenario.workOrders,
    workCenters: scenario.workCenters
  });

  console.log("Updated Schedule:");
  console.log(result.updatedWorkOrders);

  console.log("\nChanges:");
  console.log(result.changes);

  console.log("\nExplanation:");
  console.log(result.explanation);
}