# Architecture — POS Offers Toggle Extension

## Overview

This extension toggles the **OFERTAS** category availability on the Qamarero POS
by sending the `EditCategory` GraphQL mutation directly to the API.

## Key Design Decisions

1. **Self-generated DPoP proofs.** The server validates DPoP proofs in a
   self-contained way (structure + signature) without binding the keypair to
   the session. This means we generate our own ECDSA P-256 keypair and create
   fresh proofs per request.

2. **No master code required.** The `EditCategory` mutation does not require
   the 6-digit master code server-side. The server exposes a
   `CheckMasterCodeIsCorrect` mutation that returns `true/false`, but it's
   only used as a client-side UI gate.

3. **JWT from cookie.** The JWT is stored in the `restaurant-token` cookie,
   accessible via the `chrome.cookies` API.

## Data Flow

```
┌──────────┐   message    ┌───────────────┐   fetch() + DPoP    ┌──────────────────────┐
│ popup.js │ ───────────→ │ background.js │ ──────────────────→ │ qamarero.stellate.sh │
│          │ ←─────────── │               │ ←────────────────── │                      │
│  toggle  │   result     │ • Own keypair │   GraphQL response  └──────────────────────┘
└──────────┘              │ • JWT cookie  │
                          │ • DPoP gen    │
                          └───────────────┘

┌──────────────┐  CustomEvent  ┌────────────┐  chrome.storage  ┌────────────────┐
│ intercept.js │ ────────────→ │ injector.js│ ───────────────→ │ storage.local  │
│ (MAIN world) │               │ (ISOLATED) │                  │{ofertasAvail.} │
│ GetMenu resp │               └────────────┘                  └────────────────┘
└──────────────┘
```

## Authentication

### JWT (`authorization` header)

- **Source:** `restaurant-token` cookie on `pos.qamarero.com`
- **Format:** `JWT <token_value>`
- **Read by:** `background.js` via `chrome.cookies.get()`
- **Lifetime:** Long-lived (~31 days based on observed `exp`)
- **Contains:** `user_id`, `user_type: "Waiter"`, `scp: []`

### DPoP (`dpop` header)

- **Source:** Self-generated ECDSA P-256 keypair in `background.js`
- **Per-request:** A fresh proof is generated for every API call
- **Lifetime:** 60 seconds per proof
- **Structure:**
  - Header: `{ typ: "dpop+jwt", alg: "ES256", jwk: <public_key> }`
  - Payload: `{ jti: <uuid>, iat, exp, htm: "POST", htu: "https://qamarero.stellate.sh/" }`
  - Signature: ECDSA SHA-256 with the private key

The keypair is generated once when the service worker starts and reused for
subsequent proofs. If the service worker restarts (Chrome kills idle workers),
a new keypair is generated automatically.

## GraphQL Mutation

```graphql
mutation EditCategory($input: CategoryInput!) {
  editCategory(input: $input) {
    id
    name
    available
    __typename
  }
}
```

Variables:
```json
{
  "input": {
    "id": "2bc5d07e-e166-43ad-b24b-5c7f625b8cc4",
    "mode": "LIST",
    "order": 0,
    "name": "OFERTAS",
    "visible": true,
    "available": true,
    "interactive": true,
    "subcategories": []
  }
}
```

Set `available: true` to activate, `available: false` to deactivate.

## Required Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `authorization` | `JWT <token>` | Session authentication |
| `dpop` | `<proof>` | Proof-of-possession |
| `content-type` | `application/json` | GraphQL request |
| `x-app-qamarero` | `POS` | App identifier |
| `x-bypass-cache` | `1` | Skip Stellate cache |
| `x-graphql-client-name` | `POS` | Client identifier |
| `x-graphql-client-version` | `2.17.0` | Client version |
| `x-menu-language` | `en` | Menu language |

## Reading Current State

The current OFERTAS availability is read passively by intercepting the app's
own `GetMenu` GraphQL responses:

1. `intercept.js` (MAIN world, `document_start`) patches `window.fetch` and
   `XMLHttpRequest` to intercept responses to the `GetMenu` operation.
2. It extracts `categories[].available` for the category named `OFERTAS`.
3. It dispatches a `CustomEvent` with the status.
4. `injector.js` (ISOLATED world, `document_start`) listens for the event and
   saves `ofertasAvailable` to `chrome.storage.local`.
5. `popup.js` reads from storage and updates the toggle switch position.

This means the toggle always reflects the real server state (as of the last
`GetMenu` fetch the app made).

## Permissions

| Permission | Why |
|-----------|-----|
| `storage` | Store OFERTAS status between popup opens |
| `cookies` | Read `restaurant-token` cookie for JWT |
| `host_permissions: qamarero.stellate.sh` | Make cross-origin GraphQL requests from background |
| `host_permissions: pos.qamarero.com` | Read cookies + inject content scripts |

## Error Handling

| Scenario | User Feedback |
|----------|---------------|
| Not logged in (no JWT cookie) | "No se encontró la sesión. Inicia sesión en el POS." |
| Network failure | "Failed to fetch" or HTTP status error |
| GraphQL error | Server error message displayed |
| Extension communication failure | "Error de comunicación con la extensión" |

## Why Self-Generated DPoP (Not Sniffed)

Sniffing the app's outgoing DPoP headers was considered but rejected:

1. DPoP proofs expire in ~60 seconds and are meant to be single-use (`jti`).
2. Sniffing requires the user to have recently interacted with the POS.
3. Self-generated proofs work because the server validates proof structure
   and signature without binding the keypair to the session.
