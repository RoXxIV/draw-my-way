export const CAPTURE_STATS_POSITION_STORAGE_KEY = 'captureStatsPosition';
export const DEFAULT_CAPTURE_STATS_POSITION = 'top-left';
export const DEFAULT_CAPTURE_FORMAT = 'desktop';

export const CAPTURE_FORMATS = [
  { id: 'square', label: 'Carré', resolution: '1080 x 1080' },
  { id: 'story', label: 'Story', resolution: '1080 x 1920' },
  { id: 'desktop', label: 'Desktop', resolution: '1920 x 1080' },
  { id: 'poster', label: 'Poster', resolution: '1440 x 1800' },
];

export const CAPTURE_STATS_POSITIONS = [
  { id: 'top-left', label: 'Haut gauche' },
  { id: 'top-center', label: 'Haut centre' },
  { id: 'top-right', label: 'Haut droite' },
  { id: 'middle-left', label: 'Milieu gauche' },
  { id: 'middle-center', label: 'Centre' },
  { id: 'middle-right', label: 'Milieu droite' },
  { id: 'bottom-left', label: 'Bas gauche' },
  { id: 'bottom-center', label: 'Bas centre' },
  { id: 'bottom-right', label: 'Bas droite' },
];
