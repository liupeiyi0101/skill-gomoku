import { WebSocketServer, WebSocket } from 'ws';
import { randomInt, randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { other } from '../lib/game-core.ts';
import { actMatch, newMatch } from '../lib/match-core.ts';

export function lanAddresses(port) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && !n.internal && n.family === 'IPv4')
    .map((n) => `http://${n.address}:${port}`);
}
export function attachRooms(httpServer) {
  const rooms = new Map();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const send = (socket, message) => {
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  };
  const snapshot = (room) => ({
    code: room.code,
    game: room.game,
    revision: room.revision,
    round: room.round,
    rematch: [...room.rematch],
    players: Object.fromEntries(
      ['A', 'B'].map((p) => [
        p,
        room.players[p]
          ? {
              name: room.players[p].name,
              connected: room.players[p].socket?.readyState === WebSocket.OPEN,
            }
          : null,
      ]),
    ),
  });
  const broadcast = (room) => {
    room.updated = Date.now();
    const message = { type: 'state', room: snapshot(room) };
    for (const p of Object.values(room.players)) send(p?.socket, message);
  };
  function binding(socket) {
    const room = rooms.get(socket.roomCode),
      seat = socket.seat;
    if (!room || !seat || room.players[seat]?.socket !== socket)
      throw new Error('请先创建或加入房间。');
    return { room, seat };
  }
  function attach(socket, room, seat) {
    const player = room.players[seat];
    if (player.socket && player.socket !== socket)
      player.socket.close(4001, 'Session opened elsewhere');
    player.socket = socket;
    socket.roomCode = room.code;
    socket.seat = seat;
    room.revision++;
    send(socket, {
      type: 'session',
      session: { code: room.code, seat, token: player.token },
    });
    broadcast(room);
  }
  function closeRoom(room, reason) {
    for (const p of Object.values(room.players))
      if (p?.socket) {
        send(p.socket, { type: 'roomClosed', message: reason });
        p.socket.roomCode = null;
        p.socket.seat = null;
      }
    rooms.delete(room.code);
  }
  const nameOf = (name) =>
    typeof name === 'string' && name.trim()
      ? name
          .trim()
          .replace(/[\u0000-\u001f<>]/g, '')
          .slice(0, 20)
      : '棋友';
  const onUpgrade = (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/ws') return;
    // A page from another origin must not control a LAN game (CSWSH).
    if (request.headers.origin) {
      try {
        if (new URL(request.headers.origin).host !== request.headers.host) {
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }
    if (wss.clients.size >= 500) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit('connection', ws),
    );
  };
  httpServer.on('upgrade', onUpgrade);
  wss.on('connection', (socket) => {
    socket.alive = true;
    socket.rateTime = Date.now();
    socket.rateCount = 0;
    socket.on('pong', () => {
      socket.alive = true;
    });
    socket.on('error', () => {});
    socket.on('message', (raw) => {
      let message;
      try {
        if (Date.now() - socket.rateTime > 10000) {
          socket.rateTime = Date.now();
          socket.rateCount = 0;
        }
        if (++socket.rateCount > 50)
          throw new Error('操作太频繁，请稍等再试。');
        message = JSON.parse(raw.toString());
        if (
          !message ||
          typeof message !== 'object' ||
          typeof message.id !== 'string' ||
          message.id.length > 80
        )
          throw new Error('无效请求。');
        if (
          ['create', 'join', 'resume'].includes(message.type) &&
          socket.roomCode
        )
          throw new Error('请先离开当前房间。');
        if (message.type === 'create') {
          if (
            message.mode !== undefined &&
            !['standard', 'entertainment'].includes(message.mode)
          )
            throw new Error('无效的游戏模式。');
          if (rooms.size >= 200) throw new Error('房间已满，请稍后再试。');
          let code;
          do {
            code = String(randomInt(100000, 1000000));
          } while (rooms.has(code));
          const room = {
            code,
            game: newMatch('A', message.mode || 'standard'),
            round: 1,
            revision: 0,
            rematch: new Set(),
            updated: Date.now(),
            players: {
              A: {
                name: nameOf(message.name),
                token: randomUUID(),
                socket: null,
              },
              B: null,
            },
          };
          rooms.set(code, room);
          attach(socket, room, 'A');
        } else if (message.type === 'join') {
          const room = rooms.get(message.code);
          if (!room) throw new Error('找不到这个房间，请检查六位房间号。');
          if (room.players.B) throw new Error('这个房间已有两位玩家。');
          room.players.B = {
            name: nameOf(message.name),
            token: randomUUID(),
            socket: null,
          };
          attach(socket, room, 'B');
        } else if (message.type === 'resume') {
          if (typeof message.token !== 'string' || !message.token)
            throw new Error('房间已失效，请重新创建或加入。');
          const room = rooms.get(message.code);
          const seat = ['A', 'B'].find(
            (p) => room?.players[p]?.token === message.token,
          );
          if (!room || !seat) throw new Error('房间已失效，请重新创建或加入。');
          attach(socket, room, seat);
        } else if (message.type === 'action') {
          const { room, seat } = binding(socket);
          if (
            !['A', 'B'].every(
              (p) => room.players[p]?.socket?.readyState === WebSocket.OPEN,
            )
          )
            throw new Error('等待双方连接后才能继续。');
          if (message.revision !== room.revision) {
            send(socket, { type: 'state', room: snapshot(room) });
            throw new Error('棋局刚刚更新，请重新操作。');
          }
          if (!message.action || typeof message.action !== 'object')
            throw new Error('无效操作。');
          room.game = actMatch(room.game, seat, message.action);
          room.revision++;
          broadcast(room);
        } else if (message.type === 'rematch') {
          const { room, seat } = binding(socket);
          if (room.game.phase !== 'finished') throw new Error('本局尚未结束。');
          room.rematch.add(seat);
          if (room.rematch.size === 2) {
            room.game = newMatch(other(room.game.opener), room.game.mode);
            room.round++;
            room.rematch.clear();
          }
          room.revision++;
          broadcast(room);
        } else if (message.type === 'leave') {
          const { room } = binding(socket);
          closeRoom(room, '一位玩家已离开，房间已关闭。');
        } else throw new Error('未知请求。');
        send(socket, { type: 'ack', id: message.id });
      } catch (error) {
        send(socket, {
          type: 'error',
          id: message?.id,
          message:
            error instanceof Error ? error.message : '操作失败，请重试。',
        });
      }
    });
    socket.on('close', () => {
      const room = rooms.get(socket.roomCode);
      if (room?.players[socket.seat]?.socket === socket) {
        room.players[socket.seat].socket = null;
        room.revision++;
        broadcast(room);
      }
    });
  });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.alive) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
    for (const room of rooms.values())
      if (
        Date.now() - room.updated > 30 * 60 * 1000 &&
        !Object.values(room.players).some(
          (p) => p?.socket?.readyState === WebSocket.OPEN,
        )
      )
        rooms.delete(room.code);
  }, 15000);
  heartbeat.unref();
  const dispose = () => {
    clearInterval(heartbeat);
    httpServer.off('upgrade', onUpgrade);
    for (const socket of wss.clients) socket.terminate();
    wss.close();
  };
  httpServer.on('close', dispose);
  return { rooms, dispose };
}
