# 🍔 Qamarero KDS Helper

Chrome extension that adds visual category indicators to items in the Qamarero KDS interface.

## Features

- Color-coded items by category:
  - 🟡 **Yellow** - Burgers (default)
  - 🟢 **Green** - Patatas
  - 🔵 **Blue** - Bebidas
  - 🟠 **Orange** - Complementos

- Automatic detection via keywords
- Updates in real-time when new orders arrive via WebSocket

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **Load unpacked**
4. Select this folder

## Usage

Once installed, visit https://kds.qamarero.com/ and items will be automatically color-coded based on their category.

## Configuration

### Edit Categories

Modify the `CATEGORIES` object in `content.js`:

```javascript
const CATEGORIES = {
  patatas: ['PATATAS', 'TARRINA'],
  bebidas: ['33cl', '50cl', 'BEBIDA', 'AGUA', 'CAÑA', 'CERVEZA', ...],
  complementos: ['NUGGETS', 'ALITAS PICANTES', ...],
};
```

Items not matching any category default to "burger".

### Edit Colors

Modify the colors in `content.css`:

```css
.css-c2sd62[data-label="burger"] {
  background: rgba(241, 196, 15, 0.15) !important;
  border-left: 3px solid #f1c40f !important;
}
```

## Development

Open `demo.html` in your browser to test styles without connecting to the live site.

## Files

- `manifest.json` - Extension configuration
- `content.js` - Categorization logic
- `content.css` - Category styles
- `demo.html` - Local testing page

## After Making Changes

1. Go to `chrome://extensions/`
2. Click the refresh icon on the extension
3. Reload the KDS page
