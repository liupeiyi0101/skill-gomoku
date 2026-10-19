'use client';
import { useId } from 'react';
import type { Color } from '@/lib/game-core';
import { TOKEN_SKINS } from '@/lib/presentation';

const hexagon =
  'M-2-15Q0-16 2-15L12-9Q14-8 14-6V6Q14 8 12 9L2 15Q0 16-2 15L-12 9Q-14 8-14 6V-6Q-14-8-12-9Z';

function WebMark({ ink }: { ink: string }) {
  return (
    <g
      fill="none"
      stroke={ink}
      strokeWidth=".9"
      opacity=".65"
      transform="translate(0 -1)"
    >
      <path d="M-9 0H9M0-9V9M-6.4-6.4 6.4 6.4M-6.4 6.4 6.4-6.4" />
      <path d="M0-8Q1-4 5.6-5.6Q4-1 8 0Q4 1 5.6 5.6Q1 4 0 8Q-1 4-5.6 5.6Q-4 1-8 0Q-4-1-5.6-5.6Q-1-4 0-8ZM0-4Q1-2 2.8-2.8Q2-1 4 0Q2 1 2.8 2.8Q1 2 0 4Q-1 2-2.8 2.8Q-2 1-4 0Q-2-1-2.8-2.8Q-1-2 0-4Z" />
    </g>
  );
}

export function TokenGradient({ color, id }: { color: Color; id: string }) {
  const skin = TOKEN_SKINS[color];
  return (
    <radialGradient id={id} cx="30%" cy="20%" r="85%">
      <stop offset="0%" stopColor={skin.highlight} />
      <stop offset="38%" stopColor={skin.face} />
      <stop offset="100%" stopColor={skin.shade} />
    </radialGradient>
  );
}

// Shared geometry keeps board, opening sequence, side selection and history in sync.
export function TokenShape({
  color,
  fill,
  symbol = true,
}: {
  color: Color;
  fill: string;
  symbol?: boolean;
}) {
  const skin = TOKEN_SKINS[color];
  return (
    <g className="energy-shape">
      {skin.shape === 'circle' ? (
        <>
          <circle cy="2.5" r="14" fill={skin.base} />
          <circle
            cy="-1"
            r="14"
            fill={fill}
            stroke={skin.edge}
            strokeWidth="1"
          />
          <path
            d="M-9-7Q-5-12 2-11"
            fill="none"
            stroke="#fff0f6"
            strokeWidth="1.5"
            opacity=".7"
            strokeLinecap="round"
          />
          {symbol && <WebMark ink={skin.ink} />}
        </>
      ) : (
        <>
          <path d={hexagon} transform="translate(0 2.5)" fill={skin.base} />
          <path
            d={hexagon}
            transform="translate(0 -1)"
            fill={fill}
            stroke={skin.edge}
            strokeWidth="1"
          />
          <path
            d="M-9-8-1-13 4-10"
            fill="none"
            stroke="#e8ffff"
            strokeWidth="1.5"
            opacity=".7"
            strokeLinecap="round"
          />
          {symbol && <WebMark ink={skin.ink} />}
        </>
      )}
    </g>
  );
}

export function EnergyToken({
  color,
  className = '',
}: {
  color: Color;
  className?: string;
}) {
  const id = 'token-' + useId().replace(/:/g, '');
  return (
    <svg
      viewBox="-20 -20 40 40"
      className={'energy-token ' + className}
      aria-hidden="true"
    >
      <defs>
        <TokenGradient color={color} id={id} />
      </defs>
      <TokenShape color={color} fill={`url(#${id})`} />
    </svg>
  );
}
