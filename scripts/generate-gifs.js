const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const GIFEncoder = require('gif-encoder-2');
const { PNG } = require('pngjs');

/* ─── helpers ──────────────────────────────────────────────────── */

function pngToRgba(pngBuffer) {
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(pngBuffer, (err, data) => {
      if (err) return reject(err);
      resolve({ width: data.width, height: data.height, data: data.data });
    });
  });
}

async function recordChromeInteraction({ url, actions, outputPath, width = 1100, height = 680, delay = 1200 }) {
  console.log(`\n🎬 Recording ${path.basename(outputPath)}...`);
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9330 + Math.floor(Math.random() * 50);
  const userDataDir = `/tmp/chrome-gif-${Date.now()}`;

  const chrome = spawn(chromePath, [
    '--headless',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-sandbox',
    `--window-size=${width},${height}`,
    url
  ]);

  let tabs = null;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
      tabs = await listRes.json();
      if (Array.isArray(tabs) && tabs.length > 0) break;
    } catch (_) {}
  }

  if (!tabs) { chrome.kill(); throw new Error('Chrome connection failed'); }

  try {
    const pageTab = tabs.find(t => t.url.includes(path.basename(url)) || t.type === 'page');
    if (!pageTab) throw new Error('Tab not found');

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise(res => ws.onopen = res);

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const id = msgId++;
        const handler = (e) => {
          const d = JSON.parse(e.data);
          if (d.id === id) { ws.removeEventListener('message', handler); resolve(d.result); }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

    const frames = [];
    async function captureFrame() {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const raw = Buffer.from(shot.data, 'base64');
      const rgba = await pngToRgba(raw);
      frames.push(rgba);
    }

    for (const action of actions) {
      if (action.eval) {
        await send('Runtime.evaluate', { expression: action.eval });
      }
      await new Promise(r => setTimeout(r, action.wait || 500));
      await captureFrame();
    }

    ws.close();

    console.log(`  Encoding ${frames.length} frames → ${outputPath}`);
    const encoder = new GIFEncoder(width, height, 'neuquant', true);
    encoder.setDelay(delay);
    encoder.setRepeat(0);
    encoder.start();
    for (const frame of frames) encoder.addFrame(frame.data);
    encoder.finish();

    const gifBuffer = encoder.out.getData();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, gifBuffer);
    console.log(`  ✅ ${path.basename(outputPath)} — ${Math.round(gifBuffer.length / 1024)} KB, ${frames.length} frames`);

  } finally {
    chrome.kill();
  }
}

/* ─── action helpers ───────────────────────────────────────────── */

function resetView() {
  return {
    eval: `(() => {
      if (window.Archify && Archify.focus) Archify.focus.clear();
      if (window.Archify && Archify.view) Archify.view.reset();
    })()`,
    wait: 1000
  };
}

function focusNode(nodeId, wait = 1200) {
  return {
    eval: `(() => {
      if (window.Archify && Archify.focus) Archify.focus.set('${nodeId}', { toggle: false });
      if (window.Archify && Archify.view) Archify.view.reveal(['${nodeId}'], { includeNeighbors: true });
    })()`,
    wait
  };
}

function scrollPassport(scrollTop = 80) {
  return {
    eval: `(() => {
      const wrap = document.querySelector('.da-table-wrap');
      if (wrap) wrap.scrollTop = ${scrollTop};
    })()`,
    wait: 800
  };
}

/* ================================================================
   1. CLI DEMO GIF — Terminal mock showing CLI commands
   ================================================================ */

