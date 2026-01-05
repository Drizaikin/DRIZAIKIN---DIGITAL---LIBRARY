// Preferences Toolbar Component
// Requirements: 2.1, 3.1, 4.1, 4.2, 4.4, 6.1, 7.1

import React from 'react';
import { 
  Grid, 
  List, 
  LayoutGrid, 
  Table2, 
  Sun, 
  Moon, 
  Palette,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { IconSize, ViewLayout, ThemeMode, ThemeColor } from '../services/preferencesService';
import { THEME_COLOR_NAMES, ICON_SIZE_NAMES, THEME_COLORS } from '../constants/themes';

interface PreferencesToolbarProps {
  iconSize: IconSize;
  viewLayout: ViewLayout;
  themeMode: ThemeMode;
  themeColor: ThemeColor;
  onIconSizeChange: (size: IconSize) => void;
  onViewLayoutChange: (layout: ViewLayout) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  onThemeColorChange: (color: ThemeColor) => void;
}

const ICON_SIZE_OPTIONS: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const VIEW_LAYOUT_OPTIONS: ViewLayout[] = ['grid', 'list', 'compact', 'table'];
const THEME_COLOR_OPTIONS: ThemeColor[] = ['classic', 'modern', 'elegant'];

const VIEW_LAYOUT_ICONS: Record<ViewLayout, React.ReactNode> = {
  grid: <Grid size={16} />,
  list: <List size={16} />,
  compact: <LayoutGrid size={16} />,
  table: <Table2 size={16} />,
};

const VIEW_LAYOUT_NAMES: Record<ViewLayout, string> = {
  grid: 'Grid',
  list: 'List',
  compact: 'Compact',
  table: 'Table',
};

const PreferencesToolbar: React.FC<PreferencesToolbarProps> = ({
  iconSize,
  viewLayout,
  themeMode,
  themeColor,
  onIconSizeChange,
  onViewLayoutChange,
  onThemeModeChange,
  onThemeColorChange,
}) => {
  return (
    <div className="glass-panel p-2 md:p-3 rounded-xl mb-4 md:mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left Section: View Layout & Icon Size */}
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          {/* View Layout Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 hidden sm:inline">View:</span>
            <div className="flex bg-white/70 rounded-lg border border-slate-200 p-0.5">
              {VIEW_LAYOUT_OPTIONS.map((layout) => (
                <button
                  key={layout}
                  onClick={() => onViewLayoutChange(layout)}
                  className={`p-1.5 md:p-2 rounded-md transition-all ${
                    viewLayout === layout
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                  }`}
                  title={VIEW_LAYOUT_NAMES[layout]}
                  aria-label={`${VIEW_LAYOUT_NAMES[layout]} view`}
                >
                  {VIEW_LAYOUT_ICONS[layout]}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Size Selector - Only show for grid view */}
          {viewLayout === 'grid' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 hidden sm:inline">Size:</span>
              <div className="flex bg-white/70 rounded-lg border border-slate-200 p-0.5">
                {ICON_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => onIconSizeChange(size)}
                    className={`px-2 py-1 md:px-2.5 md:py-1.5 text-[10px] md:text-xs font-medium rounded-md transition-all ${
                      iconSize === size
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'
                    }`}
                    title={ICON_SIZE_NAMES[size]}
                    aria-label={`${ICON_SIZE_NAMES[size]} icon size`}
                  >
                    {size.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Theme Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Theme Color Selector */}
          <div className="flex items-center gap-1.5">
            <Palette size={14} className="text-slate-400 hidden sm:block" />
            <div className="flex bg-white/70 rounded-lg border border-slate-200 p-0.5">
              {THEME_COLOR_OPTIONS.map((color) => {
                const colorValue = THEME_COLORS[color][themeMode].primary;
                return (
                  <button
                    key={color}
                    onClick={() => onThemeColorChange(color)}
                    className={`p-1.5 md:p-2 rounded-md transition-all ${
                      themeColor === color
                        ? 'ring-2 ring-indigo-600 ring-offset-1'
                        : 'hover:bg-slate-100'
                    }`}
                    title={THEME_COLOR_NAMES[color]}
                    aria-label={`${THEME_COLOR_NAMES[color]} theme`}
                  >
                    <div
                      className="w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: colorValue }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Mode Toggle */}
          <button
            onClick={() => onThemeModeChange(themeMode === 'light' ? 'dark' : 'light')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg border transition-all ${
              themeMode === 'dark'
                ? 'bg-slate-800 text-yellow-400 border-slate-700'
                : 'bg-white/70 text-slate-600 border-slate-200 hover:border-indigo-600'
            }`}
            title={themeMode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label={themeMode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {themeMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span className="text-xs font-medium hidden sm:inline">
              {themeMode === 'light' ? 'Dark' : 'Light'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreferencesToolbar;
