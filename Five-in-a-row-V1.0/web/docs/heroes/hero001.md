# Hero001 · 小果

2026-09-05 实装记录。原始 `main.txt` 和 `heros.xls` 未修改。

## 表格来源

只读解析 `heros.xls`，本次最新值：

| 工作表 / 范围 | ID | 名称 | 描述或引用 |
| --- | --- | --- | --- |
| 英雄 A2:D2 | Hero001 | 小果 | Talent001 / Skill001 |
| 天赋 A2:C2 | Talent001 | 蜘蛛感应 | 当对手落下的这颗棋后出现三连棋子时，Q版人物旁边出现一个叹号“！” |
| 技能 A2:C2 | Skill001 | 蛛丝换位 | 蜘蛛侠可以发射一个蛛丝让任意一颗棋子换位 |

技能原文中的旧称“蜘蛛侠”原样保留在来源配置，游戏显示英雄最新名称「小果」。技能表未明确冷却、使用次数、目标是否必须为空、长连拆解和天赋三连边界。以下是可调整的第一版试玩解释，不声称这些细节均来自表格或已经得到额外确认。

## 试玩规则

- 标准模式完全保留原 Swap2 状态机，只添加人物、专属棋子和落子动作。客户端与服务端都禁止主动技能，天赋也不触发。
- 娱乐模式沿用 Swap2 开局、恰好五连和无禁手。双方目前自动选用唯一可用英雄 Hero001。
- 完成选边后，仅行动方可使用技能；每回合最多一次，必须在正常落子前。技能不消耗正常落子机会，正常落子结束回合并恢复下一回合技能机会。
- 可选择任意一方的现有棋子，牵引至空交叉点。不能交换、覆盖、复制或删除棋子。选择中可取消、更换源棋子，最终确认才提交。
- 换位完成后检查全盘恰好五连，胜利归棋子所属方。移走六连端点形成五连也判胜；移动成六连不判胜。内部扫描以被移动棋子的颜色优先，确保结果确定。
- 蜘蛛感应检查对手刚落下的棋子所参与的连续同色线，长度至少三颗时提示。只有正常落子触发，开局摆子和技能不触发。横、竖、两个斜向都检测，不跨棋盘边界、不把断开的棋子当作连续。
- 同英雄双方以红圆、蓝六边形和文字区分，均带蛛网标记。英雄站位绑定 A/B，Swap2 选边不会把人物换到另一侧。
- 原始手数与当前位置分开存储，移动棋子的手数编号随棋子移动，历史记录仍保留当时的落点。

## 动作与特效

| 时间 | 落子 | 蛛丝换位 |
| --- | --- | --- |
| 0–150 ms | 蓄力、抬腕 | 蓄力、锁定源棋子 |
| 150–430 ms | 蛛丝向落点延伸 | 蛛丝连接源棋子 |
| 430–470 ms | 蛛丝到达 | 收腕牵引开始 |
| 470–760 ms | 棋子凝结、冲击环扩散、归位 | 棋子沿弧线移动 |
| 950–1250 ms | — | 棋子落定、环形反馈、收手 |

每个站位独立使用四帧：待机、蓄力、发射、牵引。左下为背侧，右上为正侧，不用镜像代替两个视角。发射点按手腕锚点和当前棋盘实际尺寸计算，棋盘目标由真实交叉点坐标换算，缩放时重测。

规则先确认，再播放表现。动画中目标棋子暂时隐藏，落定时显示；被牵引棋子在轨迹层播放，避免源/目标同时出现两颗。动画期间界面短暂锁定输入。新快照通过序号去重；刷新恢复、批量追帧、换房间、新一局不重播整段历史。开启系统“减少动态效果”后棋子即时显示，保留文字和静态天赋提示。

## 文件与素材

- `public/heroes/hero001/portrait.png`：用户确认的原图原样复制，用于卡面与头像。
- `public/heroes/hero001/actions-rear.png`：左下站位动作条，2172×724，4 格，每格 543×724。
- `public/heroes/hero001/actions-front.png`：右上站位动作条，2172×724，4 格，每格 543×724。
- `lib/heroes.ts`：来源文本、英雄身份、资产路径、模式权限。
- `lib/match-core.ts`：试玩规则扩展、棋子身份与动作事件；`game-core.ts` 未更改。
- `lib/use-hero-motion.ts`：动作时序、天赋提示、减少动画支持。
- `components/hero-stage.tsx`：两个站位、动作关键帧、动态蛛丝轨迹。

### 美术限制

动作由内置 ImageGen 生成，没有使用 CLI/API 后备，也没有程序修改像素。虽然提示要求透明底，但两个动作条实际均为 RGB PNG，浅色格纹已经写入图片，并非透明通道。因此本版使用有底角色展示框，不把它们宣称为透明精灵。背侧图兜帽放下，正侧图兜帽戴起；正侧发射方向更接近左侧。角色原图不变，动作图属于第一版派生素材，兜帽一致性、手部瞄准和透明抠图仍可精修。

本版是关键帧加程序特效，不是 Spine 骨骼动画、逐帧连续动画或真正的 3D 模型。未新增运行时动画引擎依赖。

