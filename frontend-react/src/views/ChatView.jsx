// The assistant screen: one chat box over the three ML models.
//
// The answer comes from the local LLM, but every verdict in it comes from the
// trained models: the agent calls them as tools and returns the reply with a
// log of what ran.  The log is shown under each answer, so a claim like
// "SPAM, 0.95" can be checked against the tool output that produced it.
//
// The backend answers with server-sent events (see apiStream), so the box can
// say "running check_spam" while the model is still thinking instead of
// showing a spinner that looks stuck.

import { useEffect, useRef, useState } from 'react'
import Alert from '../components/Alert'
import { api } from '../api/client'

// A tool name is a function identifier; a person reads "Spam check".
const TOOL_LABELS = {
  check_spam: 'Spam check',
  check_malware: 'Malware check',
  list_malware_platforms: 'List malware platforms',
  predict_process: 'Process prediction',
  get_model_info: 'Model info',
  get_attachment: 'Read file details',
  read_attachment_text: 'Read file text',
  scan_attachment: 'Scan attached file',
}

// What the chat box accepts.  The backend decides the real type from the
// bytes; this list only keeps the file picker honest.
const ACCEPT = '.pdf,.exe,.dll,.sys,.apk,.txt,.text,.md,.log,.csv,.json,.eml,.html,.htm'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const DEFAULT_QUESTION = 'Analyse the attached file.'

const EXAMPLES = [
  "Is this message spam? 'WIN a FREE prize now, click the link to claim your reward'",
  'What malware platforms do you support?',
  'Explain how the spam model decides, and what words pushed this one to spam.',
]

let nextId = 1
const newId = () => String(nextId++)

/** Bytes as a size a person reads. */
function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// The reply is fetched whole; this only paces how it appears.  A short answer
// takes about a second, and a long one is capped so nobody waits on an effect.
const TYPE_MS = 1200
const TYPE_FRAME_MS = 16
const TYPE_MIN_CHARS = 8

/** Reveal `text` letter by letter, once, for this message.

 * `enabled` is the request to animate, not a lasting state: the hook turns it
 * off itself after the reveal so a later re-render cannot replay the effect.
 */
function useTypewriter(text, enabled) {
  const [shown, setShown] = useState(enabled ? '' : text)
  const [animating, setAnimating] = useState(enabled)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!animating || !text || reduceMotion) return undefined

    // Long answers reveal in bigger steps so the total time stays bounded.
    const step = Math.max(TYPE_MIN_CHARS, Math.ceil(text.length / (TYPE_MS / TYPE_FRAME_MS)))
    let index = 0
    const timer = setInterval(() => {
      index = Math.min(text.length, index + step)
      setShown(text.slice(0, index))
      if (index >= text.length) {
        clearInterval(timer)
        setAnimating(false)
      }
    }, TYPE_FRAME_MS)
    return () => clearInterval(timer)
  }, [text, animating, reduceMotion])

  if (!animating || !text || reduceMotion) return text
  return shown
}

