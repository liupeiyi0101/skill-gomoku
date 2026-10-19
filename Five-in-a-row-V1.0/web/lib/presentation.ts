import type { Color } from './game-core.ts';

// This is a skin mapping, not a change to the logical Swap2 sides (1 / 2).
// Heroes can supply a new skin later without changing saved games or room messages.
export const TOKEN_SKINS = {
  1: {
    name: '珊瑚红',
    short: '红',
    shape: 'circle',
    highlight: '#ffced4',
    face: '#ff8299',
    shade: '#df3f68',
    edge: '#ffb1c2',
    base: '#9c3457',
    ink: '#5c1638',
  },
  2: {
    name: '冰蓝',
    short: '蓝',
    shape: 'hexagon',
    highlight: '#e2ffff',
    face: '#8debf2',
    shade: '#36a7c9',
    edge: '#c4faff',
    base: '#20677f',
    ink: '#123d57',
  },
} as const;

export const colorName = (color: Color) => TOKEN_SKINS[color].name;
