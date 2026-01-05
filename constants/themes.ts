// Theme Constants and Color Configurations
// Requirements: 7.2, 7.3, 7.4

import type { IconSize, ThemeColor } from '../services/preferencesService';

export interface ThemeColors {
  primary: string;
  accent: string;
  background: string;
  text: string;
  textSecondary: string;
  border: string;
  cardBg: string;
}

export const THEME_COLORS: Record<ThemeColor, { light: ThemeColors; dark: ThemeColors }> = {
  // Theme 1: Drizaikn Indigo - Default theme
  classic: {
    light: {
      primary: '#4f46e5',      // Indigo
      accent: '#a855f7',       // Purple
      background: '#FFFFFF',   // White
      text: '#1e1b4b',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      cardBg: '#FFFFFF',
    },
    dark: {
      primary: '#818CF8',
      accent: '#C084FC',
      background: '#0F172A',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
      border: '#334155',
      cardBg: '#1E293B',
    },
  },
  // Theme 2: Modern Blue
  modern: {
    light: {
      primary: '#2563EB',      // Royal blue
      accent: '#8B5CF6',       // Violet
      background: '#F8FAFC',   // Off-white
      text: '#1E293B',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      cardBg: '#FFFFFF',
    },
    dark: {
      primary: '#60A5FA',
      accent: '#A78BFA',
      background: '#0F172A',
      text: '#F1F5F9',
      textSecondary: '#94A3B8',
      border: '#334155',
      cardBg: '#1E293B',
    },
  },
  // Theme 3: Elegant Purple
  elegant: {
    light: {
      primary: '#7C3AED',      // Violet
      accent: '#EC4899',       // Pink
      background: '#FFFBEB',   // Warm white
      text: '#1e1b4b',
      textSecondary: '#57534E',
      border: '#D6D3D1',
      cardBg: '#FFFFFF',
    },
    dark: {
      primary: '#A78BFA',
      accent: '#F472B6',
      background: '#18181B',
      text: '#FAFAF9',
      textSecondary: '#A8A29E',
      border: '#3F3F46',
      cardBg: '#27272A',
    },
  },
};


// Icon size CSS class mappings
export const ICON_SIZES: Record<IconSize, { card: string; image: string; text: string }> = {
  xs: { card: 'w-24', image: 'h-32', text: 'text-xs' },
  sm: { card: 'w-32', image: 'h-44', text: 'text-sm' },
  md: { card: 'w-40', image: 'h-56', text: 'text-base' },
  lg: { card: 'w-48', image: 'h-64', text: 'text-lg' },
  xl: { card: 'w-56', image: 'h-72', text: 'text-xl' },
};

// Theme display names for UI
export const THEME_COLOR_NAMES: Record<ThemeColor, string> = {
  classic: 'Drizaikn Indigo',
  modern: 'Modern Blue',
  elegant: 'Elegant Purple',
};

// Icon size display names for UI
export const ICON_SIZE_NAMES: Record<IconSize, string> = {
  xs: 'Extra Small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra Large',
};
