# Texas Hold’em LLM

[English](README.md) | 简体中文

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)

一款本地运行的单人无限注德州扑克游戏。你可以与 1～8 位电脑玩家进行快速牌局或单桌锦标赛，查看胜率与牌局统计，并逐步回放每一手牌。

电脑玩家默认使用本地启发式策略，无需 API 即可游玩；也可以按角色接入任意兼容 OpenAI Chat Completions API 的大语言模型，让不同对手拥有独立的性格、打法和牌桌发言。

> 本项目不包含真实货币、充值、提现或联网对战功能，仅用于编程学习、扑克规则练习与个人作品展示。项目内的概率和行动建议不构成赌博或财务建议。

## 功能亮点

- **完整的无限注规则**：覆盖盲注、下注轮转、最小加注、全下、摊牌、平局分池与多人边池结算。
- **两种游戏模式**：固定盲注的快速游戏，以及盲注升级、玩家淘汰的单桌锦标赛。
- **自由配置牌桌**：选择 1～8 位电脑玩家，调整初始筹码、盲注、AI 难度和游戏速度。
- **双 AI 决策系统**：本地启发式 AI 开箱即用，大模型 AI 可按角色独立开启。
- **可定制 AI 角色**：支持角色性格、打法、默认提示词、模型和采样参数配置。
- **统计与复盘**：记录 VPIP、PFR、WTSD、W$SD、盈亏、连胜连败和起手牌表现，并按行动逐步回放。
- **本地自动存档**：在每次行动后保存当前牌局，最多保留 300 手牌历史，支持 JSON 导入和导出。
- **中英文界面**：提供响应式牌桌、动画、音效、卡牌样式与新手辅助功能。
- **本地优先设计**：后端仅监听 `127.0.0.1`，API Key 不会返回给浏览器前端。

## AI 模式

| 模式 | 是否需要 API | 特点 | 适合场景 |
| --- | --- | --- | --- |
| 本地启发式 AI | 否 | 响应快、零费用，提供简单 / 普通 / 困难三档策略 | 直接游玩、规则练习、离线使用 |
| 大模型 AI | 是 | 可为每个角色配置不同模型、性格、打法和牌桌发言 | 角色化对局、LLM 应用实验 |

大模型返回的结果不会直接修改游戏状态。所有动作仍需经过规则引擎校验；当响应超时、格式错误、动作非法或下注金额越界时，程序会尝试修复或回退到合法动作。

## 快速开始

### 环境要求

- Node.js `20.19+`、`22.12+` 或更高版本
- npm
- 现代桌面浏览器

LLM API 是可选项。没有配置 API 时，游戏会自动使用本地启发式 AI。

### Windows

