// =============================================================
// content.js — Runs in ISOLATED world at document_idle
// Handles the toggle automation flow and communication with popup.
// Network interception is handled by intercept.js (MAIN world)
// and injector.js (ISOLATED world bridge).
// =============================================================

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleOffers') {
    const desired = message.enabled; // true = ON, false = OFF
    console.log('[POS Offers] Toggle requested:', desired ? 'ON' : 'OFF');
    continueFlow(desired, 'click_menu_manager');
    sendResponse({ received: true });
  }
  return true; // keep channel open for async
});

// --- Utility: wait for an element to appear in the DOM ---
function waitForElement(selector, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const root = document.body || document.documentElement;
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for selector: ${selector}`));
    }, timeout);
  });
}

// --- Utility: wait for a button containing specific text ---
function waitForButtonWithText(text, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const find = () =>
      [...document.querySelectorAll('button')].find(b =>
        b.textContent.includes(text)
      );

    const btn = find();
    if (btn) return resolve(btn);

    const root = document.body || document.documentElement;
    const observer = new MutationObserver(() => {
      const found = find();
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for button: "${text}"`));
    }, timeout);
  });
}

// --- Utility: wait for any element containing specific text ---
function waitForElementWithText(text, tagSelector = '*', timeout = 10000) {
  return new Promise((resolve, reject) => {
    const find = () =>
      [...document.querySelectorAll(tagSelector)].find(el =>
        el.textContent.toUpperCase().includes(text.toUpperCase())
      );

    const el = find();
    if (el) return resolve(el);

    const root = document.body || document.documentElement;
    const observer = new MutationObserver(() => {
      const found = find();
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element with text: "${text}"`));
    }, timeout);
  });
}

// --- Click a digit on the PIN pad ---
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

// --- Enter full PIN code ---
async function enterPin(pin) {
  console.log('[POS Offers] Entering PIN...');
  for (const digit of pin.split('')) {
    const clicked = clickPinDigit(digit);
    if (!clicked) {
      console.warn(`[POS Offers] Could not click digit: ${digit}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log('[POS Offers] PIN entered');
}

// --- Helper: small delay ---
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// =============================================================
// Main automation flow
// @param {boolean} desiredState - true = make available, false = make unavailable
// @param {string}  step - the step to start from
// =============================================================
async function continueFlow(desiredState, step) {
  console.log('[POS Offers] Step:', step, '| Desired state:', desiredState);

  try {
    if (step === 'click_menu_manager') {
      // 1) Open the menu-manager modal (PIN pad)
      let modal = document.querySelector('[id^="chakra-modal"]');
      if (!modal) {
        console.log('[POS Offers] Waiting for menu-manager-button...');
        const menuBtn = await waitForElement('[data-testid="menu-manager-button"]', 20000);
        menuBtn.click();
        console.log('[POS Offers] Clicked menu-manager-button');
        modal = await waitForElement('[id^="chakra-modal"]', 20000);
      } else {
        console.log('[POS Offers] Modal already open');
      }
      await delay(300);

      // 2) Enter PIN
      const { posPin } = await chrome.storage.sync.get('posPin');
      if (!posPin) {
        console.error('[POS Offers] No PIN configured — aborting');
        return;
      }
      await enterPin(posPin);
      await delay(800);

      // 3) Click "Editar categorias"
      console.log('[POS Offers] Looking for "Editar categor\u00edas" button...');
      const editBtn = await waitForButtonWithText('Editar categor\u00edas');
      editBtn.click();
      console.log('[POS Offers] Clicked "Editar categor\u00edas"');
      await delay(500);

      // 4) Find and click the OFERTAS category
      console.log('[POS Offers] Looking for OFERTAS category...');
      // Try [data-index] first, then fall back to broader search
      let ofertasBtn = null;
      const indexedBtns = document.querySelectorAll('[data-index]');
      for (const btn of indexedBtns) {
        if (btn.textContent.toUpperCase().includes('OFERTAS')) {
          ofertasBtn = btn;
          break;
        }
        }
      // Fallback: search all clickable elements
      if (!ofertasBtn) {
        console.log('[POS Offers] [data-index] not found, trying broader search...');
        ofertasBtn = await waitForElementWithText('OFERTAS', 'button, div[role="button"], [data-index], li', 10000);
      }

      if (!ofertasBtn) {
        console.error('[POS Offers] Could not find OFERTAS category — aborting');
        return;
      }

      ofertasBtn.click();
      console.log('[POS Offers] Clicked OFERTAS category');
      await delay(500);

      // 5) Check current state and decide if we need to toggle
      //    Look for the "Disponible" / "No disponible" button/indicator
      console.log('[POS Offers] Looking for "Disponible" button...');
      const disponibleBtn = await waitForButtonWithText('Disponible', 10000);

      // Determine current state from the button context
      // Typically the button or its parent has visual indicators
      const btnText = disponibleBtn.textContent.trim().toLowerCase();
      const parentText = (disponibleBtn.closest('[class]')?.textContent || '').toLowerCase();

      // Heuristic: if the button says "Disponible" and it looks active/checked,
      // the category is currently available.
      // We check aria attributes, data attributes, or nearby text
      const isCurrentlyAvailable = checkIfCurrentlyAvailable(disponibleBtn);
      console.log('[POS Offers] Current availability:', isCurrentlyAvailable, '| Desired:', desiredState);

      if (isCurrentlyAvailable === desiredState) {
        console.log('[POS Offers] Already in desired state — no toggle needed');
        // Still close/go back
      } else {
        // Toggle it
        disponibleBtn.click();
        console.log('[POS Offers] Toggled "Disponible"');
        await delay(300);

        // 6) Confirm changes
        console.log('[POS Offers] Looking for "Confirmar cambios" button...');
        const confirmarBtn = await waitForButtonWithText('Confirmar cambios');
        confirmarBtn.click();
        console.log('[POS Offers] Clicked "Confirmar cambios" — Done!');
      }

      // 7) Navigate back to /control
      await delay(800);
      window.location.href = 'https://pos.qamarero.com/control';
    }
  } catch (err) {
    console.error('[POS Offers] Error in flow:', err);
  }
}

// =============================================================
// Heuristic to determine if the category is currently available
// Checks common patterns: aria-checked, data-checked, class names,
// or the storage value as ultimate fallback.
// =============================================================
function checkIfCurrentlyAvailable(disponibleBtn) {
  // Check aria attributes
  if (disponibleBtn.getAttribute('aria-checked') === 'true') return true;
  if (disponibleBtn.getAttribute('aria-checked') === 'false') return false;
  if (disponibleBtn.getAttribute('data-checked') !== null) return true;

  // Check if button or parent has an "active" / "checked" class
  const classes = (disponibleBtn.className + ' ' + (disponibleBtn.parentElement?.className || '')).toLowerCase();
  if (classes.includes('active') || classes.includes('checked') || classes.includes('selected')) return true;

  // Check computed background color (colored = active, gray = inactive)
  const bg = window.getComputedStyle(disponibleBtn).backgroundColor;
  if (bg && bg !== 'rgb(255, 255, 255)' && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
    // Has a colored background — likely active
    // Gray tones suggest inactive
    const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      // If it's a saturated color (not gray), consider it active
      const isGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
      if (!isGray) return true;
    }
  }

  // Fallback: read from storage (set by intercept.js)
  // Since we can't do async here, we'll default to assuming it needs toggling
  console.warn('[POS Offers] Could not determine current state from DOM, assuming toggle is needed');
  return null; // null means "unknown" — we'll always toggle
}

// =============================================================
// Resume pending action on page load (after navigation)
// =============================================================
chrome.storage.sync.get(['pendingToggle', 'pendingStep'], (data) => {
  if (data.pendingStep) {
    console.log('[POS Offers] Resuming pending action:', data.pendingStep);
    const desiredState = data.pendingToggle; // true or false
    const step = data.pendingStep;

    // Clear pending state immediately
    chrome.storage.sync.remove(['pendingToggle', 'pendingStep']);

    // content.js runs at document_idle so DOM is ready
    continueFlow(desiredState, step);
  }
});

console.log('[POS Offers Toggle] content.js loaded');
