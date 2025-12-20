import React from 'react';
import { useThemeStore, Theme } from '@/stores/themeStore';
import { Select } from '@/components/ui/Select';
import { useShallow } from 'zustand/react/shallow';

export const ThemeSelector: React.FC = () => {
  const themeSelector = useShallow((state: any) => ({
    theme: state.theme,
    setTheme: state.setTheme
  }));
  const { theme, setTheme } = useThemeStore(themeSelector);

  const options = [
    { value: 'cyan', label: 'Neon Cyan' },
    { value: 'green', label: 'Neon Green' },
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
