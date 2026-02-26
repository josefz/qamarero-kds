// =============================================================
// popup.js — Extension popup logic
//
// Displays the current OFERTAS availability state and sends
// toggle requests to the background service worker.
// =============================================================

'use strict';

const ofertasSwitch = document.getElementById('ofertasSwitch');
const ofertasStatus = document.getElementById('ofertasStatus');
const messageEl = document.getElementById('message');

// Prevent toggle while a request is in flight
let isToggling = false;

// -- Load & display OFERTAS status from storage -------------------------

function updateOfertasStatus() {
  chrome.storage.local.get(['ofertasAvailable'], (data) => {
    if (typeof data.ofertasAvailable === 'boolean') {
      ofertasSwitch.checked = data.ofertasAvailable;
      ofertasStatus.textContent = data.ofertasAvailable ? 'ON' : 'OFF';
      ofertasStatus.style.color = data.ofertasAvailable ? '#4caf50' : '#c62828';
    } else {
      ofertasSwitch.checked = false;
      ofertasStatus.textContent = 'Desconocido';
      ofertasStatus.style.color = '#999';
    }
  });
}

// Load initial state
updateOfertasStatus();

// React to storage changes (e.g., from GetMenu interception)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.ofertasAvailable && !isToggling) {
    updateOfertasStatus();
  }
});

// -- Toggle switch handler ----------------------------------------------

ofertasSwitch.addEventListener('change', async () => {
  if (isToggling) {
    // Revert — a request is already in flight
    ofertasSwitch.checked = !ofertasSwitch.checked;
    return;
  }

  const desiredState = ofertasSwitch.checked;
  isToggling = true;
  ofertasSwitch.disabled = true;
  showMessage(
    desiredState ? 'Activando ofertas...' : 'Desactivando ofertas...',
    'info'
  );

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'toggleOffers',
      available: desiredState,
    });

    if (response.success) {
      ofertasSwitch.checked = response.available;
      ofertasStatus.textContent = response.available ? 'ON' : 'OFF';
      ofertasStatus.style.color = response.available ? '#4caf50' : '#c62828';
      showMessage(
        response.available ? 'Ofertas activadas \u2713' : 'Ofertas desactivadas \u2713',
        'success'
      );
    } else {
      // Revert the toggle to previous state
      ofertasSwitch.checked = !desiredState;
      showMessage(response.error || 'Error desconocido', 'error');
    }
  } catch (err) {
    console.error('[POS Offers Popup] Error:', err);
    ofertasSwitch.checked = !desiredState;
    showMessage('Error de comunicaci\u00f3n con la extensi\u00f3n', 'error');
  } finally {
    isToggling = false;
    ofertasSwitch.disabled = false;
  }
});

// -- Show message helper ------------------------------------------------

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;

  // Auto-hide after a delay (longer for errors)
  const delay = type === 'error' ? 6000 : 3000;
  setTimeout(() => {
    messageEl.className = 'message';
  }, delay);
}
