# 🍔 Qamarero KDS Helper

Chrome extension that adds visual category indicators to items in the Qamarero KDS interface.

## Features

- Color-coded items by category:
  - � **Orange** - Salsas
  - 🟡 **Yellow** - Plancha (carne, queso, bacon)
  - 🔴 **Red** - Extras (cebolla, jalapeño, pepinillo)
  - 🟢 **Light Green** - Patatas
  - 🟢 **Green** - Tarrinas
  - 🟣 **Purple** - Complementos
  - ⚪ **White** - Others/Bebidas (default)

- Automatic detection via keywords
- Support for exact match keywords (prefix with `=`)
- Updates in real-time when new orders arrive via WebSocket

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **Load unpacked**
4. Select this folder

## Usage

Once installed, visit https://kds.qamarero.com/ and items will be automatically color-coded based on their category.

## Configuration

Edit `categories.js` to customize categories, keywords, and colors:

```javascript
const CATEGORIES = {
  salsas: {
    keywords: ['SALSA'],
    color: '#f48524',
  },
  plancha: {
    keywords: ['CARNE', 'QUESO', 'BACON'],
    color: '#f1c40f',
  },
  others: {
    keywords: [...BEBIDAS],  // default category
    color: '#ffffff',
  },
};
```

- **keywords**: Array of strings to match (case-insensitive)
  - Prefix with `=` for exact match: `'=EXTRA BACON'`
- **color**: Hex color for border and background (background uses 15% opacity)

Items not matching any category default to "others".

## Development

Open `demo.html` in your browser to test styles without connecting to the live site.

## Files

- `manifest.json` - Extension configuration
- `categories.js` - Category definitions (keywords & colors)
- `content.js` - Categorization logic
- `content.css` - Base styles
- `demo.html` - Local testing page

## After Making Changes

1. Go to `chrome://extensions/`
2. Click the refresh icon on the extension
3. Reload the KDS page
