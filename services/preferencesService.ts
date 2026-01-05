// Preferences Service with Local Storage Persistence
// Requirements: 2.3, 2.4, 2.5, 3.6, 3.7, 3.8, 6.4, 6.5, 6.6, 7.6, 7.7, 7.8

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ViewLayout = 'grid' | 'list' | 'compact' | 'table';
export type ThemeMode = 'light' | 'dark';
export type ThemeColor = 'classic' | 'modern' | 'elegant';

export interface UserPreferences {
  iconSize: IconSize;
  viewLayout: ViewLayout;
  themeMode: ThemeMode;
  themeColor: ThemeColor;
}

const STORAGE_KEY = 'drizaikn_library_preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  iconSize: 'md',
  viewLayout: 'grid',
  themeMode: 'light',
  themeColor: 'classic',
};

// Valid values for validation
const VALID_ICON_SIZES: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const VALID_VIEW_LAYOUTS: ViewLayout[] = ['grid', 'list', 'compact', 'table'];
const VALID_THEME_MODES: ThemeMode[] = ['light', 'dark'];
const VALID_THEME_COLORS: ThemeColor[] = ['classic', 'modern', 'elegant'];

function isValidIconSize(value: unknown): value is IconSize {
  return typeof value === 'string' && VALID_ICON_SIZES.includes(value as IconSize);
}

function isValidViewLayout(value: unknown): value is ViewLayout {
  return typeof value === 'string' && VALID_VIEW_LAYOUTS.includes(value as ViewLayout);
}

function isValidThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && VALID_THEME_MODES.includes(value as ThemeMode);
}

function isValidThemeColor(value: unknown): value is ThemeColor {
  return typeof value === 'string' && VALID_THEME_COLORS.includes(value as ThemeColor);
}


function validatePreferences(data: unknown): UserPreferences {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_PREFERENCES };
  }

  const obj = data as Record<string, unknown>;

  return {
    iconSize: isValidIconSize(obj.iconSize) ? obj.iconSize : DEFAULT_PREFERENCES.iconSize,
    viewLayout: isValidViewLayout(obj.viewLayout) ? obj.viewLayout : DEFAULT_PREFERENCES.viewLayout,
    themeMode: isValidThemeMode(obj.themeMode) ? obj.themeMode : DEFAULT_PREFERENCES.themeMode,
    themeColor: isValidThemeColor(obj.themeColor) ? obj.themeColor : DEFAULT_PREFERENCES.themeColor,
  };
}

function readFromStorage(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_PREFERENCES };
    }
    const parsed = JSON.parse(stored);
    return validatePreferences(parsed);
  } catch (error) {
    console.warn('Failed to read preferences from local storage, using defaults:', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

function writeToStorage(preferences: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to write preferences to local storage:', error);
  }
}

export const preferencesService = {
  getPreferences(): UserPreferences {
    return readFromStorage();
  },

  setIconSize(size: IconSize): void {
    if (!isValidIconSize(size)) {
      console.warn(`Invalid icon size: ${size}, ignoring`);
      return;
    }
    const prefs = readFromStorage();
    prefs.iconSize = size;
    writeToStorage(prefs);
  },

  setViewLayout(layout: ViewLayout): void {
    if (!isValidViewLayout(layout)) {
      console.warn(`Invalid view layout: ${layout}, ignoring`);
      return;
    }
    const prefs = readFromStorage();
    prefs.viewLayout = layout;
    writeToStorage(prefs);
  },

  setThemeMode(mode: ThemeMode): void {
    if (!isValidThemeMode(mode)) {
      console.warn(`Invalid theme mode: ${mode}, ignoring`);
      return;
    }
    const prefs = readFromStorage();
    prefs.themeMode = mode;
    writeToStorage(prefs);
  },

  setThemeColor(color: ThemeColor): void {
    if (!isValidThemeColor(color)) {
      console.warn(`Invalid theme color: ${color}, ignoring`);
      return;
    }
    const prefs = readFromStorage();
    prefs.themeColor = color;
    writeToStorage(prefs);
  },

  resetToDefaults(): void {
    writeToStorage({ ...DEFAULT_PREFERENCES });
  },
};
