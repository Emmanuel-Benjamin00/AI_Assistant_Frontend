# AI Assistant — Frontend

React single-page UI for the **AI Assistant** RAG service. Ask questions and get answers grounded in the indexed documents, with the source chunks shown alongside; see what is indexed; and paste text to add new documents.

The Django API it talks to lives in a separate repo: **[AI_Assistant_Backend](https://github.com/Emmanuel-Benjamin00/AI_Assistant_Backend)**.

> **The backend must be running for this app to do anything.** Set it up first using its README, then come back here.

---

## Table of contents

- [What the UI does](#what-the-ui-does)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quickstart — clone to running UI](#quickstart--clone-to-running-ui)
- [Verify it works](#verify-it-works)
- [How it reaches the API](#how-it-reaches-the-api)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Project layout](#project-layout)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## What the UI does

| Panel | Calls | What happens |
|---|---|---|
| **Ask · RAG streaming** | `POST /api/ask/stream/` | Send a question with *Search* (hybrid or vector), *Top K* and optional *Re-rank with LLM*. The answer appears token by token as it is generated. Each source shows its document, page, similarity and where the vector and keyword searches ranked it. |
| **Ask · Agent** | `POST /api/agent/` | The model calls tools (search, list documents, read a document) before answering. The tool calls it made are listed under the answer. Try the summary and comparison samples. |
| **Ask · LangChain** | `POST /api/ask/langchain/` | The same RAG flow built with LangChain, returned in one response, for comparison. |
| **Indexed documents** | `GET /api/documents/` | Lists what the assistant can answer from, with each document's type and chunk count. |
| **Add a document** | `POST /api/documents/upload/` or `POST /api/documents/` | *Upload file* (PDF, DOCX, TXT, Markdown, up to 10 MB) or *Paste text*. On a deployment with ingest locked, enter the access key (the backend's `INGEST_API_KEY`). |

All panels show loading states and surface API errors inline. Requests time out after 90 seconds without data (a streaming answer resets the timer on every token), and a notice appears after 5 seconds in case the backend is waking up.

Streaming uses `fetch` and reads the response body, not `EventSource`, because `EventSource` can only send GET requests. [`parseSseChunk`](src/api.js) handles an event split across two network chunks.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Language | JavaScript (JSX), ES modules |
| HTTP | native `fetch` — no client library |
| Linting | ESLint 10 with React Hooks rules |
| Styling | plain CSS (`src/App.css`, `src/index.css`) |

---

## Prerequisites

- **Node.js 20.19+ or 22.12+** (Vite 8 requires it) — check with `node --version`
- **npm** — ships with Node
- **The backend running** at `http://127.0.0.1:8000` — see [AI_Assistant_Backend](https://github.com/Emmanuel-Benjamin00/AI_Assistant_Backend)

---

## Quickstart — clone to running UI

### 1. Start the backend first

In a **separate terminal**, follow the [backend quickstart](https://github.com/Emmanuel-Benjamin00/AI_Assistant_Backend#quickstart--clone-to-running-api). In short:

```bash
git clone https://github.com/Emmanuel-Benjamin00/AI_Assistant_Backend.git
cd AI_Assistant_Backend
docker compose up -d
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then add your OPENAI_API_KEY
python manage.py migrate
python manage.py runserver
```

Leave that terminal running.

### 2. Clone this repo

```bash
git clone https://github.com/Emmanuel-Benjamin00/AI_Assistant_Frontend.git
cd AI_Assistant_Frontend
```

### 3. Install dependencies

```bash
npm install
```

### 4. Run the dev server

```bash
npm run dev
```

Open <http://localhost:5173/>.

**No environment file is needed for local development.** Vite proxies API calls to the backend automatically — see [how it reaches the API](#how-it-reaches-the-api).

> If port 5173 is taken, Vite picks the next free port and prints it. Use whatever URL it shows.

---

## Verify it works

1. In the **Add a document** panel, choose **Paste text**, enter a title such as `Company facts` and this text:

   ```
   Our support hours are 9am to 5pm on weekdays.

   We offer a 30-day refund on all plans.
   ```

2. Click **Ingest**. You should see `Indexed document #1 (1 chunks, text).`

3. In the **Ask** panel, ask `When can I get support?` and click Ask.

4. You should see the answer appear word by word, about 9am–5pm weekdays, with the matching source chunk listed below it.

5. Optional: switch to **Upload file** and upload a PDF, then ask about it. The sources show the page number.

If all four steps work, the full stack — React, Django, pgvector, and OpenAI — is wired up correctly.

---

## How it reaches the API

[`src/api.js`](src/api.js) builds every request from one base:

```js
const API_BASE = import.meta.env.VITE_API_BASE ?? ''
```

**In development**, `VITE_API_BASE` is unset, so requests go to relative paths like `/api/ask/`. The dev server proxies those to Django, configured in [`vite.config.js`](vite.config.js):

```js
server: {
  proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } }
}
```

Because the browser only ever talks to `localhost:5173`, this sidesteps CORS entirely during development.

**In a production build**, there is no dev server and no proxy, so `VITE_API_BASE` must point at the deployed API's absolute origin. That origin must also be listed in the backend's `CORS_ALLOWED_ORIGINS`.

---

## Environment variables

Vite only exposes variables prefixed `VITE_`, and it **inlines them into the bundle at build time**.

| Variable | Used when | Purpose |
|---|---|---|
| `VITE_API_BASE` | production builds | Absolute origin of the deployed API, e.g. `https://ai-assistant-api.azurewebsites.net`. Leave unset in dev. |

Which files are committed, and why:

| File | Committed? | Contents |
|---|---|---|
| `.env.example` | yes | Documentation only, no values |
| `.env.production` | yes | The deployed API URL — a public endpoint, not a secret |
| `.env`, `.env.local`, `.env.*.local` | **no** — gitignored | Your local overrides |

> **Never put a secret in any `VITE_` variable.** Anything prefixed `VITE_` is compiled into the JavaScript that ships to the browser, where anyone can read it. API keys belong on the backend only — which is exactly why this app never talks to OpenAI directly.

To override the API URL locally without touching a committed file, create `.env.local`:

```dotenv
VITE_API_BASE=http://127.0.0.1:8000
```

---

## Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot module reload at <http://localhost:5173/> |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally to check a production build |
| `npm run lint` | Run ESLint across the project |

---

## Project layout

```
AI_Assistant_Frontend/
├── src/
│   ├── App.jsx          # layout and the document list
│   ├── components/
│   │   ├── AskPanel.jsx     # engine picker (RAG streaming / agent / LangChain), search options, answer
│   │   ├── IngestPanel.jsx  # file upload and paste-text forms
│   │   └── Sources.jsx      # retrieved chunks with page, similarity and search ranks
│   ├── useSlowFlag.js   # "still working" notice after 5 seconds
│   ├── api.js           # every API call, including the streaming reader and SSE parser
│   ├── App.css          # component styles
│   ├── index.css        # global styles
│   ├── main.jsx         # React entry point
│   └── assets/
├── public/              # static files served as-is (incl. staticwebapp.config.json)
├── index.html           # HTML shell Vite builds from
├── vite.config.js       # React plugin + the /api dev proxy
├── eslint.config.js
├── .env.example         # template
└── .env.production      # deployed API URL for prod builds
```

---

## Security notes

- **No credentials in this repo.** The OpenAI key lives only in the backend's `.env`; this app calls your own API, never OpenAI.
- **`.env`, `.env.local` and `.env.*.local` are gitignored.** Put anything machine-specific there.
- **Everything in a `VITE_` variable is public** once built — treat the whole bundle as readable by users.
- **The ingest access key is typed by the user, never built in.** It is sent only as the `X-Ingest-Key` header and is not stored.

---

## Troubleshooting

**Every request fails, or errors mention the proxy**
The backend is not running. Start it (`python manage.py runserver`) and confirm <http://127.0.0.1:8000/admin/> loads.

**`Request failed (503)`**
The backend has no `OPENAI_API_KEY`. Add it to the backend's `.env` and restart `runserver`.

**A field error such as `text: ...`**
A field failed validation — usually an empty title or text, text over 100,000 characters, or a *Top K* outside 1–10.

**Deploying to Azure**
See [DEPLOY_AZURE.md](https://github.com/Emmanuel-Benjamin00/AI_Assistant_Backend/blob/dev/DEPLOY_AZURE.md) in the backend repo; this app deploys to Azure Static Web Apps.

**The answer says there is no indexed content**
Nothing has been ingested into that database yet. Use the **Add a document** panel first.

**Vite starts on a different port**
Port 5173 was busy. Vite prints the port it chose — use that URL. Nothing else needs changing, since the proxy is configured on the server side.

**`npm install` fails on the Node version**
Vite 8 needs Node 20.19+ or 22.12+. Check `node --version` and upgrade, ideally with [nvm](https://github.com/nvm-sh/nvm).

**Production build calls the wrong host**
`VITE_API_BASE` is baked in at build time, so changing it means rebuilding. Update `.env.production` and run `npm run build` again.

---

## Related repos

| Repo | Contents |
|---|---|
| [AI_Assistant_Backend](https://github.com/Emmanuel-Benjamin00/AI_Assistant_Backend) | Django REST API, pgvector, RAG pipeline |
| [AI-Assistant_Plan-and-docs](https://github.com/Emmanuel-Benjamin00/AI-Assistant_Plan-and-docs) | Roadmap and build plan |
