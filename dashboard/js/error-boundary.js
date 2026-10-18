/**
 * Pulse · Smart Traffic & Emergency Route Management
 * Error Boundaries & Fault Isolation Module (PulseErrorBoundary)
 *
 * Capabilities:
 * - Component & tab execution isolation
 * - Accessible fallback UI rendering with incident reference IDs
 * - Safe event handler & async promise wrapper
 * - Simulation loop crash-loop breaker
 * - Global uncaught exception & rejection handlers
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./diagnostics.js'), require('./preferences.js'));
  } else {
    root.PulseErrorBoundary = factory(root.PulseDiagnostics, root.PulsePreferences);
  }
})(typeof self !== 'undefined' ? self : this, function (Diagnostics, Preferences) {
  'use strict';

  let hasGlobalHandlersAttached = false;
  let consecutiveSimErrors = 0;
  const MAX_CONSECUTIVE_SIM_ERRORS = 5;

  function initGlobalListeners() {
    if (hasGlobalHandlersAttached || typeof window === 'undefined') return;
    hasGlobalHandlersAttached = true;

    window.addEventListener('error', (event) => {
      // Ignore cross-origin script errors with no info
      if (event.message === 'Script error.' && !event.filename) return;

      if (Diagnostics) {
        Diagnostics.captureError(event.error || event.message, {
          category: 'unhandled_window_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason || 'Unhandled Promise Rejection';
      if (Diagnostics) {
        Diagnostics.captureError(reason, {
          category: 'unhandled_promise_rejection'
        });
      }
    });
  }

  function renderFallback(containerEl, err, context = {}, onRetry = null) {
    if (!containerEl) return;
    const correlationId = (Diagnostics && Diagnostics.captureError(err, context)) || ('ERR-' + Math.random().toString(36).substring(2, 8));

    const originalContent = containerEl.getAttribute('data-original-html') || containerEl.innerHTML;
    if (!containerEl.hasAttribute('data-original-html')) {
      containerEl.setAttribute('data-original-html', originalContent);
    }

    const title = context.title || 'Module Display Issue';
    const message = context.message || 'This section encountered an unexpected error during execution. All other Pulse services remain active.';

    containerEl.innerHTML = `
      <div class="error-boundary-card" role="alert" aria-live="assertive">
        <div class="error-boundary-icon">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="error-boundary-title">${escapeHtml(title)}</div>
        <div class="error-boundary-desc">${escapeHtml(message)}</div>
        <div class="error-boundary-reference">Incident Ref: ${escapeHtml(correlationId)}</div>
        <div class="error-boundary-actions">
          <button type="button" class="btn-error-retry" id="btnRetry_${correlationId}">
            <i class="fa-solid fa-arrow-rotate-right"></i> Retry Section
          </button>
          <button type="button" class="btn-error-reset" id="btnReset_${correlationId}">
            Reset Preferences
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById(`btnRetry_${correlationId}`);
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        containerEl.innerHTML = containerEl.getAttribute('data-original-html') || '';
        if (typeof onRetry === 'function') {
          try {
            onRetry();
          } catch (retryErr) {
            renderFallback(containerEl, retryErr, { ...context, title: 'Retry Failed' }, onRetry);
          }
        }
      });
    }

    const resetBtn = document.getElementById(`btnReset_${correlationId}`);
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (Preferences) Preferences.reset();
        window.location.reload();
      });
    }
  }

  function wrap(componentName, fn, containerEl, onRetry) {
    try {
      return fn();
    } catch (err) {
      renderFallback(
        containerEl,
        err,
        {
          category: 'component_render',
          component: componentName,
          title: `${componentName} Encountered an Issue`
        },
        onRetry
      );
      return null;
    }
  }

  function wrapHandler(handlerName, fn) {
    return function (...args) {
      try {
        return fn.apply(this, args);
      } catch (err) {
        if (Diagnostics) {
          Diagnostics.captureError(err, {
            category: 'event_handler',
            handler: handlerName
          });
        }
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast('Action Notice', 'The requested operation could not be completed safely.');
        }
      }
    };
  }

  function guardSimulationTick(tickFn, onRecoverableFailure) {
    try {
      tickFn();
      consecutiveSimErrors = 0;
    } catch (simErr) {
      consecutiveSimErrors++;
      if (Diagnostics) {
        Diagnostics.captureError(simErr, {
          category: 'simulation_loop',
          consecutiveErrors: consecutiveSimErrors
        });
      }
      if (consecutiveSimErrors >= MAX_CONSECUTIVE_SIM_ERRORS) {
        if (typeof onRecoverableFailure === 'function') {
          onRecoverableFailure(simErr);
        }
      }
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

  // Initialize global window error catching
  initGlobalListeners();

  return {
    wrap,
    wrapHandler,
    renderFallback,
    guardSimulationTick,
    initGlobalListeners
  };
});
