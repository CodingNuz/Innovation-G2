// The process regression screen.
//
// The model predicts how many voluntary context switches a process makes. The
// user fills in the counters of a running process and POST /api/process
// answers with the predicted count.
//
// The answer is a count, not a label, so there is no probability to show as a
// gauge. What there is is a position on the training range, which is what the
// gauge shows here: where the predicted count sits between the smallest and
// the largest value in the training data.

import { useEffect, useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import Alert from '../components/Alert'
import GaugeChart from '../components/GaugeChart'
import NumberField from '../components/NumberField'
import { api } from '../api/client'
import { axisOptions, baseOptions, palette } from '../charts/setup'

// The counters a person can read off a process, grouped the way they describe
// it. The rest of the model inputs are filled with the training median.
const GROUPS = [
  {
    title: 'Memory',
    features: ['map_count', 'total_vm', 'reserved_vm', 'exec_vm', 'shared_vm', 'mm_users'],
  },
  {
    title: 'CPU time',
    features: ['utime', 'stime', 'gtime', 'cgtime', 'nivcsw', 'signal_nvcsw'],
  },
  {
    title: 'Faults and scheduling',
    features: ['min_flt', 'maj_flt', 'last_interval', 'free_area_cache', 'fs_excl_counter'],
  },
  {
    title: 'Process state',
    features: ['state', 'usage_counter', 'prio', 'static_prio', 'normal_prio', 'policy', 'task_size'],
  },
]

export default function ProcessView() {
  const [schema, setSchema] = useState(null)
  const [values, setValues] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .processSchema()
      .then((reply) => !cancelled && setSchema(reply))
      .catch((apiError) => !cancelled && setLoadError(apiError.message))
    return () => {
      cancelled = true
    }
  }, [])

  // The counters that actually carry information. A counter that never changes
  // in the training data tells the model nothing, so it is not shown.
  const usable = useMemo(() => {
    if (!schema) return []
    return Object.entries(schema).filter(([, info]) => info.max > info.min)
  }, [schema])

  const grouped = useMemo(() => {
    const byName = new Map(usable)
    const groups = []
    for (const group of GROUPS) {
      const rows = group.features.filter((name) => byName.has(name))
      if (rows.length > 0) groups.push({ ...group, rows })
    }
    // Anything the groups do not mention still belongs on the form.
    const named = new Set(GROUPS.flatMap((g) => g.features))
    const rest = usable.map(([name]) => name).filter((name) => !named.has(name))
    if (rest.length > 0) groups.push({ title: 'Other counters', rows: rest })
    return groups
  }, [usable])

  const setValue = (name, raw) => {
    if (raw === '') {
      setValues((previous) => {
        const next = { ...previous }
        delete next[name]
        return next
      })
      return
    }
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    setValues((previous) => ({ ...previous, [name]: value }))
  }

  async function check(event) {
    event?.preventDefault()
    if (busy || Object.keys(values).length === 0) return

    setBusy(true)
    setError(null)
    try {
      const reply = await api.process(values)
      setResult(reply)
    } catch (apiError) {
      setResult(null)
      setError(apiError.message)
    } finally {
      setBusy(false)
    }
  }

  // The predicted count on the training range. A horizontal stacked bar shows
  // the position directly: the red part is the part of the range the model
  // filled, the grey part is the rest of the range still ahead of it.
  const chartData = useMemo(() => {
    if (!result) return null
    const [low, high] = result.range
    const predicted = result.prediction
    const share = Math.max(0, Math.min(1, (predicted - low) / (high - low)))

    return {
      labels: ['Position'],
      datasets: [
        {
          label: 'Prediction',
          data: [share * 100],
          backgroundColor: palette.blue,
          borderRadius: 12,
          borderSkipped: false,
          barPercentage: 0.5,
        },
        {
          label: 'Rest of the range',
          data: [(1 - share) * 100],
          backgroundColor: 'rgba(39, 35, 67, 0.1)',
          borderRadius: 12,
          borderSkipped: false,
          barPercentage: 0.5,
        },
      ],
    }
  }, [result])

  const chartOptions = {
    ...baseOptions,
    indexAxis: 'y',
    // The two datasets are parts of one bar, so they stack.
    scales: {
      x: {
        ...axisOptions,
        stacked: true,
        max: 100,
        ticks: { ...axisOptions.ticks, callback: (value) => `${value}%` },
        title: { display: true, text: 'Share of the training range', color: palette.dark },
      },
      y: { ...axisOptions, stacked: true, grid: { display: false } },
    },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...baseOptions.plugins.tooltip,
        callbacks: {
          label: (item) =>
            item.datasetIndex === 0
              ? `${result.prediction.toLocaleString()} switches`
              : `${Math.round(item.raw)}% of the range left`,
        },
      },
    },
  }

  // Where the prediction sits on the training range, as a fraction.
  const position = result
    ? (result.prediction - result.range[0]) / (result.range[1] - result.range[0])
    : 0

  return (
    <section className="view view-wide">
      <form className="panel detector" onSubmit={check}>
        <h1 className="detitle">PROCESS CONTEXT SWITCHES</h1>
        <p className="subtitle">
          Fill in the counters of a running process. The model predicts how many voluntary
          context switches it makes.
        </p>

        {loadError ? <Alert kind="error">{loadError}</Alert> : null}

        {schema ? (
          <>
            <div className="countergroups">
              {grouped.map((group) => (
                <fieldset className="countergroup" key={group.title}>
                  <legend>{group.title}</legend>
                  <div className="counters">
                    {group.rows.map((name) => (
                      <NumberField
                        key={name}
                        id={`proc-${name}`}
                        name={name}
                        value={values[name]}
                        info={schema[name]}
                        onChange={(raw) => setValue(name, raw)}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>

            {error ? <Alert kind="error">{error}</Alert> : null}

            <div className="actions">
              <button
                type="submit"
                className="butt checkbutt static"
                disabled={Object.keys(values).length === 0 || busy}
              >
                {busy ? '...' : 'Predict'}
              </button>
              <span className="counter">
                {Object.keys(values).length} counter
                {Object.keys(values).length === 1 ? '' : 's'} set
              </span>
            </div>
          </>
        ) : (
          <p className="empty">Loading the counters of the regression model...</p>
        )}
      </form>

      {result ? (
        <aside className="panel sidepanel">
          <div>
            <h2 className="resulttitle">
              <span style={{ color: palette.dark }}>PREDICTION</span>
              <i className="fa-solid fa-gauge result-flag" style={{ color: palette.blue }} />
            </h2>
            <p className="resultmeta">
              {result.model} &middot; target {result.target}
            </p>

            <div className="prediction">
              <span className="prediction-value">
                {result.prediction.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="prediction-unit">context switches</span>
            </div>

            <GaugeChart
              value={position}
              color={palette.blue}
              caption="position in the training range"
            />

            <p className="sus">Model input:</p>
            <ul className="suslist">
              <li>
                {result.features_given} counter{result.features_given === 1 ? '' : 's'} you set
              </li>
              <li>
                {result.features_imputed} filled with the training median
              </li>
              {result.clipped ? (
                <li className="warning">The answer was outside the training range and pulled back</li>
              ) : null}
            </ul>

            {chartData ? (
              <div className="chartbox">
                <h3 className="charttitle">Where the answer sits</h3>
                <div className="chartarea">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              </div>
            ) : null}
          </div>

          <button type="button" className="butt closebutt" onClick={() => setResult(null)}>
            Close
          </button>
        </aside>
      ) : null}
    </section>
  )
}
