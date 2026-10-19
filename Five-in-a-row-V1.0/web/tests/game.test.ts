import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  actor,
  coordinate,
  exactFive,
  newGame,
  other,
  placingColor,
  SIZE,
  type Color,
  type Game,
  type Player,
} from '../lib/game-core.ts';
function three(opener: Player = 'A') {
  let g = newGame(opener);
  for (const [x, y] of [
    [7, 7],
    [7, 8],
    [8, 8],
  ])
    g = act(g, opener, { type: 'place', x, y });
  return g;
}
function playing(color: Color = 1): Game {
  const g = newGame();
  g.phase = 'playing';
  g.colors = { A: 1, B: 2 };
  g.turn = color;
  return g;
}
test('opening: same player places black-white-black, anywhere', () => {
  let g = newGame();
  for (const [i, pos] of [
    [0, [0, 0]],
    [1, [14, 14]],
    [2, [0, 14]],
  ] as const) {
    assert.equal(actor(g), 'A');
    assert.equal(placingColor(g), i % 2 ? 2 : 1);
    g = act(g, 'A', { type: 'place', x: pos[0], y: pos[1] });
  }
  assert.equal(g.phase, 'chooseSecond');
  assert.equal(actor(g), 'B');
  assert.equal(placingColor(g), null);
});
for (const color of [1, 2] as Color[])
  test('second player directly selects ' + color, () => {
    const g = act(three(), 'B', { type: 'choose', color });
    assert.equal(g.colors.B, color);
    assert.equal(g.colors.A, color === 1 ? 2 : 1);
    assert.equal(g.turn, 2);
    assert.equal(g.phase, 'playing');
    assert.equal(actor(g), color === 1 ? 'A' : 'B');
  });
for (const opener of ['A', 'B'] as Player[])
  for (const color of [1, 2] as Color[])
    test('extended opening, opener ' + opener + ' chooses ' + color, () => {
      let g = act(three(opener), other(opener), { type: 'extend' });
      assert.equal(g.phase, 'opening2');
      assert.equal(placingColor(g), 2);
      g = act(g, other(opener), { type: 'place', x: 1, y: 1 });
      assert.equal(placingColor(g), 1);
      assert.equal(actor(g), other(opener));
      g = act(g, other(opener), { type: 'place', x: 2, y: 2 });
      assert.equal(g.phase, 'chooseFirst');
      assert.equal(actor(g), opener);
      assert.throws(() => act(g, opener, { type: 'extend' }));
      g = act(g, opener, { type: 'choose', color });
      assert.equal(g.colors[opener], color);
      assert.equal(g.turn, 2);
      assert.equal(g.moves.length, 5);
    });
test('reject occupied, out-of-range, fractional and wrong-turn moves', () => {
  const g = act(newGame(), 'A', { type: 'place', x: 7, y: 7 });
  assert.throws(() => act(g, 'B', { type: 'place', x: 0, y: 0 }));
  assert.throws(() => act(g, 'A', { type: 'place', x: 7, y: 7 }));
  for (const [x, y] of [
    [-1, 0],
    [15, 0],
    [0, 15],
    [0, -1],
    [1.2, 3],
    [NaN, 3],
    [Infinity, 0],
  ])
    assert.throws(() => act(g, 'A', { type: 'place', x, y }));
  assert.throws(() => act(newGame(), 'A', { type: 'choose', color: 1 }));
  assert.throws(() => act(three(), 'A', { type: 'choose', color: 1 }));
  assert.throws(() => act(three(), 'B', { type: 'place', x: 0, y: 0 }));
  assert.throws(() => act(newGame(), 'A', { type: 'resign' }));
});
for (const color of [1, 2] as Color[])
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ])
    test(`exact five wins: color ${color}, direction ${dx}/${dy}`, () => {
      const g = playing(color);
      for (let n = 0; n < 4; n++) {
        const x = 4 + dx * n,
          y = 6 + dy * n;
        g.board[y * SIZE + x] = color;
        g.moves.push({ x, y, color, player: actor(g)! });
      }
      const next = act(g, actor(g)!, {
        type: 'place',
        x: 4 + dx * 4,
        y: 6 + dy * 4,
      });
      assert.equal(next.winner, color === 1 ? 'A' : 'B');
      assert.equal(next.phase, 'finished');
      assert.equal(next.winning.length, 5);
      assert.throws(() => act(next, 'A', { type: 'place', x: 0, y: 0 }));
    });