1. 安装 [Node.js](https://nodejs.org/)，并保留 npm 组件。
2. 下载或克隆本仓库。
3. 双击项目根目录下的 `start.bat`。
4. 首次运行会自动安装依赖并构建项目，随后浏览器会打开 `http://127.0.0.1:3000/`。
5. 游玩期间请保持命令行窗口开启；按 `Ctrl+C` 或关闭窗口即可停止服务。

如果 PowerShell 因执行策略阻止 `npm.ps1`，可以在命令行中使用 `npm.cmd`，或直接运行 `start.bat`。

### macOS / Linux

```bash
chmod +x start.sh
./start.sh
```

启动后访问 `http://127.0.0.1:3000/`。

### 手动启动

```bash
npm install
npm run build
npm run server
```

## 配置大模型 AI

游戏支持 OpenAI Compatible `/v1/chat/completions` 接口，包括 OpenAI、OpenRouter，以及实现相同协议的其他服务。

1. 启动游戏，进入右上角的“偏好设置”。
2. 打开“AI API 设置”。
3. 填写 `API Base URL`、`API Key` 和模型名称。
4. 按服务商能力调整流式输出、超时、重试和采样参数。
5. 保存配置并测试连接。
6. 在“角色 AI”中为需要的电脑玩家开启大模型。

常见 API 地址示例：

```text
https://api.openai.com/v1
https://openrouter.ai/api/v1
https://your-provider.example/v1
```

程序会规范化 API 地址，避免生成重复的 `/v1/v1/chat/completions`。如果服务商不支持 `/models`，可以直接手动填写模型名称。

> “测试连接”会真实请求所配置的服务商，可能产生少量 Token 费用。

### 本地 Mock Provider

开发或测试时，可以启动不消耗真实 API 额度的模拟服务：

```bash
npm run mock-provider
```

在游戏内填写：

```text
API Base URL: http://127.0.0.1:3999/v1
API Key: 任意非空测试字符串
Model: mock-normal
```

除普通和流式响应外，Mock Provider 还提供鉴权失败、限流、超时、断流、格式错误和非法动作等测试场景，具体模型名可查看 `server/mockProvider.js`。

## 数据、隐私与安全

- 牌局设置、统计、历史和当前存档保存在浏览器 `localStorage` 中。
- API Key 保存在本机的 `config/api-config.json`，该文件已加入 `.gitignore`。
- 本地后端只绑定 `127.0.0.1`，不会主动向局域网或公网开放端口。
- 浏览器只与本地后端通信；携带 API Key 的远程请求由后端发出。
- 配置查询只返回密钥是否存在及末尾预览，不返回完整密钥。
- 日志会递归脱敏常见认证头、Token、Cookie、密码和 Secret 字段。
- 模型动作必须通过合法动作与下注范围校验，无法绕过游戏规则。
- 未摊牌的电脑玩家底牌在复盘中仍会保持隐藏。

运行时文件位置：

```text
config/api-config.json    # 本地 API 配置，不提交到 Git
logs/                     # AI 请求与后端运行日志，不提交到 Git
```

清理浏览器站点数据会删除本地牌局记录。更换浏览器或清理数据前，请先在“统计”页面导出 JSON 存档。

## 本地开发

开发模式需要同时启动后端和 Vite 开发服务器：

```bash
# Terminal 1
npm run server

# Terminal 2
npm run dev
```

Vite 会把 `/api` 请求代理到 `http://127.0.0.1:3000`。

### 可用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run server` | 启动本地 Express 后端 |
| `npm run build` | 执行 TypeScript 检查并构建生产版本 |
| `npm test` | 运行全部 Vitest 测试 |
| `npm run test:watch` | 以监听模式运行测试 |
| `npm run mock-provider` | 启动本地模拟 AI 服务商 |

### 项目结构

```text
.
├─ public/cards/          # 扑克牌图片资源
├─ src/
│  ├─ api/                # 前端 AI 请求与牌局状态快照
│  ├─ components/         # 牌桌、操作区、设置、统计与复盘组件
│  ├─ data/               # AI 玩家和角色配置
│  ├─ engine/             # 发牌、下注、牌型、奖池、赔率与锦标赛引擎
│  ├─ pages/              # 首页、牌桌、统计与复盘页面
│  ├─ storage/            # 本地存档、导入导出与统计计算
│  └─ tests/              # 前端和规则引擎测试
├─ server/                # Express API、模型请求、解析、日志与后端测试
├─ shared/                # 前后端共享的 AI 角色资料
├─ config/                # API 配置示例与本地运行时配置
├─ start.bat              # Windows 一键启动
└─ start.sh               # macOS / Linux 启动脚本
```

## 测试范围

自动测试覆盖以下关键路径：

- 牌组生成、洗牌与发牌
- 合法下注、最小加注和全下规则
- 五至七张牌的最佳牌型比较
- 主池、边池、平局与筹码分配
- 快速游戏与锦标赛状态流转
- 本地存档、统计、国际化与动画状态
- AI 状态快照、Prompt 构建与模型响应解析
- 请求并发、取消、超时、配置和日志脱敏

发布前建议运行：

```bash
npm test
npm run build
```

测试使用本地数据和 Mock Provider，不会调用真实模型或消耗 API 额度。

## 当前限制

- 仅支持本机单人游戏，不支持联网多人对战。
- 游戏存档主要依赖当前浏览器的 `localStorage`，不会自动跨设备同步。
- 大模型的决策质量、速度和费用取决于所选择的模型与服务商。
- 项目包含本地 Express 后端，不能直接作为纯静态网站部署到 GitHub Pages。
- 本项目不是专业扑克训练器，新手建议和概率结果仅供学习参考。

## 开源协议

本项目采用 [MIT License](LICENSE) 开源。
