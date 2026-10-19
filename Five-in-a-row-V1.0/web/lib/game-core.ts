// Deterministic, platform-independent rules. No browser, transport or skill logic here.
export const SIZE = 15;
export type Player = 'A' | 'B';
export type Color = 1 | 2;
export type Phase =
  | 'opening3'
  | 'chooseSecond'
  | 'opening2'
  | 'chooseFirst'
  | 'playing'
  | 'finished';
export type Move = { x: number; y: number; color: Color; player: Player };
export type Game = {
  rule: 'swap2';
  board: number[];
  moves: Move[];
  opener: Player;
  phase: Phase;
  colors: Record<Player, Color | null>;
  turn: Color;
  winner: Player | 'draw' | null;
  winning: number[];
  reason: 'five' | 'full' | 'resign' | null;
};
export type Action =
  | { type: 'place'; x: number; y: number }
  | { type: 'choose'; color: Color }
  | { type: 'extend' }
  | { type: 'resign' };
export const other = (p: Player): Player => (p === 'A' ? 'B' : 'A');
export const colorName = (color: Color) => (color === 1 ? '黑棋' : '白棋');
export const coordinate = (x: number, y: number) =>
  `${String.fromCharCode(65 + x)}${SIZE - y}`;
export function newGame(opener: Player = 'A'): Game {
  return {
    rule: 'swap2',
    board: Array(SIZE * SIZE).fill(0),
    moves: [],
    opener,
    phase: 'opening3',
    colors: { A: null, B: null },
    turn: 1,
    winner: null,
    winning: [],
    reason: null,
  };
}
export function actor(game: Game): Player | null {
  if (game.phase === 'finished') return null;
  if (game.phase === 'opening3' || game.phase === 'chooseFirst')
    return game.opener;
  if (game.phase === 'opening2' || game.phase === 'chooseSecond')
    return other(game.opener);
  return game.colors.A === game.turn ? 'A' : 'B';
}
export function placingColor(game: Game): Color | null {
  if (game.phase === 'opening3' || game.phase === 'opening2')
    return game.moves.length % 2 === 0 ? 1 : 2;
  return game.phase === 'playing' ? game.turn : null;
}
export function exactFive(
  board: number[],
  x: number,
  y: number,
  color: Color,
): number[] {
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]) {
    const line = [y * SIZE + x];
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
        line.push(ny * SIZE + nx);
        nx += dx * sign;
        ny += dy * sign;
      }
    }
    if (line.length === 5) return line;
  }
  return [];
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function act(original: Game, player: Player, action: Action): Game {
  assert(original.phase !== 'finished', '本局已结束，请开始新一局。');
  assert(player === 'A' || player === 'B', '无效的玩家身份。');
  const game: Game = {
    ...original,
    board: [...original.board],
    moves: [...original.moves],
    colors: { ...original.colors },
    winning: [...original.winning],
  };
  if (action.type === 'resign') {
    assert(game.phase === 'playing', '完成选边后才可以认输。');
    game.phase = 'finished';
    game.winner = other(player);
    game.reason = 'resign';
    return game;
  }
  assert(actor(game) === player, '请等待对方完成操作。');
  if (action.type === 'choose') {
    assert(
      game.phase === 'chooseSecond' || game.phase === 'chooseFirst',
      '现在不是选边阶段。',
    );
    assert(action.color === 1 || action.color === 2, '请选择黑棋或白棋。');
    game.colors[player] = action.color;
    game.colors[other(player)] = action.color === 1 ? 2 : 1;
    game.phase = 'playing';
    game.turn = 2;
    return game;
  }
  if (action.type === 'extend') {
    assert(game.phase === 'chooseSecond', '现在不能补摆两子。');
    game.phase = 'opening2';
    return game;
  }
  assert(action.type === 'place', '未知的操作。');
  const color = placingColor(game);
  assert(color !== null, '请先完成选边。');
  assert(
    Number.isInteger(action.x) &&
      Number.isInteger(action.y) &&
      action.x >= 0 &&
      action.x < SIZE &&
      action.y >= 0 &&
      action.y < SIZE,
    '落点不在棋盘内。',
  );
  const index = action.y * SIZE + action.x;
  assert(game.board[index] === 0, '这里已经有棋子了。');
  game.board[index] = color;
  game.moves.push({ x: action.x, y: action.y, color, player });
  if (game.phase === 'opening3') {
    if (game.moves.length === 3) game.phase = 'chooseSecond';
  } else if (game.phase === 'opening2') {
    if (game.moves.length === 5) game.phase = 'chooseFirst';
  } else {
    game.winning = exactFive(game.board, action.x, action.y, color);
    if (game.winning.length) {
      game.phase = 'finished';
      game.winner = player;
      game.reason = 'five';
    } else if (game.moves.length === SIZE * SIZE) {
      game.phase = 'finished';
      game.winner = 'draw';
      game.reason = 'full';
    } else game.turn = color === 1 ? 2 : 1;
  }
  return game;
}
