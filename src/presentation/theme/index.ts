export const colors = {
  background: '#0B0D12',
  canvas: '#07090D',
  surface: '#12151C',
  surfaceRaised: '#1A1F29',
  surfaceHover: '#232A37',
  border: '#272E3B',
  borderStrong: '#3A4354',
  textPrimary: '#EEF1F6',
  textSecondary: '#9AA4B5',
  textInverse: '#14110A',
  accent: '#FFC53D',
  accentHover: '#FFD166',
  accentSoft: 'rgba(255, 197, 61, 0.12)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',
  paper: '#FFFFFF',
  overlay: 'rgba(4, 6, 10, 0.68)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700' as const,
    letterSpacing: -1,
  },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  heading: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
} as const;

export const layout = {
  touchTarget: 44,
  compactWidth: 600,
  contentMaxWidth: 560,
} as const;

export const elevation = {
  shadowColor: '#000000',
  shadowOpacity: 0.4,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 12,
} as const;
