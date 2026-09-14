const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🎥  Data-Archify — Generating Full Journey Video');
  console.log('      (Including Native Features: PATH, MAP, LENS, Finder)');
  console.log('═══════════════════════════════════════════════════════');

  const width = 1280;
  const height = 720;
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const port = 9750;
  const userDataDir = `/tmp/chrome-video-${Date.now()}`;

  // Step 1: Ensure demo HTML exists
  const demoHtmlPath = path.resolve(__dirname, '../docs/05-enterprise-tree.html');
  if (!fs.existsSync(demoHtmlPath)) {
    console.log('Building enterprise tree platform demo HTML...');
    const { execSync } = require('child_process');
    execSync(`node dist/index.js render --input templates/05-enterprise-tree-platform.json --out ${demoHtmlPath}`, { stdio: 'inherit' });
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

  const pageTab = tabs.find(t => t.url.includes(path.basename(demoHtmlPath)) || (t.type === 'page' && !t.url.startsWith('chrome:')));
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

  console.log('Injecting high-fidelity canvas video recorder with real diagram capture...');

  // Setup client-side capture pipeline inside the browser
  await send('Runtime.evaluate', {
    expression: `
      window.__VIDEO_RECORDER__ = (() => {
        const canvas = document.createElement('canvas');
        canvas.width = ${width};
        canvas.height = ${height};
        canvas.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;display:none;pointer-events:none;';
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 4500000
        });

        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

        let finishPromise = new Promise(resolve => {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
          };
        });

        recorder.start();

        let activeHud = {
          tier: '',
          title: '',
          subtitle: '',
          mode: 'diagram' // 'terminal' | 'diagram'
        };

        let termLines = [];

        return {
          setHud: (tier, title, subtitle) => {
            activeHud.tier = tier || '';
            activeHud.title = title || '';
            activeHud.subtitle = subtitle || '';
          },
          setMode: (mode) => {
            activeHud.mode = mode;
          },
          addTermLine: (line) => {
            termLines.push(line);
          },
          renderFrame: (base64Jpg) => {
            return new Promise(done => {
              if (activeHud.mode === 'terminal') {
                // Draw rich terminal window
                ctx.fillStyle = '#0d1117';
                ctx.fillRect(0, 0, ${width}, ${height});

                // Window container
                ctx.fillStyle = '#161b22';
                ctx.beginPath();
                ctx.roundRect(140, 80, ${width} - 280, ${height} - 200, 12);
                ctx.fill();
                ctx.strokeStyle = '#30363d';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Window header
                ctx.fillStyle = '#21262d';
                ctx.beginPath();
                ctx.roundRect(140, 80, ${width} - 280, 42, [12, 12, 0, 0]);
                ctx.fill();

                // Window control dots
                ctx.fillStyle = '#ff5f56'; ctx.beginPath(); ctx.arc(164, 101, 6, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffbd2e'; ctx.beginPath(); ctx.arc(184, 101, 6, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#27c93f'; ctx.beginPath(); ctx.arc(204, 101, 6, 0, Math.PI*2); ctx.fill();

                ctx.fillStyle = '#8b949e';
                ctx.font = '13px monospace';
                ctx.fillText('terminal — data-archify CLI (TypeScript / Node.js)', 240, 106);

                // Terminal text
                ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
                let y = 155;
                for (const l of termLines) {
                  if (l.startsWith('$')) {
                    ctx.fillStyle = '#58a6ff';
                    ctx.fillText('mauricio@macbook:~/data-archify ', 170, y);
                    ctx.fillStyle = '#f0f6fc';
                    ctx.fillText(l, 400, y);
                  } else if (l.includes('[✓]') || l.includes('[✨]')) {
                    ctx.fillStyle = '#3fb950';
                    ctx.fillText(l, 170, y);
                  } else {
                    ctx.fillStyle = '#c9d1d9';
                    ctx.fillText(l, 170, y);
                  }
                  y += 28;
                }
                drawOverlays();
                done();
              } else if (base64Jpg) {
                // Draw the actual rendered web page
                const img = new Image();
                img.onload = () => {
                  ctx.drawImage(img, 0, 0, ${width}, ${height});
                  drawOverlays();
                  done();
                };
                img.src = 'data:image/jpeg;base64,' + base64Jpg;
              } else {
                drawOverlays();
                done();
              }
            });
          },
          finish: () => {
            recorder.stop();
            return finishPromise;
          }
        };

        function drawOverlays() {
          // Bottom-left sleek floating HUD card (NEVER overlaps top toolbar or bottom-right dock!)
          if (activeHud.title) {
            const cardX = 24;
            const cardY = ${height} - 94;
            const cardW = 560;
            const cardH = 70;
            const radius = 10;

            // Glassmorphism background
            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, radius);
            ctx.fill();

            // Accent border
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Tag badge inside HUD
            let titleOffset = 20;
            if (activeHud.tier) {
              ctx.fillStyle = '#238636';
              ctx.beginPath();
              ctx.roundRect(cardX + 16, cardY + 12, 130, 20, 4);
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
              ctx.fillText(activeHud.tier, cardX + 24, cardY + 26);
              titleOffset = 158;
            }

            // Title
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(activeHud.title, cardX + titleOffset, cardY + 27);

            // Subtitle
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(activeHud.subtitle, cardX + 20, cardY + 52);
          }
        }
      })();
    `
  });

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function pushFrame(options = {}) {
    let base64Jpg = null;
    if (options.capturePage) {
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      base64Jpg = shot?.data || null;
    }
    await send('Runtime.evaluate', {
      expression: `window.__VIDEO_RECORDER__.renderFrame(${base64Jpg ? JSON.stringify(base64Jpg) : 'null'})`,
      awaitPromise: true
    });
  }

  async function holdScene(durationMs, capturePage = true, stepMs = 100) {
    const steps = Math.max(1, Math.floor(durationMs / stepMs));
    for (let i = 0; i < steps; i++) {
      await pushFrame({ capturePage: capturePage && (i % 2 === 0) });
      await sleep(stepMs);
    }
  }

  // ═══════════════════════════════════════════════════════
  // SCENE 1: Terminal CLI Compilation Journey
  // ═══════════════════════════════════════════════════════
  console.log('▶ Recording Scene 1: Terminal CLI Execution...');
  await send('Runtime.evaluate', {
    expression: `window.__VIDEO_RECORDER__.setMode('terminal');
      window.__VIDEO_RECORDER__.setHud('1. CLI & COMPILATION', 'Step 1: Terminal Compilation & Synthesis', 'Executing data-archify CLI to ingest multi-tier template, resolve graph and inject contracts.');`
  });

  const cliCommands = [
    { text: '$ data-archify render --input templates/04-enterprise-full-platform.json --out enterprise.html', delay: 800 },
    { text: '  [✓] Reading architecture definition: templates/04-enterprise-full-platform.json', delay: 400 },
    { text: '  [✓] Loaded graph: 17 nodes, 16 edges across 9 technology tiers', delay: 400 },
    { text: '  [✓] Running Archify topological BFS grid layout & boundary solver...', delay: 500 },
    { text: '  [✓] Delivered publication-ready architecture: enterprise.html (9/9 checks pass)', delay: 500 },
    { text: '  [✓] Injecting Interactive Semantic Passport, Volumetry & Compute Sizing...', delay: 400 },
    { text: '  [✓] Generated companion data governance report: enterprise_contracts.md', delay: 500 },
    { text: '  [✨] Complete Enterprise Platform is ready to explore!', delay: 1000 }
  ];

  for (const cmd of cliCommands) {
    await send('Runtime.evaluate', {
      expression: `window.__VIDEO_RECORDER__.addTermLine(${JSON.stringify(cmd.text)})`
    });
    await holdScene(cmd.delay, false, 80);
  }

  await holdScene(1500, false, 80);

  // ═══════════════════════════════════════════════════════
  // SCENE 2: Landing on Diagram & Entering Presentation Mode
  // ═══════════════════════════════════════════════════════
  console.log('▶ Recording Scene 2: Standard Viewer & Entering Presentation Mode...');
  await send('Runtime.evaluate', {
    expression: `
      window.__VIDEO_RECORDER__.setMode('diagram');
      window.__VIDEO_RECORDER__.setHud('2. FULL PLATFORM VIEW', 'Step 2: Entering Presentation Mode (Fullscreen Stage)', 'Activating presentation stage mode: diagram fits viewport with active top toolbar and dock.');
      if (window.Archify && Archify.presentation) Archify.presentation.enter();
      if (window.Archify && Archify.focus) Archify.focus.clear();
      if (window.Archify && Archify.view) Archify.view.reset();
    `
  });
  await sleep(600);
  await holdScene(3500, true, 120);

  // ═══════════════════════════════════════════════════════
  // SCENE 3: Native Controls Showcase (MAP, LENS, Finder 🔍, Zoom)
  // ═══════════════════════════════════════════════════════
  console.log('▶ Recording Scene 3: Native Interactive Features (MAP, LENS, Finder, Zoom)...');

  // 3A: Spatial Radar / Overview Map
  console.log('  -> Showcasing Spatial Radar (MAP)...');
  await send('Runtime.evaluate', {
    expression: `
      window.__VIDEO_RECORDER__.setHud('FEATURE: MAP', 'Spatial Radar (MAP) — Interactive Mini-Map', 'Clicking MAP opens radar mini-map in bottom-right for global orientation across all 17 nodes.');
      if (window.Archify && Archify.radar) Archify.radar.open();
    `
  });
  await sleep(400);
  await holdScene(2800, true, 120);

  await send('Runtime.evaluate', {
    expression: 'if (window.Archify && Archify.radar) Archify.radar.close();'
  });
  await sleep(400);

  // 3B: Semantic Lens (Filtering by category)
  console.log('  -> Showcasing Semantic Lens (LENS)...');
  await send('Runtime.evaluate', {
    expression: `
      window.__VIDEO_RECORDER__.setHud('FEATURE: LENS', 'Semantic Lens (LENS) — Category Highlighting', 'Clicking LENS filters components by role: highlighting database & storage tier components.');
      if (window.Archify && Archify.semanticLens) {
        Archify.semanticLens.open();
        Archify.semanticLens.select('database');
      }
    `
  });
  await sleep(400);
  await holdScene(2800, true, 120);

  await send('Runtime.evaluate', {
    expression: `
      if (window.Archify && Archify.semanticLens) {
        Archify.semanticLens.clear();
        Archify.semanticLens.close();
      }
    `
  });
  await sleep(400);

  // 3C: Node Finder Search (🔍)
  console.log('  -> Showcasing Node Finder (🔍)...');
  await send('Runtime.evaluate', {
    expression: `
      window.__VIDEO_RECORDER__.setHud('FEATURE: FINDER', 'Node Finder (🔍) — Fast Component Search', 'Searching \"Aurora\" quickly identifies, navigates, and isolates target database in diagram.');
      if (window.Archify && Archify.finder) {
        Archify.finder.open();
        const input = document.getElementById('node-finder-input');
        if (input) {
          input.value = 'aurora';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    `
  });
  await sleep(400);
  await holdScene(2600, true, 120);

  await send('Runtime.evaluate', {
    expression: 'if (window.Archify && Archify.finder) Archify.finder.close();'
  });
  await sleep(400);

  // 3D: Viewport Zoom Controls (- / 100% / +)
  console.log('  -> Showcasing Viewport Zoom & Scaling...');
  await send('Runtime.evaluate', {
    expression: `
      window.__VIDEO_RECORDER__.setHud('FEATURE: ZOOM', 'Viewport Zoom & Canvas Controls', 'Fluid scaling controls (+ / - / 100%) for zooming into dense architectural clusters.');
      if (window.Archify && Archify.view) Archify.view.zoomIn();
    `
  });
  await holdScene(1400, true, 120);

  await send('Runtime.evaluate', {
    expression: 'if (window.Archify && Archify.view) Archify.view.zoomOut();'
  });
  await holdScene(1200, true, 120);

  await send('Runtime.evaluate', {
    expression: 'if (window.Archify && Archify.view) Archify.view.reset();'
  });
  await holdScene(1600, true, 120);

  // ═══════════════════════════════════════════════════════
  // SCENE 4: End-to-End Route Tracing (PATH)
  // ═══════════════════════════════════════════════════════
  console.log('▶ Recording Scene 4: End-to-End Route Tracing (PATH)...');
  await send('Runtime.evaluate', {
    expression: `
      window.__VIDEO_RECORDER__.setHud('FEATURE: PATH', 'Route Probe (PATH) — End-to-End Path Tracing', 'Clicking PATH connects Storefront Web App to Delta Lake Gold, illuminating entire traversed pipeline.');
      if (window.Archify && Archify.routeProbe) {
        Archify.routeProbe.begin();
        Archify.routeProbe.choose('fe_ecommerce_web');
        Archify.routeProbe.choose('table_delta_gold_kpis');
      }
    `
  });
  await sleep(600);
  await holdScene(4500, true, 120);

  await send('Runtime.evaluate', {
    expression: 'if (window.Archify && Archify.routeProbe) Archify.routeProbe.clear();'
  });
  await sleep(500);

  // ═══════════════════════════════════════════════════════
  // SCENE 5: Cadenced Step-by-Step Drill-down Through Nodes & Contracts
  // ═══════════════════════════════════════════════════════
  console.log('▶ Recording Scene 5: Cadenced Step-by-Step Drill-down with Data Contracts...');

  const journeySteps = [
    {
      nodeId: 'db_aurora_oltp',
      tier: 'TRUNK A — OLTP SOURCE',
      title: 'Branch A — Orders & Customers Aurora PG',
      subtitle: 'Transactional PostgreSQL handling 25M orders/day with real-time WAL replication.',
      duration: 3800,
      hasScroll: true
    },
    {
      nodeId: 'proc_debezium_cdc',
      tier: 'TRUNK A — LOG CDC',
      title: 'Branch A — Debezium CDC Engine',
      subtitle: 'Log-based Change Data Capture engine with sub-200ms CDC streaming lag.',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'bus_kafka_msk',
      tier: 'TRUNK A — EVENT BUS',
      title: 'Branch A — Amazon MSK Kafka Cluster',
      subtitle: 'Managed Apache Kafka streaming 35,000 events/sec across 3 availability zones.',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'fe_storefront_app',
      tier: 'TRUNK B — CLICKSTREAM',
      title: 'Branch B — Storefront Web & Mobile',
      subtitle: 'Next.js 15 customer storefront producing clickstream payloads (50,000 req/sec).',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'api_gateway_core',
      tier: 'TRUNK B — INGRESS GATEWAY',
      title: 'Branch B — Central API Gateway',
      subtitle: 'AWS API Gateway routing traffic with sub-15ms latency and rate limiting.',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'queue_sqs_events',
      tier: 'TRUNK B — QUEUE BUFFER',
      title: 'Branch B — Lake Buffer SQS FIFO Queue',
      subtitle: 'Strictly-ordered SQS FIFO queue acting as a backpressure buffer.',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'lake_s3_bronze',
      tier: 'CORE HUB — BRONZE LAKE',
      title: 'Storage Hub — S3 Raw/Bronze Lakehouse',
      subtitle: 'Immutable multi-region S3 bucket receiving raw CDC streams (850 GB/day).',
      duration: 3800,
      hasScroll: false
    },
    {
      nodeId: 'table_iceberg_silver',
      tier: 'CORE HUB — SILVER LAKE',
      title: 'Storage Hub — Cleansed Iceberg Silver Lake',
      subtitle: 'ACID-compliant Apache Iceberg Silver table with column contracts and upstream lineage.',
      duration: 4500,
      hasScroll: true
    },
    {
      nodeId: 'proc_emr_spark',
      tier: 'FAN-OUT 1 — BATCH SPARK',
      title: 'Branch 1 — Amazon EMR Feature Spark',
      subtitle: 'Distributed Spark cluster: 16x r5.4xlarge nodes (2,176 GB RAM total capacity).',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'table_delta_gold_marts',
      tier: 'FAN-OUT 1 — GOLD MARTS',
      title: 'Branch 1 — Delta Lake Gold Business Marts',
      subtitle: 'Vectorized Databricks Delta Lake tables powering corporate finance and analytics.',
      duration: 4200,
      hasScroll: true
    },
    {
      nodeId: 'wh_snowflake_dw',
      tier: 'FAN-OUT 1 — CLOUD DW',
      title: 'Branch 1 — Snowflake Analytics DW',
      subtitle: 'Enterprise data warehouse serving self-service ad-hoc SQL and BI dashboards.',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'proc_flink_streaming',
      tier: 'FAN-OUT 2 — STREAM ENGINE',
      title: 'Branch 2 — Apache Flink Stream Engine',
      subtitle: 'Stateful stream processing engine computing rolling 5-min user behavior windows.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'store_dynamodb_features',
      tier: 'FAN-OUT 2 — FEATURE STORE',
      title: 'Branch 2 — DynamoDB Real-time Feature Store',
      subtitle: 'Low-latency NoSQL feature store serving real-time vectors to online ML models.',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'svc_ml_inference_api',
      tier: 'FAN-OUT 2 — ML INFERENCE',
      title: 'Branch 2 — Real-time ML Inference API',
      subtitle: 'FastAPI microservice predicting personalized product recommendations (< 25ms).',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'orch_airflow_master',
      tier: 'FAN-OUT 3 — ORCHESTRATION',
      title: 'Branch 3 — Master Lakehouse MWAA DAG',
      subtitle: 'Managed Apache Airflow 2.9 DAG orchestrating cross-system SLA dependencies.',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'svc_reverse_etl',
      tier: 'FAN-OUT 3 — REVERSE ETL',
      title: 'Branch 3 — Reverse ETL Sync Engine',
      subtitle: 'Sync engine exporting curated customer lifetime value into operational CRM tools.',
      duration: 3200,
      hasScroll: false
    },
    {
      nodeId: 'notif_ses_gateway',
      tier: 'FAN-OUT 3 — NOTIFICATIONS',
      title: 'Branch 3 — Customer Notification SES Hub',
      subtitle: 'Automated transactional email gateway sending purchase receipts (12M emails/day).',
      duration: 3200,
      hasScroll: false
    }
  ];

  let stepIdx = 0;
  for (const step of journeySteps) {
    stepIdx++;
    console.log(`  [${stepIdx}/17] Visiting ${step.title.split('—')[0]}...`);

    // Set HUD and focus node in Archify
    await send('Runtime.evaluate', {
      expression: `
        window.__VIDEO_RECORDER__.setHud(${JSON.stringify(step.tier)}, ${JSON.stringify(step.title)}, ${JSON.stringify(step.subtitle)});
        if (window.Archify && Archify.focus) {
          Archify.focus.set('${step.nodeId}', { toggle: false });
        }
        if (window.Archify && Archify.view) {
          Archify.view.reveal(['${step.nodeId}'], { includeNeighbors: true });
        }
      `
    });

    await sleep(400);

    if (step.hasScroll) {
      // First hold to read top details (location, criticality, SLAs)
      await holdScene(1800, true, 120);

      // Scroll column table down to reveal source lineage
      await send('Runtime.evaluate', {
        expression: `
          const wrap = document.querySelector('.da-table-wrap');
          if (wrap) wrap.scrollTop = 70;
        `
      });
      await sleep(200);
      await holdScene(step.duration - 1800, true, 120);
    } else {
      await holdScene(step.duration, true, 120);
    }
  }

  // ═══════════════════════════════════════════════════════
  // SCENE 6: Finale Return to Big Picture
  // ═══════════════════════════════════════════════════════
  console.log('▶ Recording Scene 6: Finale Return to Big Picture...');
  await send('Runtime.evaluate', {
    expression: `
      window.__VIDEO_RECORDER__.setHud('20. COMPLETE PLATFORM', 'Architecture Synthesized & Published Successfully', 'Seamless pairing of Data Contracts, Compute Sizing, Volumetry, and Multi-Cloud Lineage with data-archify.');
      if (window.Archify && Archify.focus) Archify.focus.clear();
      if (window.Archify && Archify.view) Archify.view.reset();
    `
  });
  await sleep(600);
  await holdScene(4500, true, 120);

  // Stop recording and retrieve video
  console.log('Finalizing video encoding...');
  const finishRes = await send('Runtime.evaluate', {
    expression: 'window.__VIDEO_RECORDER__.finish()',
    awaitPromise: true,
    returnByValue: true
  });

  const base64Video = finishRes?.result?.value;
  if (!base64Video) {
    chrome.kill();
    throw new Error('Failed to retrieve video stream from browser');
  }

  const outputVideoPath = path.resolve(__dirname, '../video/data-archify-complete-journey.webm');
  const videoBuffer = Buffer.from(base64Video, 'base64');
  fs.writeFileSync(outputVideoPath, videoBuffer);

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  🎉 Cadenced Full Journey Video generated successfully!`);
  console.log(`  📁 Path: ${outputVideoPath}`);
  console.log(`  📊 Size: ${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
  console.log('═══════════════════════════════════════════════════════');

  chrome.kill();
}

main().catch(err => {
  console.error('Video generation failed:', err);
  process.exit(1);
});
