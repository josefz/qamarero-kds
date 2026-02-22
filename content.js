// Category mappings
const CATEGORIES = {
  patatas: ['PATATAS', 'TARRINA'],
  bebidas: ['33cl', '50cl', 'BEBIDA', 'AGUA', 'CAÑA', 'CERVEZA' ,'DOBLE', 'RADLER', 'TERCIO', 'VERMÚ', 'COPA'],
  complementos: ['NUGGETS','ALITAS PICANTES', 'ARITOS DE CEBOLLA', 'ARITOS DE GOUDA', 'CHEDDARPEÑOS', 'BOCADITOS DE COSTILLA', 'AGUACATE FRITO'],
};

function getCategory(text) {
  const normalized = text.trim().toUpperCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => normalized.includes(kw.toUpperCase()))) {
      return category;
    }
  }
  return 'burger'; // Default category
}

// Add data-label attributes based on p child text
function labelElements() {
  document.querySelectorAll('.css-c2sd62').forEach(el => {
    const p = el.querySelector('p');
    if (p && p.textContent) {
      const category = getCategory(p.textContent);
      el.setAttribute('data-label', category);
    }
  });
}

// Run on page load
labelElements();

// Re-run when DOM changes (for dynamic content)
const observer = new MutationObserver(labelElements);
observer.observe(document.body, { childList: true, subtree: true });