async function generateTerminalGif() {
  const terminalHtmlPath = path.resolve(__dirname, 'terminal_mock.html');

  const html = `<!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        margin: 0; background: #0d1117;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        color: #c9d1d9;
        display: flex; justify-content: center; align-items: center;
        height: 100vh; overflow: hidden;
      }
      .window { width: 860px; background: #161b22; border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6); border: 1px solid #30363d; overflow: hidden; }
      .header { background: #21262d; padding: 12px 16px; display: flex; align-items: center; gap: 8px;
        border-bottom: 1px solid #30363d; }
      .dot { width: 12px; height: 12px; border-radius: 50%; }
      .dot-red { background: #ff5f56; } .dot-yellow { background: #ffbd2e; } .dot-green { background: #27c93f; }
      .title { color: #8b949e; font-size: 13px; margin-left: auto; margin-right: auto; padding-right: 48px; }
      .content { padding: 24px; font-size: 14px; line-height: 1.6; min-height: 320px; }
      .prompt { color: #58a6ff; font-weight: bold; }
      .cmd { color: #f0f6fc; }
      .success { color: #3fb950; }
      .dim { color: #8b949e; }
      .highlight { color: #f2cc60; }
      .cyan { color: #39c5cf; }
      .cursor { display: inline-block; width: 8px; height: 16px; background: #58a6ff;
        vertical-align: middle; animation: blink 1s infinite; }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    </style>
  </head>
  <body>
    <div class="window">
      <div class="header">
        <div class="dot dot-red"></div>
        <div class="dot dot-yellow"></div>
        <div class="dot dot-green"></div>
        <div class="title">terminal — data-archify CLI (Node.js / TypeScript)</div>
      </div>
      <div class="content" id="term-body"></div>
    </div>
  </body>
  </html>`;

  fs.writeFileSync(terminalHtmlPath, html);

  const actions = [
    {
      eval: `document.getElementById('term-body').innerHTML = '<span class="prompt">mauricio@macbook</span>:<span class="cyan">~/data-archify</span>$ <span class="cursor"></span>';`,
      wait: 400
    },
    {
      eval: `document.getElementById('term-body').innerHTML = '<span class="prompt">mauricio@macbook</span>:<span class="cyan">~/data-archify</span>$ <span class="cmd">data-archify dbt --manifest manifest.json --out lineage.html</span><br><br><span class="dim">Reading dbt manifest...</span><br><span class="success">✔</span> Processed graph: <span class="highlight">8 nodes, 7 edges</span><br><span class="dim">Running Archify renderer...</span><br><span class="success">✔</span> Delivered architecture <span class="cyan">lineage.html</span><br><span class="success">✔</span> Injected Interactive Portal with Data Contracts & Columns<br><span class="success">✔</span> Generated companion report <span class="cyan">lineage_contracts.md</span><br><br><span class="prompt">mauricio@macbook</span>:<span class="cyan">~/data-archify</span>$ <span class="cursor"></span>';`,
      wait: 1000
    },
    {
      eval: `document.getElementById('term-body').innerHTML += '<span class="cmd">data-archify render -i templates/01-event-driven-ingestion.json -o stream.html</span><br><br><span class="dim">Loading architecture template...</span><br><span class="success">✔</span> Loaded graph: <span class="highlight">6 nodes, 5 edges</span> (SNS, SQS, Lambda, S3)<br><span class="dim">Applying Volumetry & Compute Sizing...</span><br><span class="success">✔</span> Volumetry: <span class="highlight">15,000 msg/sec | 35 GB/day</span><br><span class="success">✔</span> Delivered interactive architecture: <span class="cyan">stream.html</span><br><br><span class="prompt">mauricio@macbook</span>:<span class="cyan">~/data-archify</span>$ <span class="cursor"></span>';`,
      wait: 1400
    }
  ];

  await recordChromeInteraction({
    url: `file://${terminalHtmlPath}`,
    actions,
    outputPath: path.resolve(__dirname, '../docs/assets/cli-demo.gif'),
    width: 900, height: 480, delay: 1200
  });

  fs.unlinkSync(terminalHtmlPath);
}

/* ================================================================
   2. MEDALLION LAKEHOUSE GIF — Full data contract journey
      Big picture → Airflow → Bronze → dbt Silver → Silver Table
      (columns+lineage) → dbt Gold → Gold Marts → back to overview
   ================================================================ */

async function generateMedallionGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/demo-medallion.html');

  const actions = [
    // Frame 1: Big Picture overview
    resetView(),
    // Extra frame at overview for emphasis
    { eval: '', wait: 600 },
    // Frame 2: Airflow Orchestrator
    focusNode('airflow_orchestrator', 1200),
    // Frame 3: Bronze CRM Users (with volumetry)
    focusNode('bronze_crm_users', 1400),
    // Frame 4: dbt Silver Cleansing Process
    focusNode('dbt_silver_cleansing', 1200),
    // Frame 5: Silver Customers — data contract + column lineage
    focusNode('silver_customers_cleaned', 1500),
    // Frame 6: Scroll to see column lineage detail
    scrollPassport(55),
    // Frame 7: dbt Gold Aggregation
    focusNode('dbt_gold_aggregation', 1200),
    // Frame 8: Gold Marts KPIs — final table
    focusNode('gold_marts_kpis', 1400),
    // Frame 9: Reset to big picture
    resetView()
  ];

  await recordChromeInteraction({
    url: `file://${demoHtmlPath}`,
    actions,
    outputPath: path.resolve(__dirname, '../docs/assets/portal-medallion.gif'),
    width: 1100, height: 680, delay: 1350
  });
}

