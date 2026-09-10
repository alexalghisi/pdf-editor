export const colors = {
  background: '#0E1116',
  surface: '#161B22',
  surfaceRaised: '#1F2630',
  border: '#30363D',
  textPrimary: '#E8EDF2',
  textSecondary: '#8B949E',
  textInverse: '#0E1116',
  accent: '#C9A227',
  accentSoft: '#3A3114',
  danger: '#F85149',
  paper: '#F6F1E7',
  overlay: 'rgba(8, 10, 14, 0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 20, fontWeight: '600' as const },
  heading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;
