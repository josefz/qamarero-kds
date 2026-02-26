# POS Offers Toggle Extension

Chrome extension (MV3) to toggle the **OFERTAS** menu category on/off in [Qamarero POS](https://pos.qamarero.com) with a single click.

## How it works

The extension sends the `EditCategory` GraphQL mutation directly to the Qamarero API. Authentication is handled automatically using the session cookie and a self-generated DPoP proof.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full technical details.

## Installation

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode** (top right)
3. Click **"Load unpacked"** and select this folder
4. Navigate to `https://pos.qamarero.com` and log in
5. Click the extension icon → toggle OFERTAS on/off

## File Structure

| File | Purpose |
|------|--------|
| `manifest.json` | MV3 manifest with permissions and content scripts |
| `background.js` | Service worker — generates DPoP, reads JWT cookie, sends GraphQL mutation |
| `popup.html/js/css` | Extension popup UI — toggle switch and status display |
| `intercept.js` | MAIN world content script — intercepts `GetMenu` responses to read current OFERTAS state |
| `injector.js` | ISOLATED world bridge — relays intercepted data to `chrome.storage.local` |
| `content.js` | Minimal stub |

## Requirements

- Chrome 116+ (MV3 service workers)
- Active session on `https://pos.qamarero.com` (logged in)