export default function ChatView() {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [status, setStatus] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const listRef = useRef(null)
  const fileInputRef = useRef(null)

  // Which model answers, so the box can show it is connected before the first
  // question.  A dead server is reported here rather than on the first send.
  useEffect(() => {
    let cancelled = false
    api
      .agentInfo()
      .then((reply) => !cancelled && setInfo(reply))
      .catch(() => !cancelled && setInfo(null))
    return () => {
      cancelled = true
    }
  }, [])

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, status])

  const online = info?.server?.reachable === true
  const canSend = (draft.trim().length > 0 || pendingFile !== null) && !busy

  /** Keep one file in memory for the next question. */
  function chooseFile(file) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setError(`${file.name} is ${formatSize(file.size)}; the limit is 10 MB.`)
      return
    }
    setError(null)
    setPendingFile(file)
  }

  function onDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    chooseFile(event.dataTransfer?.files?.[0] ?? null)
  }

  /** Base64, because the bytes travel inside the same JSON body. */
  async function encodeFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    const step = 0x8000
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, i + step))
    }
    return { filename: file.name, content_b64: btoa(binary) }
  }

  async function send(event) {
    event?.preventDefault()
    const typed = draft.trim()
    const file = pendingFile
    if ((!typed && !file) || busy) return
    const prompt = typed || DEFAULT_QUESTION

    // The history sent to the server is what the user saw: their questions and
    // the answers.  Tool logs are not replayed, they are shown only here.
    const history = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.text))
      .map((m) => ({ role: m.role, content: m.text }))

    const question = {
      id: newId(),
      role: 'user',
      text: prompt,
      file: file ? { name: file.name, size: file.size } : null,
    }
    setMessages((current) => [...current, question])
    setDraft('')
    setPendingFile(null)
    setError(null)
    setBusy(true)
    setStatus(null)

    try {
      const attachment = file ? await encodeFile(file) : null
      const reply = await api.chat(
        prompt,
        history,
        (name, payload) => {
          if (name === 'tool_start') {
            setStatus({ tool: payload.tool, running: true })
          } else if (name === 'tool_end') {
            setStatus({ tool: payload.tool, running: false })
          } else if (name === 'attachment') {
            setStatus({ file: payload.filename, running: true })
          } else if (name === 'retry') {
            setStatus({ retry: true })
          }
        },
        attachment,
      )
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: 'assistant',
          text: reply.reply,
          tools: reply.tool_calls ?? [],
          rounds: reply.rounds,
          finish: reply.finish_reason,
          animate: true,
        },
      ])
    } catch (apiError) {
      setError(apiError.message)
      // The question stays in the list so the user can see what failed.
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  function reset() {
    setMessages([])
    setError(null)
    setStatus(null)
  }

  return (
    <section className="view view-wide chatview">
      <div
        className={`panel chatpanel${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
        }}
        onDrop={onDrop}
      >
        <header className="chathead">
          <div>
            <h1 className="detitle">Ask the security assistant</h1>
            <p className="subtitle">
              Verdicts come from the trained models, never from the language model alone.
            </p>
          </div>
          <div className="chatmeta">
            <span className={`health ${online ? 'ok' : 'bad'}`}>
              <i
                className={
                  online ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'
                }
                aria-hidden="true"
              />
              {online ? info.model : 'model server offline'}
            </span>
            {messages.length > 0 ? (
              <button type="button" className="linkbutt" onClick={reset}>
                clear
              </button>
            ) : null}
          </div>
        </header>

        <div className="chatlog" ref={listRef} aria-live="polite">
          {messages.length === 0 ? (
            <div className="chathint">
              <p>
                Ask about a message, a platform, or the counters of a process. The
                assistant picks the right model, runs it, and explains the result.
              </p>
              <ul>
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      className="linkbutt"
                      onClick={() => setDraft(example)}
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className="chatmsg chatmsg-user">
                <p>{message.text}</p>
                {message.file ? (
                  <p className="chatfile">
                    <i className="fa-solid fa-paperclip" aria-hidden="true" />{' '}
                    {message.file.name}
                    <span> · {formatSize(message.file.size)}</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <AssistantMessage key={message.id} message={message} />
            ),
          )}

          {busy ? (
            <div className="chatmsg chatmsg-bot chatmsg-busy">
              <p className="chatwho">
                <i className="fa-solid fa-robot" aria-hidden="true" /> assistant
              </p>
              <p className="chatstatus">
                {status
                  ? status.retry
                    ? 'The model is still thinking; giving it more room…'
                    : status.file
                    ? `Reading ${status.file}…`
                    : `${TOOL_LABELS[status.tool] ?? status.tool} ${status.running ? 'is running' : 'finished'}…`
                  : 'Thinking about which model to use…'}
              </p>
            </div>
          ) : null}
        </div>

        {error ? <Alert kind="error">{error}</Alert> : null}

        {pendingFile ? (
          <p className="attachchip">
            <i className="fa-solid fa-paperclip" aria-hidden="true" />{' '}
            {pendingFile.name}
            <span className="attachsize">{formatSize(pendingFile.size)}</span>
            <button
              type="button"
              className="attachremove"
              onClick={() => setPendingFile(null)}
              aria-label={`Remove ${pendingFile.name}`}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </p>
        ) : null}

        <form className="chatinput" onSubmit={send}>
          <label className="visually-hidden" htmlFor="chat-file">
            Attach a file to analyse
          </label>
          <input
            ref={fileInputRef}
            id="chat-file"
            type="file"
            className="visually-hidden"
            accept={ACCEPT}
            onChange={(event) => {
              chooseFile(event.target.files?.[0] ?? null)
              event.target.value = ''
            }}
          />
          <button
            type="button"
            className="butt clipbutt"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label="Attach a file"
            title="Attach a PDF, executable, APK or text file"
          >
            <i className="fa-solid fa-paperclip" aria-hidden="true" />
          </button>
          <label className="visually-hidden" htmlFor="chat-text">
            Message to the assistant
          </label>
          <textarea
            id="chat-text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Ask: is this email spam? / which malware platforms exist?"
            maxLength={4000}
            rows={3}
          />
          <button type="submit" className="butt chatbutt" disabled={!canSend}>
            {busy ? '...' : 'Send'}
          </button>
        </form>
        <p className="chathintline">
          Enter sends, Shift+Enter adds a line. Each answer runs the model the question
          needs, then explains its result.
        </p>
      </div>
    </section>
  )
}



/** Bold and inline-code spans inside one line. */
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <code key={index}>{part.slice(1, -1)}</code>
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

function ToolLog({ tools, rounds }) {
  return (
    <details className="toollog">
      <summary>
        <i className="fa-solid fa-screwdriver-wrench" aria-hidden="true" />{' '}
        {tools.length} tool {tools.length === 1 ? 'call' : 'calls'}
        {rounds ? ` · ${rounds} rounds` : ''}
      </summary>
      {tools.map((call, index) => (
        <div className="toolcall" key={`${call.tool}-${index}`}>
          <p className="toolname">
            {TOOL_LABELS[call.tool] ?? call.tool}
            <code>{call.tool}</code>
          </p>
          <pre>{JSON.stringify(call.result, null, 2)}</pre>
        </div>
      ))}
    </details>
  )
}

/** The answer as a report card: verdict first, then the explanation. */
function AssistantMessage({ message }) {
  const text = message.text || '(no text reply)'
  const shown = useTypewriter(text, message.animate === true)
  const finished = shown.length >= text.length
  const report = parseReport(text, message.tools)

  return (
    <article className="answer">
      <header className="answerhead">
        <span className="answersource">
          <i className="fa-solid fa-robot" aria-hidden="true" /> assistant
        </span>
        {message.tools.length > 0 ? (
          <span className="answertools">
            {message.tools.length} model {message.tools.length === 1 ? 'call' : 'calls'}
          </span>
        ) : null}
      </header>

      {report.verdict ? (
        <VerdictStamp verdict={report.verdict} probability={report.probability} />
      ) : null}

      <div className="answerbody">
        <ChatText text={stripLeadingVerdict(shown, report.verdict)} />
      </div>

      {finished && report.words.length > 0 ? <Evidence words={report.words} /> : null}

      {finished && message.tools.length > 0 ? (
        <ToolLog tools={message.tools} rounds={message.rounds} />
      ) : null}
    </article>
  )
}

/** The verdict word and the probability, from the tool result when there is one. */
const VERDICT_WORDS = ['SPAM', 'HAM', 'MALWARE', 'BENIGN']

/**
 * Drop the sentence the stamp already says.

 * A model almost always opens with "Verdict: SPAM, probability 0.9503", which
 * is exactly the line above it.  Only a leading sentence is removed, and only
 * when it carries no other claim, so the explanation survives intact.
 */

function parseReport(text, tools) {
  // The tool output is the source of truth; the prose is what the model made
  // of it.  A number read from the result cannot drift from the model.
  const scored = (tools || [])
    .map((call) => call.result)
    .filter((result) => result && typeof result.probability === 'number')
  const fromTool = scored.length > 0 ? scored[scored.length - 1] : null

  const match = text.match(/\b(SPAM|HAM|MALWARE|BENIGN)\b/)
  const verdict = fromTool?.verdict ?? (match ? match[1] : null)
  const probability = fromTool?.probability ?? null

  // The words behind a spam score, when the spam model ran.
  const spam = (tools || [])
    .map((call) => call.result)
    .filter((result) => result && Array.isArray(result.suspicious_words))
    .pop()
  const words = spam
    ? [
        ...spam.suspicious_words.slice(0, 6).map((w) => ({ ...w, toward: 'spam' })),
        ...spam.safe_words.slice(0, 4).map((w) => ({ ...w, toward: 'ham' })),
      ]
    : []

  return { verdict: VERDICT_WORDS.includes(verdict) ? verdict : null, probability, words }
}

/** The headline of the answer: the word, the number, and a meter. */
function VerdictStamp({ verdict, probability }) {
  const bad = verdict === 'SPAM' || verdict === 'MALWARE'
  const percent = probability === null ? null : Math.round(probability * 1000) / 10

  return (
    <div className={`stamp ${bad ? 'is-bad' : 'is-good'}`}>
      <p className="stampword">{verdict}</p>
      {percent !== null ? (
        <div className="stampmeter">
          <span className="stamppct">{percent}%</span>
          <span
            className="stampbar"
            role="img"
            aria-label={`model confidence ${percent} percent`}
          >
            <span style={{ width: `${Math.max(2, percent)}%` }} />
          </span>
        </div>
      ) : null}
    </div>
  )
}

/** The words that moved the score, as a compact evidence strip. */
function Evidence({ words }) {
  return (
    <div className="evidence">
      <p className="evidencetitle">What moved the score</p>
      <ul>
        {words.map((word) => (
          <li
            key={`${word.toward}-${word.word}`}
            className={word.toward === 'spam' ? 'toward-spam' : 'toward-ham'}
            title={`weight ${word.weight}`}
          >
            {word.word}
            <span>{word.weight > 0 ? '+' : ''}{word.weight.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChatText({ text }) {
  // The model answers in Markdown. Only bold, inline code, bullets and
  // paragraphs are rendered: those are what it actually uses, and building
  // React elements keeps the reply inert instead of injecting HTML.
  const blocks = []
  let paragraph = []
  let bullets = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'p', lines: paragraph })
      paragraph = []
    }
  }
  const flushBullets = () => {
    if (bullets.length > 0) {
      blocks.push({ kind: 'ul', items: bullets })
      bullets = []
    }
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushParagraph()
      flushBullets()
      continue
    }
    if (/^[-*\u2022]\s+/.test(trimmed)) {
      flushParagraph()
      bullets.push(trimmed.replace(/^[-*\u2022]\s+/, ''))
      continue
    }
    flushBullets()
    paragraph.push(trimmed)
  }
  flushParagraph()
  flushBullets()

  return (
    <>
      {blocks.map((block, index) =>
        block.kind === 'ul' ? (
          <ul className="answerlist" key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="answerp" key={index}>
            <Inline text={block.lines.join(' ')} />
          </p>
        ),
      )}
    </>
  )
}

function stripLeadingVerdict(text, verdict) {
  if (!verdict) return text
  // The sentence ends at a full stop followed by a space, the closing bold
  // marker or the end of the line, so the decimal point in "0.9503" does not
  // cut it in half.
  const sentence = /^\s*\**\s*(?:verdict|result|conclusion)\s*\**\s*[:\u2014-]\s*(.*?)(?:\.(?=\s|\*|$)|\n|$)\s*/i
  const match = text.match(sentence)
  if (!match) return text

  // A closing "**" from a bolded opening line is left behind by the cut.
  const rest = text.slice(match[0].length).replace(/^\s*\*\*\s*/, '')
  if (!rest.trim()) return text

  // Keep the sentence when it says more than the verdict and the number; a
  // caveat like "but it is signed by Microsoft" must not be dropped.
  const FILLER = new Set([
    'verdict', 'result', 'conclusion', 'probability', 'probabilities',
    'confidence', 'score', 'model', 'prediction', 'is', 'the', 'of',
    'at', 'with', 'a', 'an', 'to', 'and', 'percent',
  ])
  const words = match[1]
    .replace(new RegExp('\\b' + verdict + '\\b', 'gi'), ' ')
    .toLowerCase()
    .match(/[a-z]+/g) || []
  const meaningful = words.filter((word) => !FILLER.has(word))
  return meaningful.length > 0 ? text : rest
}
