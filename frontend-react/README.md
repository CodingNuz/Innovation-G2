# SpamChameleon front end

The React front end of the SpamChameleon app: five tabs — Spam, Malware,
Process, Assistant and History. The first three ask the FastAPI back end for a
verdict and show the probability and the features behind it; Assistant is a
tool-calling chat box over the same models; History is a session-only dashboard
of the predictions made in this browser session.

## Run it

See the [root README](../README.md) for the Python environment. In short: start
the back end on port 3000, then in this folder:

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>. The dev server proxies every `/api` call to
<http://127.0.0.1:3000>, so the browser only ever sees one origin and no CORS
setup is needed. The server binds on every interface, so a phone on the same
network can open `http://<the-computer-ip>:5173` to check the mobile layout.

## Build it

```bash
npm run build
```

The output lands in `dist/`. The FastAPI back end serves that folder when it
exists, so the whole app then runs from one server (open
<http://127.0.0.1:3000/>). Without a build, `/` returns 503; the API still works.

## The other commands

```bash
npm run lint     # oxlint
npm run preview  # serve the built files locally (no /api proxy; use the dev server for that)
```

## How it is put together

| file | what it does |
| --- | --- |
| `src/App.jsx` | the shell: header, tab bar, about box, footer, session history |
| `src/views/SpamView.jsx` | the message tab |
| `src/views/MalwareView.jsx` | the file-features tab, one form per platform |
| `src/views/ProcessView.jsx` | the process-counters tab |
| `src/views/ChatView.jsx` | the Assistant tab (tool-calling chat, attachments) |
| `src/views/HistoryView.jsx` | the History dashboard: charts, filters, CSV export |
| `src/api/client.js` | every call to the back end, with the error handling in one place |
| `src/charts/setup.js` | the Chart.js registration the charts share |
| `src/components/` | the gauge, the alert box, the number field and the file picker |

The forms are built from what the back end reports about the model:
`/api/malware/schema` and `/api/process/schema` give the kind, the range and
the median of every input, so a field that is left empty is filled by the
model with the same median it was trained on.

## Styling

The CSS is plain CSS in `src/App.css` (one stylesheet for every view), with no
CSS framework. `src/index.css` only resets the browser defaults.

## The API

The back end documents itself at <http://127.0.0.1:3000/docs>. The endpoints
this app uses:

| method | endpoint | what for |
| --- | --- | --- |
| GET | `/api/health` | is the back end up, and are the models loaded? |
| GET | `/api/agent/info` | which model answers the Assistant tab |
| POST | `/api/spam` | classify a message |
| POST | `/api/scan/upload` | score one or more uploaded files |
| POST | `/api/chat/stream` | stream a chat reply and its tool calls |
| GET | `/api/malware/platforms` | the platform names |
| GET | `/api/malware/schema` | the kind, range and median of every column |
| POST | `/api/malware` | classify a file |
| GET | `/api/process/schema` | the kind, range and median of every counter |
| POST | `/api/process` | predict the context switches of a process |
