import { DataGraph } from '../graph/models';

export function buildArchifyIr(graph: DataGraph): any {
  // 1. Calculate topological depth (row) using BFS
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    adj.get(edge.source)?.push(edge.target);
  }

  const nodeDepths = new Map<string, number>();
  let queue: string[] = [];

  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
      nodeDepths.set(id, 0);
    }
  }

  let depth = 0;
  while (queue.length > 0) {
    const nextQueue: string[] = [];
    for (const u of queue) {
      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        const nextDepth = depth + 1;
        if (!nodeDepths.has(v) || nextDepth > nodeDepths.get(v)!) {
          nodeDepths.set(v, nextDepth);
        }
        nextQueue.push(v);
      }
    }
    queue = nextQueue;
    depth++;
    // Avoid infinite loop if there are cycles
    if (depth > graph.nodes.length + 5) break;
  }

  // Fallback for stranded / cyclic nodes
  for (const node of graph.nodes) {
    if (!nodeDepths.has(node.id)) {
      nodeDepths.set(node.id, 0);
    }
  }

  // Group by depth to assign cols
  const depthCounts = new Map<number, number>();
  const nodePositions = new Map<string, { row: number; col: number }>();

  const components = graph.nodes.map(node => {
    let r = nodeDepths.get(node.id) || 0;
    let c = depthCounts.get(r) || 0;
    if ((node as any).row !== undefined) {
      r = (node as any).row;
    }
    if ((node as any).col !== undefined) {
      c = (node as any).col;
    } else {
      c = depthCounts.get(r) || 0;
      depthCounts.set(r, c + 1);
    }
    nodePositions.set(node.id, { row: r, col: c });

    let sublabel = node.sublabel || '';

    const validTypes = new Set(['frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external']);
    const compType = validTypes.has(node.type) ? node.type : 'database';

    const comp: any = {
      id: node.id.replace(/[^a-zA-Z0-9_-]/g, '_'),
      type: compType,
      label: node.name,
      sublabel: sublabel,
      tag: node.group,
      size: [240, 64],
      row: r,
      col: c
    };

    if (node.brand) {
      comp.brand = node.brand;
    }

    return comp;
  });

  const connections = graph.edges.map(edge => {
    const targetNode = graph.nodes.find(n => n.id === edge.target);
    const sourcePos = nodePositions.get(edge.source) || { row: 0, col: 0 };
    const targetPos = nodePositions.get(edge.target) || { row: 0, col: 0 };

    let edgeLabel = '';
    if (targetNode?.metadata?.sla) {
      edgeLabel = `SLA: ${targetNode.metadata.sla}`;
    }

    const sourceSanitized = edge.source.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetSanitized = edge.target.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Truthful side determination
    let fromSide = 'bottom';
    let toSide = 'top';

    if (targetPos.row === sourcePos.row) {
      if (targetPos.col > sourcePos.col) {
        fromSide = 'right';
        toSide = 'left';
      } else {
        fromSide = 'left';
        toSide = 'right';
      }
    } else if (targetPos.row > sourcePos.row) {
      if (targetPos.col > sourcePos.col) {
        fromSide = 'right';
        toSide = 'top';
      } else if (targetPos.col < sourcePos.col) {
        fromSide = 'left';
        toSide = 'top';
      } else {
        fromSide = 'bottom';
        toSide = 'top';
      }
    } else {
      if (targetPos.col > sourcePos.col) {
        fromSide = 'right';
        toSide = 'bottom';
      } else if (targetPos.col < sourcePos.col) {
        fromSide = 'left';
        toSide = 'bottom';
      } else {
        fromSide = 'top';
        toSide = 'bottom';
      }
    }

    const conn: any = {
      id: `c-${sourceSanitized}-${targetSanitized}`,
      from: sourceSanitized,
      to: targetSanitized,
      fromSide: fromSide,
      toSide: toSide
    };

    return conn;
  });

  const maxCol = Math.max(...components.map((c: any) => c.col), 0);

  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: {
      title: 'Data Architecture Lineage',
      visual_preset: 'classic'
    },
    layout: {
      mode: 'grid',
      cols: maxCol + 1,
      gapX: 60,
      gapY: 70,
      cellW: 240,
      cellH: 74
    },
    components,
    connections
  };
}
