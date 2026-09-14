import { DataGraph, DataNode, DataEdge } from '../graph/models';

const DATA_RESOURCES = new Set([
  // Storage & Tables
  'aws_s3_bucket',
  'aws_glue_catalog_table',
  'aws_glue_catalog_database',
  'aws_dynamodb_table',
  'aws_db_instance',
  'aws_rds_cluster',
  
  // Compute & Processing
  'aws_glue_job',
  'aws_emr_cluster',
  'aws_lambda_function',
  'aws_sfn_state_machine',
  'databricks_cluster',
  'databricks_sql_endpoint',
  'databricks_pipeline',
  'databricks_job',
  
  // Messaging & Streaming
  'aws_sns_topic',
  'aws_sqs_queue',
  'aws_kinesis_stream',
  'aws_msk_cluster'
]);

export function parseTerraformState(tfstate: any): DataGraph {
  const nodes: DataNode[] = [];
  const edges: DataEdge[] = [];
  const includedResourceAddresses = new Set<string>();

  if (!tfstate.resources || !Array.isArray(tfstate.resources)) {
    return { nodes, edges };
  }

  // First pass: create nodes
  for (const resource of tfstate.resources) {
    if (resource.mode !== 'managed') continue;
    
    // Only include data resources to avoid IAM/networking clutter
    if (!DATA_RESOURCES.has(resource.type)) {
      continue;
    }

    const modulePrefix = resource.module ? `${resource.module}.` : '';
    const address = `${modulePrefix}${resource.type}.${resource.name}`;
    includedResourceAddresses.add(address);

    let compType = 'cloud';
    let category: 'DATASET' | 'PROCESS' | 'MESSAGING' = 'DATASET';

    if (resource.type.includes('sns') || resource.type.includes('sqs') || resource.type.includes('kinesis') || resource.type.includes('msk')) {
      compType = 'messagebus';
      category = 'MESSAGING';
    } else if (resource.type.includes('s3') || resource.type.includes('table') || resource.type.includes('db')) {
      compType = 'database';
      category = 'DATASET';
    } else if (resource.type.includes('lambda') || resource.type.includes('emr') || resource.type.includes('databricks') || resource.type.includes('glue_job') || resource.type.includes('sfn')) {
      compType = 'backend';
      category = 'PROCESS';
    }

    let group = 'root';
    if (resource.module) {
      group = resource.module;
    }

    // Inspect instance attributes for compute / location
    const firstInstance = resource.instances && resource.instances[0] ? resource.instances[0].attributes : {};
    const location = firstInstance?.arn || firstInstance?.bucket || firstInstance?.name || address;
    
    // Extract compute sizing if available
    let computeInfo: any = undefined;
    if (category === 'PROCESS') {
      let sizing = firstInstance?.worker_type 
        ? `${firstInstance.number_of_workers || ''}x ${firstInstance.worker_type}` 
        : firstInstance?.instance_type || firstInstance?.node_type_id || 'Serverless Execution';
      computeInfo = {
        engine: resource.type.split('_')[1] || resource.type,
        sizing: sizing,
        rationale: `Managed ${resource.type} provisioned via Terraform`
      };
    }

    // Map resource type to brand mark
    let brand: string | undefined = undefined;
    if (resource.type.startsWith('aws_s3')) brand = 'aws-s3';
    else if (resource.type.startsWith('aws_lambda')) brand = 'aws-lambda';
    else if (resource.type.startsWith('aws_glue')) brand = 'aws-glue';
    else if (resource.type.startsWith('aws_emr')) brand = 'aws-emr';
    else if (resource.type.startsWith('aws_sns')) brand = 'aws-sns';
    else if (resource.type.startsWith('aws_sqs')) brand = 'aws-sqs';
    else if (resource.type.startsWith('aws_kinesis')) brand = 'aws-kinesis';
    else if (resource.type.startsWith('aws_msk')) brand = 'apache-kafka';
    else if (resource.type.startsWith('aws_sfn')) brand = 'aws-step-functions';
    else if (resource.type.startsWith('databricks')) brand = 'databricks';
    else if (resource.type.includes('db') || resource.type.includes('rds')) brand = 'postgresql';

    nodes.push({
      id: address,
      name: resource.name,
      type: compType,
      category: category,
      location: location,
      group: `sys-${group.replace(/[^a-zA-Z0-9]/g, '-')}`,
      description: `Terraform: ${resource.type}`,
      sublabel: resource.type,
      compute: computeInfo,
      brand: brand
    });
  }

  // Second pass: extract edges from dependencies
  for (const resource of tfstate.resources) {
    if (resource.mode !== 'managed') continue;
    const modulePrefix = resource.module ? `${resource.module}.` : '';
    const sourceAddress = `${modulePrefix}${resource.type}.${resource.name}`;

    // Only map edges if the source node is included in our graph
    if (!includedResourceAddresses.has(sourceAddress)) continue;

    if (resource.instances && Array.isArray(resource.instances)) {
      for (const instance of resource.instances) {
        if (instance.dependencies && Array.isArray(instance.dependencies)) {
          for (const dep of instance.dependencies) {
            if (includedResourceAddresses.has(dep)) {
              edges.push({
                source: dep,
                target: sourceAddress
              });
            }
          }
        }
      }
    }
  }

  // Deduplicate edges
  const uniqueEdges = new Map<string, DataEdge>();
  for (const e of edges) {
    const key = `${e.source}->${e.target}`;
    if (!uniqueEdges.has(key)) {
      uniqueEdges.set(key, e);
    }
  }

  return { nodes, edges: Array.from(uniqueEdges.values()) };
}
