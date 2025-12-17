import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export const useDynamicFavicon = () => {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Get accent color from computed style or mapping
      let color = '#3b82f6'; // Default blue
      
      const themeColors: Record<string, string> = {
          cyan: '#06b6d4',
          green: '#10b981',
          magenta: '#d946ef',
          orange: '#f97316',
          blue: '#3b82f6',
          rainbow: '#f43f5e'
      };
      
      if (theme in themeColors) {
          color = themeColors[theme] || color;
      }

      // Draw Circle
      ctx.clearRect(0, 0, 32, 32);
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw Glow
      ctx.shadowBlur = 4;
      ctx.shadowColor = color;
      ctx.stroke();

      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = canvas.toDataURL();
      const head = document.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(link);
      }
    }
  }, [theme]);
};
