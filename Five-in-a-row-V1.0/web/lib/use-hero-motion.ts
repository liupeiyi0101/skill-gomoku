'use client';
// The authoritative game snapshot is an external event stream. Its presentation
// timeline is intentionally reset immediately, before scheduling later frames.
/* oxlint-disable react/react-compiler */
import { useEffect, useRef, useState } from 'react';
import { newMotionEvent, type HeroEvent, type Match } from './match-core';

export type HeroMotion = {
  event: HeroEvent;
  frame: 1 | 2 | 3;
  phase: 'windup' | 'cast' | 'pull' | 'land';
};
export function useHeroMotion(
  game: Match,
  scene: string,
  ready: boolean,
  reduced: boolean,
) {
  const previous = useRef<{ game: Match; scene: string } | null>(null);
  const [motion, setMotion] = useState<HeroMotion | null>(null);
  const [warning, setWarning] = useState<HeroEvent | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const previousReduced = useRef(reduced);
  useEffect(() => {
    const old = previous.current;
    previous.current = ready ? { game, scene } : null;
    const changedScene =
      !old ||
      old.scene !== scene ||
      game.eventSerial < old.game.eventSerial ||
      (!previousReduced.current && reduced);
    previousReduced.current = reduced;
    if (changedScene) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setMotion(null);
      setWarning(null);
    }
    const event =
      !changedScene && ready ? newMotionEvent(old.game, game) : null;
    if (!event) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setWarning(null);
    const later = (ms: number, callback: () => void) =>
      timers.current.push(setTimeout(callback, ms));
    const warn = () => {
      if (event.warning) {
        setWarning(event);
        later(2600, () => setWarning(null));
      }
    };
    if (reduced) {
      setMotion(null);
      warn();
      return;
    }
    setMotion({ event, frame: 1, phase: 'windup' });
    later(150, () => setMotion({ event, frame: 2, phase: 'cast' }));
    if (event.kind === 'shift') {
      later(430, () => setMotion({ event, frame: 3, phase: 'pull' }));
      later(950, () => setMotion({ event, frame: 3, phase: 'land' }));
      later(1250, () => {
        setMotion(null);
        warn();
      });
    } else {
      later(470, () => {
        setMotion({ event, frame: 2, phase: 'land' });
        warn();
      });
      later(760, () => setMotion(null));
    }
  }, [game, scene, ready, reduced]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return {
    motion,
    warning,
    busy: !!motion,
    hiddenCell: motion && motion.phase !== 'land' ? motion.event.to : null,
  };
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}
