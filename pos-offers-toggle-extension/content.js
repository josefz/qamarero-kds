// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleOffers') {
    console.log('[POS Offers] Toggle:', message.enabled ? 'ON' : 'OFF');
    continueFlow(message.enabled, 'click_menu_manager');
  }
});

// Wait for element to appear
function waitForElement(selector, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { 
      observer.disconnect(); 
      reject(new Error(`Timeout: ${selector}`)); 
    }, timeout);
  });
}

// Wait for button with specific text
function waitForButtonWithText(text, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const find = () => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
    const btn = find();
    if (btn) return resolve(btn);

    const observer = new MutationObserver(() => {
      const found = find();
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { 
      observer.disconnect(); 
      reject(new Error(`Timeout: button "${text}"`)); 
    }, timeout);
  });
}

// Click a digit on the PIN pad
function clickPinDigit(digit) {
  const buttons = document.querySelectorAll('[id^="chakra-modal"] button');
  for (const btn of buttons) {
    if (btn.textContent.trim() === String(digit)) {
      btn.click();
      return true;
    }
  }
  return false;
}

// Enter PIN code
async function enterPin(pin) {
  console.log('[POS Offers] Entering PIN...');
  for (const digit of pin.split('')) {
    clickPinDigit(digit);
    await new Promise(r => setTimeout(r, 150));
  }
  console.log('[POS Offers] PIN entered');
}

async function continueFlow(enabled, step) {
  console.log('[POS Offers] Step:', step);
  
  try {
    if (step === 'click_menu_manager') {
      // Si el modal ya está abierto, no hacer click
      let modal = document.querySelector('[id^="chakra-modal"]');
      if (!modal) {
        console.log('[POS Offers] Waiting for menu-manager-button...');
        const menuBtn = await waitForElement('[data-testid="menu-manager-button"]', 20000);
        menuBtn.click();
        console.log('[POS Offers] Clicked menu-manager-button');
        // Esperar a que aparezca el modal
        modal = await waitForElement('[id^="chakra-modal"]', 20000);
      } else {
        console.log('[POS Offers] Modal ya estaba abierto');
      }
      await new Promise(r => setTimeout(r, 300));
      
      // Get PIN from storage
      const { posPin } = await chrome.storage.sync.get('posPin');
      if (posPin) {
        await enterPin(posPin);
        
        // Wait for modal to close, then click "Editar categorías"
        await new Promise(r => setTimeout(r, 800));
        console.log('[POS Offers] Looking for "Editar categorías" button...');
        const editBtn = await waitForButtonWithText('Editar categorías');
        editBtn.click();
        console.log('[POS Offers] Clicked "Editar categorías"');
        
        // Wait and click OFERTAS
        await new Promise(r => setTimeout(r, 500));
        console.log('[POS Offers] Looking for OFERTAS button...');
        
        // Find button containing OFERTAS text
        const allButtons = document.querySelectorAll('[data-index]');
        let ofertasBtn = null;
        for (const btn of allButtons) {
          if (btn.textContent.toUpperCase().includes('OFERTAS')) {
            ofertasBtn = btn;
            break;
          }
        }
        
        if (ofertasBtn) {
          ofertasBtn.click();
          console.log('[POS Offers] Clicked OFERTAS');
          
          // Wait for form modal to open
          await new Promise(r => setTimeout(r, 500));
          
          // Click "Disponible" button
          console.log('[POS Offers] Looking for "Disponible" button...');
          const disponibleBtn = await waitForButtonWithText('Disponible');
          disponibleBtn.click();
          console.log('[POS Offers] Clicked "Disponible"');
          
          // Click "Confirmar cambios"
          await new Promise(r => setTimeout(r, 300));
          console.log('[POS Offers] Looking for "Confirmar cambios" button...');
          const confirmarBtn = await waitForButtonWithText('Confirmar cambios');
          confirmarBtn.click();
          console.log('[POS Offers] Clicked "Confirmar cambios" - Done!');
          // Navegar de vuelta a /control
          setTimeout(() => {
            window.location.href = 'https://pos.qamarero.com/control';
          }, 800);
        } else {
          console.error('[POS Offers] Could not find OFERTAS button');
        }
      } else {
        console.error('[POS Offers] No PIN configured');
      }
    }
  } catch (err) {
    console.error('[POS Offers] Error:', err);
  }
}

// Check for pending action on page load (after navigation)
chrome.storage.sync.get(['pendingToggle', 'pendingStep'], (data) => {
  if (data.pendingStep) {
    console.log('[POS Offers] Resuming pending action:', data.pendingStep);
    const enabled = data.pendingToggle;
    const step = data.pendingStep;
    
    // Clear pending state
    chrome.storage.sync.remove(['pendingToggle', 'pendingStep']);
    
    // Wait a bit for page to fully load, then continue
    setTimeout(() => {
      continueFlow(enabled, step);
    }, 1000);
  }
});

console.log('[POS Offers Toggle] Extension loaded');
