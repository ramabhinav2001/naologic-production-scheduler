# Algorithm Design Using AI

## Prompt Used

Design a scheduling algorithm that reschedules manufacturing work orders when disruptions occur. The algorithm must respect:

- work order dependencies
- work center conflicts
- shift schedules
- maintenance windows

The output should be a valid schedule with updated start and end times.

## AI-Assisted Ideas

The AI suggested modeling the scheduling problem as a **Directed Acyclic Graph (DAG)** where:

- Each work order is represented as a node
- Dependencies are represented as edges

Using **topological sorting**, we can process work orders in dependency-safe order.

## Final Implementation

The final implementation uses:

1. DAG construction from work order dependencies
2. Additional edges to preserve work center execution order
3. Topological sorting to determine scheduling order
4. Greedy scheduling respecting constraints

This approach ensures all dependencies are satisfied and no circular scheduling occurs.