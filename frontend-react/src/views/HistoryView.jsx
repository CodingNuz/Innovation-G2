// The History dashboard: summary cards, filters, three charts, the list of
// individual predictions, and the export / clear actions.
//
// The history itself lives in App.jsx. This component only reads it through
// props and never keeps a second copy, so a new prediction shows up here
// without any extra wiring.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { axisOptions, baseOptions, palette } from '../charts/setup'
import { useCountUp } from '../motion.jsx'
import { useWidgetGrid } from '../useWidgetGrid'
import '../WidgetGrid.css'
import '../History.css'

/* ------------------------------------------------------------------ */
/* constants                                                           */
/* ------------------------------------------------------------------ */

const MODELS = {
  spam: { label: 'Spam', fullName: 'Spam model', icon: 'fa-solid fa-envelope' },
  malware: { label: 'Malware', fullName: 'Malware model', icon: 'fa-solid fa-bug' },
  process: { label: 'Process', fullName: 'Process model', icon: 'fa-solid fa-microchip' },
}
const MODEL_KEYS = Object.keys(MODELS)

// Verdicts that count as "something was detected".
const THREAT_VERDICTS = new Set(['spam', 'malware'])
const CLEAR_VERDICTS = new Set(['ham', 'benign'])
const VERDICT_ORDER = ['spam', 'ham', 'malware', 'benign']
const VERDICT_LABELS = { spam: 'Spam', ham: 'Ham', malware: 'Malware', benign: 'Benign' }

// Doughnut segments: one per model and verdict, in a fixed order.
const SEGMENT_ORDER = ['spam:spam', 'spam:ham', 'malware:malware', 'malware:benign']
const SEGMENT_COLORS = {
  'spam:spam': palette.spam,
  'spam:ham': palette.ham,
  'malware:malware': palette.dark,
  'malware:benign': palette.yellow,
}

const PAGE_SIZE = 20
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const DEFAULT_FILTERS = { model: 'all', verdict: 'all', from: '', to: '' }
const CSV_FILENAME = 'spamchameleon-history.csv'

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
})
const BUCKET_FORMATS = {
  minute: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }),
  hour: new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
  day: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }),
  month: new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }),
}

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0')

/** Local calendar day as YYYY-MM-DD, the same format a date input uses. */
function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** A probability becomes a percentage. Values in 0..1 are scaled, 1..100 are
 * taken as already being percentages, anything else is treated as missing. */
function toPercent(value) {
  const number = toNumber(value)
  if (number === null || number < 0 || number > 100) return null
  return number <= 1 ? number * 100 : number
}

function formatPercent(percent) {
  return percent === null ? '—' : `${percent.toFixed(1)}%`
}

function formatNumber(number) {
  return number === null || !Number.isFinite(number)
    ? '—'
    : number.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatDateTime(date) {
  return date ? dateTimeFormat.format(date) : 'Unknown date'
}

/** Any stored value as plain text; empty string when there is nothing. */
function formatValue(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value).trim()
}

function normaliseVerdict(value) {
  if (typeof value !== 'string') return 'unknown'
  const key = value.trim().toLowerCase()
  return key || 'unknown'
}

