# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-14

### Added

#### 🚀 Multi-Ecosystem Parsers & Ingestion Engine
- **dbt Bipartite Graph Parser (`src/dbt/parser.ts`, `src/dbt/graph.ts`)**:
  - Ingests dbt `manifest.json` artifacts.
  - Automatically splits models into Bipartite Transformation Graphs: `[Upstream Dataset] ➔ [SQL Transformation Process] ➔ [Target Dataset]`.
  - Supports model filtering via `--select` (e.g. tags, directories, specific models).
  - Extracts full column catalogs, data types, descriptions, data tests, and tags.
- **Apache Airflow REST API Ingestion (`src/airflow/api.ts`, `src/airflow/parser.ts`)**:
  - Connects to Airflow REST API endpoints (`/api/v1/dags/{dag_id}/tasks`).
  - Supports basic authentication (`AIRFLOW_USERNAME`, `AIRFLOW_PASSWORD`).
  - Maps upstream/downstream task dependencies, task instances, and hierarchical TaskGroups.
- **Terraform Infrastructure Scanner (`src/terraform/parser.ts`)**:
  - Scans and parses local `.tfstate` files.
  - Detects data and messaging cloud resources: AWS S3, AWS Glue, Amazon EMR, AWS Lambda, Amazon SNS, Amazon SQS, Aurora PostgreSQL, Databricks, and Snowflake.
  - Infers module boundaries, resource types, and dependency graphs.
- **Topological Layout Engine (`src/archify/builder.ts`, `src/archify/runner.ts`)**:
  - Implements Breadth-First Search (BFS) rank clustering and DAG topological sorting to guarantee clean directional left-to-right flow without crossing edges.

#### 📜 Data Contracts & Column-Level Lineage
- **Interactive Semantic Passport (`src/portal/injector.ts`)**:
  - Dynamic DOM injector augmenting Archify's Semantic Passport with dedicated Data Contract sections.
  - Interactive drill-down displaying Table Name, Physical Schema, SLA/SLO (Freshness & Latency), Criticality tiers (P0/P1/P2), and Data Ownership.
  - Full column schema table with column names, types, descriptions, constraints, and column-level upstream lineage (`source_columns`).
- **Data Contract Governance Reports (`src/report/generator.ts`)**:
  - Automatically generates accompanying Markdown contract reports (`<output>_contracts.md`) alongside HTML diagrams.
  - Provides tabular summaries of schemas, constraints, and lineage for auditing, compliance, and governance workflows.

#### ⚙️ Compute Sizing & Volumetry Modeling
- **Compute Sizing Cards (`src/graph/models.ts`)**:
  - Dedicated hardware specification modeling for compute engines: AWS Glue (DPUs, worker types), Amazon EMR (master/core instance types, total RAM, Spark version), Databricks (Photon engine, DLT pipelines, runtime version), and AWS Lambda (allocated memory, concurrent executions).
  - Contextual architectural rationale embedded directly into node inspector cards.
- **Volumetry & Operational Metrics**:
  - Ingestion badges showing real-time event throughput (e.g. `15,000 msgs/sec`), daily batch volumes (e.g. `12 TB/day`), message retention policies, and compaction cycles.

#### 🎨 Official 2026 Cloud Brand Marks
- **AWS 2026 & Databricks SVG Badges (`vendor/archify/renderers/shared/generated-brand-marks.mjs`)**:
  - Embedded official AWS 2026 architecture brand marks: Amazon S3, AWS Glue, Amazon EMR, AWS Lambda, Amazon SNS, Amazon SQS, Amazon API Gateway, AWS Secrets Manager, Amazon Aurora PostgreSQL, and Amazon SES.
  - Embedded official Databricks and dbt brand icons with crisp vector scaling across light and dark canvas modes.

#### 📁 Reference Architecture Templates (`templates/`)
- **`01-event-driven-ingestion.json`**: Real-time streaming journey (Webhook ➔ SNS ➔ SQS FIFO ➔ SQS DLQ ➔ Lambda ➔ S3 Bronze).
- **`02-heavy-processing-lakehouse.json`**: Big data batch processing pipeline (S3 Bronze ➔ Glue Compactor ➔ Apache Iceberg ➔ EMR Spark 2TB RAM ➔ Databricks Photon ➔ Gold Marts).
- **`03-medallion-lakehouse-orchestrated.json`**: Governed Medallion architecture (Airflow MWAA ➔ Bronze Iceberg ➔ dbt Silver Cleansing ➔ dbt Gold Marts with column lineage).
- **`04-enterprise-full-platform.json`**: Complete 17-node, 9-tier enterprise stack covering Front-end, API, Backend Services, Relational DB, Messaging, Storage Lakehouse, Batch Compute, Query Engine, Orchestration, Cloud DW, Observability, and Notifications.
- **`05-enterprise-tree-platform.json`**: Multi-layer, non-linear Tree Architecture (25 nodes & 24 directed edges across 9 tiers) featuring 3 parallel ingestion trunks (CDC, Clickstream, SaaS), S3 Bronze / Iceberg Silver storage hub, and 3 parallel consumption branches (Analytics DW, ML Feature Store, Reverse ETL).

#### 🎬 Documentation & Media Assets
- **7 Animated High-Fidelity GIFs (`docs/assets/`)**:
  - `cli-demo.gif`: CLI compilation and artifact bundling.
  - `portal-medallion.gif`: Medallion Lakehouse with column lineage drill-down.
  - `portal-event-driven.gif`: Real-time streaming with volumetry and DLQ inspection.
  - `portal-heavy-processing.gif`: Heavy batch processing with EMR/Glue compute sizing.
  - `portal-dbt-lineage.gif`: dbt bipartite graph transformation walkthrough.
  - `portal-enterprise-platform.gif`: Multi-tier enterprise platform overview.
  - `portal-enterprise-tree.gif`: Non-linear Enterprise Tree Architecture walkthrough across all 25 nodes and 3 fan-in / fan-out branches.
- **Complete Journey Walkthrough Video (`video/data-archify-complete-journey.webm`)**:
  - 1280x720 30fps VP9 recording capturing the complete user journey:
    - CLI execution and blueprint compilation.
    - Presentation Stage entry and `Exit` control.
    - `PATH` topological route analysis between components.
    - `MAP` radar mini-map toggling and coordinate tracking.
    - `LENS` semantic filtering across operational tiers.
    - `Finder 🔍` component search with live highlight.
    - Zoom and canvas navigation.
    - Deep-dive into Data Contracts and Column-Level Lineage.