/* ================================================================
   3. EVENT-DRIVEN INGESTION GIF — Streaming architecture tour
      Big picture → Payment Gateway → SNS Topic → SQS Queue →
      SQS DLQ → Lambda (compute card) → S3 Bronze → overview
   ================================================================ */

async function generateEventDrivenGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/demo-event-driven.html');

  const actions = [
    // Frame 1: Big Picture — full streaming architecture at a glance
    resetView(),
    { eval: '', wait: 600 },
    // Frame 2: Payment Gateway — external event source (15k events/sec)
    focusNode('ext_payment_gateway', 1200),
    // Frame 3: SNS Order Events — fan-out topic with volumetry
    focusNode('sns_order_events', 1400),
    // Frame 4: SQS Order Queue — FIFO queue with retention
    focusNode('sqs_order_queue', 1400),
    // Frame 5: SQS Dead Letter Queue — error handling path
    focusNode('sqs_order_dlq', 1200),
    // Frame 6: Lambda Processor — compute card (512 MB, 10 workers)
    focusNode('lambda_stream_processor', 1500),
    // Frame 7: S3 Bronze Lake — storage destination with retention policy
    focusNode('s3_bronze_lake', 1400),
    // Frame 8: Back to big picture
    resetView()
  ];

  await recordChromeInteraction({
    url: `file://${demoHtmlPath}`,
    actions,
    outputPath: path.resolve(__dirname, '../docs/assets/portal-event-driven.gif'),
    width: 1100, height: 680, delay: 1350
  });
}

/* ================================================================
   4. HEAVY PROCESSING LAKEHOUSE GIF — Compute-intensive pipeline
      Big picture → S3 Bronze (12 TB/day) → Glue (12 DPUs) →
      Iceberg Silver → EMR (2 TB RAM) → Databricks Photon →
      Gold Delta KPIs → overview
   ================================================================ */

async function generateHeavyProcessingGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/demo-heavy-processing.html');

  const actions = [
    // Frame 1: Big Picture — massive data pipeline overview
    resetView(),
    { eval: '', wait: 600 },
    // Frame 2: S3 Bronze Store — 12 TB/day, 85M records/day
    focusNode('s3_bronze_store', 1400),
    // Frame 3: Glue Compaction Job — 12 DPUs, 96 GB distributed RAM
    focusNode('glue_compaction_job', 1500),
    // Frame 4: Iceberg Silver Table — 8 TB/day compressed
    focusNode('glue_iceberg_silver', 1400),
    // Frame 5: EMR Spark Cluster — 16× r5.4xlarge, 2 TB RAM
    focusNode('emr_heavy_spark_cluster', 1500),
    // Frame 6: Databricks Gold Pipeline — Photon acceleration
    focusNode('databricks_gold_pipeline', 1500),
    // Frame 7: Delta Gold KPIs — final materialization
    focusNode('delta_gold_kpis', 1300),
    // Frame 8: Back to big picture
    resetView()
  ];

  await recordChromeInteraction({
    url: `file://${demoHtmlPath}`,
    actions,
    outputPath: path.resolve(__dirname, '../docs/assets/portal-heavy-processing.gif'),
    width: 1100, height: 680, delay: 1350
  });
}

/* ================================================================
   5. DBT LINEAGE GIF — Bipartite Table ↔ SQL Process graph
      Big picture → raw.customers source → stg_customers process →
      stg_customers dataset (columns) → raw.orders source →
      stg_orders process → customers Gold (lineage) → overview
   ================================================================ */

