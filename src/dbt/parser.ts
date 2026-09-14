import { DataGraph, DataNode, DataEdge } from '../graph/models';

export function parseDbtManifest(manifest: any): DataGraph {
  const nodes: DataNode[] = [];
  const edges: DataEdge[] = [];
  
  if (manifest.nodes) {
    for (const [id, node] of Object.entries(manifest.nodes) as [string, any][]) {
      // Create Process Node
      const processId = `process_${id}`;
      nodes.push(extractNodeMetadata(processId, node, 'PROCESS'));
      
      // Create Dataset Node
      const datasetId = `dataset_${id}`;
      nodes.push(extractNodeMetadata(datasetId, node, 'DATASET'));

      // Edge from Process to Dataset
      edges.push({ source: processId, target: datasetId });
    }
  }

  if (manifest.sources) {
    for (const [id, source] of Object.entries(manifest.sources) as [string, any][]) {
      // Sources are only Datasets
      const datasetId = `dataset_${id}`;
      nodes.push(extractNodeMetadata(datasetId, source, 'DATASET'));
    }
  }

  if (manifest.parent_map) {
    for (const [childId, parentIds] of Object.entries(manifest.parent_map) as [string, string[]][]) {
      for (const parentId of parentIds) {
        // Parent is a dataset. Child is a process (if child is a model)
        // Check if child exists as a process
        const processChildId = `process_${childId}`;
        const datasetParentId = `dataset_${parentId}`;
        
        // Only link if child is a node (has a process). Otherwise, if it's some other thing, skip.
        edges.push({
          source: datasetParentId,
          target: processChildId
        });
      }
    }
  }

  return { nodes, edges };
}

function extractNodeMetadata(id: string, item: any, category: 'PROCESS' | 'DATASET'): DataNode {
  let folder = 'default';
  if (item.original_file_path) {
    const parts = item.original_file_path.split('/');
    if (parts.length > 1) {
      folder = parts[parts.length - 2];
    }
  }

  let compType = category === 'PROCESS' ? 'backend' : 'database';
  if (category === 'DATASET' && item.resource_type === 'source') {
    compType = 'external';
  }

  const metadata: any = {};
  if (item.meta) {
    if (item.meta.sla) metadata.sla = item.meta.sla;
    if (item.meta.slo) metadata.slo = item.meta.slo;
    if (item.meta.criticality) metadata.criticality = item.meta.criticality;
    if (item.meta.owner) metadata.owner = item.meta.owner;
  }

  const columns = [];
  if (item.columns) {
    for (const [colName, colData] of Object.entries(item.columns) as [string, any][]) {
      // Mock parsing column lineage if it existed in meta
      const sourceCols = colData.meta?.source_columns || [];
      columns.push({
        name: colName,
        type: colData.data_type || colData.type,
        description: colData.description,
        source_columns: sourceCols.length > 0 ? sourceCols : undefined
      });
    }
  }

  const db = item.database || 'default';
  const schema = item.schema || 'public';
  const table = item.identifier || item.name;
  const location = `${db}.${schema}.${table}`;

  const displayName = category === 'PROCESS' ? `SQL: ${item.name}` : item.name;
  const sublabel = category === 'PROCESS' ? 'Transformation' : item.schema || 'unknown';

  const brand = category === 'PROCESS' ? 'dbt' : 'snowflake';

  return {
    id: id,
    name: displayName,
    type: compType,
    group: `sys-${folder.replace(/[^a-zA-Z0-9]/g, '-')}`,
    category: category,
    location: location,
    description: item.description || '',
    sublabel: sublabel,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    columns: columns.length > 0 ? columns : undefined,
    brand: brand
  };
}
