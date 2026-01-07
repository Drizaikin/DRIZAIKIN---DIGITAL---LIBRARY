// Custom hook to get the current app theme based on theme mode
import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getTheme, AppTheme } from '../constants/darkTheme';

export function useAppTheme(): AppTheme {
  const { themeMode } = useTheme();
  
  const theme = useMemo(() => getTheme(themeMode), [themeMode]);
  
  return theme;
}

export default useAppTheme;
