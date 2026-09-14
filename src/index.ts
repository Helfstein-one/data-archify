import { Command } from 'commander';
import { parseDbtManifest } from './dbt/parser';
import { filterAndGroupGraph } from './dbt/graph';
import { buildArchifyIr } from './archify/builder';
import { runArchify } from './archify/runner';
import { fetchAirflowTasks } from './airflow/api';
import { parseAirflowTasks } from './airflow/parser';
import { generateMarkdownReport } from './report/generator';
import { injectInteractivePortal } from './portal/injector';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('data-archify')
  .description('Generate architecture and lineage diagrams from data engineering artifacts')
  .version('1.0.0');

program
  .command('dbt')
  .description('Generate Archify diagrams from a dbt manifest.json')
  .requiredOption('-m, --manifest <path>', 'Path to the dbt manifest.json file')
  .requiredOption('-o, --out <path>', 'Path to output the generated HTML diagram')
  .option('-s, --select <models>', 'Filter models (e.g. `+my_model+` or comma-separated names)')
  .option('-g, --group', 'Group models by their tags or folders', false)
  .action(async (options) => {
    console.log(`Reading dbt manifest from ${options.manifest}...`);
    try {
      const manifestPath = path.resolve(process.cwd(), options.manifest);
      if (!fs.existsSync(manifestPath)) {
        console.error(`Manifest file not found: ${manifestPath}`);
        process.exit(1);
      }

      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      console.log('Parsing manifest...');
      const graph = parseDbtManifest(manifestContent);
      
      console.log(`Original graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
      
      const processedGraph = filterAndGroupGraph(graph, options.select, options.group);
      console.log(`Processed graph: ${processedGraph.nodes.length} nodes, ${processedGraph.edges.length} edges`);
      
      const archifyIr = buildArchifyIr(processedGraph);
      
      console.log('Running Archify renderer...');
      await runArchify(archifyIr, options.out);
      console.log(`Base diagram generated successfully at ${options.out}`);

      console.log('Injecting Interactive Portal overlay...');
      injectInteractivePortal(processedGraph, options.out);
      console.log(`Interactive Single Page App ready at ${options.out}`);

      const reportPath = options.out.replace(/\.[^/.]+$/, "") + "_contracts.md";
      generateMarkdownReport(processedGraph, reportPath);
      console.log(`Data Contracts report generated at ${reportPath}`);
    } catch (err) {
      console.error('Error generating diagram:', err);
      process.exit(1);
    }
  });

program
  .command('airflow')
  .description('Generate Archify diagrams from an Airflow REST API')
  .requiredOption('-u, --url <url>', 'Airflow API Base URL (e.g., http://localhost:8080)')
  .requiredOption('-d, --dag <id>', 'DAG ID to fetch')
  .requiredOption('-o, --out <path>', 'Path to output the generated HTML diagram')
  .action(async (options) => {
    console.log(`Fetching DAG ${options.dag} from ${options.url}...`);
    try {
      const username = process.env.AIRFLOW_USERNAME;
      const password = process.env.AIRFLOW_PASSWORD;
      
      const tasks = await fetchAirflowTasks(options.url, options.dag, username, password);
      console.log(`Fetched ${tasks.length} tasks from Airflow.`);
      
      const graph = parseAirflowTasks(tasks);
      console.log(`Parsed graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
      
      const archifyIr = buildArchifyIr(graph);
      
      console.log('Running Archify renderer...');
      await runArchify(archifyIr, options.out);
      
      console.log(`Diagram generated successfully at ${options.out}`);
    } catch (err) {
      console.error('Error generating Airflow diagram:', err);
      process.exit(1);
    }
  });

import { parseTerraformState } from './terraform/parser';

program
  .command('terraform')
  .description('Generate Archify diagrams from a terraform.tfstate file')
  .requiredOption('-s, --state <path>', 'Path to the terraform.tfstate file')
  .requiredOption('-o, --out <path>', 'Path to output the generated HTML diagram')
  .action(async (options) => {
    console.log(`Reading Terraform state from ${options.state}...`);
    try {
      const statePath = path.resolve(process.cwd(), options.state);
      if (!fs.existsSync(statePath)) {
        console.error(`State file not found: ${statePath}`);
        process.exit(1);
      }

      const stateContent = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      
      console.log('Parsing Terraform state...');
      const graph = parseTerraformState(stateContent);
      
      console.log(`Parsed graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
      
      const archifyIr = buildArchifyIr(graph);
      
      console.log('Running Archify renderer...');
      await runArchify(archifyIr, options.out);
      
      console.log('Injecting Interactive Portal overlay...');
      injectInteractivePortal(graph, options.out);
      console.log(`Interactive Single Page App ready at ${options.out}`);

      const reportPath = options.out.replace(/\.[^/.]+$/, "") + "_contracts.md";
      generateMarkdownReport(graph, reportPath);
      console.log(`Data Contracts report generated at ${reportPath}`);
    } catch (err) {
      console.error('Error generating Terraform diagram:', err);
      process.exit(1);
    }
  });

program
  .command('render')
  .description('Render an architecture diagram from a template or DataGraph JSON file')
  .requiredOption('-i, --input <path>', 'Path to the template/DataGraph JSON file')
  .requiredOption('-o, --out <path>', 'Path to output the generated HTML diagram')
  .action(async (options) => {
    console.log(`Reading architecture definition from ${options.input}...`);
    try {
      const inputPath = path.resolve(process.cwd(), options.input);
      if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        process.exit(1);
      }

      const graph = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      console.log(`Loaded graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
      
      const archifyIr = buildArchifyIr(graph);
      
      console.log('Running Archify renderer...');
      await runArchify(archifyIr, options.out);
      
      console.log('Injecting Interactive Portal overlay...');
      injectInteractivePortal(graph, options.out);
      console.log(`Interactive Single Page App ready at ${options.out}`);

      const reportPath = options.out.replace(/\.[^/.]+$/, "") + "_contracts.md";
      generateMarkdownReport(graph, reportPath);
      console.log(`Data Contracts report generated at ${reportPath}`);
    } catch (err) {
      console.error('Error rendering architecture:', err);
      process.exit(1);
    }
  });

program.parse(process.argv);

