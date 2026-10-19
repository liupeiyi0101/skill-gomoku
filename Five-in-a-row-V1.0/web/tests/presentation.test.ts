import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  actor,
  newGame,
  other,
  placingColor,
  type Color,
  type Player,
} from '../lib/game-core.ts';
import { colorName, TOKEN_SKINS } from '../lib/presentation.ts';

test('visual sides use different colors and silhouettes, without changing rule IDs', () => {
  assert.equal(colorName(1), '珊瑚红');
  assert.equal(colorName(2), '冰蓝');
  assert.equal(TOKEN_SKINS[1].shape, 'circle');
  assert.equal(TOKEN_SKINS[2].shape, 'hexagon');
  assert.notEqual(TOKEN_SKINS[1].face, TOKEN_SKINS[2].face);
});

test('red-blue-red opening, both Swap2 branches and swapped opener keep the same ownership', () => {
  for (const opener of ['A', 'B'] as Player[]) {
    for (const extend of [false, true]) {
      for (const choice of [1, 2] as Color[]) {
        let game = newGame(opener);
        const names: string[] = [];
        for (let i = 0; i < 3; i++) {
          names.push(colorName(placingColor(game)!));
          game = act(game, opener, { type: 'place', x: i, y: 7 });
        }
        assert.deepEqual(names, ['珊瑚红', '冰蓝', '珊瑚红']);
        assert.deepEqual(game.colors, { A: null, B: null });
        if (extend) {
          game = act(game, other(opener), { type: 'extend' });
          assert.equal(colorName(placingColor(game)!), '冰蓝');
          game = act(game, other(opener), { type: 'place', x: 3, y: 7 });
          assert.equal(colorName(placingColor(game)!), '珊瑚红');
          game = act(game, other(opener), { type: 'place', x: 4, y: 7 });
        }
        const chooser = actor(game)!;
        game = act(game, chooser, { type: 'choose', color: choice });
        assert.equal(game.colors[chooser], choice);
        assert.equal(colorName(placingColor(game)!), '冰蓝');
        assert.equal(game.colors[actor(game)!], 2);
        assert.equal(game.phase, 'playing');
      }
    }
  }
});
