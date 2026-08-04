# Texas Hold’em LLM

English | [简体中文](README.zh-CN.md)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)

A local-first, single-player No-Limit Texas Hold'em game. Play quick games or single-table tournaments against 1–8 computer opponents, review detailed statistics, and replay every hand action by action.

Computer players use local heuristic strategies by default, so no API is required. You can also connect any OpenAI Chat Completions-compatible LLM on a per-character basis, giving each opponent an independent personality, playing style, model configuration, and table talk.

> This project does not include real-money gambling, deposits, withdrawals, or online multiplayer. It is intended for programming education, poker rule practice, and portfolio demonstration. Probabilities and action suggestions are provided for educational purposes only and do not constitute gambling or financial advice.

## Features

- **Complete No-Limit rules engine**: blinds, betting order, minimum raises, all-ins, showdowns, split pots, and multi-player side-pot settlement.
- **Two game modes**: fixed-blind quick games and single-table tournaments with increasing blind levels and player elimination.
- **Configurable tables**: choose 1–8 computer opponents and adjust starting chips, blinds, AI difficulty, and game speed.
- **Dual AI system**: local heuristic AI works out of the box, while LLM decision-making can be enabled separately for each character.
- **Customizable AI characters**: configure personality, playing style, default prompts, model selection, and sampling parameters.
- **Statistics and replay**: track VPIP, PFR, WTSD, W$SD, net chips, streaks, and starting-hand performance, then replay each hand step by step.
- **Automatic local saves**: save after every action, retain up to 300 hands, and import or export save data as JSON.
- **Chinese and English UI**: responsive table layout, animations, sound effects, card styles, and optional beginner assistance.
- **Local-first security**: the backend listens only on `127.0.0.1`, and the full API key is never returned to the browser.

## AI Modes

| Mode | API required | Characteristics | Best for |
| --- | --- | --- | --- |
| Local heuristic AI | No | Fast, free, and available in Easy, Normal, and Hard difficulties | Immediate play, rule practice, and offline use |
| LLM-powered AI | Yes | Per-character models, personalities, playing styles, prompts, and table talk | Character-driven games and LLM application experiments |

LLM responses never modify the game state directly. Every action must pass the rules engine's legality checks. If a response times out, contains invalid formatting, selects an illegal action, or returns an out-of-range amount, the application attempts to repair it or falls back to a legal move.

## Quick Start

### Requirements

- Node.js `20.19+`, `22.12+`, or a newer supported version
- npm
- A modern desktop browser

An LLM API is optional. Without one, the game automatically uses local heuristic AI.

### Windows

1. Install [Node.js](https://nodejs.org/) with npm.
2. Download or clone this repository.
3. Double-click `start.bat` in the project root.
4. On the first run, the script installs dependencies and builds the project, then opens `http://127.0.0.1:3000/` in your browser.
5. Keep the command window open while playing. Press `Ctrl+C` or close the window to stop the server.

If PowerShell execution policy blocks `npm.ps1`, use `npm.cmd` from the command line or run `start.bat` directly.

### macOS / Linux

```bash
chmod +x start.sh
./start.sh
```

Then open `http://127.0.0.1:3000/`.

### Manual Start

```bash
npm install
npm run build
npm run server
```

## Configure LLM Opponents

The game supports OpenAI-compatible `/v1/chat/completions` endpoints, including OpenAI, OpenRouter, and other providers implementing the same protocol.

1. Start the game and open **Preferences** in the top-right corner.
2. Select **AI API Settings**.
3. Enter the `API Base URL`, `API Key`, and model name.
4. Adjust streaming, timeout, retry, and sampling settings for your provider.
5. Save the configuration and test the connection.
6. Open **Character AI** and enable LLM decision-making for the desired opponents.

Common endpoint examples:

```text
https://api.openai.com/v1
https://openrouter.ai/api/v1
https://your-provider.example/v1
```

The application normalizes the base URL to avoid duplicated paths such as `/v1/v1/chat/completions`. If the provider does not support `/models`, enter the model name manually.

> **Test Connection** sends a real request to the configured provider and may incur a small token charge.

### Local Mock Provider

For development and testing without consuming real API credits:

```bash
npm run mock-provider
```

Use the following settings in the game:

```text
API Base URL: http://127.0.0.1:3999/v1
API Key: any non-empty test string
Model: mock-normal
```

In addition to normal and streaming responses, the Mock Provider includes scenarios for authentication failures, rate limits, timeouts, disconnects, malformed output, and illegal actions. See `server/mockProvider.js` for the available model names.

## Data, Privacy, and Security

- Game settings, statistics, hand history, and the active save are stored in browser `localStorage`.
- The API key is stored locally in `config/api-config.json`, which is excluded by `.gitignore`.
- The backend binds only to `127.0.0.1` and does not expose itself to the LAN or public internet.
- The browser communicates only with the local backend; remote requests containing the API key are sent by the backend.
- Configuration responses report only whether a key exists and a masked suffix, never the complete key.
- Logs recursively redact common authentication headers, tokens, cookies, passwords, and secret fields.
- Model decisions must pass legal-action and bet-range validation and cannot bypass the poker rules.
- Unrevealed computer hole cards remain hidden in hand replays.

Clearing browser site data removes local game records. Export a JSON save from the **Statistics** page before clearing data or switching browsers.

## Local Development

Development mode requires the backend and Vite development server to run at the same time:

```bash
# Terminal 1
npm run server

# Terminal 2
npm run dev
```

Vite proxies `/api` requests to `http://127.0.0.1:3000`.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run server` | Start the local Express backend |
| `npm run build` | Run TypeScript checks and create a production build |
| `npm test` | Run the complete Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run mock-provider` | Start the local mock AI provider |

### Project Structure

```text
.
├─ public/cards/          # Playing-card image assets
├─ src/
│  ├─ api/                # Frontend AI requests and game-state snapshots
│  ├─ components/         # Table, controls, settings, statistics, and replay UI
│  ├─ data/               # AI players and character configuration
│  ├─ engine/             # Deck, betting, hands, pots, odds, and tournament engine
│  ├─ pages/              # Home, game, statistics, and replay pages
│  ├─ storage/            # Local saves, import/export, and statistics
│  └─ tests/              # Frontend and rules-engine tests
├─ server/                # Express API, model requests, parsing, logs, and tests
├─ shared/                # AI character data shared by frontend and backend
├─ config/                # API configuration example and local runtime config
├─ start.bat              # Windows launcher
└─ start.sh               # macOS / Linux launcher
```

## Current Limitations

- Local single-player only; online multiplayer is not supported.
- Saves primarily rely on the current browser's `localStorage` and do not sync across devices.
- LLM decision quality, latency, and cost depend on the selected model and provider.
- The project includes a local Express backend and cannot be deployed directly as a static GitHub Pages site.
- This is not a professional poker trainer; beginner suggestions and probability estimates are for educational reference only.

## License

This project is released under the [MIT License](LICENSE).
