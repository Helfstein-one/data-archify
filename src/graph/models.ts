export interface DataColumn {
  name: string;
  type?: string;
  description?: string;
  source_columns?: string[]; // e.g. ["source.raw.users.id"]
}

export interface DataVolumetry {
  volume_per_day?: string;    // e.g. "250 GB/day" or "15 TB/day"
  throughput?: string;        // e.g. "12,000 events/sec"
  records_per_day?: string;   // e.g. "45M records/day"
  batch_window?: string;      // e.g. "Every 15 min" or "Hourly"
  retention?: string;         // e.g. "90 days" or "7 years"
}

export interface DataCompute {
  engine?: 'glue' | 'emr' | 'databricks' | 'lambda' | 'step_functions' | 'spark' | 'dbt' | string;
  sizing?: string;            // e.g. "10x m5.2xlarge workers" or "4 DPUs (G.2X)"
  memory?: string;            // e.g. "64 GB RAM"
  rationale?: string;         // e.g. "Spark cluster selected due to 5TB daily shuffle requirement"
}

export interface DataNode {
  id: string;
  name: string;
  type: string; // Used to map to Archify component type (e.g. backend, database, external)
  group: string; // Used to map to Archify systems (TaskGroup or dbt folder)
  category?: 'DATASET' | 'PROCESS' | 'MESSAGING';
  location?: string; // database.schema.table or arn or bucket path
  description?: string;
  sublabel?: string; // e.g. schema or operator type
  metadata?: {
    sla?: string;
    slo?: string;
    criticality?: string;
    owner?: string;
  };
  volumetry?: DataVolumetry;
  compute?: DataCompute;
  columns?: DataColumn[];
  brand?: string;
}

export interface DataEdge {
  source: string;
  target: string;
}

export interface DataGraph {
  nodes: DataNode[];
  edges: DataEdge[];
}
