const { spawn, execSync } = require('child_process');
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

function ensureHtml(inputFile, outputFile) {
  console.log(`  Building demo HTML ${path.basename(outputFile)}...`);
  if (inputFile.endsWith('manifest.json')) {
    execSync(`node dist/index.js dbt --manifest "${inputFile}" --out "${outputFile}"`, { stdio: 'pipe' });
  } else {
    execSync(`node dist/index.js render --input "${inputFile}" --out "${outputFile}"`, { stdio: 'pipe' });
  }
}

function cleanupTempHtml(outputFile) {
  try {
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    const contractFile = outputFile.replace(/\.html$/, '_contracts.md');
    if (fs.existsSync(contractFile)) fs.unlinkSync(contractFile);
  } catch (_) {}
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
   ================================================================ */

async function generateMedallionGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/temp_demo_medallion.html');
  const templatePath = path.resolve(__dirname, '../templates/03-medallion-lakehouse-orchestrated.json');
  ensureHtml(templatePath, demoHtmlPath);

  const actions = [
    resetView(),
    { eval: '', wait: 600 },
    focusNode('airflow_orchestrator', 1200),
    focusNode('bronze_crm_users', 1400),
    focusNode('dbt_silver_cleansing', 1200),
    focusNode('silver_customers_cleaned', 1500),
    scrollPassport(55),
    focusNode('dbt_gold_aggregation', 1200),
    focusNode('gold_marts_kpis', 1400),
    resetView()
  ];

  try {
    await recordChromeInteraction({
      url: `file://${demoHtmlPath}`,
      actions,
      outputPath: path.resolve(__dirname, '../docs/assets/portal-medallion.gif'),
      width: 1100, height: 680, delay: 1350
    });
  } finally {
    cleanupTempHtml(demoHtmlPath);
  }
}

/* ================================================================
   3. EVENT-DRIVEN INGESTION GIF — Streaming architecture tour
   ================================================================ */

async function generateEventDrivenGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/temp_demo_event.html');
  const templatePath = path.resolve(__dirname, '../templates/01-event-driven-ingestion.json');
  ensureHtml(templatePath, demoHtmlPath);

  const actions = [
    resetView(),
    { eval: '', wait: 600 },
    focusNode('ext_payment_gateway', 1200),
    focusNode('sns_order_events', 1400),
    focusNode('sqs_order_queue', 1400),
    focusNode('sqs_order_dlq', 1200),
    focusNode('lambda_stream_processor', 1500),
    focusNode('s3_bronze_lake', 1400),
    resetView()
  ];

  try {
    await recordChromeInteraction({
      url: `file://${demoHtmlPath}`,
      actions,
      outputPath: path.resolve(__dirname, '../docs/assets/portal-event-driven.gif'),
      width: 1100, height: 680, delay: 1350
    });
  } finally {
    cleanupTempHtml(demoHtmlPath);
  }
}

/* ================================================================
   4. HEAVY PROCESSING LAKEHOUSE GIF — Compute-intensive pipeline
   ================================================================ */

async function generateHeavyProcessingGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/temp_demo_heavy.html');
  const templatePath = path.resolve(__dirname, '../templates/02-heavy-processing-lakehouse.json');
  ensureHtml(templatePath, demoHtmlPath);

  const actions = [
    resetView(),
    { eval: '', wait: 600 },
    focusNode('s3_bronze_store', 1400),
    focusNode('glue_compaction_job', 1500),
    focusNode('glue_iceberg_silver', 1400),
    focusNode('emr_heavy_spark_cluster', 1500),
    focusNode('databricks_gold_pipeline', 1500),
    focusNode('delta_gold_kpis', 1300),
    resetView()
  ];

  try {
    await recordChromeInteraction({
      url: `file://${demoHtmlPath}`,
      actions,
      outputPath: path.resolve(__dirname, '../docs/assets/portal-heavy-processing.gif'),
      width: 1100, height: 680, delay: 1350
    });
  } finally {
    cleanupTempHtml(demoHtmlPath);
  }
}

/* ================================================================
   5. DBT LINEAGE GIF — Bipartite Table ↔ SQL Process graph
   ================================================================ */

