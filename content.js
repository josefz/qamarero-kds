function matchesKeyword(text, keyword) {
  const kw = keyword.toUpperCase();
  if (kw.startsWith('=')) {
    return text === kw.slice(1); // Exact match
  }
  return text.includes(kw); // Partial match
}

function getCategory(text) {
  const normalized = text.trim().toUpperCase();
  for (const [category, { keywords }] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => matchesKeyword(normalized, kw))) {
      return category;
    }
  }
  return 'others'; // Default category
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Add data-label attributes and apply styles based on p child text
function labelElements() {
  document.querySelectorAll('.css-c2sd62').forEach(el => {
    const p = el.querySelector('p');
    if (p && p.textContent) {
      const category = getCategory(p.textContent);
      const { color } = CATEGORIES[category];
      el.setAttribute('data-label', category);
      el.style.background = hexToRgba(color, 0.15);
      el.style.borderLeft = `3px solid ${color}`;
    }
  });
}

// Run on page load
labelElements();

// Re-run when DOM changes (for dynamic content)
const observer = new MutationObserver(labelElements);
observer.observe(document.body, { childList: true, subtree: true });
