const BEBIDAS = ['33cl', '50cl', 'BEBIDA', 'AGUA', 'CAÑA', 'CERVEZA', 'DOBLE', 'RADLER', 'TERCIO', '1/3', 'VERMÚ', 'COPA'];

// Category mappings
const CATEGORIES = {
  salsas: {
    keywords: ['SALSA'],
    color: '#f48524',
  },
  plancha: {
    keywords: ['CARNE', 'QUESO', 'BACON'],
    color: '#f1c40f',
  },
  extras: {
    keywords: ['CEBOLLA', 'JALAPEÑO', 'PEPINILLO',],
    color: '#d73f0c',
  },
  patatas: {
    keywords: ['PATATAS'],
    color: '#a4d06a',
  },
  tarrinas: {
    keywords: ['TARRINA'],
    color: '#0a9351',
  },
  complementos: {
    keywords: ['NUGGETS', 'ALITAS PICANTES', 'ARITOS DE CEBOLLA', 'ARITOS DE GOUDA', 'CHEDDARPEÑOS', 'BOCADITOS DE COSTILLA', 'AGUACATE FRITO'],
    color: '#e622cf',
  },
  others: {
    keywords: [...BEBIDAS],
    color: '#ffffff',
  },
};
