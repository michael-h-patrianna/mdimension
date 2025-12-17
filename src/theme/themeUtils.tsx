import { CSSProperties } from 'react';

/**
 * Creates a semi-transparent background color.
 * @param color - Hex or RGB color string
 * @param opacity - Opacity value between 0 and 1
 * @returns CSSProperties with background set
 */
export function createOverlayBackground(color: string, opacity: number): CSSProperties {
  // Simple check if color is hex
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})` };
  }
  return { backgroundColor: color, opacity };
}

/**
 * Creates a card background with optional blur.
 * @param color - Background color
 * @param opacity - Opacity
 * @param blur - Blur amount in px
 * @returns CSSProperties
 */
export function createCardBackground(color: string, opacity: number, blur = 0): CSSProperties {
  const bg = createOverlayBackground(color, opacity);
  return {
    ...bg,
    backdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
    WebkitBackdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
  };
}

/**
 * Creates a gradient text style.
 * @param gradient - CSS gradient string
 * @returns CSSProperties
 */
export function createGradientText(gradient: string): CSSProperties {
  return {
    background: gradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
  };
}

/**
 * Creates a flex layout style.
 * @param align - align-items value
 * @param justify - justify-content value
 * @param gap - gap value
 * @param direction - flex-direction value
 * @returns CSSProperties
 */
export function createFlexLayout(
  align: CSSProperties['alignItems'] = 'stretch',
  justify: CSSProperties['justifyContent'] = 'flex-start',
  gap: string | number = 0,
  direction: CSSProperties['flexDirection'] = 'row'
): CSSProperties {
  return {
    display: 'flex',
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    gap,
  };
}

/**
 * Creates an absolute overlay style.
 * @param offset - Top/Left/Right/Bottom offsets
 * @param offset.top
 * @param offset.left
 * @param offset.right
 * @param offset.bottom
 * @param zIndex - z-index value
 * @returns CSSProperties
 */
export function createAbsoluteOverlay(
  offset: { top?: number | string; left?: number | string; right?: number | string; bottom?: number | string } = { top: 0, left: 0 },
  zIndex?: number
): CSSProperties {
  return {
    position: 'absolute',
    ...offset,
    zIndex,
  };
}

/**
 * Creates a transform style.
 * @param transforms - Object with transform properties
 * @param transforms.translateX
 * @param transforms.translateY
 * @param transforms.scale
 * @param transforms.rotate
 * @returns CSSProperties
 */
export function createTransform(transforms: {
  translateX?: string | number;
  translateY?: string | number;
  scale?: number;
  rotate?: number;
}): CSSProperties {
  const parts = [];
  if (transforms.translateX !== undefined) parts.push(`translateX(${typeof transforms.translateX === 'number' ? transforms.translateX + 'px' : transforms.translateX})`);
  if (transforms.translateY !== undefined) parts.push(`translateY(${typeof transforms.translateY === 'number' ? transforms.translateY + 'px' : transforms.translateY})`);
  if (transforms.scale !== undefined) parts.push(`scale(${transforms.scale})`);
  if (transforms.rotate !== undefined) parts.push(`rotate(${transforms.rotate}deg)`);
  return { transform: parts.join(' ') };
}

/**
 * Creates a responsive font size style.
 * @param containerWidth - Current width of container
 * @param options - Min/Max font size and width configuration
 * @param options.min
 * @param options.max
 * @param options.minWidth
 * @param options.maxWidth
 * @returns number (font size in px)
 */
export function createResponsiveFontSize(
  containerWidth: number,
  options: { min: number; max: number; minWidth: number; maxWidth: number }
): number {
  const { min, max, minWidth, maxWidth } = options;
  if (containerWidth <= minWidth) return min;
  if (containerWidth >= maxWidth) return max;
  const ratio = (containerWidth - minWidth) / (maxWidth - minWidth);
  return min + (max - min) * ratio;
}
