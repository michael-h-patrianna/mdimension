/**
 * Shader Settings Component
 *
 * Previously contained surface shader settings. These have been migrated
 * to the Faces section for better organization.
 *
 * This component is kept for backward compatibility but currently renders nothing.
 * Future shader-related settings that aren't face-specific could be added here.
 *
 * @see {@link FacesSection} for face/surface color settings
 */

import React from 'react';

/**
 * Props for ShaderSettings component
 */
export interface ShaderSettingsProps {
  /** Optional CSS class name for styling */
  className?: string;
}

/**
 * Placeholder for shader settings.
 * Face/surface settings have moved to FacesSection.
 *
 * @returns null - renders nothing as settings moved to Faces section
 */
export const ShaderSettings: React.FC<ShaderSettingsProps> = () => {
  // All face-related settings have been migrated to FacesSection
  // This component is kept for API compatibility
  return null;
};
