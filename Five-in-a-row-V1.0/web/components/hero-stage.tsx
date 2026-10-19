'use client';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
// Sprite sheets must retain their exact dimensions in this LAN static export.
/* oxlint-disable next/no-img-element */
import { HERO001, HERO_STATIONS } from '@/lib/heroes';
import { coordinate, SIZE, type Color, type Player } from '@/lib/game-core';
import type { HeroEvent } from '@/lib/match-core';
import type { HeroMotion } from '@/lib/use-hero-motion';
import { colorName } from '@/lib/presentation';
import {
  EnergyToken,
  TokenGradient,
  TokenShape,
} from '@/components/energy-token';

type Point = { x: number; y: number };
type Geometry = {
  width: number;
  height: number;
  hand: Point;
  source: Point;
  target: Point;
  scale: number;
};
const curve = (a: Point, b: Point) =>
  `M${a.x},${a.y} Q${(a.x + b.x) / 2},${(a.y + b.y) / 2 - 45} ${b.x},${b.y}`;

export function HeroStage({
  children,
  motion,
  warning,
  currentActor,
  colors,
  nameOf,
}: {
  children: ReactNode;
  motion: HeroMotion | null;
  warning: HeroEvent | null;
  currentActor: Player | null;
  colors: Record<Player, Color | null>;
  nameOf: (seat: Player) => string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const beginMotion = useCallback(
    (node: SVGAnimateMotionElement | null) => node?.beginElement(),
    [],
  );
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  useLayoutEffect(() => {
    const stage = root.current;
    if (!stage || !motion) {
      setGeometry(null);
      return;
    }
    const measure = () => {
      const outer = stage.getBoundingClientRect();
      const board = stage.querySelector('.board')?.getBoundingClientRect();
      const hand = stage
        .querySelector(`[data-hand="${motion.event.player}"]`)
        ?.getBoundingClientRect();
      if (!board || !hand || !board.width) return;
      const at = (cell: number): Point => ({
        x:
          board.left -
          outer.left +
          ((36 + (cell % SIZE) * 36) / 576) * board.width,
        y:
          board.top -
          outer.top +
          ((36 + Math.floor(cell / SIZE) * 36) / 576) * board.height,
      });
      setGeometry({
        width: outer.width,
        height: outer.height,
        hand: { x: hand.left - outer.left, y: hand.top - outer.top },
        source: at(motion.event.from ?? motion.event.to),
        target: at(motion.event.to),
        scale: board.width / 576,
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(stage);
    return () => resize.disconnect();
  }, [motion]);
  return (
    <div
      className="hero-stage"
      ref={root}
      data-motion={motion?.phase ?? 'idle'}
    >
      {(['A', 'B'] as Player[]).map((seat) => {
        const acting = motion?.event.player === seat;
        const frame = acting ? motion.frame : 0;
        const hand =
          seat === 'A'
            ? frame === 2
              ? [86, 30]
              : [65, 48]
            : frame === 2
              ? [17, 41]
              : [52, 45];
        return (
          <div
            key={seat}
            className={`hero-station station-${seat} ${currentActor === seat ? 'is-current' : ''} ${acting ? 'is-acting' : ''}`}
          >
            <div className="hero-sprite">
            <img
                src={HERO_STATIONS[seat].sprites}
                width={2172}
                height={724}
                draggable={false}
                alt={`${nameOf(seat)}的小果，${seat === 'A' ? '左下背侧视角' : '右上正侧视角'}${acting ? '，' + (motion.event.kind === 'shift' ? '施放蛛丝换位' : '发射蛛丝落子') : ''}`}
                style={{ left: `${-frame * 100}%` }}
              />
              <i
                data-hand={seat}
                style={{ left: `${hand[0]}%`, top: `${hand[1]}%` }}
              />
            </div>
            <div className="hero-station-label">
              <span>
                {nameOf(seat)} · {seat === 'A' ? '左下' : '右上'}
              </span>
              <strong>
                {HERO001.name} <small>001</small>
              </strong>
              <span>
                {colors[seat] ? (
                  <>
                    <EnergyToken color={colors[seat]} />
                    {colorName(colors[seat])}
                  </>
                ) : (
                  '阵营待选定'
                )}
              </span>
              {acting && (
                <em>
                  {motion.event.kind === 'shift' ? '蛛丝换位' : '蛛丝落子'}
                </em>
              )}
            </div>
            {warning?.warning === seat && (
              <output key={warning.serial} className="hero-warning">
                <b>!</b>
                <span>蜘蛛感应 · 对手连子</span>
              </output>
            )}
          </div>
        );
      })}
      {children}
      {motion && geometry && (
        <svg
          className="hero-effects"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          aria-hidden="true"
          key={motion.event.serial}
        >
          <defs>
            <TokenGradient color={motion.event.color} id="flying-token" />
          </defs>
          {motion.phase !== 'windup' && (
            <path
              key="web"
              className="hero-web"
              pathLength="1"
              d={curve(
                geometry.hand,
                motion.event.kind === 'shift' && motion.phase === 'cast'
                  ? geometry.source
                  : geometry.target,
              )}
            />
          )}
          {motion.event.kind === 'place' && motion.phase === 'cast' && (
            <circle r="4" fill="#fff2fa" className="web-spark">
              <animateMotion
                ref={beginMotion}
                begin="indefinite"
                dur="320ms"
                path={curve(geometry.hand, geometry.target)}
                fill="freeze"
              />
            </circle>
          )}
          {motion.event.kind === 'shift' &&
            (motion.phase === 'windup' || motion.phase === 'cast') && (
              <g
                transform={`translate(${geometry.source.x} ${geometry.source.y}) scale(${geometry.scale})`}
              >
                <TokenShape
                  color={motion.event.color}
                  fill="url(#flying-token)"
                />
              </g>
            )}
          {motion.event.kind === 'shift' && motion.phase === 'pull' && (
            <g key="pull" className="flying-piece">
              <animateMotion
                ref={beginMotion}
                begin="indefinite"
                dur="520ms"
                path={curve(geometry.source, geometry.target)}
                fill="freeze"
              />
              <g transform={`scale(${geometry.scale})`}>
                <TokenShape
                  color={motion.event.color}
                  fill="url(#flying-token)"
                />
              </g>
            </g>
          )}
          {motion.phase === 'land' && (
            <g
              transform={`translate(${geometry.target.x} ${geometry.target.y})`}
            >
              <circle
                className="hero-impact"
                r="20"
                fill="none"
                stroke="#ffd0e7"
                strokeWidth="2"
              />
              <circle
                className="hero-impact inner"
                r="10"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      )}
      <output className="sr-only">
        {motion
          ? `${nameOf(motion.event.player)}${motion.event.kind === 'shift' ? '使用蛛丝换位' : '落子'}到${coordinate(motion.event.to % SIZE, Math.floor(motion.event.to / SIZE))}`
          : ''}
      </output>
    </div>
  );
}
