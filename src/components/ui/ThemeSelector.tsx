import React from 'react';
import { useThemeStore, Theme } from '../../stores/themeStore';
import { Select } from './Select';

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useThemeStore();

  const options = [
    { value: 'cyan', label: 'Neon Cyan' },
    { value: 'gold', label: 'Neon Gold' },
    { value: 'magenta', label: 'Neon Magenta' },
  ];

  return (
    <Select
      label="Theme"
      options={options}
      value={theme}
      onChange={(val) => setTheme(val as Theme)}
    />
  );
};
