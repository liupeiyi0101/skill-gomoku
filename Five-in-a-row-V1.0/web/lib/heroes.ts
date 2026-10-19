// heros.xls is user-owned; this catalog mirrors its latest inspected values.
// Hero appearance belongs to a seat, never to the Swap2 opening/colour choice.
export const HERO001 = {
  id: 'Hero001',
  key: 'xiaoguo',
  name: '小果',
  sourceName: '小果',
  source: { file: 'heros.xls', sheet: '英雄', range: 'A2:D2' },
  implementation: 'playable',
  portrait: '/heroes/hero001/portrait.png',
  subtitle: '白粉战衣 · 蛛丝使者',
  talent: {
    id: 'Talent001',
    name: '蜘蛛感应',
    description:
      '当对手落下的这颗棋后出现三连棋子时，Q版人物旁边出现一个叹号“！”',
    source: { file: 'heros.xls', sheet: '天赋', range: 'A2:C2' },
    implemented: true,
  },
  skill: {
    id: 'Skill001',
    name: '蛛丝换位',
    description: '蜘蛛侠可以发射一个蛛丝让任意一颗棋子换位',
    source: { file: 'heros.xls', sheet: '技能', range: 'A2:C2' },
    implemented: true,
    // Not specified in the workbook. Playtest defaults live in match-core.ts.
    targetRule: null,
    cooldown: null,
    useLimit: null,
    consumesNormalMove: null,
  },
  modePolicy: {
    standard: { appearance: true, talent: false, skill: false },
    entertainment: { appearance: true, talent: true, skill: true },
  },
} as const;

// Retain the former export for code referring to the workbook's original hero.
export const SPIDER_MAN = HERO001;

// Fixed screen stations, independent of the colors selected during Swap2.
// Assets must depict genuinely different views, not a horizontal reflection.
export const HERO_STATIONS = {
  A: {
    position: 'bottom-left',
    view: 'rear-three-quarter',
    facing: 'upper-right',
    sprites: '/heroes/hero001/actions-rear.png',
  },
  B: {
    position: 'top-right',
    view: 'front-three-quarter',
    facing: 'lower-left',
    sprites: '/heroes/hero001/actions-front.png',
  },
} as const;

// Timed by the client presentation layer, after the rules accept an action.
export const SPIDER_PLACEMENT_STORYBOARD = [
  'idle',
  'anticipate',
  'shoot-web',
  'web-arrives',
  'token-forms',
  'recover',
] as const;