async function generateDbtLineageGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/demo-dbt.html');

  const actions = [
    // Frame 1: Big Picture — full bipartite dbt graph
    resetView(),
    { eval: '', wait: 600 },
    // Frame 2: Raw Customers Source — origin data with columns
    focusNode('dataset_source.jaffle_shop.raw.customers', 1400),
    // Frame 3: stg_customers SQL Process — transformation logic
    focusNode('process_model.jaffle_shop.stg_customers', 1300),
    // Frame 4: stg_customers Dataset — conformed columns + lineage
    focusNode('dataset_model.jaffle_shop.stg_customers', 1500),
    // Frame 5: Scroll to see column lineage detail
    scrollPassport(60),
    // Frame 6: Raw Orders Source — order data with columns
    focusNode('dataset_source.jaffle_shop.raw.orders', 1400),
    // Frame 7: stg_orders SQL Process
    focusNode('process_model.jaffle_shop.stg_orders', 1300),
    // Frame 8: Customers Gold — final aggregated model with full lineage
    focusNode('dataset_model.jaffle_shop.customers', 1500),
    // Frame 9: Back to big picture
    resetView()
  ];

  await recordChromeInteraction({
    url: `file://${demoHtmlPath}`,
    actions,
    outputPath: path.resolve(__dirname, '../docs/assets/portal-dbt-lineage.gif'),
    width: 1100, height: 680, delay: 1350
  });
}

/* ================================================================
   6. ENTERPRISE FULL PLATFORM GIF — End-to-end full stack tour
      Big picture → Storefront Web (Next.js) → API Gateway (AWS) →
      Order Service (Node.js) → Aurora Orders (PostgreSQL) →
      SNS Event Topic → SQS FIFO Queue → S3 Bronze → Glue Silver →
      Iceberg Silver → EMR Spark → Databricks Gold →
      Airflow MWAA → Snowflake Analytics → Grafana Observability →
      SES Notifications → overview
   ================================================================ */

async function generateEnterpriseFullPlatformGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/demo-enterprise-full-platform.html');

  const actions = [
    // Frame 1: Big Picture overview
    resetView(),
    { eval: '', wait: 700 },
    // Frame 2: Storefront Web App (Next.js 15)
    focusNode('fe_ecommerce_web', 1300),
    // Frame 3: API Gateway
    focusNode('api_gateway_core', 1200),
    // Frame 4: Order Processor (Microservice)
    focusNode('svc_order_processor', 1200),
    // Frame 5: Aurora PostgreSQL Orders Database
    focusNode('db_aurora_orders', 1400),
    // Frame 6: SQS Buffer Queue
    focusNode('queue_lake_buffer', 1200),
    // Frame 7: S3 Bronze Lakehouse
    focusNode('lake_s3_bronze', 1300),
    // Frame 8: Iceberg Silver Table
    focusNode('table_iceberg_silver', 1400),
    // Frame 9: EMR Heavy Spark Processing
    focusNode('proc_emr_features', 1300),
    // Frame 10: Databricks Gold Pipeline
    focusNode('proc_databricks_marts', 1300),
    // Frame 11: Delta Lake Gold Marts (KPIs & Lineage)
    focusNode('table_delta_gold_kpis', 1400),
    // Frame 12: Snowflake Data Cloud
    focusNode('wh_snowflake_analytics', 1300),
    // Frame 13: Grafana Platform Observability
    focusNode('dash_grafana_telemetry', 1200),
    // Frame 14: Return to Big Picture
    resetView()
  ];

  await recordChromeInteraction({
    url: `file://${demoHtmlPath}`,
    actions,
    outputPath: path.resolve(__dirname, '../docs/assets/portal-enterprise-platform.gif'),
    width: 1100, height: 680, delay: 1350
  });
}

/* ================================================================
   MAIN — Run all GIF generators sequentially
   ================================================================ */

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  📹  Data-Archify — Generating Animated GIF Demos');
  console.log('═══════════════════════════════════════════════════════');

  const generators = [
    { name: '1/6  CLI Demo', fn: generateTerminalGif },
    { name: '2/6  Medallion Lakehouse', fn: generateMedallionGif },
    { name: '3/6  Event-Driven Ingestion', fn: generateEventDrivenGif },
    { name: '4/6  Heavy Processing Lakehouse', fn: generateHeavyProcessingGif },
    { name: '5/6  dbt Column Lineage', fn: generateDbtLineageGif },
    { name: '6/6  Enterprise Full Platform', fn: generateEnterpriseFullPlatformGif },
  ];

  for (const gen of generators) {
    console.log(`\n▶ ${gen.name}`);
    try {
      await gen.fn();
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅  All GIFs generated! Check docs/assets/');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('GIF generation failed:', err);
  process.exit(1);
});
