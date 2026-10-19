import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { attachRooms } from '../server/rooms.mjs';

async function fixture(t) {
  const server = createServer();
  const backend = attachRooms(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = '127.0.0.1:' + server.address().port;
  t.after(() => {
    backend.dispose();
    server.close();
  });
  async function client() {
    const ws = new WebSocket('ws://' + address + '/ws', {
        origin: 'http://' + address,
      }),
      client = { ws, room: null, session: null };
    const pending = new Map();
    let seq = 0;
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'state') client.room = m.room;
      if (m.type === 'session') client.session = m.session;
      if (m.type === 'roomClosed') {
        client.room = null;
        client.closed = m.message;
      }
      const task = pending.get(m.id);
      if (task) {
        if (m.type === 'error') {
          pending.delete(m.id);
          task.reject(new Error(m.message));
        }
        if (m.type === 'ack') {
          pending.delete(m.id);
          task.resolve(m);
        }
      }
    });
    await once(ws, 'open');
    t.after(() => ws.terminate());
    client.send = (data) =>
      new Promise((resolve, reject) => {
        const id = String(++seq),
          timeout = setTimeout(() => reject(new Error('test timeout')), 2000);
        pending.set(id, {
          resolve: (m) => {
            clearTimeout(timeout);
            resolve(m);
          },
          reject: (e) => {
            clearTimeout(timeout);
            reject(e);
          },
        });
        ws.send(JSON.stringify({ ...data, id }));
      });
    return client;
  }
  return { client, backend };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
