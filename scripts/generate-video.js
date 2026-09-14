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
      nodeId: 'fe_ecommerce_web',
      tier: '3. FRONTEND TIER',
      title: 'Tier 1 — Storefront Web App (Next.js 15 / React 19)',
      subtitle: 'High-traffic customer shopping portal with 45,000 req/sec throughput and sub-100ms TTFB SLA.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'api_gateway_core',
      tier: '4. API GATEWAY',
      title: 'Tier 2 — Amazon API Gateway (AWS 2026 Badge)',
      subtitle: 'Edge routing with rate limiting, JWT validation and 4.3B daily requests with sub-15ms overhead.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'sec_vault_secrets',
      tier: '5. SECURITY & SECRETS',
      title: 'Tier 3 — AWS Secrets Manager',
      subtitle: 'Rotates database connection strings and payment API credentials every 30 days automatically.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'svc_order_processor',
      tier: '6. BACKEND SERVICES',
      title: 'Tier 4 — Order Orchestrator (Node.js microservice)',
      subtitle: 'Running on EKS Kubernetes HPA with 16 pods (64 GB RAM total cluster compute capacity).',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'db_aurora_orders',
      tier: '7. OPERATIONAL DATABASE',
      title: 'Tier 5 — Amazon Aurora PostgreSQL Multi-AZ',
      subtitle: 'ACID transactional database processing 15M orders/day with full column contract and typing displayed.',
      duration: 4200,
      hasScroll: true
    },
    {
      nodeId: 'bus_order_events',
      tier: '8. MESSAGING & PUB/SUB',
      title: 'Tier 6 — Amazon SNS Topic (order-events-stream)',
      subtitle: 'Pub/sub broadcast fan-out delivering 25,000 msg/sec with sub-20ms delivery SLA to consumers.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'queue_lake_buffer',
      tier: '9. QUEUING & BUFFER',
      title: 'Tier 7 — Amazon SQS FIFO Queue (lakehouse-ingestion.fifo)',
      subtitle: 'Throttles traffic spikes, deduplicates orders, and guarantees exactly-once delivery to storage.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'lake_s3_bronze',
      tier: '10. BRONZE DATA LAKE',
      title: 'Tier 8 — Amazon S3 Bronze (Raw Immutable Lake)',
      subtitle: 'Ingests 1.5 TB/day raw append-only Parquet logs with infinite Glacier 90d lifecycle policy.',
      duration: 4200,
      hasScroll: true
    },
    {
      nodeId: 'job_glue_silver_etl',
      tier: '11. SILVER PROCESSING',
      title: 'Tier 9 — AWS Glue 4.0 (Spark 3.3 Serverless)',
      subtitle: 'Provisioned with 16 DPUs (G.2X workers, 128 GB RAM distributed) for automated file compaction.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'table_iceberg_silver',
      tier: '12. APACHE ICEBERG',
      title: 'Tier 10 — Apache Iceberg Silver Table',
      subtitle: 'ACID transaction layer partitioned by order_date with 900 GB/day compressed and column-level lineage.',
      duration: 4500,
      hasScroll: true
    },
    {
      nodeId: 'proc_emr_features',
      tier: '13. EMR HEAVY PROCESSING',
      title: 'Tier 11 — Amazon EMR 7.1 Distributed Spark Cluster',
      subtitle: 'Heavy compute cluster: 16x r5.4xlarge instances, 2,048 GB RAM for cross-table graph feature store.',
      duration: 3800,
      hasScroll: false
    },
    {
      nodeId: 'proc_databricks_marts',
      tier: '14. DATABRICKS PHOTON',
      title: 'Tier 12 — Databricks Photon Delta Live Tables',
      subtitle: 'Vectorized query engine producing Gold KPI models daily by 05:00 UTC with automated file skipping.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'table_delta_gold_kpis',
      tier: '15. DELTA LAKE GOLD',
      title: 'Tier 13 — Delta Lake Gold Business KPIs',
      subtitle: 'Executive metrics: GMV, Churn, Active Buyers with upstream lineage pointing back to Iceberg Silver.',
      duration: 4500,
      hasScroll: true
    },
    {
      nodeId: 'orch_airflow_master',
      tier: '16. ORCHESTRATION',
      title: 'Tier 14 — Apache Airflow 2.9 (Amazon MWAA)',
      subtitle: 'Master DAG coordinating triggers, task sensors, SLA compliance, and cross-cloud synchronization.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'wh_snowflake_analytics',
      tier: '17. ANALYTICS WAREHOUSE',
      title: 'Tier 15 — Snowflake Data Cloud Hub',
      subtitle: 'Central analytical warehouse serving executive Tableau/PowerBI semantic models 24/7.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'dash_grafana_telemetry',
      tier: '18. OBSERVABILITY',
      title: 'Tier 16 — Grafana Platform Observability',
      subtitle: 'Real-time telemetry, service latency percentiles, error budgets, and queue lag monitoring.',
      duration: 3500,
      hasScroll: false
    },
    {
      nodeId: 'notif_ses_service',
      tier: '19. NOTIFICATIONS',
      title: 'Tier 17 — Amazon SES Notification Hub',
      subtitle: 'Customer transactional email service dispatching receipts and notifications (12M emails/day).',
      duration: 3500,
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