for (const color of [1, 2] as Color[])
  for (const length of [6, 7])
    test(`overline ${length} for ${color} is legal and not winning`, () => {
      const g = playing(color);
      for (let x = 1; x <= length; x++)
        if (x !== 3) {
          g.board[7 * SIZE + x] = color;
          g.moves.push({ x, y: 7, color, player: actor(g)! });
        }
      const next = act(g, actor(g)!, { type: 'place', x: 3, y: 7 });
      assert.equal(next.winner, null);
      assert.equal(next.phase, 'playing');
      assert.equal(next.turn, color === 1 ? 2 : 1);
    });
test('five in one direction wins even with an overline in another', () => {
  const g = playing();
  for (let x = 2; x <= 7; x++) if (x !== 4) g.board[7 * SIZE + x] = 1;
  for (let y = 3; y <= 6; y++) g.board[y * SIZE + 4] = 1;
  assert.equal(act(g, 'A', { type: 'place', x: 4, y: 7 }).winner, 'A');
});
test('double-three and double-four are legal for both colors', () => {
  for (const color of [1, 2] as Color[]) {
    const g = playing(color);
    for (const [x, y] of [
      [6, 7],
      [8, 7],
      [7, 6],
      [7, 8],
    ])
      g.board[y * SIZE + x] = color;
    assert.equal(
      act(g, actor(g)!, { type: 'place', x: 7, y: 7 }).phase,
      'playing',
    );
  }
});
test('board edge is not connected to another row', () => {
  const g = playing();
  for (const i of [13, 14, 15, 16, 17]) g.board[i] = 1;
  assert.deepEqual(exactFive(g.board, 2, 1, 1), []);
});
test('full board without exactly five draws', () => {
  const g = playing(2);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (x !== 14 || y !== 14) {
        const color: Color = (x + 2 * y) % 4 < 2 ? 1 : 2;
        g.board[y * SIZE + x] = color;
        g.moves.push({ x, y, color, player: color === 1 ? 'A' : 'B' });
      }
  const next = act(g, 'B', { type: 'place', x: 14, y: 14 });
  assert.equal(next.winner, 'draw');
  assert.equal(next.reason, 'full');
});
test('resign is allowed outside own turn after colors are assigned', () => {
  const g = act(three(), 'B', { type: 'choose', color: 1 });
  assert.equal(actor(g), 'A');
  assert.equal(act(g, 'B', { type: 'resign' }).winner, 'A');
});
test('actions are immutable and opening choices replay exactly', () => {
  const g = newGame(),
    original = JSON.stringify(g);
  act(g, 'A', { type: 'place', x: 3, y: 3 });
  assert.equal(JSON.stringify(g), original);
  const a = three(),
    before = JSON.stringify(a);
  act(a, 'B', { type: 'choose', color: 2 });
  assert.equal(JSON.stringify(a), before);
  assert.equal(coordinate(0, 14), 'A1');
  assert.equal(coordinate(14, 0), 'O15');
});
test('100 seeded legal games always finish and preserve board/move invariants', () => {
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let round = 0; round < 100; round++) {
    let g = newGame(round % 2 ? 'A' : 'B');
    let operations = 0;
    while (g.phase !== 'finished') {
      assert.ok(++operations <= 230);
      if (g.phase === 'chooseSecond' && round % 3 === 0)
        g = act(g, actor(g)!, { type: 'extend' });
      else if (g.phase === 'chooseSecond' || g.phase === 'chooseFirst')
        g = act(g, actor(g)!, {
          type: 'choose',
          color: random() < 0.5 ? 1 : 2,
        });
      else {
        const free = g.board
          .map((v, i) => (v ? null : i))
          .filter((v): v is number => v !== null);
        const position = free[Math.floor(random() * free.length)];
        g = act(g, actor(g)!, {
          type: 'place',
          x: position % SIZE,
          y: Math.floor(position / SIZE),
        });
      }
      assert.equal(g.board.filter(Boolean).length, g.moves.length);
      assert.equal(
        new Set(g.moves.map((m) => m.x + m.y * SIZE)).size,
        g.moves.length,
      );
    }
    assert.ok(g.winner);
    if (g.reason === 'five') assert.equal(g.winning.length, 5);
  }
});
