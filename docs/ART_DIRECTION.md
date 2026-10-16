# 私人牌室视觉

本轮采用墨绿绒面、香槟金、象牙白与低饱和角色色。大厅用扑克静物主视觉，牌桌使用可缩放的 CSS 材质、SVG 卡背与八枚角色图标。

- `public/art/poker-room.png`：内置 imagegen 生成，1536 × 1024；本地加载，无外部图片依赖。
- `public/cards/Back-Club.svg`：项目内编写的几何黑桃卡背；发牌动画和静态牌面共用同一个资源映射。
- `src/components/PlayerSeat/PlayerAvatar.tsx`：对应肥皂、茶杯等八名角色的 SVG 图标，大厅、牌桌、角色设置共用。
- 原有 52 张正面牌资源继续使用。

大厅的角色 AI 配置改为默认折叠；开局区显示人数、筹码与盲注。牌桌按 2–9 人安排座位，窄屏采用纵向桌面；动画与下注规则沿用原有实现。快捷下注在非玩家行动时禁用。

## 验证

- `npm run build`：TypeScript 检查与生产构建通过。
- `npm test`：19 个测试文件、71 项测试通过。
- 浏览器：九人桌在 320、390、768、1440 px 宽度无座位重叠或页面横向溢出；另验证了六人快速游戏和双人锦标赛。
- 实际完成发牌、跟注、弃牌、摊牌结算、下一手；历史复盘可跳至第 28 / 28 步。
- 中英文切换、折叠角色设置、手机设置入口正常；窄屏公共牌与底牌无交叠。
- 对局验证使用本地策略 AI，未验证外部模型 API。
- 效果截图：`previews/lobby.jpg`、`previews/table.jpg`。

## 主视觉生成提示词

工具：内置 `image_gen`，不透明背景。以下为实际使用的完整提示词：

```text
Use case: product-mockup. Asset: cinematic hero background artwork for a premium local Texas Hold'em poker game, landscape 3:2. A beautifully art-directed close-up still life on rich deep emerald green wool poker felt. On the RIGHT HALF, a dramatic sculptural cluster of premium dark forest green, ivory and oxblood clay poker chip stacks, finely milled edges, restrained brass inlay details, one ivory dealer disc, and two elegantly fanned ivory playing cards with recognizable ace of spades and king of hearts faces. Low three-quarter camera angle, tactile macro photography, realistic physical materials, crisp foreground, soft shallow depth of field, warm golden side-light from top right. Deep green-black background with darkness and completely clear negative space over the LEFT HALF for webpage typography. Sophisticated quiet private card room mood, editorial luxury product photography, muted warm ivory, antique champagne gold and dark green palette, subtle film grain. No people, no hands, no casino room, no table text, no logos, no watermarks, no UI, no flashy neon, no glitter. Composition concentrates objects on right and leaves safe empty margin near all edges. This is artwork only, not a website mockup.
```
