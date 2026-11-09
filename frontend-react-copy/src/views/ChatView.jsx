// Assistant screen: one chat box over the three ML models.
// Verdicts come from the trained models via tool calls, and the tool log sits
// under each answer. Events stream in (see apiStream).

import { useEffect, useRef, useState } from 'react'
import Alert from '../components/Alert'
import Icon from '../components/Icon'
import PageHead from '../components/PageHead'
import { api } from '../api/client'

// Tool names are function identifiers; people read "Spam check".
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

// What the chat box accepts. The backend decides the real type from the
// bytes; this list only filters the file picker.
const ACCEPT =
  '.pdf,.exe,.dll,.sys,.apk,.txt,.text,.md,.log,.csv,.json,.eml,.html,.htm,' +
  '.png,.jpg,.jpeg,.gif,.bmp,.webp'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const DEFAULT_QUESTION = 'Analyse the attached file.'

// A picture is shown in the message bubble so the conversation keeps a
// preview of what the model saw.
const IMAGE_EXT = /\.(png|jpe?g|gif|bmp|webp)$/i

const EXAMPLES = [
  "Is this message spam? 'WIN a FREE prize now, click the link to claim your reward'",
  'What malware platforms do you support?',
  'Explain how the spam model decides, and what words pushed this one to spam.',
]

let nextId = 1
const newId = () => String(nextId++)

/** Bytes as a human-readable size. */
function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// The reply arrives whole; this only paces how it appears. A short answer
// takes about a second, and a long one is capped so nobody waits on an effect.
const TYPE_MS = 1200
const TYPE_FRAME_MS = 16
const TYPE_MIN_CHARS = 8

/** Reveal `text` letter by letter, once; `enabled` is switched off after the reveal. */
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

  // Which model answers, so the box can show it's connected before the first
  // question. A dead server shows up here, before the first send.
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

  /** Base64, since the bytes travel inside the same JSON body. */
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

    // The history sent is what the user saw: questions and answers. Tool logs
    // aren't replayed, only shown here.
    const history = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.text))
      .map((m) => ({ role: m.role, content: m.text }))

    const question = {
      id: newId(),
      role: 'user',
      text: prompt,
      file: file
        ? {
            name: file.name,
            size: file.size,
            // Object URLs let the bubble show the picture without a second copy
            // of its bytes in state.
            preview: IMAGE_EXT.test(file.name) ? URL.createObjectURL(file) : null,
          }
        : null,
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
    <section className="view chatview">
      <PageHead
        title="Assistant"
        lead="Verdicts come from the trained models, never from the language model alone."
      />
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
          <span className={'health is-' + (online ? 'ok' : 'bad')}>
            <span className="health-dot" aria-hidden="true" />
            {online ? info.model : 'Model server offline'}
          </span>
          {messages.length > 0 ? (
            <button type="button" className="linkbutt" onClick={reset}>
              Clear Conversation
            </button>
          ) : null}
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
                {message.file?.preview ? (
                  <img
                    className="chatimage"
                    src={message.file.preview}
                    alt={`Attached picture: ${message.file.name}`}
                  />
                ) : null}
                {message.file ? (
                  <p className="chatfile">
                    <Icon name="paperclip" size={16} />{' '}
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
                <Icon name="bot" size={16} /> assistant
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
            <Icon name="paperclip" size={16} />{' '}
            {pendingFile.name}
            <span className="attachsize">{formatSize(pendingFile.size)}</span>
            <button
              type="button"
              className="attachremove"
              onClick={() => setPendingFile(null)}
              aria-label={`Remove ${pendingFile.name}`}
            >
              <Icon name="x" size={16} />
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
            <Icon name="paperclip" size={16} />
          </button>
          <label className="visually-hidden" htmlFor="chat-text">
            Message to the assistant
          </label>
          <textarea
            id="chat-text"
            className="field-textarea resize-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Ask a question"
            maxLength={4000}
            rows={3}
          />
          <button type="submit" className="butt chatbutt" disabled={!canSend} aria-busy={busy} aria-label={busy ? "Sending" : "Send"}>
            {busy ? <span className='spinner' aria-hidden='true' /> : <Icon name='arrowUp' size={18} />}
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



/** Bold and inline-code spans in one line. */
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
        <Icon name="terminal" size={16} />{' '}
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
          <Icon name="bot" size={16} /> assistant
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

/** Verdict word and probability, from the tool result when there is one. */
const VERDICT_WORDS = ['SPAM', 'HAM', 'MALWARE', 'BENIGN']

/** Drop the leading sentence that repeats the verdict stamp, if it adds no other claim. */

function parseReport(text, tools) {
  // The tool output is the source of truth; the prose is the model's reading of
  // it. A number taken from the result can't drift from what the model said.
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

/** Headline of the answer: the word, the number and a meter. */
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
      <p className="evidencetitle">What Moved the Score</p>
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
  // paragraphs are rendered, since that's all it uses, and building React
  // elements means no HTML gets injected.
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
  // The sentence ends at a full stop followed by a space, a closing bold
  // marker or the end of the line, so the decimal point in "0.9503" doesn't
  // split it.
  const sentence = /^\s*\**\s*(?:verdict|result|conclusion)\s*\**\s*[:\u2014-]\s*(.*?)(?:\.(?=\s|\*|$)|\n|$)\s*/i
  const match = text.match(sentence)
  if (!match) return text

  // A closing "**" from a bolded opening line is left behind by the cut.
  const rest = text.slice(match[0].length).replace(/^\s*\*\*\s*/, '')
  if (!rest.trim()) return text

  // Keep the sentence if it says more than the verdict and number; a caveat
  // like "but it is signed by Microsoft" must not be dropped.
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
