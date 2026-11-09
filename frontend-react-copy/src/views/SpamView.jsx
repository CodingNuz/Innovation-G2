// Spam check screen: one text box, a Check button and a result panel (POST /api/spam).

import { useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import Alert from '../components/Alert'
import FilePicker from '../components/FilePicker'
import PageHead from '../components/PageHead'
import { ReportPanel, Verdict } from '../components/Report'
import { api } from '../api/client'
import { axisOptions, baseOptions, palette } from '../charts/setup'

const EXAMPLES = {
  spam: 'WIN a FREE prize now, click the link to claim your reward today',
  ham: 'Are we still meeting for lunch tomorrow at the office?',
}

export default function SpamView({onPrediction}) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)

  const trimmed = text.trim()
  const canCheck = (trimmed.length > 0 || file !== null) && !busy

  async function check(event) {
    event?.preventDefault()
    if (!canCheck) return

    setBusy(true)
    setError(null)
    try {
      let reply
      if (!file) {
        reply = await api.spam(trimmed)
      } else {
        reply = (await api.scanUpload([file])).files[0]
        if (reply.error) throw new Error(reply.error)
        if (reply.kind !== 'spam') {
          throw new Error(
            `${file.name} is a ${reply.file_type === 'pe' ? 'Windows PE' : 'Android APK'} file; check it in the Malware tab.`,
          )
        }
      }
      setResult(reply)
      // Record the successful prediction in the shared history.
      onPrediction?.({
        model: 'spam',
        verdict: reply.verdict,
        probability: reply.probability,
        inputType: file ? 'PDF' : 'Text',
        inputSummary: file ? file.name : trimmed.slice(0, 120),
      })
    } catch (apiError) {
      setResult(null)
      setError(apiError.message)
    } finally {
      setBusy(false)
    }
  }

  // This message's words with their push, split by direction. The backend
  // already sorts them by absolute size.
  const chartData = useMemo(() => {
    if (!result) return null
    const rows = [
      ...result.suspicious_words.map((w) => ({ word: w.word, weight: w.weight })),
      ...result.safe_words.map((w) => ({ word: w.word, weight: w.weight })),
    ].sort((a, b) => b.weight - a.weight)

    return {
      labels: rows.map((r) => r.word),
      datasets: [
        {
          label: 'Push toward spam',
          data: rows.map((r) => (r.weight > 0 ? r.weight : 0)),
          backgroundColor: rows.map((r) => (r.weight > 0 ? palette.threat : 'transparent')),
          borderRadius: 6,
        },
        {
          label: 'Push toward ham',
          data: rows.map((r) => (r.weight < 0 ? r.weight : 0)),
          backgroundColor: rows.map((r) => (r.weight < 0 ? palette.safe : 'transparent')),
          borderRadius: 6,
        },
      ],
    }
  }, [result])

  const chartOptions = {
    ...baseOptions,
    indexAxis: 'y',
    scales: {
      x: {
        ...axisOptions,
        title: { display: true, text: 'Contribution to the score', color: palette.ink },
      },
      y: { ...axisOptions, grid: { display: false } },
    },
    plugins: {
      ...baseOptions.plugins,
      // The bars use a transparent colour where a word is on the other side, so the
      // default legend swatch would be blank. Draw explicit swatches instead.
      legend: {
        ...baseOptions.plugins.legend,
        labels: {
          ...baseOptions.plugins.legend.labels,
          generateLabels: () => [
            { text: 'Push toward spam', fillStyle: palette.threat, strokeStyle: palette.threat, fontColor: palette.mute, borderRadius: 3, datasetIndex: 0 },
            { text: 'Push toward ham', fillStyle: palette.safe, strokeStyle: palette.safe, fontColor: palette.mute, borderRadius: 3, datasetIndex: 1 },
          ],
        },
      },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (item) => `weight ${item.raw.toFixed(3)}`,
        },
      },
    },
  }

  const isSpam = result?.verdict === 'SPAM'

  // How this message's words split between the two directions.
  const splitData = useMemo(() => {
    if (!result) return null
    const up = result.suspicious_words.length
    const down = result.safe_words.length
    return {
      labels: ['Toward spam', 'Toward ham'],
      datasets: [
        {
          data: [up, down],
          backgroundColor: [palette.threat, palette.safe],
          borderWidth: 0,
        },
      ],
    }
  }, [result])

  const splitOptions = {
    ...baseOptions,
    cutout: '62%',
    plugins: {
      ...baseOptions.plugins,
      legend: {
        ...baseOptions.plugins.legend,
        position: 'bottom',
      },
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (item) => `${item.label}: ${item.raw} word${item.raw === 1 ? '' : 's'}`,
        },
      },
    },
  }

  return (
    <section className="view">
      <PageHead
        title="Spam"
        lead="Paste an email or text message, or upload an email as a PDF. The model scores it and shows which words moved the score."
      />

      <div className="workbench">
        <form className="panel detector" onSubmit={check} noValidate>
          <div className="field">
            <label className="fieldlabel" htmlFor="spam-input">
              Message to check
            </label>
            <textarea
              id="spam-input"
              className="field-textarea tall resize-none"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="Insert your email or text message in here..."
              maxLength={20000}
              rows={9}
              aria-describedby="spam-count"
            />
            <p className="field-foot" id="spam-count">
              <span className="tag">Enter checks · Shift+Enter adds a line</span>
              <span className="tag">{text.length.toLocaleString()} / 20,000</span>
            </p>
          </div>

          <div className="field">
            <span className="fieldlabel">Or upload an email as a PDF</span>
            <FilePicker
              id="spam-pdf"
              accept=".pdf,application/pdf"
              file={file}
              onChange={setFile}
              disabled={busy}
              prompt="Drop a PDF here or choose one"
              hint="The text is extracted and scored like a pasted message."
            />
          </div>

          <div className="examples">
            <span className="tag">Try an Example</span>
            <button type="button" className="chipbutt" onClick={() => setText(EXAMPLES.spam)}>
              Spam Message
            </button>
            <button type="button" className="chipbutt" onClick={() => setText(EXAMPLES.ham)}>
              Ham Message
            </button>
          </div>

          {error ? <Alert kind="error">{error}</Alert> : null}

          <div className="actions">
            <button type="submit" className="butt butt-wide" disabled={!canCheck} aria-busy={busy}>
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Checking
                </>
              ) : (
                'Check'
              )}
            </button>
          </div>
        </form>

        <ReportPanel
          result={result}
          title="Spam Result"
          emptyText="Check a message and the verdict, its probability and the words behind it appear here."
          onDismiss={() => setResult(null)}
        >
          {result ? (
            <>
              <Verdict
                word={isSpam ? 'Spam' : 'Ham'}
                tone={isSpam ? 'bad' : 'good'}
                sub={isSpam ? 'Looks like unwanted mail' : 'Looks like a normal message'}
                value={result.probability}
                ringLabel="probability of spam"
              />

              <section className="evidence-block">
                <h3 className="sectiontitle">Suspicious Words</h3>
                {result.suspicious_words.length > 0 ? (
                  <ul className="wordlist">
                    {result.suspicious_words.map((item) => (
                      <li className="word is-spam" key={'s-' + item.word}>
                        {item.word} <span className="weight">+{item.weight.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No word pushed the score toward spam.</p>
                )}

                {result.safe_words.length > 0 ? (
                  <>
                    <h3 className="sectiontitle">Safe Words</h3>
                    <ul className="wordlist">
                      {result.safe_words.map((item) => (
                        <li className="word is-ham" key={'h-' + item.word}>
                          {item.word} <span className="weight">{item.weight.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>

              {chartData ? (
                <div className="chartbox">
                  <h3 className="sectiontitle">What Moved the Score</h3>
                  <div className="chartarea">
                    <Bar
                      data={chartData}
                      options={chartOptions}
                      role="img"
                      aria-label="Bar chart of each word's contribution to the score. The same words are listed above."
                    />
                  </div>
                </div>
              ) : null}

              {splitData ? (
                <div className="chartbox">
                  <h3 className="sectiontitle">Words in This Message</h3>
                  <div className="chartarea chartarea-square">
                    <Doughnut
                      data={splitData}
                      options={splitOptions}
                      role="img"
                      aria-label={
                        'Doughnut chart: ' +
                        result.suspicious_words.length +
                        ' words toward spam, ' +
                        result.safe_words.length +
                        ' words toward ham'
                      }
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </ReportPanel>
      </div>
    </section>
  )
}

