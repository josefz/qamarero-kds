const toggleBtn = document.getElementById('toggleBtn');
const messageEl = document.getElementById('message');
const pinInput = document.getElementById('pin');

// Load saved PIN
chrome.storage.sync.get(['posPin'], (data) => {
  if (data.posPin) {
    pinInput.value = data.posPin;
  }
});

// Save PIN on change
pinInput.addEventListener('change', () => {
  chrome.storage.sync.set({ posPin: pinInput.value });
});

toggleBtn.addEventListener('click', async () => {
  const pin = pinInput.value.trim();
  if (!pin) {
    showMessage('Introduce el PIN', 'error');
    return;
  }
  
  // Save PIN
  chrome.storage.sync.set({ posPin: pin });
  
  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Save pending action for after navigation
  chrome.storage.sync.set({ 
    pendingToggle: true,
    pendingStep: 'click_menu_manager'
  });
  
  const url = new URL(tab.url || '');
  const isOnPosControl = url.hostname === 'pos.qamarero.com' && url.pathname === '/control';
  
  if (!isOnPosControl) {
    // Navigate to /control
    chrome.tabs.update(tab.id, { url: 'https://pos.qamarero.com/control' });
    showMessage('Navegando a /control...', 'info');
  } else {
    // Already on /control - send message to content script
    chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleOffers'
    });
  }
});

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;
  setTimeout(() => {
    messageEl.className = 'message';
  }, 3000);
}
