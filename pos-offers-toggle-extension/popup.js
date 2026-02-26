const pinInput = document.getElementById('pin');
const ofertasSwitch = document.getElementById('ofertasSwitch');
const ofertasStatus = document.getElementById('ofertasStatus');
const messageEl = document.getElementById('message');

// ---- Load saved PIN ----
chrome.storage.sync.get(['posPin'], (data) => {
  if (data.posPin) {
    pinInput.value = data.posPin;
  }
});

// Save PIN on change
pinInput.addEventListener('change', () => {
  chrome.storage.sync.set({ posPin: pinInput.value });
});

// ---- Load & display OFERTAS status ----
function updateOfertasStatus() {
  chrome.storage.local.get(['ofertasAvailable'], (data) => {
    if (typeof data.ofertasAvailable === 'boolean') {
      ofertasSwitch.checked = data.ofertasAvailable;
      ofertasStatus.textContent = data.ofertasAvailable ? 'ON' : 'OFF';
      ofertasStatus.style.color = data.ofertasAvailable ? 'green' : 'red';
    } else {
      ofertasSwitch.checked = false;
      ofertasStatus.textContent = 'Desconocido';
      ofertasStatus.style.color = 'gray';
    }
  });
}

updateOfertasStatus();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.ofertasAvailable) {
    updateOfertasStatus();
  }
});

// ---- Toggle switch handler ----
ofertasSwitch.addEventListener('change', async () => {
  const pin = pinInput.value.trim();
  if (!pin) {
    showMessage('Introduce el PIN', 'error');
    ofertasSwitch.checked = !ofertasSwitch.checked; // revert
    return;
  }

  // The desired state is whatever the user just toggled TO
  const desiredState = ofertasSwitch.checked; // true = ON, false = OFF

  // Save PIN
  chrome.storage.sync.set({ posPin: pin });

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const url = new URL(tab.url || '');
  const isOnPos = url.hostname === 'pos.qamarero.com';
  const isOnPosControl = isOnPos && url.pathname === '/control';

  if (!isOnPosControl) {
    // Save pending action — will be picked up by content.js after navigation
    await chrome.storage.sync.set({
      pendingToggle: desiredState,
      pendingStep: 'click_menu_manager'
    });
    // Navigate to /control
    chrome.tabs.update(tab.id, { url: 'https://pos.qamarero.com/control' });
    showMessage('Navegando a /control...', 'info');
  } else {
    // Already on /control — send message directly to content script
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleOffers',
        enabled: desiredState
      });
      showMessage(desiredState ? 'Activando ofertas...' : 'Desactivando ofertas...', 'info');
    } catch (err) {
      console.error('[POS Offers Popup] Error sending message:', err);
      // Fallback: save as pending and reload
      await chrome.storage.sync.set({
        pendingToggle: desiredState,
        pendingStep: 'click_menu_manager'
      });
      chrome.tabs.reload(tab.id);
      showMessage('Recargando p\u00e1gina...', 'info');
    }
  }
});

// ---- Show message helper ----
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;
  setTimeout(() => {
    messageEl.className = 'message';
  }, 4000);
}
