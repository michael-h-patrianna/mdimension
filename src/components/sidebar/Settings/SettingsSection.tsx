/**
 * Settings Section Component
 * Section wrapper for app settings controls
 */

import { Section } from '@/components/ui/Section';
import React from 'react';
import { ThemeSelector } from './ThemeSelector';

export interface SettingsSectionProps {
  defaultOpen?: boolean;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  defaultOpen = true,
}) => {
  return (
    <Section title="Settings" defaultOpen={defaultOpen}>
      <ThemeSelector />
    </Section>
  );
};
