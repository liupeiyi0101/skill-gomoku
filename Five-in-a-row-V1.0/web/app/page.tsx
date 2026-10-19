'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
// Local static export serves original hero assets without an image service.
/* oxlint-disable next/no-img-element */
import {
  ArrowRight,
  Check,
  CircleHelp,
  Copy,
  Flag,
  Grid2X2,
  Hash,
  Link2,
  Sparkles,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  actor,
  coordinate,
  other,
  placingColor,
  SIZE,
  type Action,
  type Color,
  type Player,
} from '@/lib/game-core';
import { useRoom } from '@/lib/use-room';
import { colorName, TOKEN_SKINS } from '@/lib/presentation';
import { HERO001 } from '@/lib/heroes';
import {
  actMatch,
  canUseSkill,
  newMatch,
  type Match,
  type MatchAction,
  type MatchMode,
} from '@/lib/match-core';
import { useHeroMotion, useReducedMotion } from '@/lib/use-hero-motion';
import { HeroStage } from '@/components/hero-stage';
import {
  EnergyToken,
  TokenGradient,
  TokenShape,
} from '@/components/energy-token';

const blankGame = newMatch();
const LOCAL_KEY = 'yijian-local-v1';
type SavedMove = { player: Player; action: MatchAction };
type ModelTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelContext = {
  registerTool: (
    tool: ModelTool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

export default function Home() {
  const [localGame, setLocalGame] = useState<Match>(newMatch),
    [mode, setMode] = useState<'local' | 'lan'>('local');
  const [lobbyMode, setLobbyMode] = useState<MatchMode>('standard');
  const [pendingRuleset, setPendingRuleset] = useState<MatchMode>('standard');
  const [ready, setReady] = useState(false);
  const [usingSkill, setUsingSkill] = useState(false);
  const [skillFrom, setSkillFrom] = useState<number | null>(null);
  const inFlight = useRef(false);
  const actionLock = useRef(0);
  const [selected, setSelected] = useState<number | null>(null),
    [numbers, setNumbers] = useState(false),
    [confirmMove, setConfirmMove] = useState(true);
  const [modal, setModal] = useState<
      'rules' | 'reset' | 'resign' | 'leave' | 'mode' | null
    >(null),
    [toast, setToast] = useState('');
  const [nickname, setNickname] = useState(''),
    [roomCode, setRoomCode] = useState(''),
    [addresses, setAddresses] = useState<string[]>([]);
  const [focusCell, setFocusCell] = useState(112);
  const record = useRef<SavedMove[]>([]),
    openerRef = useRef<Player>('A'),
    toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const roomPanel = useRef<HTMLElement | null>(null),
    gameRef = useRef<Match>(localGame);
  const notice = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5000);
  }, []);
  const network = useRoom(mode === 'lan', notice);
  const game = mode === 'local' ? localGame : network.room?.game || blankGame;
  gameRef.current = game;
  const ruleset =
    mode === 'local' ? game.mode : (network.room?.game.mode ?? lobbyMode);
  const reduced = useReducedMotion();
  const presentation = useHeroMotion(
    game,
    `${mode}-${network.room?.code ?? ''}-${network.room?.round ?? 0}`,
    ready,
    reduced,
  );
  const currentActor = actor(game),
    nextColor = placingColor(game);
  const linked = network.status === 'connected',
    bothReady =
      !!network.room?.players.A?.connected &&
      !!network.room?.players.B?.connected;
  const playable =
    (mode === 'local' || (linked && bothReady && !network.pending)) &&
    !presentation.busy;
  const myTurn =
    playable && (mode === 'local' || network.session?.seat === currentActor);
  const canPlace = myTurn && nextColor !== null;
  const canChoose =
    myTurn && (game.phase === 'chooseSecond' || game.phase === 'chooseFirst');
  const nameOf = (p: Player | null) =>
    p
      ? mode === 'lan'
        ? network.room?.players[p]?.name || '玩家 ' + p
        : '玩家 ' + p
      : '';
  const phaseStep =
    game.phase === 'opening3'
      ? 0
      : ['chooseSecond', 'opening2', 'chooseFirst'].includes(game.phase)
        ? 1
        : 2;
  const isFinished = game.phase === 'finished';
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      if (
        stored &&
        Array.isArray(stored.actions) &&
        stored.actions.length <= 500 &&
        ['A', 'B'].includes(stored.opener)
      ) {
        let restored = newMatch(
          stored.opener,
          stored.mode === 'entertainment' ? 'entertainment' : 'standard',
        );
        for (const event of stored.actions)
          restored = actMatch(restored, event.player, event.action);
        record.current = stored.actions;
        openerRef.current = stored.opener;
        setLocalGame(restored);
      }
      const params = new URLSearchParams(location.search);
      if (sessionStorage.getItem('yijian-room-v1') || params.has('room'))
        setMode('lan');
      if (/^\d{6}$/.test(params.get('room') || ''))
        setRoomCode(params.get('room')!);
      setNickname(localStorage.getItem('yijian-name') || '');
      const preferences = JSON.parse(
        localStorage.getItem('yijian-preferences') || 'null',
      );
      if (preferences) {
        setNumbers(preferences.numbers === true);
        setConfirmMove(preferences.confirm !== false);
      }
    } catch {
      /* A malformed saved game never changes the rules. */
    }
    setReady(true);
    void fetch('/api/lan-info')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (
          data &&
          typeof data === 'object' &&
          'addresses' in data &&
          Array.isArray(data.addresses)
        )
          setAddresses(
            data.addresses.filter(
              (a: unknown): a is string => typeof a === 'string',
            ),
          );
      })
      .catch(() => {});
    return () => clearTimeout(toastTimer.current);
  }, []);
  useEffect(() => {
    setSelected(null);
    setUsingSkill(false);
    setSkillFrom(null);
  }, [game, mode]);
  const savePreferences = (show: boolean, confirm: boolean) => {
    setNumbers(show);
    setConfirmMove(confirm);
    try {
      localStorage.setItem(
        'yijian-preferences',
        JSON.stringify({ numbers: show, confirm }),
      );
    } catch {}
  };
  async function dispatch(action: MatchAction) {
    if (inFlight.current) throw new Error('操作正在确认，请稍候。');
    if (!reduced && Date.now() < actionLock.current)
      throw new Error('请等待小果完成动作。');
    if (!playable) throw new Error('请等待双方连接就绪。');
    if (action.type !== 'resign' && !myTurn)
      throw new Error('现在轮到对方操作。');
    inFlight.current = true;
    try {
      if (mode === 'lan') {
        await network.action(action);
        setSelected(null);
        return;
      }
      const current = gameRef.current;
      const player = actor(current);
      if (!player) throw new Error('本局已结束。');
      const next = actMatch(current, player, action);
      if (!reduced && (action.type === 'place' || action.type === 'shift'))
        actionLock.current =
          Date.now() + (action.type === 'shift' ? 1250 : 760);
      record.current.push({ player, action });
      flushSync(() => {
        setLocalGame(next);
        setSelected(null);
      });
      try {
        localStorage.setItem(
          LOCAL_KEY,
          JSON.stringify({
            opener: openerRef.current,
            mode: next.mode,
            actions: record.current,
          }),
        );
      } catch {}
    } finally {
      inFlight.current = false;
    }
  }
  const run = (work: () => void | Promise<unknown>) => {
    void Promise.resolve()
      .then(work)
      .catch((error) => notice(error.message || '操作失败，请重试。'));
  };
  const submit = (action: MatchAction) => run(() => dispatch(action));
  function pick(index: number) {
    setFocusCell(index);
    if (usingSkill) {
      if (!myTurn || !canUseSkill(game, currentActor)) return;
      if (game.board[index]) {
        setSkillFrom(index);
        setSelected(null);
      } else if (skillFrom !== null) setSelected(index);
      else notice('先选择一颗已有棋子，再选择空交叉点。');
      return;
    }
    if (!canPlace || game.board[index]) return;
    if (confirmMove) setSelected(index);
    else
      submit({ type: 'place', x: index % SIZE, y: Math.floor(index / SIZE) });
  }
  function resetLocal(nextMode: MatchMode = localGame.mode) {
    actionLock.current = 0;
    openerRef.current = other(openerRef.current);
    record.current = [];
    setLocalGame(newMatch(openerRef.current, nextMode));
    setSelected(null);
    setModal(null);
    try {
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({
          opener: openerRef.current,
          mode: nextMode,
          actions: [],
        }),
      );
    } catch {}
  }
  function chooseRuleset(next: MatchMode) {
    if (ruleset === next) return;
    if (mode === 'lan') {
      if (network.room) {
        notice('房间模式创建后保持不变，请离开房间后重新创建。');
        return;
      }
      setLobbyMode(next);
    } else if (game.moves.length) {
      setPendingRuleset(next);
      setModal('mode');
    } else resetLocal(next);
  }
  function switchMode(next: 'local' | 'lan') {
    if (next === mode) return;
    if (mode === 'lan' && network.session) {
      setModal('leave');
      return;
    }
    if (next === 'lan') setLobbyMode(localGame.mode);
    setMode(next);
  }
  async function enterRoom(create: boolean) {
    if (!create && !/^\d{6}$/.test(roomCode))
      throw new Error('请输入六位数字房间号。');
    try {
      localStorage.setItem('yijian-name', nickname.trim());
    } catch {}
    if (create) await network.create(nickname, lobbyMode);
    else await network.join(roomCode, nickname);
  }
  async function copyInvite() {
    if (!network.room) return;
    const base = ['localhost', '127.0.0.1'].includes(location.hostname)
      ? addresses[0] || location.origin
      : location.origin;
    const url = base + '/?room=' + network.room.code;
    try {
      await navigator.clipboard.writeText(url);
      notice('邀请链接已复制，发送给同一 Wi-Fi 下的朋友。');
    } catch {
      const input = document.createElement('textarea');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      notice(copied ? '邀请链接已复制。' : '请长按下方邀请地址进行复制。');
    }
  }
  const handlers = useRef({ dispatch, game, canPlace });
  handlers.current = { dispatch, game, canPlace };
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const specs: ModelTool[] = [
      {
        name: 'read_gomoku_game',
        title: '读取五子棋对局',
        description: '读取当前真实棋盘、Swap2阶段和行动方；不修改对局。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => handlers.current.game,
      },
      {
        name: 'play_gomoku_action',
        title: '执行五子棋操作',
        description:
          '通过与页面相同的校验执行落子、选边或补摆两子。place的x/y为0到14，choose的color为1珊瑚红（规则黑方）或2冰蓝（规则白方）。请只在用户要求代为操作时使用。',
        inputSchema: {
          type: 'object',
          properties: {
            type: { enum: ['place', 'choose', 'extend'] },
            x: { type: 'integer', minimum: 0, maximum: 14 },
            y: { type: 'integer', minimum: 0, maximum: 14 },
            color: { type: 'integer', enum: [1, 2] },
          },
          required: ['type'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input: unknown) => {
          if (
            !input ||
            typeof input !== 'object' ||
            !['place', 'choose', 'extend'].includes((input as Action).type)
          )
            throw new Error('无效操作。');
          await handlers.current.dispatch(input as Action);
          return {
            accepted: true,
            phase: handlers.current.game.phase,
            moves: handlers.current.game.moves.length,
          };
        },
      },
    ];
    for (const spec of specs)
      try {
        void Promise.resolve(
          context.registerTool(spec, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, []);
  let title = '',
    description = '';
  if (game.phase === 'opening3') {
    title = nameOf(currentActor) + '，请摆出开局';
    description =
      '依次摆放红、蓝、红三子。位置不限，随后由另一位玩家选择阵营。';
  }
  if (game.phase === 'chooseSecond') {
    title = nameOf(currentActor) + '，选择你的阵营';
    description =
      '选择珊瑚红或冰蓝；也可补摆一蓝一红，把最终选边权交还给开局方。';
  }
  if (game.phase === 'opening2') {
    title = nameOf(currentActor) + '，请补摆两子';
    description = '先摆一颗冰蓝，再摆一颗珊瑚红。完成后由开局方选择最终阵营。';
  }
  if (game.phase === 'chooseFirst') {
    title = nameOf(currentActor) + '，最终选边';
    description = '五颗开局棋子已就位。选择你的阵营，随后由冰蓝方落下第六手。';
  }
  if (game.phase === 'playing') {
    title = nameOf(currentActor) + '的回合';
    description =
      '使用' + colorName(game.turn) + '落子。横、竖或斜线恰好五连即可获胜。';
  }
  if (isFinished) {
    title = game.winner === 'draw' ? '本局和棋' : nameOf(game.winner) + ' 获胜';
    description =
      game.reason === 'five'
        ? '五连达成！这一手，是你的高光时刻。'
        : game.reason === 'resign'
          ? '对方已认输，本局结束。'
          : '棋盘已满，双方均未形成恰好五连。';
  }
  if (mode === 'lan' && !network.room) {
    title = '邀一位朋友，下一盘棋';
    description =
      '先创建房间，或输入朋友的六位房间号。双方须连接同一个 Wi-Fi。';
  } else if (mode === 'lan' && !bothReady) {
    title = network.room?.players.B ? '等待对方重新连接' : '等待棋友入座';
    description = network.room?.players.B
      ? '棋局已保留，双方连接恢复后可以继续。'
      : '分享邀请链接，朋友加入后即可开始。';
  }
  const last = game.lastEvent
    ? {
        x: game.lastEvent.to % SIZE,
        y: Math.floor(game.lastEvent.to / SIZE),
        color: game.lastEvent.color,
      }
    : game.moves.at(-1);
  const cellNumbers = new Map(
    game.piecePositions.map((cell, i) => [cell, i + 1]),
  );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="弈间首页">
          <img src="/icon.svg" alt="" />
          <span>
            弈间<small>GOMOKU</small>
          </span>
        </a>
        <nav aria-label="游戏模式">
          <button
            className={ruleset === 'standard' ? 'nav-active' : 'muted'}
            aria-pressed={ruleset === 'standard'}
            onClick={() => chooseRuleset('standard')}
          >
            <Grid2X2 size={16} /> 标准对弈
          </button>
          <button
            className={ruleset === 'entertainment' ? 'nav-active' : 'muted'}
            aria-pressed={ruleset === 'entertainment'}
            onClick={() => chooseRuleset('entertainment')}
          >
            <Sparkles size={16} /> 娱乐模式 <small>Hero001</small>
          </button>
        </nav>
        <span className="header-note">纯粹对弈 · 未来主场</span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">HERO 001 / 小果已就位</p>
            <h1>
              下一手，<em>玩点未来。</em>
            </h1>
            <p className="heading-note">
              {ruleset === 'standard'
                ? 'Swap2 标准对弈 · 英雄仅提供外观和落子动作'
                : '技能五子棋 · 蛛丝换位与蜘蛛感应已开启'}
            </p>
          </div>
          <Button
            variant="outline"
            className="rule-button"
            onClick={() => setModal('rules')}
          >
            <CircleHelp /> 规则说明
          </Button>
        </div>
        <div className="mobile-mode-row">
          <Button
            variant={mode === 'local' ? 'default' : 'outline'}
            onClick={() => switchMode('local')}
          >
            同机双人
          </Button>
          <Button
            variant={mode === 'lan' ? 'default' : 'outline'}
            onClick={() => {
              switchMode('lan');
              setTimeout(
                () =>
                  roomPanel.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  }),
                50,
              );
            }}
          >
            <Wifi /> 局域网联机
          </Button>
        </div>
        <div
          className={
            'game-layout ' +
            (mode === 'lan' && !network.room ? 'lan-lobby' : '')
          }
        >
          <aside className="room-panel panel" ref={roomPanel}>
            <div className="section-title">
              <Users size={17} />
              <h2>对战准备室</h2>
              <span
                className={
                  'online-dot ' + (mode === 'local' || linked ? 'online' : '')
                }
                aria-label={mode === 'local' || linked ? '连接就绪' : '未连接'}
              />
            </div>
            <div className="segmented" aria-label="连接方式">
              <button
                className={mode === 'local' ? 'selected' : ''}
                aria-pressed={mode === 'local'}
                onClick={() => switchMode('local')}
              >
                同机双人
              </button>
              <button
                className={mode === 'lan' ? 'selected' : ''}
                aria-pressed={mode === 'lan'}
                onClick={() => switchMode('lan')}
              >
                局域网联机
              </button>
            </div>
            {mode === 'lan' && !network.room ? (
              <form
                className="room-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(() => enterRoom(false));
                }}
              >
                <label htmlFor="nickname">
                  你的称呼 <small>选填</small>
                </label>
                <Input
                  id="nickname"
                  maxLength={20}
                  placeholder="给自己起个名字"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
                <Button
                  className="wide create-room"
                  type="button"
                  disabled={!linked || network.pending}
                  onClick={() => run(() => enterRoom(true))}
                >
                  <Users size={15} /> 创建房间
                </Button>
                <div className="or-divider">
                  <span>或者加入朋友的房间</span>
                </div>
                <label htmlFor="room-code">房间号</label>
                <Input
                  id="room-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="输入六位房间号"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.replace(/\D/g, ''))
                  }
                />
                <Button
                  className="wide"
                  variant="outline"
                  type="submit"
                  disabled={!linked || network.pending}
                >
                  <ArrowRight /> 加入房间
                </Button>
              </form>
            ) : (
              <>
                {network.room && mode === 'lan' && (
                  <div className="room-identity">
                    <span>房间号</span>
                    <strong>{network.room.code}</strong>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="复制邀请链接"
                      onClick={() => run(copyInvite)}
                    >
                      <Copy />
                    </Button>
                  </div>
                )}
                {(['A', 'B'] as Player[]).map((p, i) => (
                  <div key={p}>
                    {i > 0 && <div className="versus">VS</div>}
                    <div
                      className={
                        'player-card ' +
                        (currentActor === p && playable ? 'active-player' : '')
                      }
                    >
                      <div className="player-avatar">
                        <img
                          src={HERO001.portrait}
                          width={1114}
                          height={1411}
                          alt="小果的白粉战衣头像"
                        />
                      </div>
                      <div className="player-info">
                        <b>
                          {mode === 'lan' && !network.room?.players[p]
                            ? '等待棋友'
                            : nameOf(p)}
                          {mode === 'lan' && network.session?.seat === p && (
                            <em>你</em>
                          )}
                        </b>
                        <span>
                          {game.colors[p]
                            ? colorName(game.colors[p]!)
                            : p === game.opener
                              ? '开局方 · 摆出前三子'
                              : '选边方 · 决定阵营'}
                        </span>
                      </div>
                      {mode === 'lan' && (
                        <i
                          className={
                            'player-connection ' +
                            (network.room?.players[p]?.connected ? 'on' : '')
                          }
                        />
                      )}
                    </div>
                  </div>
                ))}
                <div className="match-meta">
                  <span>
                    开局方式<strong>Swap2</strong>
                  </span>
                  <span>
                    对局用时<strong>不限时</strong>
                  </span>
                  <span>
                    本局手数
                    <strong>
                      {String(game.moves.length).padStart(2, '0')}{' '}
                      <small>手</small>
                    </strong>
                  </span>
                </div>
                {mode === 'lan' && network.room && (
                  <>
                    <Button
                      className="wide"
                      variant="outline"
                      onClick={() => run(copyInvite)}
                    >
                      <Link2 /> 复制邀请链接
                    </Button>
                    <Button
                      variant="ghost"
                      className="wide leave-button"
                      onClick={() => setModal('leave')}
                    >
                      <LogOut /> 离开房间
                    </Button>
                  </>
                )}
              </>
            )}
            <div className="hero-equipped">
              <img
                src={HERO001.portrait}
                width={1114}
                height={1411}
                alt="小果，白粉帽兜战衣的 Q 版英雄"
              />
              <div>
                <small>HERO 001</small>
                <b>{HERO001.name}</b>
                <span>双方已选用 · 白粉战衣</span>
              </div>
            </div>
            <div className="room-footer">
              {mode === 'local' ? (
                <>
                  <ShieldCheck size={15} />
                  <span>
                    同一屏幕，轮流落子。
                    <br />
                    棋局自动保存在这台设备上。
                  </span>
                </>
              ) : (
                <>
                  <Wifi size={15} />
                  <span>
                    {linked
                      ? '连接就绪 · 同一 Wi-Fi 下可联机'
                      : network.status === 'replaced'
                        ? '身份已在其他窗口登录'
                        : '连接中断，正在重新连接…'}
                    <br />
                    主机保持运行，朋友即可加入。
                  </span>
                </>
              )}
            </div>
            {mode === 'lan' && addresses.length > 0 && (
              <details className="lan-help">
                <summary>查看局域网访问地址</summary>
                {addresses.map((address) => (
                  <p key={address}>
                    <a
                      href={address + '/?room=' + (network.room?.code || '')}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {address}
                    </a>
                  </p>
                ))}
                <small>
                  手机浏览器打开此地址，再输入房间号。无法访问时，请检查 Windows
                  防火墙和 Wi-Fi 客户端隔离。
                </small>
              </details>
            )}
          </aside>
          <section className="board-area">
            <div className="board-heading">
              <b>
                {ruleset === 'standard' ? '标准竞技台' : '英雄竞技台'}{' '}
                <span>SWAP2</span>
              </b>
              <small>
                {mode === 'lan' && network.room
                  ? '第 ' + network.room.round + ' 局 · '
                  : ''}
                15 × 15 · 无禁手
              </small>
            </div>
            <div className="mobile-turn" aria-live="polite">
              <span className="online-dot online" />
              {title}
            </div>
            {ruleset === 'entertainment' && (
              <div className="board-skill-bar">
                <output>
                  {usingSkill
                    ? skillFrom === null
                      ? '选择要牵引的棋子'
                      : '选择空交叉点，再确认换位'
                    : game.skillUsed
                      ? '本回合技能已用 · 请落子'
                      : '蛛丝换位 · 每回合一次'}
                </output>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!myTurn || !canUseSkill(game, currentActor)}
                  onClick={() => {
                    setUsingSkill(!usingSkill);
                    setSkillFrom(null);
                    setSelected(null);
                  }}
                >
                  <Sparkles size={15} />
                  {usingSkill ? '取消' : '使用技能'}
                </Button>
              </div>
            )}
            <HeroStage
              motion={presentation.motion}
              warning={presentation.warning}
              currentActor={currentActor}
              colors={game.colors}
              nameOf={nameOf}
            >
              <div
                className={'board-frame ' + (!canPlace ? 'board-paused' : '')}
              >
                <svg
                  viewBox="0 0 576 576"
                  className="board"
                  role="grid"
                  aria-label="15乘15五子棋棋盘，方向键移动，回车选择落点"
                  onKeyDown={(e) => {
                    const offsets: Record<string, number> = {
                      ArrowLeft: -1,
                      ArrowRight: 1,
                      ArrowUp: -15,
                      ArrowDown: 15,
                    };
                    if (e.key in offsets) {
                      e.preventDefault();
                      const index = Math.max(
                        0,
                        Math.min(224, focusCell + offsets[e.key]),
                      );
                      setFocusCell(index);
                      document.getElementById('point-' + index)?.focus();
                    }
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick(focusCell);
                    }
                  }}
                >
                  <defs>
                    <TokenGradient color={1} id="board-token-1" />
                    <TokenGradient color={2} id="board-token-2" />
                    <filter
                      id="stone-shadow"
                      x="-30%"
                      y="-30%"
                      width="170%"
                      height="180%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="3"
                        stdDeviation="2"
                        floodColor="#10182e"
                        floodOpacity=".5"
                      />
                    </filter>
                  </defs>
                  {Array.from({ length: SIZE }, (_, i) => (
                    <g key={i}>
                      <line
                        x1="36"
                        y1={36 + i * 36}
                        x2="540"
                        y2={36 + i * 36}
                      />
                      <line
                        x1={36 + i * 36}
                        y1="36"
                        x2={36 + i * 36}
                        y2="540"
                      />
                      <text x={36 + i * 36} y="20" className="board-coord">
                        {String.fromCharCode(65 + i)}
                      </text>
                      <text x="15" y={40 + i * 36} className="board-coord">
                        {15 - i}
                      </text>
                      <text x={36 + i * 36} y="562" className="board-coord">
                        {String.fromCharCode(65 + i)}
                      </text>
                    </g>
                  ))}
                  {[48, 56, 112, 168, 176].map((index) => (
                    <circle
                      key={'star' + index}
                      cx={36 + (index % 15) * 36}
                      cy={36 + Math.floor(index / 15) * 36}
                      r="3"
                      fill="#9faed0"
                    />
                  ))}
                  {game.winning.length === 5 &&
                    presentation.hiddenCell === null && (
                      <path
                        className="winning-link"
                        pathLength="1"
                        d={[...game.winning]
                          .sort((a, b) => a - b)
                          .map(
                            (index, i) =>
                              `${i === 0 ? 'M' : 'L'}${36 + (index % SIZE) * 36},${36 + Math.floor(index / SIZE) * 36}`,
                          )
                          .join(' ')}
                      />
                    )}
                  {game.board.map((v, i) => {
                    const x = 36 + (i % 15) * 36,
                      y = 36 + Math.floor(i / 15) * 36,
                      isLast =
                        last?.x === i % 15 && last?.y === Math.floor(i / 15);
                    return (
                      <g
                        key={i}
                        role="gridcell"
                        id={'point-' + i}
                        tabIndex={focusCell === i ? 0 : -1}
                        className={
                          'board-point ' +
                          ((canPlace && !v) || (usingSkill && myTurn)
                            ? 'available'
                            : '')
                        }
                        aria-label={
                          coordinate(i % 15, Math.floor(i / 15)) +
                          (v
                            ? '，' +
                              colorName(v as Color) +
                              '，第' +
                              cellNumbers.get(i) +
                              '手'
                            : '，空位')
                        }
                        aria-selected={selected === i || skillFrom === i}
                        onClick={() => pick(i)}
                        onFocus={() => setFocusCell(i)}
                      >
                        <rect
                          x={x - 18}
                          y={y - 18}
                          width="36"
                          height="36"
                          fill="transparent"
                        />
                        {game.winning.includes(i) && (
                          <circle
                            className="winning-ring"
                            cx={x}
                            cy={y}
                            r="18"
                            fill="none"
                            stroke="#edda95"
                            strokeWidth="2"
                          />
                        )}
                        {skillFrom === i && (
                          <rect
                            x={x - 17}
                            y={y - 17}
                            width="34"
                            height="34"
                            rx="9"
                            className="skill-source-mark"
                          />
                        )}
                        {v > 0 ? (
                          <g
                            transform={`translate(${x} ${y})`}
                            className="token-position"
                            visibility={
                              presentation.hiddenCell === i
                                ? 'hidden'
                                : 'visible'
                            }
                          >
                            {isLast && presentation.hiddenCell !== i && (
                              <circle
                                className="placement-wave"
                                r="17"
                                fill="none"
                                stroke={TOKEN_SKINS[v as Color].edge}
                                strokeWidth="2"
                              />
                            )}
                            <g
                              key={
                                isLast
                                  ? `${game.eventSerial}-${presentation.hiddenCell === i ? 'hidden' : 'landed'}`
                                  : 'settled'
                              }
                              className={
                                isLast && presentation.hiddenCell !== i
                                  ? 'placed-stone'
                                  : ''
                              }
                              filter="url(#stone-shadow)"
                            >
                              <TokenShape
                                color={v as Color}
                                fill={`url(#board-token-${v})`}
                                symbol={!numbers}
                              />
                            </g>
                            {numbers ? (
                              <text
                                x="0"
                                y="3"
                                className="move-number"
                                fill={TOKEN_SKINS[v as Color].ink}
                              >
                                {cellNumbers.get(i)}
                              </text>
                            ) : (
                              isLast && (
                                <circle
                                  cx="0"
                                  cy="-1"
                                  r="2.5"
                                  fill={TOKEN_SKINS[v as Color].ink}
                                />
                              )
                            )}
                          </g>
                        ) : selected === i && nextColor ? (
                          <>
                            <g transform={`translate(${x} ${y})`} opacity=".55">
                              <TokenShape
                                color={
                                  usingSkill && skillFrom !== null
                                    ? (game.board[skillFrom] as Color)
                                    : nextColor
                                }
                                fill={`url(#board-token-${usingSkill && skillFrom !== null ? game.board[skillFrom] : nextColor})`}
                              />
                            </g>
                            <path
                              className="target-lock"
                              d={`M${x - 16},${y - 9}v-7h7 M${x + 9},${y - 16}h7v7 M${x + 16},${y + 9}v7h-7 M${x - 9},${y + 16}h-7v-7`}
                              stroke={TOKEN_SKINS[nextColor].edge}
                              fill="none"
                              strokeWidth="2"
                            />
                          </>
                        ) : (
                          canPlace && (
                            <circle
                              className="hover-stone"
                              cx={x}
                              cy={y}
                              r="5"
                              fill={
                                nextColor
                                  ? TOKEN_SKINS[nextColor].face
                                  : '#c4b5ff'
                              }
                            />
                          )
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </HeroStage>
            <div className="board-caption">
              <span>
                {last
                  ? (game.lastEvent?.kind === 'shift'
                      ? '蛛丝换位 → '
                      : '上一手 ') +
                    coordinate(last.x, last.y) +
                    ' · ' +
                    colorName(last.color)
                  : '恰好五连获胜 · 长连不获胜'}
              </span>
              <span
                className="token-legend"
                aria-label="珊瑚红圆形棋子，冰蓝六边形棋子"
              >
                <EnergyToken color={1} /> 珊瑚红
                <EnergyToken color={2} /> 冰蓝
              </span>
            </div>
            <div className="board-controls">
              <div className="board-options">
                <label>
                  <input
                    type="checkbox"
                    checked={numbers}
                    onChange={(e) =>
                      savePreferences(e.target.checked, confirmMove)
                    }
                  />
                  <Hash size={14} /> 显示手数
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmMove}
                    onChange={(e) => savePreferences(numbers, e.target.checked)}
                  />
                  落子确认
                </label>
              </div>
              <Button
                className="confirm-move"
                disabled={
                  !canPlace ||
                  selected === null ||
                  (usingSkill && skillFrom === null)
                }
                onClick={() =>
                  selected !== null &&
                  submit(
                    usingSkill && skillFrom !== null
                      ? { type: 'shift', from: skillFrom, to: selected }
                      : {
                          type: 'place',
                          x: selected % SIZE,
                          y: Math.floor(selected / SIZE),
                        },
                  )
                }
              >
                <Check />
                {selected === null
                  ? usingSkill
                    ? '选择换位目标'
                    : '选择落点'
                  : coordinate(selected % SIZE, Math.floor(selected / SIZE)) +
                    (usingSkill ? ' · 确认换位' : ' · 确认落子')}
              </Button>
            </div>
            <div className="board-actions">
              {mode === 'local' && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    game.moves.length ? setModal('reset') : resetLocal()
                  }
                >
                  <RotateCcw /> 新一局
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={game.phase !== 'playing' || !playable}
                onClick={() => setModal('resign')}
              >
                <Flag /> 认输
              </Button>
              <small>
                {usingSkill
                  ? '先选棋子，再选空位并确认'
                  : presentation.busy
                    ? '小果正在完成动作…'
                    : confirmMove
                      ? '点击交叉点预选，再确认落子'
                      : '单击落子已开启'}
              </small>
            </div>
          </section>
          <aside className="status-panel">
            <section
              className={
                'turn-panel panel ' + (isFinished ? 'finished-panel' : '')
              }
            >
              <div className="turn-kicker">
                <p className="eyebrow">
                  {isFinished
                    ? 'GAME COMPLETE'
                    : game.phase === 'playing'
                      ? 'YOUR NEXT MOVE'
                      : 'SWAP2 OPENING'}
                </p>
                {isFinished ? (
                  <Trophy size={18} />
                ) : (
                  nextColor && (
                    <EnergyToken color={nextColor} className="small-token" />
                  )
                )}
              </div>
              <h2 aria-live="polite">{title}</h2>
              <p>{description}</p>
              {!isFinished && (
                <div className="opening-progress">
                  {['摆出开局', '选边 / 补子', '正式对弈'].map((step, i) => (
                    <div
                      key={step}
                      className={i <= phaseStep ? 'step reached' : 'step'}
                    >
                      <span>{i < phaseStep ? <Check size={11} /> : i + 1}</span>
                      <small>{step}</small>
                    </div>
                  ))}
                </div>
              )}
              {['opening3', 'opening2'].includes(game.phase) && (
                <div className="opening-hint">
                  <div className="stone-sequence">
                    {(game.phase === 'opening3' ? [1, 2, 1] : [2, 1]).map(
                      (c, i) => (
                        <span
                          key={i}
                          className={
                            'sequence-item ' +
                            (i <
                            (game.phase === 'opening3'
                              ? game.moves.length
                              : game.moves.length - 3)
                              ? 'done'
                              : '')
                          }
                        >
                          <EnergyToken color={c as Color} />
                          {i <
                            (game.phase === 'opening3'
                              ? game.moves.length
                              : game.moves.length - 3) && <Check size={12} />}
                        </span>
                      ),
                    )}
                  </div>
                  <span>
                    下一颗：{nextColor ? colorName(nextColor) : ''} · 已摆{' '}
                    {game.phase === 'opening3'
                      ? game.moves.length
                      : game.moves.length - 3}
                    /{game.phase === 'opening3' ? 3 : 2}
                  </span>
                </div>
              )}
              {['chooseSecond', 'chooseFirst'].includes(game.phase) && (
                <div className="choice-actions">
                  <Button
                    variant="outline"
                    disabled={!canChoose}
                    onClick={() => submit({ type: 'choose', color: 1 })}
                  >
                    <EnergyToken color={1} /> 珊瑚红
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!canChoose}
                    onClick={() => submit({ type: 'choose', color: 2 })}
                  >
                    <EnergyToken color={2} /> 冰蓝
                  </Button>
                  {game.phase === 'chooseSecond' && (
                    <Button
                      className="extend-choice"
                      disabled={!canChoose}
                      onClick={() => submit({ type: 'extend' })}
                    >
                      再摆两子，让对方选边 <ArrowRight size={14} />
                    </Button>
                  )}
                </div>
              )}
              {isFinished && (
                <Button
                  className="wide rematch"
                  disabled={
                    mode === 'lan' &&
                    (!linked ||
                      !bothReady ||
                      network.pending ||
                      network.room?.rematch.includes(
                        network.session?.seat || 'A',
                      ))
                  }
                  onClick={() =>
                    mode === 'local' ? resetLocal() : run(network.rematch)
                  }
                >
                  <RotateCcw />
                  {mode === 'lan' &&
                  network.room?.rematch.includes(network.session?.seat || 'A')
                    ? '已邀请，等待对方'
                    : '再来一局'}
                </Button>
              )}
              {isFinished &&
                mode === 'lan' &&
                network.room?.rematch.includes(
                  other(network.session?.seat || 'A'),
                ) && <p className="rematch-notice">对方邀请你再来一局。</p>}
              {!myTurn &&
                !isFinished &&
                mode === 'lan' &&
                network.room &&
                bothReady && (
                  <div className="waiting-notice">
                    {linked ? (
                      <>
                        <span className="waiting-pulse" />
                        对方正在思考，请稍候
                      </>
                    ) : (
                      <>
                        <WifiOff size={14} />
                        连接恢复后继续
                      </>
                    )}
                  </div>
                )}
            </section>
            <section className="hero-abilities panel">
              <div className="ability-heading">
                <Sparkles size={18} />
                <h2>小果的能力</h2>
                <span>HERO 001</span>
              </div>
              <div>
                <span className="ability-tag">天赋</span>
                <b>{HERO001.talent.name}</b>
                <p>对手本次落子连成至少三颗时，小果身旁出现「!」。</p>
              </div>
              <div>
                <span className="ability-tag">技能</span>
                <b>{HERO001.skill.name}</b>
                <p>
                  牵引任意一方的一颗棋子到空位。每回合一次，之后仍可正常落子。
                </p>
              </div>
              {ruleset === 'standard' ? (
                <p className="ability-policy">
                  标准模式只播放落子动作，不启用技能和天赋。
                </p>
              ) : (
                <>
                  <Button
                    className="wide skill-button"
                    disabled={!myTurn || !canUseSkill(game, currentActor)}
                    onClick={() => {
                      setUsingSkill(!usingSkill);
                      setSkillFrom(null);
                      setSelected(null);
                    }}
                  >
                    <Sparkles />
                    {usingSkill
                      ? '取消施法'
                      : game.skillUsed
                        ? '本回合已使用'
                        : '蛛丝换位'}
                  </Button>
                  <output className="ability-policy">
                    {usingSkill
                      ? skillFrom === null
                        ? '① 点击棋盘上的任意一颗棋子'
                        : `② 已选 ${coordinate(skillFrom % SIZE, Math.floor(skillFrom / SIZE))}，选择空位后确认`
                      : game.phase !== 'playing'
                        ? '完成选边后，在自己的回合施放。'
                        : game.skillUsed
                          ? '技能已使用，请正常落子结束回合。'
                          : '可选自己或对方的棋子；换位也会判定五连。'}
                  </output>
                </>
              )}
            </section>
            <section className="rules-panel panel">
              <h2>公平竞技，五连制胜</h2>
              <p>
                <span>01</span> 双方没有禁手
              </p>
              <p>
                <span>02</span> 恰好五颗连成一线获胜
              </p>
              <p>
                <span>03</span> 六颗及以上不算获胜
              </p>
              <button className="text-link" onClick={() => setModal('rules')}>
                了解 Swap2 规则 <ArrowRight size={12} />
              </button>
            </section>
            <section className="move-history">
              <div className="section-title">
                <h2>最近落子</h2>
                <small>
                  {game.moves.length ? game.moves.length + ' 手' : '尚未落子'}
                </small>
              </div>
              {game.moves.length ? (
                <div className="history-list">
                  {game.moves
                    .slice(-6)
                    .reverse()
                    .map((move, i) => (
                      <span key={game.moves.length - i}>
                        <small>
                          {String(game.moves.length - i).padStart(2, '0')}
                        </small>
                        <EnergyToken
                          color={move.color}
                          className="mini-token"
                        />
                        <b>{coordinate(move.x, move.y)}</b>
                      </span>
                    ))}
                </div>
              ) : (
                <p className="empty-history">能量就绪，等待第一颗棋子。</p>
              )}
            </section>
          </aside>
        </div>
      </main>
      <footer className="site-footer">
        <span>弈间 · GOMOKU</span>
        <span>未来潮玩 × Q版科技</span>
        <span>FUTURE PLAY / STANDARD 01</span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent
          className={modal === 'rules' ? 'rules-dialog' : 'confirm-dialog'}
        >
          <DialogHeader>
            <DialogTitle>
              {modal === 'rules'
                ? 'Swap2 · 公平从开局开始'
                : modal === 'resign'
                  ? '确认认输？'
                  : modal === 'mode'
                    ? `切换到${pendingRuleset === 'standard' ? '标准对弈' : '娱乐模式'}？`
                    : modal === 'leave'
                      ? '离开当前房间？'
                      : '开始新的一局？'}
            </DialogTitle>
            <DialogDescription>
              {modal === 'rules'
                ? '15×15 棋盘 · 双方无禁手 · 恰好五连获胜'
                : modal === 'resign'
                  ? (mode === 'local'
                      ? nameOf(currentActor)
                      : nameOf(network.session?.seat || 'A')) +
                    '将认输，本局判对方获胜。'
                  : modal === 'leave'
                    ? '主动离开会关闭房间，对方也会返回大厅。仅刷新页面或暂时断网则保留对局。'
                    : '当前同机对局将清空，新一局交换开局方。'}
            </DialogDescription>
          </DialogHeader>
          {modal === 'rules' ? (
            <div className="rules-copy">
              <h3>01 / 摆出前三子</h3>
              <p>
                开局方依次摆放珊瑚红、冰蓝、珊瑚红三子，可以放在任意空交叉点，不要求中心开局。
              </p>
              <h3>02 / 由另一位玩家作选择</h3>
              <p>
                直接选择珊瑚红或冰蓝；也可以再摆一蓝一红两颗棋子，把选边权交还给开局方。此时开局方必须选择阵营，不能继续补子。
              </p>
              <h3>03 / 开始正常对弈</h3>
              <p>阵营确定后，由冰蓝方下下一手，此后红蓝交替，每回合一子。</p>
              <h3>胜负判定</h3>
              <p>
                横、竖或斜线上的同色棋子必须恰好连续五颗。六颗及以上为长连，不算获胜，也不判负。双方均没有三三、四四等禁手。棋盘下满无人获胜则和棋。
              </p>
              <div className="rules-note">
                珊瑚红对应规则黑方，冰蓝对应白方。开局摆子不代表最终阵营。标准模式中，小果仅提供棋子外观和落子动作；娱乐模式才启用技能和天赋。不限时、无悔棋。
              </div>
              {ruleset === 'entertainment' && (
                <>
                  <h3>Hero001 · 当前试玩规则</h3>
                  <p>
                    选边完成后，每个自己的回合可在落子前使用一次「蛛丝换位」，把任意一颗棋子移至空交叉点，不占用正常落子。正常落子结束回合。换位后全盘检查恰好五连，获胜归棋子所属方；若双方同时形成五连，优先判被移动棋子的所属方获胜。对手本次落子形成至少三连时，触发蜘蛛感应提示。开局摆子与技能换位不触发天赋。
                  </p>
                </>
              )}
              <a
                className="text-link"
                href="https://www.renju.net/rule/11/"
                target="_blank"
                rel="noreferrer"
              >
                查看 RIF 的 Swap2 开局说明 ↗
              </a>
            </div>
          ) : (
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setModal(null)}>
                继续对弈
              </Button>
              <Button
                onClick={() =>
                  run(async () => {
                    if (modal === 'reset') resetLocal();
                    else if (modal === 'mode') resetLocal(pendingRuleset);
                    else if (modal === 'resign') {
                      await dispatch({ type: 'resign' });
                      setModal(null);
                    } else {
                      await network.leave();
                      setModal(null);
                      setMode('local');
                    }
                  })
                }
              >
                {modal === 'resign'
                  ? '确认认输'
                  : modal === 'leave'
                    ? '离开房间'
                    : '开始新局'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
