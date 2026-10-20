# SpamChameleon front end

The React front end of the SpamChameleon app: three tabs, one per model
(spam, malware, process), each one asking the FastAPI back end for a verdict
and showing the probability and the features behind it.

## Run it

The back end must be running first, on port 3000:

```bash
cd ../innovation-g2
python main.py
```

Then, in this folder:

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>.

The dev server proxies every `/api` call to <http://127.0.0.1:3000>, so the
browser only ever sees one origin and no CORS setup is needed. The server
binds on every interface, so a phone on the same network can open
`http://<the-computer-ip>:5173` to check the mobile layout.

## Build it

```bash
npm run build
```

The output lands in `dist/`. The FastAPI back end serves that folder when it
exists, so the whole app then runs from one server:

```bash
cd ../innovation-g2
python main.py
# open http://127.0.0.1:3000/
```

## The other commands

```bash
npm run lint     # oxlint
npm run preview  # serve the built files, with the same API proxy
```

## How it is put together

| file | what it does |
| --- | --- |
| `src/App.jsx` | the shell: header, tab bar, about box, footer |
| `src/views/SpamView.jsx` | the message tab |
| `src/views/MalwareView.jsx` | the file-features tab, one form per platform |
| `src/views/ProcessView.jsx` | the process-counters tab |
| `src/api/client.js` | every call to the back end, with the error handling in one place |
| `src/charts/setup.js` | the Chart.js registration the charts share |
| `src/components/` | the gauge, the alert box and the number field |

The forms are built from what the back end reports about the model:
`/api/malware/schema` and `/api/process/schema` give the kind, the range and
the median of every input, so a field that is left empty is filled by the
model with the same median it was trained on.

## Styling

The look follows the original SpamChameleon page: the same colours, the same
rounded panels and the same type. The CSS is plain CSS in `src/App.css`, with
no CSS framework.

## The API

The back end documents itself at <http://127.0.0.1:3000/docs>. The endpoints
this app uses:

| method | endpoint | what for |
| --- | --- | --- |
| GET | `/api/health` | is the back end up, and are the models loaded? |
| GET | `/api/model` | what is inside the saved bundle |
| POST | `/api/spam` | classify a message |
| GET | `/api/malware/platforms` | the platform names |
| GET | `/api/malware/features` | the columns a platform accepts |
| GET | `/api/malware/schema` | the kind, range and median of every column |
| POST | `/api/malware` | classify a file |
| GET | `/api/process/features` | the counters the regression model reads |
| GET | `/api/process/schema` | the kind, range and median of every counter |
| POST | `/api/process` | predict the context switches of a process |
