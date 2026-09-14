import { DataGraph } from '../graph/models';

export function filterAndGroupGraph(graph: DataGraph, selectFilter?: string, group?: boolean): DataGraph {
  let filteredNodes = graph.nodes;
  let filteredEdges = graph.edges;

  if (selectFilter) {
    // For MVP, simple comma-separated node name matching.
    // In a real tool, implement full dbt selection syntax (+model+, etc.)
    const targets = selectFilter.split(',').map(s => s.trim().replace(/\+/g, ''));
    const matchedNodeIds = new Set<string>();

    // Find direct matches
    graph.nodes.forEach(n => {
      if (targets.includes(n.name) || targets.some(t => n.name.includes(t))) {
        matchedNodeIds.add(n.id);
      }
    });

    // Extremely basic neighborhood expansion for '+' syntax
    if (selectFilter.includes('+')) {
      let expanded = true;
      while (expanded) {
        expanded = false;
        graph.edges.forEach(e => {
          if (matchedNodeIds.has(e.source) && !matchedNodeIds.has(e.target)) {
            matchedNodeIds.add(e.target);
            expanded = true;
          }
          if (matchedNodeIds.has(e.target) && !matchedNodeIds.has(e.source)) {
            matchedNodeIds.add(e.source);
            expanded = true;
          }
        });
      }
    }

    filteredNodes = graph.nodes.filter(n => matchedNodeIds.has(n.id));
    filteredEdges = graph.edges.filter(e => matchedNodeIds.has(e.source) && matchedNodeIds.has(e.target));
  }

  // Grouping essentially means we can return the graph as is,
  // but we flag that Archify builder should generate groups.
  // We'll handle the grouping logically during Archify IR building.
  
  return { nodes: filteredNodes, edges: filteredEdges };
}
