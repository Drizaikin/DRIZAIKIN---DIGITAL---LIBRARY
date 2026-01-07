// Dark theme constants for Drizaikn Digital Library
// Marble-inspired color palette based on logo background

export interface AppTheme {
  colors: {
    primaryBg: string;
    secondarySurface: string;
    accent: string;
    primaryText: string;
    logoAccent: string;
    mutedText: string;
    hoverBg: string;
    navbarBg: string;
  };
  spacing: {
    navHeight: string;
    heroHeight: string;
    cardGap: string;
  };
  borderRadius: {
    card: string;
    button: string;
    input: string;
  };
  shadows: {
    card: string;
    cardHover: string;
  };
}

// Dark theme - Marble-inspired colors from logo background
export const darkThemeConfig: AppTheme = {
  colors: {
    // Marble-inspired dark theme (from logo background)
    primaryBg: '#1a1a2e',        // Deep navy with purple undertone
    secondarySurface: '#16213e', // Slightly lighter navy for cards
    accent: '#58A6FF',           // Electric Blue - buttons/links
    primaryText: '#E6EDF3',      // Soft White - readable text
    logoAccent: '#8B949E',       // Steel Gray - borders/dividers
    mutedText: '#8B949E',        // Same as logoAccent for secondary text
    hoverBg: '#1f2b47',          // Slightly lighter for hover states
    navbarBg: 'rgba(26, 26, 46, 0.85)', // Semi-transparent navbar
  },
  spacing: {
    navHeight: '64px',
    heroHeight: '300px',
    cardGap: '16px',
  },
  borderRadius: {
    card: '12px',
    button: '8px',
    input: '8px',
  },
  shadows: {
    card: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
    cardHover: '0 10px 25px -5px rgba(88, 166, 255, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
  }
};

// Light theme constants
export const lightThemeConfig: AppTheme = {
  colors: {
    primaryBg: '#f5f5f7',        // Soft off-white (Apple-inspired)
    secondarySurface: '#ffffff', // Pure white for cards
    accent: '#4f46e5',           // Indigo - buttons/links
    primaryText: '#1e1b4b',      // Dark indigo text
    logoAccent: '#94a3b8',       // Slate gray - borders/dividers
    mutedText: '#64748b',        // Slate for secondary text
    hoverBg: '#e2e8f0',          // Light slate for hover states
    navbarBg: 'rgba(245, 245, 247, 0.85)', // Semi-transparent navbar
  },
  spacing: {
    navHeight: '64px',
    heroHeight: '300px',
    cardGap: '16px',
  },
  borderRadius: {
    card: '12px',
    button: '8px',
    input: '8px',
  },
  shadows: {
    card: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
    cardHover: '0 10px 25px -5px rgba(79, 70, 229, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
  }
};

// Get theme based on mode
export const getTheme = (mode: 'light' | 'dark'): AppTheme => mode === 'light' ? lightThemeConfig : darkThemeConfig;

// Default export for backward compatibility (dark theme)
export const darkTheme = darkThemeConfig;
export const lightTheme = lightThemeConfig;
