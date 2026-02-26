// =============================================================
// background.js — MV3 Service Worker
//
// Handles the EditCategory GraphQL mutation to toggle OFERTAS
// availability. Generates a self-contained ECDSA P-256 keypair
// for DPoP proofs and reads the JWT from the restaurant-token
// cookie.
// =============================================================

'use strict';

const API_URL = 'https://qamarero.stellate.sh/';
const COOKIE_URL = 'https://pos.qamarero.com';
const COOKIE_NAME = 'restaurant-token';

// OFERTAS category details (fixed for this restaurant)
const OFERTAS_CATEGORY = {
  id: '2bc5d07e-e166-43ad-b24b-5c7f625b8cc4',
  mode: 'LIST',
  order: 0,
  name: 'OFERTAS',
  visible: true,
  interactive: true,
  subcategories: [],
};

// GraphQL mutation — minimal response to confirm the change
const EDIT_CATEGORY_MUTATION = `
mutation EditCategory($input: CategoryInput!) {
  editCategory(input: $input) {
    id
    name
    available
    __typename
  }
}
`.trim();

// -- ECDSA P-256 Keypair (generated once per service worker lifetime) -------

let keyPairPromise = null;

/**
 * Returns (and caches) an ECDSA P-256 keypair.
 * The keypair lives for the lifetime of the service worker — if the worker
 * restarts, a new keypair is generated, which is fine because the server
 * validates DPoP proofs in a self-contained way (Model B).
 */
function getKeyPair() {
  if (!keyPairPromise) {
    keyPairPromise = crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,            // extractable (needed to export public key)
      ['sign', 'verify']
    );
    keyPairPromise.then(() => {
      console.log('[POS Offers][BG] ECDSA P-256 keypair generated');
    });
  }
  return keyPairPromise;
}

// -- DPoP Proof Generation --------------------------------------------------

/**
 * Base64url-encode a JS object (JSON → UTF-8 → base64url).
 */
function b64url(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  // Convert to binary string for btoa
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a fresh DPoP proof token for a request to the given URL.
 *
 * The proof contains:
 *   - header: typ, alg, jwk (public key)
 *   - payload: jti (unique), iat, exp (+60s), htm (POST), htu (target URL)
 *   - signature: ECDSA SHA-256 with the private key
 */
async function generateDPoP(method, url) {
  const keyPair = await getKeyPair();
  const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  const header = {
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: {
      crv: pubJwk.crv,
      ext: pubJwk.ext,
      key_ops: pubJwk.key_ops,
      kty: pubJwk.kty,
      x: pubJwk.x,
      y: pubJwk.y,
    },
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 60,
    htm: method,
    htu: url,
  };

  const signingInput = b64url(header) + '.' + b64url(payload);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );

  // Convert ArrayBuffer signature to base64url
  const sigBytes = new Uint8Array(signature);
  let sigBinary = '';
  for (const b of sigBytes) sigBinary += String.fromCharCode(b);
  const sigB64 = btoa(sigBinary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return signingInput + '.' + sigB64;
}

// -- JWT Extraction ---------------------------------------------------------

/**
 * Read the JWT from the restaurant-token cookie.
 * Uses chrome.cookies API which can read HttpOnly cookies too.
 */
async function getJWT() {
  const cookie = await chrome.cookies.get({
    url: COOKIE_URL,
    name: COOKIE_NAME,
  });

  if (!cookie || !cookie.value) {
    throw new Error('No se encontró la sesión. Inicia sesión en el POS.');
  }

  return cookie.value;
}

// -- GraphQL Mutation -------------------------------------------------------

/**
 * Send the EditCategory mutation to toggle OFERTAS availability.
 *
 * @param {boolean} available - true to activate, false to deactivate
 * @returns {object} - { success, available, error }
 */
async function toggleOfertas(available) {
  // 1. Get auth tokens
  const jwt = await getJWT();
  const dpop = await generateDPoP('POST', API_URL);

  // 2. Build request body
  const body = JSON.stringify({
    operationName: 'EditCategory',
    variables: {
      input: {
        ...OFERTAS_CATEGORY,
        available: available,
      },
    },
    query: EDIT_CATEGORY_MUTATION,
  });

  // 3. Send the mutation
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `JWT ${jwt}`,
      'dpop': dpop,
      'x-app-qamarero': 'POS',
      'x-bypass-cache': '1',
      'x-graphql-client-name': 'POS',
      'x-graphql-client-version': '2.17.0',
      'x-menu-language': 'en',
    },
    body: body,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // 4. Check for GraphQL errors
  if (data.errors && data.errors.length > 0) {
    const msg = data.errors.map(e => e.message).join('; ');
    throw new Error(`GraphQL error: ${msg}`);
  }

  const result = data.data?.editCategory;
  if (!result) {
    throw new Error('Respuesta inesperada del servidor');
  }

  // 5. Update local storage so the popup reflects the new state
  await chrome.storage.local.set({ ofertasAvailable: result.available });

  // 6. Reload the POS tab so the UI reflects the change
  const tabs = await chrome.tabs.query({ url: 'https://pos.qamarero.com/*' });
  for (const tab of tabs) {
    chrome.tabs.reload(tab.id);
  }

  console.log('[POS Offers][BG] Toggle successful:', result.available ? 'ON' : 'OFF');
  return { success: true, available: result.available };
}

// -- Message Handler --------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleOffers') {
    const desired = message.available; // true = ON, false = OFF
    console.log('[POS Offers][BG] Toggle requested:', desired ? 'ON' : 'OFF');

    toggleOfertas(desired)
      .then(result => sendResponse(result))
      .catch(err => {
        console.error('[POS Offers][BG] Toggle failed:', err);
        sendResponse({ success: false, error: err.message });
      });

    // Return true to indicate we'll call sendResponse asynchronously
    return true;
  }
});

// Pre-generate the keypair on service worker startup
getKeyPair();

console.log('[POS Offers][BG] Service worker loaded');
