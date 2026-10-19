import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  actor,
  newGame,
  type Game,
  type Action,
  type Player,
  type Color,
} from '../lib/game-core.ts';
import {
  actMatch,
  newMatch,
  canUseSkill,
  makesThree,
  newMotionEvent,
  type Match,
  type MatchMode,
  type MatchAction,
} from '../lib/match-core.ts';

const opening: [Player, Action][] = [
  ['A', { type: 'place', x: 7, y: 7 }],
  ['A', { type: 'place', x: 8, y: 8 }],
  ['A', { type: 'place', x: 6, y: 7 }],
  ['B', { type: 'choose', color: 2 }],
];
function opened(mode: MatchMode = 'entertainment'): Match {
  return opening.reduce((g, [p, a]) => actMatch(g, p, a), newMatch('A', mode));
}
function boardFixture(cells: [number, Color][], turn: Color = 1): Match {
  const game = newMatch('A', 'entertainment');
  game.phase = 'playing';
  game.colors = { A: 1, B: 2 };
  game.turn = turn;
  for (const [cell, color] of cells) {
    game.board[cell] = color;
    game.piecePositions.push(cell);
    game.moves.push({
      x: cell % 15,
      y: Math.floor(cell / 15),
      color,
      player: color === 1 ? 'A' : 'B',
    });
  }
  return game;
}
void test('standard mode delegates every rule to the unchanged Swap2 core', () => {
  let core: Game = newGame(),
    match = newMatch();
  for (const [p, action] of [
    ...opening,
    ['B', { type: 'place', x: 1, y: 1 }],
    ['A', { type: 'resign' }],
  ] as [Player, Action][]) {
    core = act(core, p, action);
    match = actMatch(match, p, action);
    for (const key of Object.keys(core) as (keyof Game)[])
      assert.deepEqual(match[key], core[key]);
    assert.equal(match.lastEvent?.warning ?? null, null);
  }
});
void test('both Swap2 branches keep heroes assigned to seats through colour swaps', () => {
  for (const opener of ['A', 'B'] as Player[])
    for (const color of [1, 2] as Color[]) {
      let game = newMatch(opener, 'entertainment');
      for (const x of [0, 1, 2])
        game = actMatch(game, opener, { type: 'place', x, y: 0 });
      const second = opener === 'A' ? 'B' : 'A';
      game = actMatch(game, second, { type: 'extend' });
      for (const x of [3, 4])
        game = actMatch(game, second, { type: 'place', x, y: 0 });
      game = actMatch(game, opener, { type: 'choose', color });
      assert.deepEqual(game.heroes, { A: 'Hero001', B: 'Hero001' });
      assert.equal(game.turn, 2);
      assert.equal(canUseSkill(game, actor(game)), true);
    }
});
void test('standard, opening, other turn and finished game reject skills', () => {
  assert.throws(
    () =>
      actMatch(opened('standard'), 'B', { type: 'shift', from: 112, to: 0 }),
    /标准模式/,
  );
  assert.throws(
    () =>
      actMatch(newMatch('A', 'entertainment'), 'A', {
        type: 'shift',
        from: 112,
        to: 0,
      }),
    /选边/,
  );
  assert.throws(
    () => actMatch(opened(), 'A', { type: 'shift', from: 112, to: 0 }),
    /等待对方/,
  );
  const finished = actMatch(opened(), 'A', { type: 'resign' });
  assert.throws(
    () => actMatch(finished, 'B', { type: 'shift', from: 112, to: 0 }),
    /结束/,
  );
});
void test('shift can move either colour, retains piece identity and does not consume the placement', () => {
  for (const from of [112, 128]) {
    const original = opened(),
      frozen = structuredClone(original);
    const moved = actMatch(original, 'B', { type: 'shift', from, to: 0 });
    assert.deepEqual(original, frozen);
    assert.equal(moved.board[from], 0);
    assert.equal(moved.board[0], original.board[from]);
    assert.equal(moved.board.filter(Boolean).length, 3);
    assert.deepEqual(moved.moves, original.moves);
    assert.equal(
      moved.piecePositions[original.piecePositions.indexOf(from)],
      0,
    );
    assert.equal(actor(moved), 'B');
    assert.equal(moved.skillUsed, true);
    assert.equal(moved.lastEvent?.kind, 'shift');
    assert.equal(moved.lastEvent?.warning, null);
    assert.throws(
      () => actMatch(moved, 'B', { type: 'shift', from: 0, to: 1 }),
      /本回合已/,
    );
    const placed = actMatch(moved, 'B', { type: 'place', x: 1, y: 1 });
    assert.equal(actor(placed), 'A');
    assert.equal(placed.skillUsed, false);
    assert.equal(placed.piecePositions.at(-1), 16);
  }
});
void test('invalid skill cells, occupied targets and empty source never mutate the board', () => {
  const game = opened(),
    old = structuredClone(game);
  for (const [from, to] of [
    [-1, 0],
    [225, 0],
    [112, 225],
    [112, -1],
    [112.5, 0],
    [112, NaN],
    [0, 1],
    [112, 112],
    [112, 128],
  ]) {
    assert.throws(() => actMatch(game, 'B', { type: 'shift', from, to }));
    assert.deepEqual(game, old);
  }
});
void test('normal placement is still legal without using the optional skill', () => {
  const game = actMatch(opened(), 'B', { type: 'place', x: 0, y: 0 });
  assert.equal(actor(game), 'A');
  assert.equal(canUseSkill(game, 'A'), true);
});
for (const [dx, dy] of [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]) {
  void test(`talent detects a new contiguous run in direction ${dx}/${dy}, not remote threats`, () => {
    const board = Array(225).fill(0),
      start = 112;
    for (let i = 0; i < 3; i++) board[start + (dx + dy * 15) * i] = 1;
    assert.equal(makesThree(board, start, 1), true);
    board[0] = 1;
    assert.equal(makesThree(board, 0, 1), false);
    assert.equal(makesThree(board, start, 2), false);
  });
}
void test('talent does not wrap board edges or treat broken runs as contiguous', () => {
  const board = Array(225).fill(0);
  for (const cell of [13, 14, 15]) board[cell] = 1;
  assert.equal(makesThree(board, 14, 1), false);
  board.fill(0);
  for (const cell of [0, 1, 3]) board[cell] = 1;
  assert.equal(makesThree(board, 1, 1), false);
});
void test('talent warns the opponent only for entertainment normal placements', () => {
  const original = boardFixture([
    [0, 1],
    [1, 1],
  ]);
  const placed = actMatch(original, 'A', { type: 'place', x: 2, y: 0 });
  assert.equal(placed.lastEvent?.warning, 'B');
  assert.equal(
    actMatch({ ...original, mode: 'standard' }, 'A', {
      type: 'place',
      x: 2,
      y: 0,
    }).lastEvent?.warning,
    null,
  );
  let openingGame = newMatch('A', 'entertainment');
  for (const [x, y] of [
    [0, 0],
    [0, 1],
    [1, 0],
  ])
    openingGame = actMatch(openingGame, 'A', { type: 'place', x, y });
  assert.equal(openingGame.lastEvent?.warning, null);
});
void test('moving an opposing stone into exactly five gives its owner the win', () => {
  const game = boardFixture(
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [20, 1],
    ],
    2,
  );
  const next = actMatch(game, 'B', { type: 'shift', from: 20, to: 4 });
  assert.equal(next.phase, 'finished');
  assert.equal(next.winner, 'A');
  assert.equal(next.winning.length, 5);
});
void test('a six-long destination is legal but does not win', () => {
  const game = boardFixture([
    [0, 1],
    [1, 1],
    [2, 1],
    [4, 1],
    [5, 1],
    [20, 1],
  ]);
  const next = actMatch(game, 'A', { type: 'shift', from: 20, to: 3 });
  assert.equal(next.phase, 'playing');
  assert.deepEqual(next.winning, []);
});
void test('removing an endpoint of an overline checks the exposed five at the source', () => {
  const game = boardFixture([
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
  ]);
  const next = actMatch(game, 'A', { type: 'shift', from: 0, to: 20 });
  assert.equal(next.winner, 'A');
  assert.deepEqual(
    [...next.winning].sort((a, b) => a - b),
    [1, 2, 3, 4, 5],
  );
});
void test('saved action replay restores moved pieces, cooldown and animation event data', () => {
  const actions: [Player, MatchAction][] = [
    ...opening,
    ['B', { type: 'shift', from: 112, to: 0 }],
    ['B', { type: 'place', x: 2, y: 2 }],
    ['A', { type: 'shift', from: 0, to: 3 }],
  ];
  const result = actions.reduce(
    (g, [p, a]) => actMatch(g, p, a),
    newMatch('A', 'entertainment'),
  );
  const serialized = JSON.parse(JSON.stringify(actions)) as typeof actions;
  assert.deepEqual(
    serialized.reduce(
      (g, [p, a]) => actMatch(g, p, a),
      newMatch('A', 'entertainment'),
    ),
    result,
  );
});
void test('initial snapshot, duplicate updates, choices, reset and catch-up do not replay animation', () => {
  const initial = newMatch(),
    first = actMatch(initial, 'A', { type: 'place', x: 0, y: 0 });
  const second = actMatch(first, 'A', { type: 'place', x: 1, y: 0 });
  assert.equal(newMotionEvent(null, first), null);
  assert.equal(newMotionEvent(first, { ...first }), null);
  assert.equal(newMotionEvent(second, initial), null);
  assert.equal(newMotionEvent(initial, second), null);
  assert.deepEqual(newMotionEvent(initial, first), first.lastEvent);
  const chosen = opened();
  assert.equal(
    newMotionEvent(chosen, { ...chosen, lastEvent: chosen.lastEvent }),
    null,
  );
});
