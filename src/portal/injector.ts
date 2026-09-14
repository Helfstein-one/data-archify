import { DataGraph } from '../graph/models';
import * as fs from 'fs';

export function injectInteractivePortal(graph: DataGraph, htmlPath: string) {
  let html = fs.readFileSync(htmlPath, 'utf8');

  const payload = JSON.stringify(graph);

  const scriptAndStyles = `
    <style>
      .da-injected-passport {
        margin-top: 0.55rem;
        padding: 0.6rem;
        border: 1px solid color-mix(in srgb, var(--frontend-stroke, #38bdf8) 35%, var(--toolbar-border, rgba(255, 255, 255, 0.15)));
        border-radius: 0.55rem;
        background: color-mix(in srgb, var(--backend-fill, #1e293b) 20%, var(--panel, #0f172a));
        color: var(--text, #e2e8f0);
        font-family: inherit;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
      .da-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.45rem;
      }
      .da-section-label {
        font-size: 0.52rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--frontend-stroke, #38bdf8);
      }
      .da-location-badge {
        display: block;
        margin-bottom: 0.45rem;
        padding: 0.25rem 0.45rem;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.35rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.68rem;
        color: #38bdf8;
        word-break: break-all;
      }
      .da-meta-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
        margin-bottom: 0.55rem;
      }
      .da-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.15rem 0.4rem;
        border-radius: 999px;
        font-size: 0.52rem;
        font-weight: 600;
        border: 1px solid transparent;
      }
      .da-chip-crit {
        background: rgba(239, 68, 68, 0.18);
        border-color: rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }
      .da-chip-sla {
        background: rgba(245, 158, 11, 0.18);
        border-color: rgba(245, 158, 11, 0.4);
        color: #fcd34d;
      }
      .da-chip-owner {
        background: rgba(99, 102, 241, 0.18);
        border-color: rgba(99, 102, 241, 0.4);
        color: #c7d2fe;
      }
      .da-chip-cat {
        background: rgba(16, 185, 129, 0.18);
        border-color: rgba(16, 185, 129, 0.4);
        color: #6ee7b7;
      }
      .da-chip-msg {
        background: rgba(168, 85, 247, 0.18);
        border-color: rgba(168, 85, 247, 0.4);
        color: #d8b4fe;
      }
      .da-chip-vol {
        background: rgba(14, 165, 233, 0.18);
        border-color: rgba(14, 165, 233, 0.4);
        color: #7dd3fc;
      }
      .da-compute-card {
        margin-bottom: 0.55rem;
        padding: 0.4rem 0.5rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.4rem;
        font-size: 0.58rem;
      }
      .da-compute-head {
        font-weight: 700;
        color: #f59e0b;
        margin-bottom: 0.25rem;
        display: flex;
        justify-content: space-between;
      }
      .da-compute-desc {
        color: #94a3b8;
        font-size: 0.54rem;
        line-height: 1.3;
      }
      .da-table-wrap {
        max-height: 220px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.35rem;
        background: rgba(0, 0, 0, 0.2);
      }
      .da-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.58rem;
        text-align: left;
      }
      .da-table th {
        position: sticky;
        top: 0;
        background: #111827;
        padding: 0.3rem 0.45rem;
        font-weight: 700;
        color: #94a3b8;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .da-table td {
        padding: 0.3rem 0.45rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        color: #cbd5e1;
        vertical-align: top;
      }
      .da-col-name {
        font-weight: 600;
        color: #f8fafc;
      }
      .da-col-type {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #a78bfa;
        font-size: 0.54rem;
      }
      .da-col-lineage {
        color: #38bdf8;
        font-size: 0.52rem;
        word-break: break-all;
      }
      .da-empty-cols {
        padding: 0.4rem;
        font-size: 0.55rem;
        color: #94a3b8;
        font-style: italic;
      }
    </style>

    <script>
      (function() {
        const graph = ${payload};
        window.__DATA_ARCHIFY_METADATA__ = graph;

        let lastInjectedId = null;

        function updatePassport() {
          const chip = document.getElementById('focus-chip');
          const semanticIdEl = document.getElementById('focus-id');
          const metaContainer = document.getElementById('focus-passport-meta');

          if (!chip || chip.hidden || !semanticIdEl || !metaContainer) {
            return;
          }

          const currentId = (semanticIdEl.textContent || '').trim();
          if (!currentId) return;

          // If already injected for this ID, don't redo
          let injectedEl = document.getElementById('da-injected-passport');
          if (injectedEl && injectedEl.getAttribute('data-node-id') === currentId) {
            return;
          }

          // Match the currentId with graph nodes
          const node = graph.nodes.find(n => n.id.replace(/[^a-zA-Z0-9_-]/g, '_') === currentId);
          if (!node) {
            if (injectedEl) injectedEl.style.display = 'none';
            return;
          }

          if (!injectedEl) {
            injectedEl = document.createElement('div');
            injectedEl.id = 'da-injected-passport';
            injectedEl.className = 'da-injected-passport';
            metaContainer.parentNode.insertBefore(injectedEl, metaContainer.nextSibling);
          }

          injectedEl.style.display = 'block';
          injectedEl.setAttribute('data-node-id', currentId);
          lastInjectedId = currentId;

          let html = '';
          html += '<div class="da-header-row">';
          html += '  <span class="da-section-label">Data Contract & Architecture</span>';
          if (node.category) {
            const catClass = node.category === 'MESSAGING' ? 'da-chip-msg' : (node.category === 'PROCESS' ? 'da-chip-crit' : 'da-chip-cat');
            html += '  <span class="da-chip ' + catClass + '">' + node.category + '</span>';
          }
          html += '</div>';

          // location / resource address
          if (node.location) {
            const locLabel = node.category === 'MESSAGING' ? 'Resource / Topic:' : (node.category === 'PROCESS' ? 'Compute Target:' : 'database.table:');
            html += '<div class="da-location-badge"><strong>' + locLabel + ' </strong>' + escapeHtml(node.location) + '</div>';
          }

          // Metadata Chips (SLA, SLO, Criticality, Owner)
          if (node.metadata) {
            html += '<div class="da-meta-chips">';
            if (node.metadata.criticality) {
              html += '<span class="da-chip da-chip-crit">Crit: ' + escapeHtml(node.metadata.criticality) + '</span>';
            }
            if (node.metadata.sla) {
              html += '<span class="da-chip da-chip-sla">SLA: ' + escapeHtml(node.metadata.sla) + '</span>';
            }
            if (node.metadata.slo) {
              html += '<span class="da-chip da-chip-sla">SLO: ' + escapeHtml(node.metadata.slo) + '</span>';
            }
            if (node.metadata.owner) {
              html += '<span class="da-chip da-chip-owner">' + escapeHtml(node.metadata.owner) + '</span>';
            }
            html += '</div>';
          }

          // Volumetry Section
          if (node.volumetry) {
            html += '<div class="da-meta-chips" style="margin-top: 0.35rem;">';
            if (node.volumetry.volume_per_day) {
              html += '<span class="da-chip da-chip-vol">📦 ' + escapeHtml(node.volumetry.volume_per_day) + '</span>';
            }
            if (node.volumetry.throughput) {
              html += '<span class="da-chip da-chip-vol">⚡ ' + escapeHtml(node.volumetry.throughput) + '</span>';
            }
            if (node.volumetry.records_per_day) {
              html += '<span class="da-chip da-chip-vol">📊 ' + escapeHtml(node.volumetry.records_per_day) + '</span>';
            }
            if (node.volumetry.batch_window) {
              html += '<span class="da-chip da-chip-vol">⏱️ ' + escapeHtml(node.volumetry.batch_window) + '</span>';
            }
            if (node.volumetry.retention) {
              html += '<span class="da-chip da-chip-vol">🗓️ Retenção: ' + escapeHtml(node.volumetry.retention) + '</span>';
            }
            html += '</div>';
          }

          // Compute & Sizing Section
          if (node.compute) {
            html += '<div class="da-compute-card">';
            html += '  <div class="da-compute-head">';
            html += '    <span>⚙️ Compute: ' + escapeHtml(node.compute.engine ? node.compute.engine.toUpperCase() : 'ENGINE') + '</span>';
            if (node.compute.sizing) {
              html += '    <span style="color:#6ee7b7; font-family:monospace;">' + escapeHtml(node.compute.sizing) + '</span>';
            }
            html += '  </div>';
            if (node.compute.memory) {
              html += '  <div class="da-compute-desc"><strong>Memory:</strong> ' + escapeHtml(node.compute.memory) + '</div>';
            }
            if (node.compute.rationale) {
              html += '  <div class="da-compute-desc"><strong>Dimensionamento:</strong> ' + escapeHtml(node.compute.rationale) + '</div>';
            }
            html += '</div>';
          }

          // Columns Table
          if (node.columns && node.columns.length > 0) {
            html += '<div class="da-header-row"><span class="da-section-label">Columns (' + node.columns.length + ')</span></div>';
            html += '<div class="da-table-wrap">';
            html += '  <table class="da-table">';
            html += '    <thead>';
            html += '      <tr>';
            html += '        <th>Column</th>';
            html += '        <th>Type</th>';
            html += '        <th>Lineage (Source)</th>';
            html += '      </tr>';
            html += '    </thead>';
            html += '    <tbody>';
            node.columns.forEach(col => {
              const lineageText = col.source_columns && col.source_columns.length > 0
                ? col.source_columns.map(escapeHtml).join('<br>')
                : '<span style="color:#64748b;">-</span>';

              html += '      <tr>';
              html += '        <td class="da-col-name">' + escapeHtml(col.name) + '</td>';
              html += '        <td class="da-col-type">' + escapeHtml(col.type || 'any') + '</td>';
              html += '        <td class="da-col-lineage">' + lineageText + '</td>';
              html += '      </tr>';
            });
            html += '    </tbody>';
            html += '  </table>';
            html += '</div>';
          } else {
            html += '<div class="da-empty-cols">No columns defined for this asset</div>';
          }

          injectedEl.innerHTML = html;
        }

        function escapeHtml(str) {
          if (!str) return '';
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        }

        function init() {
          const chip = document.getElementById('focus-chip');
          const semanticIdEl = document.getElementById('focus-id');

          if (semanticIdEl) {
            // Observe text changes on semanticIdEl
            const idObserver = new MutationObserver(updatePassport);
            idObserver.observe(semanticIdEl, { childList: true, characterData: true, subtree: true });
          }

          if (chip) {
            // Observe hidden attribute on focus-chip
            const chipObserver = new MutationObserver(updatePassport);
            chipObserver.observe(chip, { attributes: true, attributeFilter: ['hidden'] });
          }

          // Polling heartbeat as a robust fallback
          setInterval(updatePassport, 100);

          // Component click trigger
          document.addEventListener('click', () => {
            setTimeout(updatePassport, 20);
          }, true);

          // Initial run in case already focused on load
          updatePassport();
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
        } else {
          init();
        }
      })();
    </script>
  `;

  // Clean up any old injections in the file
  html = html.replace(/<style>[\s\S]*?\.da-injected-passport[\s\S]*?<\/script>/, '');
  html = html.replace(/<style>[\s\S]*?\.da-injected-container[\s\S]*?<\/script>/, '');
  html = html.replace(/<style>[\s\S]*?#da-popup[\s\S]*?<\/script>/, '');

  html = html.replace('</body>', scriptAndStyles + '\n</body>');
  fs.writeFileSync(htmlPath, html, 'utf8');
}