test('LAN hero mode: authoritative shift, normal placement, restore and rematch', async (t) => {
  const { client } = await fixture(t);
  const a = await client(),
    b = await client(),
    resumed = await client();
  await a.send({ type: 'create', mode: 'entertainment', name: '小果 A' });
  await b.send({ type: 'join', code: a.session.code, name: '小果 B' });
  await settle();
  assert.equal(b.room.game.mode, 'entertainment');
  assert.deepEqual(b.room.game.heroes, { A: 'Hero001', B: 'Hero001' });
  const perform = async (c, action) => {
    await c.send({ type: 'action', revision: c.room.revision, action });
    await settle();
  };
  await assert.rejects(perform(a, { type: 'shift', from: 0, to: 1 }), /选边/);
  for (const [x, y] of [
    [7, 7],
    [8, 8],
    [6, 7],
  ])
    await perform(a, { type: 'place', x, y });
  await perform(b, { type: 'choose', color: 2 });
  await assert.rejects(
    perform(a, { type: 'shift', from: 112, to: 0, player: 'B' }),
    /等待对方/,
  );
  await perform(b, { type: 'shift', from: 112, to: 0 });
  assert.deepEqual(a.room.game, b.room.game);
  assert.equal(a.room.game.board[112], 0);
  assert.equal(a.room.game.board[0], 1);
  assert.equal(a.room.game.skillUsed, true);
  assert.equal(a.room.game.lastEvent.kind, 'shift');
  await assert.rejects(
    perform(b, { type: 'shift', from: 0, to: 1 }),
    /本回合已/,
  );
  await assert.rejects(
    b.send({
      type: 'action',
      revision: 0,
      action: { type: 'place', x: 1, y: 1 },
    }),
    /刚刚更新/,
  );
  await resumed.send({
    type: 'resume',
    code: b.session.code,
    token: b.session.token,
  });
  await settle();
  assert.deepEqual(resumed.room.game, a.room.game);
  await perform(resumed, { type: 'place', x: 1, y: 1 });
  assert.equal(a.room.game.skillUsed, false);
  await perform(a, { type: 'resign' });
  await a.send({ type: 'rematch' });
  await resumed.send({ type: 'rematch' });
  await settle();
  assert.equal(a.room.game.mode, 'entertainment');
  assert.equal(a.room.game.opener, 'B');
  assert.equal(a.room.game.eventSerial, 0);
  assert.equal(a.room.game.skillUsed, false);
  assert.deepEqual(a.room.game.piecePositions, []);
});
test('LAN standard mode rejects forged skills and invalid creation mode', async (t) => {
  const { client } = await fixture(t);
  const a = await client(),
    b = await client();
  await assert.rejects(a.send({ type: 'create', mode: 'unlimited' }), /无效/);
  await a.send({ type: 'create' });
  await b.send({ type: 'join', code: a.session.code });
  await settle();
  const before = structuredClone(a.room.game);
  await assert.rejects(
    a.send({
      type: 'action',
      revision: a.room.revision,
      action: { type: 'shift', from: 0, to: 1, mode: 'entertainment' },
    }),
    /标准模式/,
  );
  assert.deepEqual(a.room.game, before);
});
test('LAN full flow: create, join, validate turns, swap, resign, agreed rematch', async (t) => {
  const { client } = await fixture(t);
  const a = await client(),
    b = await client(),
    c = await client();
  await a.send({ type: 'create', name: '小黑' });
  assert.match(a.session.code, /^\d{6}$/);
  await assert.rejects(
    a.send({
      type: 'action',
      revision: a.room.revision,
      action: { type: 'place', x: 7, y: 7 },
    }),
    /等待双方/,
  );
  await b.send({ type: 'join', code: a.session.code, name: '小白' });
  await settle();
  assert.equal(b.room.players.A.name, '小黑');
  assert.equal(JSON.stringify(b.room).includes(a.session.token), false);
  await assert.rejects(
    c.send({ type: 'join', code: a.session.code }),
    /两位玩家/,
  );
  await assert.rejects(
    b.send({
      type: 'action',
      revision: b.room.revision,
      action: { type: 'place', x: 0, y: 0 },
    }),
    /等待对方/,
  );
  await assert.rejects(
    a.send({
      type: 'action',
      revision: 0,
      action: { type: 'place', x: 7, y: 7 },
    }),
    /刚刚更新/,
  );
  for (const [x, y] of [
    [7, 7],
    [7, 8],
    [8, 8],
  ])
    await a.send({
      type: 'action',
      revision: a.room.revision,
      action: { type: 'place', x, y },
    });
  await settle();
  assert.equal(b.room.game.phase, 'chooseSecond');
  await b.send({
    type: 'action',
    revision: b.room.revision,
    action: { type: 'choose', color: 1 },
  });
  await settle();
  assert.equal(a.room.game.colors.A, 2);
  await a.send({
    type: 'action',
    revision: a.room.revision,
    action: { type: 'place', x: 5, y: 5 },
  });
  await settle();
  assert.deepEqual(a.room.game, b.room.game);
  await a.send({
    type: 'action',
    revision: a.room.revision,
    action: { type: 'resign' },
  });
  await settle();
  assert.equal(b.room.game.winner, 'B');
  await a.send({ type: 'rematch' });
  assert.equal(a.room.game.phase, 'finished');
  await b.send({ type: 'rematch' });
  await settle();
  assert.equal(a.room.round, 2);
  assert.equal(a.room.game.opener, 'B');
  assert.equal(a.room.game.moves.length, 0);
});
test('LAN seat authentication, reconnect restores board, old socket cannot impersonate', async (t) => {
  const { client } = await fixture(t);
  const a = await client(),
    b = await client(),
    intruder = await client();
  await a.send({ type: 'create' });
  await b.send({ type: 'join', code: a.session.code });
  await settle();
  await a.send({
    type: 'action',
    revision: a.room.revision,
    action: { type: 'place', x: 0, y: 0 },
  });
  const saved = a.session;
  const closed = once(a.ws, 'close');
  a.ws.close();
  await closed;
  await settle();
  assert.equal(b.room.players.A.connected, false);
  await assert.rejects(
    intruder.send({ type: 'resume', code: saved.code, token: 'bad-token' }),
    /失效/,
  );
  const resumed = await client();
  await resumed.send({ type: 'resume', code: saved.code, token: saved.token });
  assert.equal(resumed.session.seat, 'A');
  assert.equal(resumed.room.game.moves.length, 1);
  await resumed.send({
    type: 'action',
    revision: resumed.room.revision,
    action: { type: 'place', x: 1, y: 1 },
  });
  assert.equal(resumed.room.game.moves.length, 2);
  const replacement = await client();
  const replaced = once(resumed.ws, 'close');
  await replacement.send({
    type: 'resume',
    code: saved.code,
    token: saved.token,
  });
  const [code] = await replaced;
  assert.equal(code, 4001);
  await replacement.send({ type: 'leave' });
  await settle();
  assert.equal(b.room, null);
  assert.ok(b.closed);
});
test('LAN extend opening, wrong phases and payload validation', async (t) => {
  const { client } = await fixture(t);
  const a = await client(),
    b = await client();
  await a.send({ type: 'create' });
  await b.send({ type: 'join', code: a.session.code });
  await settle();
  for (const [x, y] of [
    [7, 7],
    [7, 8],
    [8, 8],
  ])
    await a.send({
      type: 'action',
      revision: a.room.revision,
      action: { type: 'place', x, y },
    });
  await settle();
  await b.send({
    type: 'action',
    revision: b.room.revision,
    action: { type: 'extend' },
  });
  for (const [x, y] of [
    [2, 2],
    [4, 4],
  ])
    await b.send({
      type: 'action',
      revision: b.room.revision,
      action: { type: 'place', x, y },
    });
  await settle();
  await assert.rejects(
    b.send({
      type: 'action',
      revision: b.room.revision,
      action: { type: 'choose', color: 2 },
    }),
    /等待对方/,
  );
  await a.send({
    type: 'action',
    revision: a.room.revision,
    action: { type: 'choose', color: 2 },
  });
  assert.equal(a.room.game.turn, 2);
  await assert.rejects(
    a.send({
      type: 'action',
      revision: a.room.revision,
      action: { type: 'place', x: 99, y: 99 },
    }),
    /棋盘内/,
  );
  assert.equal(a.room.game.moves.length, 5);
  await assert.rejects(a.send({ type: 'rematch' }), /尚未结束/);
});
