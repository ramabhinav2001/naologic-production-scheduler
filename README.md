# Production Schedule Reflow System

## Overview

This project implements a **production schedule reflow algorithm** for a manufacturing facility. When disruptions occur (such as delays or maintenance), the system recalculates the schedule while respecting operational constraints.

The algorithm ensures a **valid schedule** that satisfies:

* Work order dependencies
* Work center capacity (no overlaps)
* Shift boundaries
* Maintenance windows

The system outputs:

* Updated schedule
* Change summary
* Explanation of why work orders moved

---

## Problem

Manufacturing facilities run multiple machines (work centers). Work orders must be scheduled on these machines while respecting several constraints.

### Constraints

1. **Dependencies**

   * A work order may depend on multiple parent orders.
   * A child order cannot start until all parents finish.

2. **Work Center Conflicts**

   * Only one work order can run on a work center at a time.

3. **Shift Boundaries**

   * Work can only occur during defined shift hours.
   * If work extends beyond the shift, it pauses and resumes next shift.

4. **Maintenance Windows**

   * Machines may have scheduled maintenance periods.
   * No work can occur during maintenance.

5. **Maintenance Work Orders**

   * Some work orders represent maintenance tasks.
   * These cannot be rescheduled.

---

## Algorithm Approach

The scheduler uses a **Directed Acyclic Graph (DAG)** approach with **topological sorting**.

### Step 1 — Build Dependency Graph

Each work order is treated as a node.

Edges represent:

Parent Work Order → Child Work Order

Example:

WO-A → WO-B → WO-C

---

### Step 2 — Preserve Work Center Order

To prevent work center conflicts, edges are also added between jobs scheduled on the same work center so that they remain sequential.

Example:

WO-A → WO-B

---

### Step 3 — Topological Sort

A **topological sort** is performed on the DAG to determine execution order.

This guarantees:

* Dependencies are respected
* Circular dependencies are detected

If a cycle is found, the algorithm throws an error.

---

### Step 4 — Greedy Scheduling

Work orders are scheduled in topological order.

The earliest possible start time is determined by:

max(
parent completion time,
previous job on work center,
original start time
)

---

### Step 5 — Shift & Maintenance Handling

Scheduling respects:

* Shift hours
* Maintenance windows

Work pauses and resumes if it reaches:

* shift end
* maintenance period

---

## Output

The system returns:

### Updated Schedule

`updatedWorkOrders`

### Changes

`changes`

Shows:

* old start/end
* new start/end
* delay
* reasons

### Explanation

Human‑readable explanation for each change.

Example:

WO WO-B moved: start +120 min, end +120 min.

Reasons:

* Its work center was busy with a prior work order.
* It waited for one or more parent work orders to complete.

---

## Project Structure

```
src/
├── index.ts
│
├── reflow/
│   ├── reflow.service.ts
│   ├── dag.ts
│   ├── constraint-checker.ts
│   └── types.ts
│
└── utils/
    └── date-utils.ts

sample-data/
└── scenarios.json
```

---

## Sample Scenarios

The project includes **three scheduling scenarios**.

### 1. Delay Cascade

A work order runs longer than expected and causes downstream jobs to shift.

Example:

WO-A delayed → WO-B delayed → WO-C delayed

### 2. Maintenance Window

A machine has a maintenance window that blocks production.

The scheduler moves work orders to avoid the blocked time.

### 3. Dependency Chain

Multiple work orders depend on previous steps in the manufacturing process.

The scheduler ensures:

Parent completes → Child starts

---

## How to Run

### Install Dependencies

```
npm install
```

### Run Scheduler

```
npm run dev
```

---

## Expected Output

Example output:

Scenario: Delay Cascade

Updated Schedule:
WO-A 08:00 → 12:00
WO-B 12:00 → 14:00
WO-C 14:00 → 17:00

Changes:
WO-B delayed due to dependency and work center conflict

---

## Metrics

The scheduler tracks:

* total delay introduced
* number of work orders moved

Example:

```
metrics:
{
  totalDelayMinutes: 240,
  movedCount: 2
}
```

---

## Bonus Features Implemented

### DAG Scheduling

* Topological sort
* Cycle detection

Example error:

Circular dependency detected: WO-A → WO-B → WO-A

### Optimization Metrics

Tracks:

* totalDelayMinutes
* movedCount

---

## Possible Future Improvements

* Work center utilization metrics
* Setup time handling
* Optimization to minimize total delay
* Automated test suite
* Visualization (Gantt chart)

---

## Technologies Used

* TypeScript
* Node.js
* Luxon (date/time calculations)

---

## Conclusion

This system demonstrates a production scheduling algorithm capable of handling real‑world manufacturing constraints while generating a valid schedule and clear explanations for scheduling changes.
