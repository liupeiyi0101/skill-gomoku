'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Player } from './game-core';
import type { MatchAction, Match, MatchMode } from './match-core';
export type Session = { code: string; token: string; seat: Player };
export type Room = {
  code: string;
  revision: number;
  round: number;
  game: Match;
  rematch: Player[];
  players: Record<Player, { name: string; connected: boolean } | null>;
};
const KEY = 'yijian-room-v1';
export function useRoom(enabled: boolean, notice: (text: string) => void) {
  const [room, setRoom] = useState<Room | null>(null),
    [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState('offline'),
    [pending, setPending] = useState(false);
  const socketRef = useRef<WebSocket | null>(null),
    sessionRef = useRef<Session | null>(null),
    noticeRef = useRef(notice);
  noticeRef.current = notice;
  const calls = useRef(
    new Map<
      string,
      {
        resolve: () => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );
  const request = useCallback(
    (data: Record<string, unknown>) =>
      new Promise<void>((resolve, reject) => {
        const socket = socketRef.current;
        if (socket?.readyState !== WebSocket.OPEN) {
          reject(new Error('连接尚未就绪，请稍等。'));
          return;
        }
        const id =
          String(Date.now()) + '-' + Math.random().toString(36).slice(2);
        const timer = setTimeout(() => {
          calls.current.delete(id);
          reject(new Error('操作确认超时，正在重新同步棋局。'));
          socket.close();
        }, 8000);
        calls.current.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ ...data, id }));
      }),
    [],
  );
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>,
      attempts = 0;
    try {
      sessionRef.current = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    } catch {
      sessionRef.current = null;
    }
    setSession(sessionRef.current);
    function connect() {
      if (cancelled) return;
      setStatus(attempts ? 'reconnecting' : 'connecting');
      const socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
      );
      socketRef.current = socket;
      socket.onopen = () => {
        attempts = 0;
        setStatus('connected');
        const saved = sessionRef.current;
        if (saved)
          void request({
            type: 'resume',
            code: saved.code,
            token: saved.token,
          }).catch((error) => {
            if (cancelled) return;
            if (error.message.includes('房间已失效')) {
              sessionRef.current = null;
              setSession(null);
              setRoom(null);
              sessionStorage.removeItem(KEY);
            }
            noticeRef.current(error.message);
          });
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'session') {
            sessionRef.current = message.session;
            setSession(message.session);
            sessionStorage.setItem(KEY, JSON.stringify(message.session));
          }
          if (message.type === 'state') flushSync(() => setRoom(message.room));
          if (message.type === 'roomClosed') {
            sessionRef.current = null;
            setSession(null);
            setRoom(null);
            sessionStorage.removeItem(KEY);
            noticeRef.current(message.message);
          }
          if (message.type === 'ack' || message.type === 'error') {
            const call = calls.current.get(message.id);
            if (call) {
              clearTimeout(call.timer);
              calls.current.delete(message.id);
              if (message.type === 'ack') call.resolve();
              else call.reject(new Error(message.message));
            }
          }
        } catch {
          noticeRef.current('收到无效的房间消息。');
        }
      };
      socket.onclose = (event) => {
        for (const call of calls.current.values()) {
          clearTimeout(call.timer);
          call.reject(new Error('连接中断，棋局保留，正在重新连接。'));
        }
        calls.current.clear();
        if (cancelled) return;
        if (event.code === 4001) {
          setStatus('replaced');
          sessionRef.current = null;
          setSession(null);
          setRoom(null);
          sessionStorage.removeItem(KEY);
          noticeRef.current(
            '这位玩家已在另一个窗口恢复对局。请刷新后重新加入。',
          );
          return;
        }
        setStatus('reconnecting');
        timer = setTimeout(connect, Math.min(1500 * ++attempts, 10000));
      };
      socket.onerror = () => {};
    }
    connect();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      socketRef.current?.close();
      socketRef.current = null;
      setStatus('offline');
    };
  }, [enabled, request]);
  const perform = useCallback(
    async (data: Record<string, unknown>) => {
      setPending(true);
      try {
        await request(data);
      } finally {
        setPending(false);
      }
    },
    [request],
  );
  return {
    room,
    session,
    status,
    pending,
    create: (name: string, mode: MatchMode = 'standard') =>
      perform({ type: 'create', name, mode }),
    join: (code: string, name: string) => perform({ type: 'join', code, name }),
    action: (action: MatchAction) =>
      perform({ type: 'action', revision: room?.revision, action }),
    rematch: () => perform({ type: 'rematch' }),
    leave: async () => {
      if (socketRef.current?.readyState !== WebSocket.OPEN)
        throw new Error('请等连接恢复后再离开房间。');
      await perform({ type: 'leave' });
      sessionRef.current = null;
      sessionStorage.removeItem(KEY);
      setSession(null);
      setRoom(null);
    },
  };
}
