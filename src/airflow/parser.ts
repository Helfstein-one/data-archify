import { DataGraph, DataNode, DataEdge } from '../graph/models';
import { AirflowTask } from './api';

export function parseAirflowTasks(tasks: AirflowTask[]): DataGraph {
  const nodes: DataNode[] = [];
  const edges: DataEdge[] = [];

  for (const task of tasks) {
    // Airflow task_id format often includes groups, e.g., group_name.task_name
    // We can infer the group from the prefix before the first dot.
    const parts = task.task_id.split('.');
    let group = 'default';
    let name = task.task_id;
    
    if (parts.length > 1) {
      group = parts[0];
      name = parts[parts.length - 1]; // Use just the last part as the display name
    }

    let compType = 'backend';
    let sublabel = 'operator';
    
    if (task.class_ref && task.class_ref.class_name) {
      sublabel = task.class_ref.class_name;
      const cls = sublabel.toLowerCase();
      if (cls.includes('sensor')) compType = 'external';
      else if (cls.includes('sql') || cls.includes('db')) compType = 'database';
      else if (cls.includes('http') || cls.includes('api')) compType = 'external';
    }

    nodes.push({
      id: task.task_id,
      name: name,
      type: compType,
      group: `sys-${group.replace(/[^a-zA-Z0-9]/g, '-')}`,
      description: `Task: ${task.task_id}`,
      sublabel: sublabel,
      brand: 'apache-airflow'
    });

    if (task.downstream_task_ids) {
      for (const targetId of task.downstream_task_ids) {
        edges.push({
          source: task.task_id,
          target: targetId
        });
      }
    }
  }

  return { nodes, edges };
}
