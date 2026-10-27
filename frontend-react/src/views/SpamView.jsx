// The spam check screen.
//
// It keeps the shape of the original SpamChameleon page (one text box, one
// Check button, a result panel beside it) and fills the panel with the answer
// of POST /api/spam: the verdict, the probability behind it, and the words
// that pushed the score up or down.

import { useMemo, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import Alert from '../components/Alert'
import GaugeChart from '../components/GaugeChart'
import { api } from '../api/client'
import { axisOptions, baseOptions, palette } from '../charts/setup'

const EXAMPLES = {
  spam: 'WIN a FREE prize now, click the link to claim your reward today',
  ham: 'Are we still meeting for lunch tomorrow at the office?',
}

export default function SpamView() {
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
      const reply = file
        ? await api.spamUpload(file)
        : await api.spam(trimmed)
      setResult(reply)
    } catch (apiError) {
      setResult(null)
      setError(apiError.message)
    } finally {
      setBusy(false)
    }
  }

  // The words of this message with their push, split by the direction they
  // pushed the score. The backend already sorts them by absolute size.
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
          backgroundColor: rows.map((r) => (r.weight > 0 ? palette.spam : 'transparent')),
          borderRadius: 6,
        },
        {
          label: 'Push toward ham',
          data: rows.map((r) => (r.weight < 0 ? r.weight : 0)),
          backgroundColor: rows.map((r) => (r.weight < 0 ? palette.ham : 'transparent')),
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
        title: { display: true, text: 'Contribution to the score', color: palette.dark },
      },
      y: { ...axisOptions, grid: { display: false } },
    },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (item) => `weight ${item.raw.toFixed(3)}`,
        },
      },
    },
  }

  const isSpam = result?.verdict === 'SPAM'
  const gaugeColor = isSpam ? palette.spam : palette.ham

  // How the words of this message split between the two directions.
  const splitData = useMemo(() => {
    if (!result) return null
    const up = result.suspicious_words.length
    const down = result.safe_words.length
    return {
      labels: ['Toward spam', 'Toward ham'],
      datasets: [
        {
          data: [up, down],
          backgroundColor: [palette.spam, palette.ham],
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
    <section className={`view ${result ? 'has-result' : ''}`}>
      <form className="panel detector" onSubmit={check}>
        <h1 className="detitle">SPAM or HAM ?</h1>

        <div className="inputbox">
          <label className="visually-hidden" htmlFor="spam-input">
            Message to check
          </label>
          <textarea
            id="spam-input"
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
          />
          <button type="submit" className="butt checkbutt" disabled={!canCheck}>
            {busy ? '...' : 'Check'}
          </button>
        </div>

        <div className="pdf-upload">
          <label htmlFor="spam-pdf">Upload email as a PDF:</label>
          <input
            id="spam-pdf" type="file" accept=".pdf,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="examples">
          <span>Try an example:</span>
          <button type="button" className="linkbutt" onClick={() => setText(EXAMPLES.spam)}>
            spam
          </button>
          <button type="button" className="linkbutt" onClick={() => setText(EXAMPLES.ham)}>
            ham
          </button>
          {text.length > 0 ? (
            <span className="charcount">{text.length} characters</span>
          ) : null}
        </div>

        {error ? <Alert kind="error">{error}</Alert> : null}
      </form>

      {result ? (
        <aside className="panel sidepanel">
          <div>
            <h2 className="resulttitle">
              <span id="resulttext" style={{ color: gaugeColor }}>
                IT IS A {result.verdict}
              </span>
              <i
                className={`fa-solid fa-flag result-flag${isSpam ? '' : ' is-ham'}`}
                aria-hidden="true"
              />
            </h2>

            <GaugeChart
              value={result.probability}
              color={gaugeColor}
              caption={`probability of ${result.verdict}`}
            />

            <p className="sus">SUS words:</p>
            {result.suspicious_words.length > 0 ? (
              <ul className="suslist">
                {result.suspicious_words.map((item) => (
                  <li key={`s-${item.word}`}>
                    {item.word} <span className="weight">+{item.weight.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="suslist">
                <li className="no-words">No word pushed the score toward spam.</li>
              </ul>
            )}

            {result.safe_words.length > 0 ? (
              <>
                <p className="sus">SAFE words:</p>
                <ul className="suslist">
                  {result.safe_words.map((item) => (
                    <li key={`h-${item.word}`}>
                      {item.word} <span className="weight safe">{item.weight.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {chartData ? (
              <div className="chartbox">
                <h3 className="charttitle">What moved the score</h3>
                <div className="chartarea">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              </div>
            ) : null}

            {splitData ? (
              <div className="chartbox">
                <h3 className="charttitle">Words in this message</h3>
                <div className="chartarea chartarea-square">
                  <Doughnut data={splitData} options={splitOptions} />
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="butt closebutt"
            onClick={() => setResult(null)}
          >
            Close
          </button>
        </aside>
      ) : null}
    </section>
  )
}
