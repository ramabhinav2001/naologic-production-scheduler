# Edge Case Analysis

## Prompt Used

What edge cases should a manufacturing scheduling system handle when recalculating production schedules?

## AI-Assisted Discussion

Several important edge cases were identified:

### 1. Circular Dependencies

Example:

WO-A depends on WO-B  
WO-B depends on WO-A

This creates an impossible schedule.

Solution:
Cycle detection during topological sorting.

### 2. Work Center Conflicts

Multiple jobs scheduled on the same machine must not overlap.

Solution:
Track the completion time of the previous job on each work center.

### 3. Maintenance Windows

Production must stop during maintenance.

Solution:
Skip blocked time periods during scheduling.

### 4. Shift Boundaries

Jobs cannot run outside shift hours.

Solution:
Pause work when a shift ends and resume at the next shift.

These cases were handled through constraint checks and scheduling logic. 