function verdictLabel(key) {
  if (VERDICT_LABELS[key]) return VERDICT_LABELS[key]
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function verdictTone(key) {
  if (THREAT_VERDICTS.has(key)) return 'bad'
  if (CLEAR_VERDICTS.has(key)) return 'good'
  return 'neutral'
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** One raw record becomes a row the component can filter and sort safely.
 * Entries that are not objects, or whose model is unknown, are skipped. */
function normaliseRecord(record, index) {
  if (!record || typeof record !== 'object') return null
  const model = typeof record.model === 'string' ? record.model.trim().toLowerCase() : ''
  if (!MODELS[model]) return null

  const date = parseDate(record.createdAt)
  const isClassification = model !== 'process'
  return {
    key: `${record.id ?? 'row'}-${index}`,
    index,
    raw: record,
    model,
    date,
    time: date ? date.getTime() : null,
    isClassification,
    verdict: isClassification ? normaliseVerdict(record.verdict) : null,
    probability: isClassification ? toPercent(record.probability) : null,
    value: isClassification ? null : toNumber(record.prediction),
  }
}

/** Newest first. Rows with no valid date go last; equal timestamps fall back
 * to the order they were added in. */
function newestFirst(a, b) {
  if (a.time === null && b.time === null) return b.index - a.index
  if (a.time === null) return 1
  if (b.time === null) return -1
  return b.time - a.time || b.index - a.index
}

/* ------------------------------------------------------------------ */
/* activity over time                                                  */
/* ------------------------------------------------------------------ */

function floorTo(date, unit) {
  const copy = new Date(date.getTime())
  if (unit === 'minute') copy.setSeconds(0, 0)
  else if (unit === 'hour') copy.setMinutes(0, 0, 0)
  else if (unit === 'day') copy.setHours(0, 0, 0, 0)
  else {
    copy.setDate(1)
    copy.setHours(0, 0, 0, 0)
  }
  return copy
}

function nextBucket(date, unit) {
  if (unit === 'minute') return new Date(date.getTime() + MINUTE)
  if (unit === 'hour') return new Date(date.getTime() + HOUR)
  if (unit === 'day') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return new Date(date.getFullYear(), date.getMonth() + 1, 1)
}

/** Counts per time bucket. The bucket size follows how long the history
 * spans, and buckets with no predictions are kept as zeros so a quiet period
 * shows as a dip instead of being skipped. */
function buildActivity(rows) {
  const times = rows.filter((row) => row.time !== null).map((row) => row.time)
  if (times.length === 0) return null

  let min = times[0]
  let max = times[0]
  for (const t of times) {
    if (t < min) min = t
    if (t > max) max = t
  }
  const span = max - min
  let unit = 'month'
  if (span <= 3 * HOUR) unit = 'minute'
  else if (span <= 48 * HOUR) unit = 'hour'
  else if (span <= 90 * DAY) unit = 'day'

  const counts = new Map()
  for (const t of times) {
    const key = floorTo(new Date(t), unit).getTime()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const labels = []
  const values = []
  const last = floorTo(new Date(max), unit).getTime()
  let cursor = floorTo(new Date(min), unit)
  // The cap is only a safety net; the unit choice keeps this well below it.
  while (cursor.getTime() <= last && labels.length < 500) {
    labels.push(BUCKET_FORMATS[unit].format(cursor))
    values.push(counts.get(cursor.getTime()) ?? 0)
    cursor = nextBucket(cursor, unit)
  }
  return { labels, values, unit, skipped: rows.length - times.length }
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

const CSV_COLUMNS = [
  ['ID', (row) => row.raw.id],
  ['Date (ISO)', (row) => (row.date ? row.date.toISOString() : '')],
  ['Model', (row) => MODELS[row.model].label],
  ['Verdict', (row) => (row.verdict ? verdictLabel(row.verdict) : '')],
  ['Probability (%)', (row) => (row.probability === null ? '' : Number(row.probability.toFixed(2)))],
  ['Predicted value', (row) => row.value],
  ['Target', (row) => row.raw.target],
  ['Platform', (row) => row.raw.platform],
  ['Input type', (row) => row.raw.inputType],
  ['Input summary', (row) => row.raw.inputSummary],
  ['SHA-256', (row) => row.raw.sha256],
  ['Models used', (row) => row.raw.modelCount],
  ['Process model', (row) => row.raw.modelName],
  ['Features given', (row) => row.raw.featuresGiven],
  ['Features imputed', (row) => row.raw.featuresImputed],
  ['Clipped', (row) => row.raw.clipped],
]

function csvCell(value) {
  let text
  if (typeof value === 'number') {
    text = Number.isFinite(value) ? String(value) : ''
  } else {
    text = formatValue(value)
    // Text that starts with = + - @ would be run as a formula by a
    // spreadsheet, so it is prefixed with an apostrophe.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  }
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function buildCsv(rows) {
  const lines = [CSV_COLUMNS.map(([title]) => csvCell(title)).join(',')]
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map(([, read]) => csvCell(read(row))).join(','))
  }
  return lines.join('\r\n')
}

function downloadCsv(rows) {
  // The byte order mark makes Excel read the file as UTF-8.
  const blob = new Blob(['\uFEFF', buildCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = CSV_FILENAME
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/* ------------------------------------------------------------------ */
/* chart options                                                       */
/* ------------------------------------------------------------------ */

const doughnutOptions = {
  ...baseOptions,
  cutout: '58%',
  plugins: {
    ...baseOptions.plugins,
    legend: {
      ...baseOptions.plugins.legend,
      position: 'bottom',
      labels: { ...baseOptions.plugins.legend.labels, boxWidth: 14, padding: 12 },
    },
    tooltip: {
      ...baseOptions.plugins.tooltip,
      callbacks: {
        label: (context) => {
          const total = context.dataset.data.reduce((sum, n) => sum + n, 0)
          const share = total ? Math.round((context.parsed / total) * 100) : 0
          return ` ${context.label}: ${context.parsed} (${share}%)`
        },
      },
    },
  },
}

const barOptions = {
  ...baseOptions,
  plugins: {
    ...baseOptions.plugins,
    legend: { display: false },
    tooltip: {
      ...baseOptions.plugins.tooltip,
      callbacks: { label: (context) => ` ${plural(context.parsed.y, 'prediction')}` },
    },
  },
  scales: {
    x: { ...axisOptions, grid: { display: false } },
    y: { ...axisOptions, beginAtZero: true, ticks: { ...axisOptions.ticks, precision: 0 } },
  },
}

const lineOptions = {
  ...baseOptions,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    ...baseOptions.plugins,
    legend: { display: false },
    tooltip: {
      ...baseOptions.plugins.tooltip,
      callbacks: { label: (context) => ` ${plural(context.parsed.y, 'prediction')}` },
    },
  },
  scales: {
    x: {
      ...axisOptions,
      grid: { display: false },
      ticks: { ...axisOptions.ticks, maxTicksLimit: 8, maxRotation: 0 },
    },
    y: { ...axisOptions, beginAtZero: true, ticks: { ...axisOptions.ticks, precision: 0 } },
  },
}

/* ------------------------------------------------------------------ */
/* detail rows                                                         */
/* ------------------------------------------------------------------ */

/** The label/value pairs shown when a row is opened. Empty values are left
 * out, so each kind of prediction only shows what it actually has. */
function detailFields(row) {
  const record = row.raw
  const fields = [
    ['Prediction ID', record.id],
    ['Date & time', formatDateTime(row.date)],
    ['Model', MODELS[row.model].label],
    ['Input type', record.inputType],
  ]
  if (row.isClassification) {
    fields.push(
      ['Verdict', verdictLabel(row.verdict)],
      ['Probability', row.probability === null ? '' : formatPercent(row.probability)],
      ['Platform', record.platform],
      ['Models used', record.modelCount],
      ['SHA-256', record.sha256],
    )
  } else {
    fields.push(
      ['Predicted value', row.value === null ? '' : formatNumber(row.value)],
      ['Target', record.target],
      ['Regression model', record.modelName],
      ['Features given', record.featuresGiven],
      ['Features imputed', record.featuresImputed],
      ['Values clipped', record.clipped],
    )
  }
  fields.push(['Input summary', record.inputSummary])
  return fields
    .map(([label, value]) => [label, formatValue(value)])
    .filter(([, text]) => text !== '')
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function ChartCard({ id, title, size, note, children, onPointerDown, onResize, refade }) {
  return (
    <section
      className={`history-widget history-chart-card reveal size-${size}${refade ? ' refade' : ''}`}
      data-widget={id}
    >
      <div className="w-head" onPointerDown={(event) => onPointerDown(event, id)}>
        <h3 className="w-title history-chart-title">{title}</h3>
        <div className="w-tools">
          <button
            type="button"
            className="w-size"
            onClick={() => onResize(id)}
            aria-label={`Resize ${title} widget`}
            title="Change widget size"
          >
            ⤢
          </button>
        </div>
      </div>
      <div className="history-chart-area">{children}</div>
      {note ? <p className="history-chart-note">{note}</p> : null}
    </section>
  )
}

function ModelBadge({ model }) {
  const info = MODELS[model]
  return (
    <span className={'history-badge is-' + (model === 'process' ? 'neutral' : 'spam')}>
      <i className={info.icon} aria-hidden="true" />
      {info.label}
    </span>
  )
}

function ResultCell({ row }) {
  if (row.isClassification) {
    return (
      <>
        <span className={`history-verdict is-${verdictTone(row.verdict)}`}>
          {verdictLabel(row.verdict)}
        </span>
        {row.raw.platform ? (
          <span className="history-cell-sub">{formatValue(row.raw.platform)}</span>
        ) : null}
      </>
    )
  }
  return (
    <>
      <span className="history-verdict">{formatNumber(row.value)}</span>
      <span className="history-cell-sub">
        {row.raw.target ? `${formatValue(row.raw.target)} (predicted)` : 'predicted value'}
      </span>
    </>
  )
}

function InputCell({ row }) {
  const record = row.raw
  const sha = formatValue(record.sha256)
  const kind = [formatValue(record.inputType), sha ? `${sha.slice(0, 8)}…` : '']
    .filter(Boolean)
    .join(' · ')
  const summary = formatValue(record.inputSummary)
  return (
    <>
      <span className="history-cell-sub history-cell-kind">{kind || 'Unknown input'}</span>
      <span className="history-summary" title={summary || undefined}>
        {summary || '—'}
      </span>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* the dashboard                                                       */
/* ------------------------------------------------------------------ */

export default function HistoryView({ history, onClearHistory }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [dateError, setDateError] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [expandedKey, setExpandedKey] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef(null)
  const [refadeId, setRefadeId] = useState(null)
  const { layout, gridRef, draggingId, onPointerDown, cycleSize, resetLayout } = useWidgetGrid()

  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  const records = useMemo(
    () => (Array.isArray(history) ? history.map(normaliseRecord).filter(Boolean) : []),
    [history],
  )
  const sorted = useMemo(() => [...records].sort(newestFirst), [records])

  // Verdicts that really occur, limited to the chosen model.
  const verdictOptions = useMemo(() => {
    const found = new Set()
    for (const row of sorted) {
      if (!row.isClassification) continue
      if (filters.model !== 'all' && row.model !== filters.model) continue
      found.add(row.verdict)
    }
    return [...found].sort((a, b) => {
      const ia = VERDICT_ORDER.indexOf(a)
      const ib = VERDICT_ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
    })
  }, [sorted, filters.model])

  // A chosen verdict that no longer exists falls back to "all"; process
  // predictions have no verdict, so the filter does not apply to them.
  const activeVerdict =
    filters.model === 'process' || !verdictOptions.includes(filters.verdict)
      ? 'all'
      : filters.verdict

  const filtered = useMemo(
    () =>
      sorted.filter((row) => {
        if (filters.model !== 'all' && row.model !== filters.model) return false
        if (activeVerdict !== 'all' && (!row.isClassification || row.verdict !== activeVerdict)) {
          return false
        }
        if (filters.from || filters.to) {
          if (!row.date) return false
          const day = toDateKey(row.date)
          if (filters.from && day < filters.from) return false
          if (filters.to && day > filters.to) return false
        }
        return true
      }),
    [sorted, filters.model, filters.from, filters.to, activeVerdict],
  )

  const stats = useMemo(() => {
    const perModel = { spam: 0, malware: 0, process: 0 }
    let flagged = 0
    for (const row of filtered) {
      perModel[row.model] += 1
      if (row.isClassification && THREAT_VERDICTS.has(row.verdict)) flagged += 1
    }
    return {
      total: filtered.length,
      perModel,
      detection: perModel.spam + perModel.malware,
      flagged,
    }
  }, [filtered])

  const totalRef = useCountUp(stats.total)
  const detectionRef = useCountUp(stats.detection)

  const doughnut = useMemo(() => {
    const groups = new Map()
    for (const row of filtered) {
      if (!row.isClassification) continue
      const key = `${row.model}:${row.verdict}`
      groups.set(key, (groups.get(key) ?? 0) + 1)
    }
    const order = (key) => {
      const i = SEGMENT_ORDER.indexOf(key)
      return i === -1 ? 99 : i
    }
    const keys = [...groups.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    const labels = keys.map((key) => {
      const [model, verdict] = key.split(':')
      return `${MODELS[model].fullName} – ${verdictLabel(verdict)}`
    })
    return {
      labels,
      total: keys.reduce((sum, key) => sum + groups.get(key), 0),
      data: {
        labels,
        datasets: [
          {
            data: keys.map((key) => groups.get(key)),
            backgroundColor: keys.map((key) => SEGMENT_COLORS[key] ?? palette.muted),
            borderColor: '#fff',
            borderWidth: 2,
          },
        ],
      },
    }
  }, [filtered])

  const barData = useMemo(
    () => ({
      labels: MODEL_KEYS.map((key) => MODELS[key].label),
      datasets: [
        {
          data: MODEL_KEYS.map((key) => stats.perModel[key]),
          backgroundColor: [palette.yellow, palette.dark, palette.blue],
          borderColor: palette.dark,
          borderWidth: 2,
          borderRadius: 10,
          maxBarThickness: 64,
        },
      ],
    }),
    [stats],
  )

  const activity = useMemo(() => buildActivity(filtered), [filtered])
  const lineData = useMemo(
    () =>
      activity && {
        labels: activity.labels,
        datasets: [
          {
            label: 'Predictions',
            data: activity.values,
            borderColor: palette.dark,
            backgroundColor: 'rgba(0, 113, 227, 0.22)',
            pointBackgroundColor: palette.yellow,
            pointBorderColor: palette.dark,
            pointRadius: activity.values.length > 60 ? 0 : 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
          },
        ],
      },
    [activity],
  )

  /* ----- actions ----- */

  const updateFilters = (patch) => {
    setFilters((current) => ({ ...current, ...patch }))
    setLimit(PAGE_SIZE)
    setExpandedKey(null)
  }

  const handleFrom = (event) => {
    const value = event.target.value
    if (value && filters.to && value > filters.to) {
      setDateError('The start date cannot be after the end date.')
      return
    }
    setDateError('')
    updateFilters({ from: value })
  }

  const handleTo = (event) => {
    const value = event.target.value
    if (value && filters.from && value < filters.from) {
      setDateError('The end date cannot be earlier than the start date.')
      return
    }
    setDateError('')
    updateFilters({ to: value })
  }

  const resetFilters = () => {
    setDateError('')
    updateFilters(DEFAULT_FILTERS)
  }

  const confirmClear = () => {
    setConfirming(false)
    setFilters(DEFAULT_FILTERS)
    setDateError('')
    setLimit(PAGE_SIZE)
    setExpandedKey(null)
    if (typeof onClearHistory === 'function') onClearHistory()
  }

  const filtersActive =
    filters.model !== 'all' || activeVerdict !== 'all' || filters.from !== '' || filters.to !== ''
  const visibleRows = filtered.slice(0, limit)

  const heading = (
    <header className="history-header">
      <h2 id="history-title" className="history-title">
        HISTORY
      </h2>
    </header>
  )

  /* ----- nothing recorded yet ----- */

  if (records.length === 0) {
    return (
      <section className="history-view" aria-labelledby="history-title">
        {heading}
        <div className="history-inner">
          <div className="history-empty">
            <i className="fa-solid fa-clock-rotate-left history-empty-icon" aria-hidden="true" />
            <h3>No prediction history yet</h3>
            <p>
              Every successful prediction from the Spam or HAM, Malware and Process tabs is
              collected here for the current session.
            </p>
            <p>Run a prediction in the Spam, Malware or Process tab, then come back to see your charts and table.</p>
          </div>
        </div>
      </section>
    )
  }

  /* ----- the dashboard ----- */

  return (
    <section className="history-view" aria-labelledby="history-title">
      {heading}

      <div className="history-inner">
        {/* Summary statistics */}
        <div className="history-stats" role="group" aria-label="Summary statistics">
          <article className="history-stat-card reveal">
            <div>
              <h3 className="history-stat-label">Total predictions</h3>
              <p className="history-stat-value" ref={totalRef}>{stats.total}</p>
              <p className="history-stat-note">
                {stats.total === records.length
                  ? 'All predictions this session'
                  : `Matching filters, of ${records.length} this session`}
              </p>
            </div>
            <i className="fa-solid fa-boxes-stacked history-stat-icon" aria-hidden="true" />
          </article>

          <article className="history-stat-card reveal delay-1">
            <div>
              <h3 className="history-stat-label">Detection results</h3>
              <p className="history-stat-value" ref={detectionRef}>{stats.detection}</p>
              <p className="history-stat-note">
                {stats.detection === 0
                  ? 'No spam or malware predictions here'
                  : `${stats.flagged} flagged as spam or malware`}
              </p>
            </div>
            <i className="fa-regular fa-circle-check history-stat-icon" aria-hidden="true" />
          </article>

          <ul className="history-model-counts" aria-label="Predictions per model">
            {MODEL_KEYS.map((key) => (
              <li key={key}>
                <i className={MODELS[key].icon} aria-hidden="true" />
                <span>{MODELS[key].label}</span>
                <strong>{stats.perModel[key]}</strong>
              </li>
            ))}
          </ul>
        </div>

        {/* Filters */}
        <form
          className="history-filters reveal"
          aria-label="Filter prediction history"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="history-field">
            <label htmlFor="history-model">Model</label>
            <select
              id="history-model"
              className="select"
              value={filters.model}
              onChange={(event) => updateFilters({ model: event.target.value, verdict: 'all' })}
            >
              <option value="all">All models</option>
              {MODEL_KEYS.map((key) => (
                <option key={key} value={key}>
                  {MODELS[key].label}
                </option>
              ))}
            </select>
          </div>

          <div className="history-field">
            <label htmlFor="history-verdict">Verdict</label>
            <select
              id="history-verdict"
              className="select"
              value={activeVerdict}
              disabled={filters.model === 'process'}
              onChange={(event) => updateFilters({ verdict: event.target.value })}
            >
              <option value="all">
                {filters.model === 'process' ? 'Not applicable' : 'All verdicts'}
              </option>
              {verdictOptions.map((key) => (
                <option key={key} value={key}>
                  {verdictLabel(key)}
                </option>
              ))}
            </select>
          </div>

          <div className="history-field">
            <label htmlFor="history-from">From</label>
            <input
              id="history-from"
              className="textinput"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={handleFrom}
            />
          </div>

          <div className="history-field">
            <label htmlFor="history-to">To</label>
            <input
              id="history-to"
              className="textinput"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={handleTo}
            />
          </div>

          <div className="history-filter-foot">
            <p className="history-count" aria-live="polite">
              Showing {filtered.length} of {records.length}{' '}
              {records.length === 1 ? 'prediction' : 'predictions'}
            </p>
            <button
              type="button"
              className="linkbutt"
              onClick={resetFilters}
              disabled={!filtersActive && !dateError}
            >
              Reset filters
            </button>
          </div>

          {dateError ? (
            <div className="alert alert-error history-alert" role="alert">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>{dateError}</span>
            </div>
          ) : null}
        </form>

        {filtered.length === 0 ? (
          <div className="history-empty">
            <i className="fa-solid fa-filter-circle-xmark history-empty-icon" aria-hidden="true" />
            <h3>No predictions match these filters</h3>
            <p>Try a different model, verdict or date range, or reset the filters below.</p>
            <button type="button" className="butt history-btn" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        ) : (
          <>
            {/* Charts: draggable / resizable widgets */}
            <div className="history-toolbar reveal">
              <span className="history-toolbar-hint">Drag a chart by its title to reorder; use ⤢ to resize.</span>
              <button type="button" className="linkbutt" onClick={resetLayout}>
                Reset layout
              </button>
            </div>
            <div className="history-widgets" id="history-widgets" ref={gridRef}>
              {layout.map((item) => {
                const common = {
                  id: item.id,
                  size: item.size,
                  onPointerDown,
                  onResize: (id) => {
                    cycleSize(id)
                    setRefadeId(id)
                    setTimeout(() => setRefadeId(null), 380)
                  },
                  refade: refadeId === item.id && draggingId === null,
                }
                if (item.id === 'verdicts') {
                  return (
                    <ChartCard
                      key={item.id}
                      {...common}
                      title="Verdict distribution"
                      note="Spam and malware classifications only. Process predictions are numbers, not verdicts."
                    >
                      {doughnut.total > 0 ? (
                        <Doughnut
                          data={doughnut.data}
                          options={doughnutOptions}
                          role="img"
                          aria-label={`Doughnut chart of verdicts: ${doughnut.labels.join(', ')}`}
                        />
                      ) : (
                        <p className="history-chart-empty">
                          No spam or malware predictions in this selection.
                        </p>
                      )}
                    </ChartCard>
                  )
                }
                if (item.id === 'by-model') {
                  return (
                    <ChartCard key={item.id} {...common} title="Predictions by model">
                      <Bar
                        data={barData}
                        options={barOptions}
                        role="img"
                        aria-label={`Bar chart of predictions by model: ${MODEL_KEYS.map(
                          (key) => `${MODELS[key].label} ${stats.perModel[key]}`,
                        ).join(', ')}`}
                      />
                    </ChartCard>
                  )
                }
                return (
                  <ChartCard
                    key={item.id}
                    {...common}
                    title="Prediction activity over time"
                    note={
                      activity
                        ? `Predictions per ${activity.unit}${
                            activity.skipped
                              ? `. ${plural(activity.skipped, 'prediction')} without a valid date not shown.`
                              : '.'
                          }`
                        : undefined
                    }
                  >
                    {lineData ? (
                      <Line
                        data={lineData}
                        options={lineOptions}
                        role="img"
                        aria-label="Line chart of prediction activity over time"
                      />
                    ) : (
                      <p className="history-chart-empty">
                        The predictions in this selection have no valid date.
                      </p>
                    )}
                  </ChartCard>
                )
              })}
            </div>

            {/* Individual predictions */}
            <section aria-labelledby="history-list-title">
              <h3 id="history-list-title" className="history-section-title">
                Individual predictions
              </h3>
              <div className="history-table-wrap reveal">
                <table className="history-table">
                  <caption className="visually-hidden">
                    Prediction history, newest first
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="history-col-date">Date</th>
                      <th scope="col" className="history-col-model">Model</th>
                      <th scope="col" className="history-col-result">Result</th>
                      <th scope="col" className="history-col-prob">Probability</th>
                      <th scope="col" className="history-col-input">Input</th>
                      <th scope="col" className="history-col-more">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const open = expandedKey === row.key
                      const detailsId = `history-details-${row.key.replace(/[^\w-]/g, '_')}`
                      return (
                        <Fragment key={row.key}>
                          <tr className={`history-row${open ? ' is-open' : ''}`}>
                            <td data-label="Date">
                              <div className="history-cell">{formatDateTime(row.date)}</div>
                            </td>
                            <td data-label="Model">
                              <div className="history-cell">
                                <ModelBadge model={row.model} />
                              </div>
                            </td>
                            <td data-label="Result">
                              <div className="history-cell">
                                <ResultCell row={row} />
                              </div>
                            </td>
                            <td data-label="Probability">
                              <div className="history-cell">
                                {row.isClassification ? formatPercent(row.probability) : '—'}
                              </div>
                            </td>
                            <td data-label="Input">
                              <div className="history-cell history-cell-input">
                                <InputCell row={row} />
                              </div>
                            </td>
                            <td data-label="Details">
                              <div className="history-cell">
                                <button
                                  type="button"
                                  className="linkbutt history-toggle"
                                  aria-expanded={open}
                                  aria-controls={open ? detailsId : undefined}
                                  aria-label={`${open ? 'Hide' : 'Show'} details of the ${
                                    MODELS[row.model].label
                                  } prediction from ${formatDateTime(row.date)}`}
                                  onClick={() => setExpandedKey(open ? null : row.key)}
                                >
                                  {open ? 'Hide' : 'View'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {open ? (
                            <tr className="history-details-row">
                              <td colSpan={6} className="history-details-cell">
                                <dl className="history-details" id={detailsId}>
                                  {detailFields(row).map(([label, text]) => (
                                    <div
                                      key={label}
                                      className={`history-detail${
                                        label === 'Input summary' || label === 'SHA-256'
                                          ? ' history-detail-wide'
                                          : ''
                                      }`}
                                    >
                                      <dt>{label}</dt>
                                      <dd>{text}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filtered.length > visibleRows.length ? (
                <div className="history-more">
                  <button
                    type="button"
                    className="butt history-btn"
                    onClick={() => setLimit((current) => current + PAGE_SIZE)}
                  >
                    Show more ({filtered.length - visibleRows.length} remaining)
                  </button>
                </div>
              ) : null}
            </section>
          </>
        )}

        {/* Export and clear */}
        <section className="history-actions-block" aria-label="History actions">
          <div className="history-actions">
            <button
              type="button"
              className="butt history-btn"
              onClick={() => downloadCsv(filtered)}
              disabled={filtered.length === 0}
            >
              <i className="fa-solid fa-file-arrow-down" aria-hidden="true" />
              Export CSV
            </button>
            <button
              type="button"
              className="butt history-btn history-btn-danger"
              onClick={() => setConfirming(true)}
              disabled={confirming}
            >
              <i className="fa-solid fa-trash-can" aria-hidden="true" />
              Clear History
            </button>
          </div>

          {confirming ? (
            <div
              className="history-confirm"
              role="alertdialog"
              aria-labelledby="history-confirm-text"
            >
              <p id="history-confirm-text">
                Clear all {plural(records.length, 'prediction')} from this session? This cannot
                be undone, and it removes everything, not just the filtered rows.
              </p>
              <div className="history-confirm-actions">
                <button
                  type="button"
                  ref={cancelRef}
                  className="butt history-btn"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="butt history-btn history-btn-confirm"
                  onClick={confirmClear}
                >
                  Yes, clear
                </button>
              </div>
            </div>
          ) : null}

          <p className="history-note">
            The CSV contains the rows currently shown by the filters. History is kept for this
            session only and disappears when the page is refreshed.
          </p>
        </section>
      </div>
    </section>
  )
}
