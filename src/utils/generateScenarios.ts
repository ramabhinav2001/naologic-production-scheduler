import fs from "fs";

const requested = process.argv[2];
const NUM_SCENARIOS = requested ? parseInt(requested) : 10;

function randomDuration() {
  const options = [60, 120, 180, 240];
  return options[Math.floor(Math.random() * options.length)];
}

function generateScenario(index: number) {
  const wcId = `wc-gen-${index}`;

  return {
    name: `Generated Scenario ${index}`,

    workCenters: [
      {
        docId: wcId,
        docType: "workCenter",
        data: {
          name: `Extrusion Line Generated ${index}`,
          shifts: [
            { dayOfWeek: 1, startHour: 8, endHour: 17 },
            { dayOfWeek: 2, startHour: 8, endHour: 17 },
            { dayOfWeek: 3, startHour: 8, endHour: 17 },
            { dayOfWeek: 4, startHour: 8, endHour: 17 },
            { dayOfWeek: 5, startHour: 8, endHour: 17 }
          ],
          maintenanceWindows:
            Math.random() < 0.3
              ? [
                  {
                    startDate: "2026-03-09T12:00:00Z",
                    endDate: "2026-03-09T14:00:00Z",
                    reason: "Scheduled maintenance"
                  }
                ]
              : []
        }
      }
    ],

    workOrders: [
      {
        docId: `wo${index}-A`,
        docType: "workOrder",
        data: {
          workOrderNumber: `WO-${index}-A`,
          manufacturingOrderId: `mo${index}`,
          workCenterId: wcId,
          startDate: "2026-03-09T08:00:00Z",
          endDate: "2026-03-09T10:00:00Z",
          durationMinutes: 240, // forces schedule changes
          isMaintenance: false,
          dependsOnWorkOrderIds: []
        }
      },
      {
        docId: `wo${index}-B`,
        docType: "workOrder",
        data: {
          workOrderNumber: `WO-${index}-B`,
          manufacturingOrderId: `mo${index}`,
          workCenterId: wcId,
          startDate: "2026-03-09T10:00:00Z",
          endDate: "2026-03-09T12:00:00Z",
          durationMinutes: randomDuration(),
          isMaintenance: false,
          dependsOnWorkOrderIds: [`wo${index}-A`]
        }
      },
      {
        docId: `wo${index}-C`,
        docType: "workOrder",
        data: {
          workOrderNumber: `WO-${index}-C`,
          manufacturingOrderId: `mo${index}`,
          workCenterId: wcId,
          startDate: "2026-03-09T12:00:00Z",
          endDate: "2026-03-09T15:00:00Z",
          durationMinutes: randomDuration(),
          isMaintenance: false,
          dependsOnWorkOrderIds: [`wo${index}-B`]
        }
      }
    ]
  };
}

// read existing scenarios
const existing = JSON.parse(
  fs.readFileSync("./src/sample-data/scenarios.json", "utf8")
);

// keep original 3 scenarios
const baseScenarios = existing.scenarios.slice(0, 3);

const scenarios = [...baseScenarios];

// generate new ones
for (let i = 1; i <= NUM_SCENARIOS; i++) {
  scenarios.push(generateScenario(i));
}

const output = { scenarios };

fs.writeFileSync(
  "./src/sample-data/scenarios.json",
  JSON.stringify(output, null, 2)
);

console.log(`Generated ${NUM_SCENARIOS} scenarios`);