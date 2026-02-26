// =============================================================
// injector.js — Runs in ISOLATED world at document_start
// Listens for CustomEvents dispatched by intercept.js (MAIN world)
// and persists the OFERTAS status into chrome.storage.local.
// =============================================================

const EVENT_NAME = '__pos_offers_menu_data__';

window.addEventListener(EVENT_NAME, (e) => {
  const detail = e.detail;
  if (!detail) return;

  if (detail.found) {
    console.log('[POS Offers][ISOLATED] Saving ofertasAvailable:', detail.available);
    chrome.storage.local.set({ ofertasAvailable: detail.available });
  } else {
    console.log('[POS Offers][ISOLATED] OFERTAS not found, clearing status');
    chrome.storage.local.remove('ofertasAvailable');
  }
});

console.log('[POS Offers][ISOLATED] Bridge listener installed');
