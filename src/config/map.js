export const MAP_STYLES = [
  { id: 'positron', label: 'Positron', preview: ['#f7f7f4', '#d6dbe0'], url: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'bright', label: 'Bright', preview: ['#f1efe9', '#9fc7f2'], url: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'dark-matter', label: 'Dark Matter', preview: ['#070909', '#2b3034'], url: '/styles/dark-matter.json' },
  { id: 'fiord', label: 'Fiord', preview: ['#45516e', '#253347'], url: '/styles/fiord-custom.json' },
  { id: '3d', label: '3D', preview: ['#ebe6dc', '#6f9f70'], url: 'https://tiles.openfreemap.org/styles/liberty', isThreeDimensional: true },
];

export const DEFAULT_MAP_STYLE_ID = 'positron';

export function getMapStyleUrl(styleId) {
  return MAP_STYLES.find((style) => style.id === styleId)?.url || getMapStyleUrl(DEFAULT_MAP_STYLE_ID);
}

export function getValidMapStyleId(styleId) {
  return MAP_STYLES.some((style) => style.id === styleId) ? styleId : DEFAULT_MAP_STYLE_ID;
}

export function isThreeDimensionalStyle(styleId) {
  return Boolean(MAP_STYLES.find((style) => style.id === styleId)?.isThreeDimensional);
}

export const FRANCE_CENTER = [2.2137, 46.2276];
export const FRANCE_ZOOM = 5.1;
