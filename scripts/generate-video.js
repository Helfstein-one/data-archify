const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🎥  Data-Archify — Generating Full Journey Video');
  console.log('═══════════════════════════════════════════════════════');

  const width = 1280;
  const height = 720;
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9550;
  const userDataDir = `/tmp/chrome-video-${Date.now()}`;

  // Step 1: Ensure demo HTML exists
  const demoHtmlPath = path.resolve(__dirname, '../docs/demo-enterprise-full-platform.html');
  if (!fs.existsSync(demoHtmlPath)) {
    console.log('Building enterprise full platform demo HTML...');
    const { execSync } = require('child_process');
    execSync(`node dist/index.js render --input templates/04-enterprise-full-platform.json --out ${demoHtmlPath}`, { stdio: 'inherit' });
  }

  // Step 2: Spawn Chrome with target page
  console.log('Launching Headless Chrome for video recording...');
  const chrome = spawn(chromePath, [
    '--headless',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-sandbox',
    `--window-size=${width},${height}`,
    `file://${demoHtmlPath}`
  ]);

  let tabs = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
      tabs = await listRes.json();
      if (Array.isArray(tabs) && tabs.length > 0) break;
    } catch (_) {}
  }

  if (!tabs) {
    chrome.kill();
    throw new Error('Chrome debugging connection failed');
  }

  const pageTab = tabs.find(t => t.url.includes(path.basename(demoHtmlPath)) || t.type === 'page');
  if (!pageTab) {
    chrome.kill();
    throw new Error('Could not find active demo page tab');
  }

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(res => ws.onopen = res);

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      const handler = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === id) {
          ws.removeEventListener('message', handler);
          resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Injecting high-fidelity video recorder into browser session...');

  const recordingScript = `
    new Promise(async (resolve) => {
      // 1. Create recording canvas & video stream
      const recCanvas = document.createElement('canvas');
      recCanvas.width = ${width};
      recCanvas.height = ${height};
      recCanvas.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;pointer-events:none;display:none;';
      document.body.appendChild(recCanvas);
      const ctx = recCanvas.getContext('2d');

      const stream = recCanvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 4000000
      });
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      };
      recorder.start();

      let isRecording = true;
      let overlayTitle = '';
      let overlaySubtitle = '';
      let activeSection = '';

      // Render loop
      function renderFrame() {
        if (!isRecording) return;
        
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, ${width}, ${height});

        if (window.renderToCanvas) {
          window.renderToCanvas(ctx);
        }

        // Top banner watermark
        ctx.fillStyle = 'rgba(13, 17, 23, 0.88)';
        ctx.fillRect(0, 0, ${width}, 44);
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 44);
        ctx.lineTo(${width}, 44);
        ctx.stroke();

        // Banner text
        ctx.fillStyle = '#58a6ff';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
        ctx.fillText('🏗️ data-archify', 24, 28);

        ctx.fillStyle = '#8b949e';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('— Universal Data Architecture, Lineage & Contracts Engine', 160, 28);

        // Section badge (if active)
        if (activeSection) {
          ctx.fillStyle = '#238636';
          ctx.beginPath();
          ctx.roundRect(${width} - 280, 10, 256, 26, 6);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
          ctx.fillText(activeSection, ${width} - 268, 27);
        }

        // Bottom HUD banner (if title active)
        if (overlayTitle) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
          ctx.beginPath();
          ctx.roundRect(24, ${height} - 80, ${width} - 48, 62, 10);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(overlayTitle, 44, ${height} - 52);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(overlaySubtitle, 44, ${height} - 30);
        }

        requestAnimationFrame(renderFrame);
      }
      requestAnimationFrame(renderFrame);

      const sleep = ms => new Promise(r => setTimeout(r, ms));

      // ─── SCENE 1: Terminal CLI Execution Journey ───
      activeSection = '1. CLI & COMPILATION';
      const termLines = [
        { text: '$ data-archify render --input templates/04-enterprise-full-platform.json --out enterprise.html', delay: 400 },
        { text: '  [✓] Reading architecture definition: templates/04-enterprise-full-platform.json', delay: 300 },
        { text: '  [✓] Loaded graph: 17 nodes, 16 edges across 9 technology tiers', delay: 300 },
        { text: '  [✓] Running Archify topological BFS grid layout & boundary solver...', delay: 400 },
        { text: '  [✓] Delivered publication-ready architecture: enterprise.html (9/9 checks pass)', delay: 400 },
        { text: '  [✓] Injecting Interactive Semantic Passport & Volumetry overlays...', delay: 300 },
        { text: '  [✓] Generated data governance report: enterprise_contracts.md', delay: 400 },
        { text: '  [✨] Complete Enterprise Platform is ready to explore!', delay: 500 }
      ];

      let displayedLines = [];
      window.renderToCanvas = (c) => {
        // Draw terminal window
        c.fillStyle = '#161b22';
        c.beginPath();
        c.roundRect(140, 90, ${width} - 280, ${height} - 210, 12);
        c.fill();
        c.strokeStyle = '#30363d';
        c.lineWidth = 1.5;
        c.stroke();

        // Terminal header
        c.fillStyle = '#21262d';
        c.beginPath();
        c.roundRect(140, 90, ${width} - 280, 42, [12, 12, 0, 0]);
        c.fill();

        // Mac dots
        c.fillStyle = '#ff5f56'; c.beginPath(); c.arc(164, 111, 6, 0, Math.PI*2); c.fill();
        c.fillStyle = '#ffbd2e'; c.beginPath(); c.arc(184, 111, 6, 0, Math.PI*2); c.fill();
        c.fillStyle = '#27c93f'; c.beginPath(); c.arc(204, 111, 6, 0, Math.PI*2); c.fill();

        c.fillStyle = '#8b949e';
        c.font = '13px monospace';
        c.fillText('terminal — data-archify CLI (TypeScript / Node.js 26)', 240, 116);

        // Terminal output text
        c.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
        let y = 165;
        for (const line of displayedLines) {
          if (line.startsWith('$')) {
            c.fillStyle = '#58a6ff';
            c.fillText('user@macbook:~/data-archify ', 170, y);
            c.fillStyle = '#f0f6fc';
            c.fillText(line, 400, y);
          } else if (line.includes('[✓]') || line.includes('[✨]')) {
            c.fillStyle = '#3fb950';
            c.fillText(line, 170, y);
          } else {
            c.fillStyle = '#c9d1d9';
            c.fillText(line, 170, y);
          }
          y += 28;
        }
      };

      overlayTitle = 'Step 1: Terminal Compilation & Synthesis';
      overlaySubtitle = 'Executing data-archify CLI to ingest templates, resolve topological graph layout, and inject contracts.';

      for (const item of termLines) {
        displayedLines.push(item.text);
        await sleep(item.delay || 400);
      }
      await sleep(1800);

      // ─── SCENE 2: Switch to Architecture Diagram ───
      window.renderToCanvas = null;

      // Reset view to big picture
      activeSection = '2. FULL PLATFORM VIEW';
      overlayTitle = 'Step 2: Big Picture Architecture (All 9 Tiers)';
      overlaySubtitle = 'Macro architectural view with 17 components spanning Frontend, API, Storage, Lakehouse, Analytics & Reporting.';
      if (window.Archify && Archify.focus) Archify.focus.clear();
      if (window.Archify && Archify.view) Archify.view.reset();
      await sleep(2500);

      // ─── SCENE 3: Step-by-Step Interactive Drill-down ───
      const journeySteps = [
        {
          nodeId: 'fe_ecommerce_web',
          section: '3. FRONTEND TIER',
          title: 'Tier 1 — Storefront Web App (Next.js 15 / React 19)',
          subtitle: 'High-traffic customer shopping portal with 45,000 req/sec throughput and sub-100ms TTFB SLA.',
          duration: 2200
        },
        {
          nodeId: 'api_gateway_core',
          section: '4. API GATEWAY',
          title: 'Tier 2 — Amazon API Gateway (AWS 2026 Badge)',
          subtitle: 'Handles 50k req/sec with rate limiting, JWT validation and 4.3B daily requests.',
          duration: 2200
        },
        {
          nodeId: 'sec_vault_secrets',
          section: '5. SECURITY & SECRETS',
          title: 'Tier 3 — AWS Secrets Manager',
          subtitle: 'Rotates database connection strings and payment API keys every 30 days automatically.',
          duration: 2200
        },
        {
          nodeId: 'svc_order_processor',
          section: '6. BACKEND SERVICES',
          title: 'Tier 4 — Order Orchestrator (Node.js microservice)',
          subtitle: 'Running on EKS Kubernetes HPA with 16 pods (64GB RAM total cluster capacity).',
          duration: 2400
        },
        {
          nodeId: 'db_aurora_orders',
          section: '7. OPERATIONAL DATABASE',
          title: 'Tier 5 — Amazon Aurora PostgreSQL Multi-AZ',
          subtitle: 'ACID transactional database processing 15M orders/day with column data contract displayed.',
          duration: 2600
        },
        {
          nodeId: 'bus_order_events',
          section: '8. MESSAGING & PUB/SUB',
          title: 'Tier 6 — Amazon SNS Topic (order-events-stream)',
          subtitle: 'Pub/sub broadcast fan-out delivering 25,000 msg/sec with sub-20ms delivery SLA.',
          duration: 2200
        },
        {
          nodeId: 'queue_lake_buffer',
          section: '9. QUEUING & BUFFER',
          title: 'Tier 7 — Amazon SQS FIFO Queue (lakehouse-ingestion.fifo)',
          subtitle: 'Throttles spike loads, deduplicates orders, and guarantees exactly-once delivery.',
          duration: 2200
        },
        {
          nodeId: 'lake_s3_bronze',
          section: '10. BRONZE DATA LAKE',
          title: 'Tier 8 — Amazon S3 Bronze (Raw Immutable Lake)',
          subtitle: 'Ingests 1.5 TB/day raw append-only Parquet logs with infinite Glacier lifecycle.',
          duration: 2400
        },
        {
          nodeId: 'job_glue_silver_etl',
          section: '11. SILVER PROCESSING',
          title: 'Tier 9 — AWS Glue 4.0 (Spark 3.3 Serverless)',
          subtitle: 'Provisioned with 16 DPUs (G.2X workers, 128 GB RAM) for automatic file compaction.',
          duration: 2400
        },
        {
          nodeId: 'table_iceberg_silver',
          section: '12. APACHE ICEBERG',
          title: 'Tier 10 — Apache Iceberg Silver Table',
          subtitle: 'ACID transaction layer partitioned by order_date with 900 GB/day compressed and full column lineage.',
          duration: 2600
        },
        {
          nodeId: 'proc_emr_features',
          section: '13. EMR HEAVY PROCESSING',
          title: 'Tier 11 — Amazon EMR 7.1 Distributed Spark Cluster',
          subtitle: 'Heavy compute cluster: 16x r5.4xlarge instances, 2,048 GB RAM for cross-table graph feature store.',
          duration: 2600
        },
        {
          nodeId: 'proc_databricks_marts',
          section: '14. DATABRICKS PHOTON',
          title: 'Tier 12 — Databricks Photon Delta Live Tables',
          subtitle: 'Vectorized query engine producing Gold KPI models daily by 05:00 UTC.',
          duration: 2400
        },
        {
          nodeId: 'table_delta_gold_kpis',
          section: '15. DELTA LAKE GOLD',
          title: 'Tier 13 — Delta Lake Gold Business KPIs',
          subtitle: 'Executive metrics: GMV, Churn, Active Buyers with source lineage pointing back to Iceberg.',
          duration: 2600
        },
        {
          nodeId: 'orch_airflow_master',
          section: '16. ORCHESTRATION',
          title: 'Tier 14 — Apache Airflow 2.9 (Amazon MWAA)',
          subtitle: 'Master DAG coordinating triggers, task sensors, SLA compliance, and cross-cloud synchronization.',
          duration: 2400
        },
        {
          nodeId: 'wh_snowflake_analytics',
          section: '17. ANALYTICS WAREHOUSE',
          title: 'Tier 15 — Snowflake Data Cloud Hub',
          subtitle: 'Central analytical warehouse serving executive Tableau/PowerBI semantic models 24/7.',
          duration: 2400
        },
        {
          nodeId: 'dash_grafana_telemetry',
          section: '18. OBSERVABILITY',
          title: 'Tier 16 — Grafana Platform Observability',
          subtitle: 'Real-time telemetry, service latency percentiles, error budgets, and queue lag monitoring.',
          duration: 2400
        },
        {
          nodeId: 'notif_ses_service',
          section: '19. NOTIFICATIONS',
          title: 'Tier 17 — Amazon SES Notification Hub',
          subtitle: 'Customer transactional email service dispatching receipts and notifications (12M emails/day).',
          duration: 2400
        }
      ];

      for (const step of journeySteps) {
        activeSection = step.section;
        overlayTitle = step.title;
        overlaySubtitle = step.subtitle;

        if (window.Archify && Archify.focus) {
          Archify.focus.set(step.nodeId, { toggle: false });
        }
        if (window.Archify && Archify.view) {
          Archify.view.reveal([step.nodeId], { includeNeighbors: true });
        }
        await sleep(step.duration);
      }

      // ─── SCENE 4: Finale Return to Big Picture ───
      activeSection = '20. COMPLETE PLATFORM';
      overlayTitle = 'Architecture Synthesized & Published Successfully';
      overlaySubtitle = 'Seamless pairing of Data Contracts, Compute Sizing, Volumetry, and Multi-Cloud Lineage with data-archify.';

      if (window.Archify && Archify.focus) Archify.focus.clear();
      if (window.Archify && Archify.view) Archify.view.reset();
      await sleep(3500);

      // Stop recorder
      isRecording = false;
      recorder.stop();
    });
  `;

  console.log('Starting full journey recording (estimated ~45 seconds)...');
  const result = await send('Runtime.evaluate', {
    expression: recordingScript,
    awaitPromise: true,
    returnByValue: true
  });

  const base64Data = result?.result?.value;
  if (!base64Data) {
    chrome.kill();
    throw new Error('Recording failed or returned empty video stream');
  }

  const outputVideoPath = path.resolve(__dirname, '../video/data-archify-complete-journey.webm');
  const videoBuffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(outputVideoPath, videoBuffer);

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  🎉 Video generated successfully!`);
  console.log(`  📁 Path: ${outputVideoPath}`);
  console.log(`  📊 Size: ${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
  console.log('═══════════════════════════════════════════════════════');

  chrome.kill();
}

main().catch(err => {
  console.error('Video generation failed:', err);
  process.exit(1);
});
