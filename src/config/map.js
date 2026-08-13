export const MAP_STYLES = [
  { id: 'positron', label: 'Positron', url: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'bright', label: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'dark-matter', label: 'Dark Matter', url: '/styles/dark-matter.json' },
  { id: 'fiord', label: 'Fiord', url: '/styles/fiord-custom.json' },
  { id: '3d', label: '3D', url: 'https://tiles.openfreemap.org/styles/liberty', isThreeDimensional: true },
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
