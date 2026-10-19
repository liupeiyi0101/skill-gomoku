// Hero mode extends the match, not the independently tested Swap2 rules.
import {
  act,
  actor,
  exactFive,
  newGame,
  other,
  SIZE,
  type Action,
  type Color,
  type Game,
  type Player,
} from './game-core.ts';

export type MatchMode = 'standard' | 'entertainment';
export type ShiftAction = { type: 'shift'; from: number; to: number };
export type MatchAction = Action | ShiftAction;
export type HeroEvent = {
  serial: number;
  kind: 'place' | 'shift';
  player: Player;
  color: Color;
  from: number | null;
  to: number;
  warning: Player | null;
};
export type Match = Game & {
  mode: MatchMode;
  heroes: Record<Player, 'Hero001'>;
  skillUsed: boolean;
  // Historical moves stay immutable; piece positions track their current cells.
  piecePositions: number[];
  eventSerial: number;
  lastEvent: HeroEvent | null;
};

// First playable ruleset. These explicit values are separate from the source text.
export const HERO001_PLAY_RULES = {
  target: 'either-side-to-empty',
  usesPerTurn: 1,
  consumesNormalMove: false,
  openingAllowed: false,
} as const;

export function newMatch(
  opener: Player = 'A',
  mode: MatchMode = 'standard',
): Match {
  return {
    ...newGame(opener),
    mode,
    heroes: { A: 'Hero001', B: 'Hero001' },
    skillUsed: false,
    piecePositions: [],
    eventSerial: 0,
    lastEvent: null,
  };
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function validCell(value: number) {
  return Number.isInteger(value) && value >= 0 && value < SIZE * SIZE;
}

// A newly placed piece must participate in the contiguous run. Disconnected
// threats elsewhere and opening setup never fire the talent.
export function makesThree(
  board: number[],
  cell: number,
  color: Color,
): boolean {
  if (!validCell(cell) || board[cell] !== color) return false;
  const x = cell % SIZE,
    y = Math.floor(cell / SIZE);
  return [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ].some(([dx, dy]) => {
    let length = 1;
    for (const sign of [-1, 1]) {
      let nx = x + dx * sign,
        ny = y + dy * sign;
      while (
        nx >= 0 &&
        nx < SIZE &&
        ny >= 0 &&
        ny < SIZE &&
        board[ny * SIZE + nx] === color
      ) {
        length++;
        nx += dx * sign;
        ny += dy * sign;
      }
    }
    return length >= 3;
  });
}

export function canUseSkill(game: Match, player: Player | null): boolean {
  return (
    game.mode === 'entertainment' &&
    game.phase === 'playing' &&
    !!player &&
    actor(game) === player &&
    !game.skillUsed
  );
}

export function actMatch(
  original: Match,
  player: Player,
  action: MatchAction,
): Match {
  if (action.type !== 'shift') {
    const game = { ...act(original, player, action) } as Match;
    if (action.type === 'place') {
      const move = game.moves.at(-1)!;
      const to = move.y * SIZE + move.x;
      game.piecePositions = [...original.piecePositions, to];
      game.skillUsed = false;
      game.eventSerial++;
      game.lastEvent = {
        serial: game.eventSerial,
        kind: 'place',
        player,
        color: move.color,
        from: null,
        to,
        warning:
          original.mode === 'entertainment' &&
          original.phase === 'playing' &&
          makesThree(game.board, to, move.color)
            ? other(player)
            : null,
      };
    }
    return game;
  }
  check(original.mode === 'entertainment', '标准模式不允许使用技能。');
  check(
    original.phase === 'playing',
    '完成 Swap2 选边后才能使用技能，本局结束后不可使用。',
  );
  check(player === 'A' || player === 'B', '无效的玩家身份。');
  check(actor(original) === player, '请等待对方完成操作。');
  check(!original.skillUsed, '本回合已使用蛛丝换位，请正常落子。');
  check(validCell(action.from) && validCell(action.to), '换位目标不在棋盘内。');
  check(original.board[action.from] !== 0, '请先选择一颗已有棋子。');
  check(
    original.board[action.to] === 0,
    '只能牵引到空交叉点，不能交换或覆盖棋子。',
  );
  const color = original.board[action.from] as Color;
  const board = [...original.board];
  board[action.from] = 0;
  board[action.to] = color;
  const game: Match = {
    ...original,
    board,
    skillUsed: true,
    piecePositions: original.piecePositions.map((cell) =>
      cell === action.from ? action.to : cell,
    ),
    eventSerial: original.eventSerial + 1,
    winning: [],
    lastEvent: {
      serial: original.eventSerial + 1,
      kind: 'shift',
      player,
      color,
      from: action.from,
      to: action.to,
      warning: null,
    },
  };
  // Removing a stone from a long run can ALSO expose an exact five.
  // Prefer the relocated side if both sides obtain five simultaneously.
  for (const side of [color, color === 1 ? 2 : 1] as Color[]) {
    for (let cell = 0; cell < board.length; cell++) {
      if (board[cell] !== side) continue;
      const winning = exactFive(
        board,
        cell % SIZE,
        Math.floor(cell / SIZE),
        side,
      );
      if (winning.length) {
        game.winning = winning;
        game.phase = 'finished';
        game.winner = game.colors.A === side ? 'A' : 'B';
        game.reason = 'five';
        return game;
      }
    }
  }
  return game;
}

export function newMotionEvent(
  previous: Match | null,
  next: Match,
): HeroEvent | null {
  // Initial load, reconnection catch-up, reset and colour choice don't replay.
  return previous && next.eventSerial === previous.eventSerial + 1
    ? next.lastEvent
    : null;
}
