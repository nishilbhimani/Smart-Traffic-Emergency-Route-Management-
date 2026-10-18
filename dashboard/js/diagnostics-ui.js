/**
 * Pulse · Smart Traffic & Emergency Route Management
 * Diagnostics Modal & Developer Console UI (DiagnosticsUI)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./diagnostics.js'), require('./preferences.js'), require('./error-boundary.js'));
  } else {
    root.DiagnosticsUI = factory(root.PulseDiagnostics, root.PulsePreferences, root.PulseErrorBoundary);
  }
})(typeof self !== 'undefined' ? self : this, function (Diagnostics, Preferences, ErrorBoundary) {
  'use strict';

  let currentFilter = null;
  let unsubscribeLogs = null;

  function ensureModalHtml() {
    if (document.getElementById('diagnosticsModalScrim')) return;

    const modal = document.createElement('div');
    modal.id = 'diagnosticsModalScrim';
    modal.className = 'diag-modal-scrim';
    modal.onclick = close;

    modal.innerHTML = `
      <div class="diag-modal-card" onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="diagModalTitle">
        <div class="diag-header">
          <div class="diag-title-row">
            <div class="brand-logo-disc" style="width:32px; height:32px; font-size:14px;"><i class="fa-solid fa-stethoscope"></i></div>
            <div>
              <h3 id="diagModalTitle" style="font-size:16px; font-weight:700; margin:0;">System Diagnostics &amp; Health</h3>
              <p style="font-size:12px; color:var(--text-secondary); margin:0;">Real-time telemetry, fault isolation &amp; observability</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge-subtle badge-blue" style="font-size:11px; font-weight:700;">v2.4.0</span>
            <button class="action-icon-menu-btn" onclick="DiagnosticsUI.close()" style="border-radius:50%; width:30px; height:30px;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div class="diag-body">
          <div class="diag-stat-grid">
            <div class="diag-stat-box">
              <div class="diag-stat-label">System Health</div>
              <div class="diag-stat-val" id="diagHealthVal" style="color:var(--success);">Normal</div>
            </div>
            <div class="diag-stat-box">
              <div class="diag-stat-label">Render Frame Rate</div>
              <div class="diag-stat-val" id="diagFpsVal">60 <span style="font-size:11px; color:var(--text-secondary);">FPS</span></div>
            </div>
            <div class="diag-stat-box">
              <div class="diag-stat-label">Total Events</div>
              <div class="diag-stat-val" id="diagEventsVal">0</div>
            </div>
            <div class="diag-stat-box">
              <div class="diag-stat-label">Storage Backend</div>
              <div class="diag-stat-val" id="diagStorageVal" style="font-size:13px; font-weight:600;">LocalStorage</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div class="diag-tabs" style="margin:0; border:none; padding:0;">
              <button class="diag-tab-btn active" data-filter="all" onclick="DiagnosticsUI.setFilter(null, this)">All Logs</button>
              <button class="diag-tab-btn" data-filter="event" onclick="DiagnosticsUI.setFilter('event', this)">Analytics</button>
              <button class="diag-tab-btn" data-filter="error" onclick="DiagnosticsUI.setFilter('error', this)">Errors</button>
              <button class="diag-tab-btn" data-filter="metric" onclick="DiagnosticsUI.setFilter('metric', this)">Metrics</button>
            </div>
            <span style="font-size:11px; color:var(--text-tertiary);" id="diagLogCount">0 entries</span>
          </div>

          <div class="diag-log-container" id="diagLogContainer">
            <div style="color:var(--text-tertiary); text-align:center; padding:20px;">No diagnostic events recorded yet.</div>
          </div>
        </div>

        <div class="diag-footer">
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-accent" onclick="DiagnosticsUI.exportJson()" style="font-size:12px; padding:6px 14px;">
              <i class="fa-solid fa-download"></i> Export JSON
            </button>
            <button type="button" class="btn-error-reset" onclick="DiagnosticsUI.simulateError()" style="font-size:12px; padding:6px 14px;">
              <i class="fa-solid fa-bug"></i> Test Fault Isolation
            </button>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-error-reset" onclick="DiagnosticsUI.clear()" style="font-size:12px; padding:6px 14px;">
              Clear Logs
            </button>
            <button type="button" class="btn-error-reset" onclick="DiagnosticsUI.close()" style="font-size:12px; padding:6px 14px;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function render() {
    ensureModalHtml();
    if (!Diagnostics) return;

    const summary = Diagnostics.getSummary();
    const healthEl = document.getElementById('diagHealthVal');
    if (healthEl) {
      healthEl.textContent = summary.health.toUpperCase();
      healthEl.style.color = summary.health === 'normal' ? 'var(--success)' : (summary.health === 'warning' ? 'var(--warning)' : 'var(--danger)');
    }

    const fpsEl = document.getElementById('diagFpsVal');
    if (fpsEl) {
      fpsEl.innerHTML = `${summary.currentFps} <span style="font-size:11px; color:var(--text-secondary);">FPS (avg ${summary.avgFps})</span>`;
    }

    const eventsEl = document.getElementById('diagEventsVal');
    if (eventsEl) {
      eventsEl.textContent = `${summary.totalEvents} (${summary.totalErrors} err)`;
    }

    const storageEl = document.getElementById('diagStorageVal');
    if (storageEl) {
      storageEl.textContent = summary.storageMode === 'persistent' ? 'Local Persistent' : 'Memory Safe-Fallback';
      storageEl.style.color = summary.storageMode === 'persistent' ? 'var(--success)' : 'var(--warning)';
    }

    const logs = Diagnostics.getLogs(currentFilter);
    const countEl = document.getElementById('diagLogCount');
    if (countEl) countEl.textContent = `${logs.length} entries`;

    const container = document.getElementById('diagLogContainer');
    if (container) {
      if (!logs.length) {
        container.innerHTML = `<div style="color:var(--text-tertiary); text-align:center; padding:20px;">No ${currentFilter ? currentFilter : ''} logs in buffer.</div>`;
      } else {
        container.innerHTML = logs
          .slice(-60)
          .reverse()
          .map((item) => {
            const time = item.timestamp.split('T')[1].split('.')[0];
            const badgeClass = item.type === 'error' ? 'diag-badge-error' : (item.type === 'metric' ? 'diag-badge-metric' : 'diag-badge-event');
            let contentStr = '';
            if (item.type === 'event') {
              contentStr = `<strong>${escapeHtml(item.event)}</strong> · ${escapeHtml(JSON.stringify(item.payload))}`;
            } else if (item.type === 'error') {
              contentStr = `<strong style="color:var(--danger);">${escapeHtml(item.message)}</strong> [${escapeHtml(item.correlationId)}] <span style="color:var(--text-tertiary); font-size:10px;">${escapeHtml(item.category)}</span>`;
            } else if (item.type === 'metric') {
              contentStr = `<strong>${escapeHtml(item.name)}</strong>: ${item.value} ${item.unit} (avg ${item.avg})`;
            }
            return `
              <div class="diag-log-row">
                <span class="diag-log-time">${time}</span>
                <span class="diag-log-badge ${badgeClass}">${item.type}</span>
                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${contentStr}</div>
              </div>
            `;
          })
          .join('');
      }
    }
  }

  function setFilter(type, btn) {
    currentFilter = type;
    if (btn && btn.parentElement) {
      btn.parentElement.querySelectorAll('.diag-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }
    render();
  }

  function open() {
    ensureModalHtml();
    const modal = document.getElementById('diagnosticsModalScrim');
    if (modal) {
      modal.classList.add('visible');
      render();
      if (Diagnostics && !unsubscribeLogs) {
        unsubscribeLogs = Diagnostics.subscribeLogs(render);
      }
    }
    if (Diagnostics) {
      Diagnostics.track('ui:diagnostics_opened');
    }
  }

  function close() {
    const modal = document.getElementById('diagnosticsModalScrim');
    if (modal) {
      modal.classList.remove('visible');
    }
    if (unsubscribeLogs) {
      unsubscribeLogs();
      unsubscribeLogs = null;
    }
  }

  function toggle() {
    const modal = document.getElementById('diagnosticsModalScrim');
    if (modal && modal.classList.contains('visible')) {
      close();
    } else {
      open();
    }
  }

  function exportJson() {
    if (!Diagnostics) return;
    const report = Diagnostics.exportReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-diagnostics-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (window.showToast) window.showToast('Diagnostics Exported', 'Full observability report downloaded.');
  }

  function clear() {
    if (Diagnostics) Diagnostics.clear();
    render();
    if (window.showToast) window.showToast('Logs Cleared', 'In-memory telemetry buffer reset.');
  }

  function simulateError() {
    close();
    const testContainer = document.querySelector('.metrics-clean-bar');
    if (testContainer && ErrorBoundary) {
      ErrorBoundary.renderFallback(
        testContainer,
        new Error('Simulated network sensor hardware failure (Signal #104 Bandra)'),
        {
          title: 'Simulated Module Fault Isolation',
          message: 'This demonstrates that a failure in one section is isolated and recoverable without crashing the application shell.',
          category: 'fault_isolation_test'
        },
        () => {
          if (window.showToast) window.showToast('Section Recovered', 'Metrics bar restored successfully.');
        }
      );
      if (window.showToast) window.showToast('Test Triggered', 'Simulated fault isolated in overview section.');
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    open,
    close,
    toggle,
    setFilter,
    exportJson,
    clear,
    simulateError,
    render
  };
});