async function generateDbtLineageGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/temp_demo_dbt.html');
  const manifestPath = path.resolve(__dirname, '../tests/manifest.json');
  ensureHtml(manifestPath, demoHtmlPath);

  const actions = [
    resetView(),
    { eval: '', wait: 600 },
    focusNode('dataset_source.jaffle_shop.raw.customers', 1400),
    focusNode('process_model.jaffle_shop.stg_customers', 1300),
    focusNode('dataset_model.jaffle_shop.stg_customers', 1500),
    scrollPassport(60),
    focusNode('dataset_source.jaffle_shop.raw.orders', 1400),
    focusNode('process_model.jaffle_shop.stg_orders', 1300),
    focusNode('dataset_model.jaffle_shop.customers', 1500),
    resetView()
  ];

  try {
    await recordChromeInteraction({
      url: `file://${demoHtmlPath}`,
      actions,
      outputPath: path.resolve(__dirname, '../docs/assets/portal-dbt-lineage.gif'),
      width: 1100, height: 680, delay: 1350
    });
  } finally {
    cleanupTempHtml(demoHtmlPath);
  }
}

/* ================================================================
   6. ENTERPRISE FULL PLATFORM GIF — End-to-end full stack tour
   ================================================================ */

async function generateEnterpriseFullPlatformGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/temp_demo_enterprise.html');
  const templatePath = path.resolve(__dirname, '../templates/04-enterprise-full-platform.json');
  ensureHtml(templatePath, demoHtmlPath);

  const actions = [
    resetView(),
    { eval: '', wait: 700 },
    focusNode('fe_ecommerce_web', 1300),
    focusNode('api_gateway_core', 1200),
    focusNode('svc_order_processor', 1200),
    focusNode('db_aurora_orders', 1400),
    focusNode('queue_lake_buffer', 1200),
    focusNode('lake_s3_bronze', 1300),
    focusNode('table_iceberg_silver', 1400),
    focusNode('proc_emr_features', 1300),
    focusNode('proc_databricks_marts', 1300),
    focusNode('table_delta_gold_kpis', 1400),
    focusNode('wh_snowflake_analytics', 1300),
    focusNode('dash_grafana_telemetry', 1200),
    resetView()
  ];

  try {
    await recordChromeInteraction({
      url: `file://${demoHtmlPath}`,
      actions,
      outputPath: path.resolve(__dirname, '../docs/assets/portal-enterprise-platform.gif'),
      width: 1100, height: 680, delay: 1350
    });
  } finally {
    cleanupTempHtml(demoHtmlPath);
  }
}

/* ================================================================
   7. ENTERPRISE TREE ARCHITECTURE GIF — 25-node tree tour
   ================================================================ */

async function generateEnterpriseTreePlatformGif() {
  const demoHtmlPath = path.resolve(__dirname, '../docs/temp_demo_tree.html');
  const templatePath = path.resolve(__dirname, '../templates/05-enterprise-tree-platform.json');
  ensureHtml(templatePath, demoHtmlPath);

  const actions = [
    resetView(),
    { eval: '', wait: 700 },
    focusNode('db_aurora_oltp', 1300),
    focusNode('fe_storefront_app', 1200),
    focusNode('api_gateway_core', 1200),
    focusNode('queue_sqs_events', 1200),
    focusNode('lake_s3_bronze', 1300),
    focusNode('table_iceberg_silver', 1400),
    focusNode('proc_emr_spark', 1300),
    focusNode('table_delta_gold_marts', 1400),
    focusNode('proc_flink_streaming', 1300),
    focusNode('store_dynamodb_features', 1300),
    focusNode('orch_airflow_master', 1300),
    focusNode('svc_reverse_etl', 1200),
    resetView()
  ];

  try {
    await recordChromeInteraction({
      url: `file://${demoHtmlPath}`,
      actions,
      outputPath: path.resolve(__dirname, '../docs/assets/portal-enterprise-tree.gif'),
      width: 1100, height: 680, delay: 1350
    });
  } finally {
    cleanupTempHtml(demoHtmlPath);
  }
}

/* ================================================================
   MAIN — Run all GIF generators sequentially
   ================================================================ */

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  📹  Data-Archify — Generating Animated GIF Demos');
  console.log('═══════════════════════════════════════════════════════');

  const generators = [
    { name: '1/7  CLI Demo', fn: generateTerminalGif },
    { name: '2/7  Medallion Lakehouse', fn: generateMedallionGif },
    { name: '3/7  Event-Driven Ingestion', fn: generateEventDrivenGif },
    { name: '4/7  Heavy Processing Lakehouse', fn: generateHeavyProcessingGif },
    { name: '5/7  dbt Column Lineage', fn: generateDbtLineageGif },
    { name: '6/7  Enterprise Full Platform', fn: generateEnterpriseFullPlatformGif },
    { name: '7/7  Enterprise Tree Architecture', fn: generateEnterpriseTreePlatformGif },
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
