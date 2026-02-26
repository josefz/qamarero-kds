// =============================================================
// intercept.js — Runs in MAIN world (page context)
// Intercepts fetch/XHR to detect GetMenu responses and sends
// the OFERTAS availability status via CustomEvent to the
// content script (ISOLATED world).
// =============================================================

(function interceptNetwork() {
  'use strict';

  const TARGET_URL = 'qamarero.stellate.sh';
  const TARGET_OP  = 'GetMenu';
  const EVENT_NAME = '__pos_offers_menu_data__';

  function isTargetRequest(url, body) {
    try {
      if (!url || !url.includes(TARGET_URL)) return false;
      if (!body) return false;
      let data = typeof body === 'string' ? JSON.parse(body) : body;
      if (data instanceof FormData) return false;
      return data.operationName === TARGET_OP;
    } catch (e) {
      return false;
    }
  }

  function extractOfertasStatus(responseData) {
    try {
      const categories = responseData?.data?.menu?.categories || [];
      const ofertas = categories.find(
        cat => cat.name && cat.name.toUpperCase() === 'OFERTAS'
      );
      if (ofertas) {
        console.log('[POS Offers][MAIN] OFERTAS available:', ofertas.available);
        window.dispatchEvent(new CustomEvent(EVENT_NAME, {
          detail: { found: true, available: ofertas.available }
        }));
      } else {
        console.log('[POS Offers][MAIN] OFERTAS category not found in menu');
        window.dispatchEvent(new CustomEvent(EVENT_NAME, {
          detail: { found: false }
        }));
      }
    } catch (e) {
      console.error('[POS Offers][MAIN] Error extracting OFERTAS:', e);
    }
  }

  // --- Patch fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const body = init?.body;

    if (isTargetRequest(url, body)) {
      const response = await origFetch.apply(this, arguments);
      const cloned = response.clone();
      cloned.json().then(extractOfertasStatus).catch(() => {});
      return response;
    }

    return origFetch.apply(this, arguments);
  };

  // --- Patch XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__posOffersUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this.__posOffersUrl && isTargetRequest(this.__posOffersUrl, body)) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          extractOfertasStatus(data);
        } catch (e) { /* ignore parse errors */ }
      });
    }
    return origSend.apply(this, arguments);
  };

  console.log('[POS Offers][MAIN] Network interceptor installed');
})();