### 原始生成结果

- 定稿：`C:/Users/admin/.codex/generated_images/01a0433f-780c-71a1-b693-eb4f8726849f/exec-01e452b0-151e-4e0d-9153-f73152af2e48.png`
- 背侧：`C:/Users/admin/.codex/generated_images/01a0707e-4063-7fa2-9e2e-101e2d2b5328/exec-732fa720-fd42-46c6-a495-2cfa786e7768.png`
- 正侧：`C:/Users/admin/.codex/generated_images/01a0707e-4063-7fa2-9e2e-101e2d2b5328/exec-262d222a-8938-449e-a1fd-990ff7d4e24e.png`

两套动作条各生成一次。最终提示词为下列共用部分，加上对应方向部分，参考图均为用户确认的定稿 PNG。

```text
Use case: stylized-concept
Asset type: production game character sprite strip, transparent PNG.
Input images: Image 1 is the approved character identity and costume reference. Preserve this EXACT same heroine, Hero001 Xiaoguo (小果), not a redesign.
Primary request: Render exactly FOUR full-body action poses of this one character in one horizontal row, each pose occupying its own equal-width column. This is a game animation strip, not a scene.
Scene/backdrop: genuinely transparent alpha background throughout all empty pixels, with no backdrop or ground plane. No checkerboard printed into the image.
Subject invariants: Keep her recognizable face, large brown eyes, dark brown loose updo with face-framing strands, white hood with pink lining, fitted white and soft pink science-fiction suit, rounded shoulder/elbow/knee armor, pink gloves, white/pink belt and chunky boots, same chibi 3D collectible proportions as the reference. Hood must have visible dark loose updo/strands as permitted by camera angle.
Style/medium: polished soft 3D collectible figure render, clean defined silhouettes, consistent soft studio lighting and costume details across all four frames. Preserve source character proportions; do not turn into a flat illustration.
Composition/framing: wide landscape 3:1 canvas, preferably 3072 x 1024 pixels, divided invisibly into EXACTLY four equal 768 x 1024 portrait cells. Exactly 4 figures total, one per cell. Cell centers at 12.5%, 37.5%, 62.5%, 87.5% of image width. Full head, hair, entire hands and both boots visible inside every cell. Consistent figure scale, center position and boot baseline around 90% of image height. Baseline stays identical even in crouch. Keep generous transparent gaps between figures and at the outside edges, approximately 12% of cell width at each side, with room for the outstretched action arm. No overlap across cell boundaries.
Actions, STRICT left-to-right order:
Column 0: idle ready pose, feet planted, arms relaxed.
Column 1: anticipation, a small crouch/windup, action elbow clearly bent, wrist drawn close to body.
Column 2: casting pose, action arm thrust and extended toward the board direction, wrist and hand readable, web-casting hand gesture; pose must clearly differ from idle.
Column 3: tug/reel pose, action wrist drawn back toward chest, elbow pulled behind, slightly braced stance as though pulling a remote piece.
Constraints: These are 4 discrete keyframes of ONE hero with identical orientation/camera in each frame. Do not alternate directions. No text, labels, letters, numbers, watermarks, borders, dividers, grid lines, panels, board, chess pieces, extra props, visible web threads/trails, glow trails, particles, motion lines or any cast shadows beneath feet. Web trajectories will be drawn dynamically by the game. Do not crop any part of the character.
```

背侧方向：

```text
Camera and direction for ALL FOUR frames: TRUE REAR THREE-QUARTER VIEW. Hero stands at bottom-left of the future game board and faces diagonally AWAY from viewer toward UPPER-RIGHT of image. Show predominantly the BACK of her hood, head/updo, shoulder blades/back armor and the sides of limbs, with only a very small sliver of facial profile if any. The front face and chest must NOT face the viewer. This is a newly rendered rear view, never a horizontally mirrored front view. Both her gaze and casting arm point diagonally screen-right/away, as if targeting something beyond the top-right corner. Camera is gently elevated and fixed. Each of the four poses retains this same back/right orientation.
```

正侧方向：

```text
Camera and direction for ALL FOUR frames: FRONT THREE-QUARTER VIEW. Hero stands at top-right of the future game board and faces diagonally TOWARD viewer toward LOWER-LEFT of image. Face is visible, along with the front white/pink chest armor. Head and torso point down-left toward the future board. Both her gaze and casting arm point diagonally screen-left/toward viewer, as if targeting something beyond the lower-left corner. Camera is gently elevated and fixed. Each of the four poses retains this same front/left orientation.
```

## 验证范围

54 项规则和真实 WebSocket 测试通过，涵盖标准模式等价性、两种开局、技能次数、目标校验、棋子身份、存档重放、天赋四方向、长连拆解、服务端防伪、重连与重赛模式保留。另做 TypeScript 检查、生产构建和本地 HTTP 素材检查。

未进行浏览器截图或自动点击测试，也未声称已经在两台实际手机上验证。全项目 lint 仍有原先文件中的 React 编译器建议、SVG 棋盘角色提示和测试 Promise 提示；不把 lint 记作全部通过。
