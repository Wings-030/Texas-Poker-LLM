# Texas Hold’em LLM

English | [简体中文](README.zh-CN.md)

**[Play online → poker.wings030.online](https://poker.wings030.online/)**

A single-player No-Limit Texas Hold’em game with a private poker-room aesthetic. Sit down with 1–8 computer opponents, play a quick game or a single-table tournament, and review each hand afterward. Connect an optional LLM API to give the opponents distinct personalities, playing styles, and table talk.

Play in your browser or run the project on your own machine. No API key is required to play with built-in strategies. All chips are virtual; there are no real-money transactions or multiplayer games.

## Preview

An emerald felt table, champagne-gold accents, custom card backs, and eight illustrated character icons carry the visual theme from the lobby to the table. The layout adapts to desktop and mobile screens.

**Lobby**

![Lobby with game modes, opponent selection, and poker artwork](docs/previews/lobby.jpg)

**At the table**

![Nine-player table with community cards, chips, and betting controls](docs/previews/table.jpg)

## Features

- **No-Limit rules:** blinds, minimum raises, all-ins, showdowns, split pots, and multi-player side pots.
- **Two ways to play:** quick games with fixed blinds, or single-table tournaments with rising blinds and player elimination.
- **Your table, your pace:** choose 1–8 opponents, starting chips, blinds, AI difficulty, and game speed.
- **Optional LLM opponents:** enable model decisions per character and customize their personality, playing style, and additional prompt. Built-in heuristic strategies are also available.
- **Statistics and replay:** track VPIP, PFR, WTSD, W$SD, net chips, streaks, and starting-hand results; replay each action while keeping unshown opponent cards hidden.
- **Automatic saves:** retain the active game and up to 300 hands in the browser, with JSON import and export.
- **Chinese and English:** switch languages in the header, with responsive layouts, animations, sound effects, and optional beginner assistance.

## Play Online

1. Open **[poker.wings030.online](https://poker.wings030.online/)**.
2. Choose a game mode, opponents, and table settings.
3. To use built-in strategies directly, turn off LLM use under **Character AI**. To use a model, follow the setup below.
4. Start the game. Use **Statistics** and **Replays** to review your play afterward.

Saves belong to the current browser and site; they do not automatically sync across devices. Export a JSON save before switching browsers or clearing site data.

## Run Locally

Install **Node.js 22.12 or later** with npm, then download or clone this repository.

### Windows

Double-click `start.bat`. It installs missing dependencies, builds the project, starts the backend, and opens [localhost:3000](http://127.0.0.1:3000/). Keep the command window open while playing; press `Ctrl+C` to stop.

If PowerShell blocks `npm.ps1`, use `npm.cmd` for the commands below or use the launcher.

### macOS / Linux

```bash
chmod +x start.sh
./start.sh
```

Then open [localhost:3000](http://127.0.0.1:3000/).

### Manual Start

```bash
npm install
npm start
```

`npm start` builds the frontend and starts Express, which serves the game at [localhost:3000](http://127.0.0.1:3000/).

## Connect an LLM

The backend supports the OpenAI Chat Completions protocol. Supply a compatible provider’s base URL, API key, and model name.

1. Open **Preferences → AI API Settings**.
2. Enter the connection details, such as a base URL ending in `/v1`.
3. Click **Get Models** to save the current connection details and fetch models immediately, even with a blank model field. Select a model, then test the connection; tests also save the current form first. If discovery is unavailable, enter the model name manually.
4. Open **Character AI** to enable LLM decisions and set additional prompts for individual opponents.
5. Use **Default Prompts** to edit each character’s personality and playing style.

**API connection, model, and sampling settings are shared by the characters in your browser’s configuration.** The per-character controls select whether to use the model and how the character is prompted; they do not select separate models.

Model actions are checked against the rules engine. Missing configuration, failed requests, or invalid responses lead to a legal fallback action; malformed responses may also be retried or repaired. LLM quality and speed depend on the provider. API calls, including connection tests, use your provider account and may incur charges.

## Saves and API Keys

- **Game data:** settings, statistics, hand history, and the active game are stored in browser IndexedDB. Existing `localStorage` saves migrate automatically after a successful write. Save failures show persistent retry and JSON export controls. JSON exports contain game data, not your API key or API access credential.
- **Visitor configuration:** the browser keeps a random access credential. The backend uses it to isolate API configuration, logs, and request cancellation. Tabs on the same site in the same browser share this configuration; another browser or site origin has separate storage.
- **Key storage:** provider requests go through this site’s backend. API keys are stored on that server and are accessible to its administrator. On the online demo, this means the hosted server; when self-hosting, it means your own server. The full saved key is not returned to the page. Missing configuration never uses the site owner’s key.
- **Deleting a key:** use **AI API Settings → Clear Configuration** before clearing browser site data. Clearing browser data alone removes your access credential but does not delete the server’s configuration file.

Runtime configurations and logs are excluded from Git. Logs redact common credential fields; see [server/](server/) for implementation and tests.

## Development

Built with **React, TypeScript, Vite, Express, and Vitest**. After `npm install`, run the backend and frontend in separate terminals:

```bash
# Terminal 1
npm run server

# Terminal 2
npm run dev
```

Open [localhost:5173](http://127.0.0.1:5173/). Vite proxies `/api` requests to the backend on port 3000.

| Command | Purpose |
| --- | --- |
| `npm start` | Build and serve the application |
| `npm run dev` | Start the Vite development server |
| `npm run server` | Start the Express backend |
| `npm run build` | Check TypeScript and create the production build |
| `npm test` | Run the Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run mock-provider` | Start a local mock LLM provider |

### Test Without API Credits

Start the local backend with `AI_ALLOW_PRIVATE_ENDPOINTS=true` to permit the mock provider (PowerShell: `$env:AI_ALLOW_PRIVATE_ENDPOINTS="true"; npm.cmd run server`; macOS/Linux: `AI_ALLOW_PRIVATE_ENDPOINTS=true npm run server`). Run `npm run mock-provider` in another terminal, then configure:

```text
API Base URL: http://127.0.0.1:3999/v1
API Key: mock-key
Model: mock-normal
```

The mock also covers streaming, authentication errors, rate limits, timeouts, disconnects, malformed responses, and illegal actions. Model names are listed in [server/mockProvider.js](server/mockProvider.js). Use this with a locally running backend; the online demo cannot reach a mock server on your computer through its loopback address.

### Project Structure

```text
public/art/       Lobby artwork
public/cards/     Card faces and custom card back
src/components/   Table, controls, settings, and shared UI
src/engine/       Deck, betting, hands, pots, odds, and tournaments
src/pages/        Lobby, game, statistics, and replay
src/storage/      Browser saves, import/export, and statistics
server/           Express API, model requests, logging, and tests
shared/           Character definitions shared by client and server
docs/             Art direction and screenshots
```

### Self-Hosting

Run `npm install` and `npm start`. Express serves `dist/` and the API on `127.0.0.1:3000`; `PORT` can change the port. For public access, place an HTTPS reverse proxy in front of it and preserve streaming responses for the AI endpoints. Full LLM functionality requires the backend, so static-only hosting is insufficient.

Visitor configuration lives in process memory only, so API keys are never written to disk and are cleared whenever the backend restarts. Request logs go to `logs/visitors/`; use `AI_LOG_DIR` to override the log root. Existing legacy `config/api-config.json` files are not used for visitor requests; configure the API through the page.

Provider requests accept public IP addresses only by default, including validation of DNS results when opening a connection. Redirects are rejected; enter the provider's final API URL. For a trusted local deployment using a local model or mock server, set `AI_ALLOW_PRIVATE_ENDPOINTS=true` before starting the backend. This setting permits private destinations for all visitors of that backend, so leave it unset on publicly accessible deployments.

## License and Artwork

Released under the [MIT License](LICENSE). See [Art Direction](docs/ART_DIRECTION.md) for visual assets, the generated lobby artwork’s prompt, and verification notes.
