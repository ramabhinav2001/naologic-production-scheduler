export class CycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CycleError";
  }
}

export function topoSortOrThrow(
  nodes: string[],
  edges: Array<[string, string]>
): string[] {

  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const n of nodes) {
    indegree.set(n, 0);
    adjacency.set(n, []);
  }

  for (const [from, to] of edges) {

    adjacency.get(from)!.push(to);

    indegree.set(
      to,
      (indegree.get(to) ?? 0) + 1
    );
  }

  const queue: string[] = [];

  for (const [node, deg] of indegree.entries()) {
    if (deg === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {

    const node = queue.shift()!;

    result.push(node);

    for (const neighbor of adjacency.get(node)!) {

      indegree.set(
        neighbor,
        indegree.get(neighbor)! - 1
      );

      if (indegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If topo sort didn't process all nodes → cycle exists
  if (result.length !== nodes.length) {

    const remaining = nodes.filter(
      n => !result.includes(n)
    );

    throw new CycleError(
      `Circular dependency detected among work orders: ${remaining.join(" → ")}`
    );
  }

  return result;
}