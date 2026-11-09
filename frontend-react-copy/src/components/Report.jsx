// The result column shared by Spam, Malware and Process.
//
// It always renders, so a result never shifts the page: an empty state first, then the
// report. When a result arrives the heading takes focus, so keyboard and screen-reader
// users land on it (and phones scroll to it, since the column stacks under the form).

import { useEffect, useRef } from 'react'
import Icon from './Icon'

/** The signature element: one probability ring, coloured by what the result means. */
export function ProbabilityRing({ value, tone = 'info', label }) {
  const percent = Math.max(0, Math.min(100, (value ?? 0) * 100))
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - percent / 100)
  return (
    <div
      className={'ring is-' + tone}
      role="img"
      aria-label={percent.toFixed(1) + ' percent ' + (label ?? '')}
    >
      <svg viewBox="0 0 140 140" aria-hidden="true" focusable="false">
        <circle className="ring-track" cx="70" cy="70" r={radius} />
        <circle
          className="ring-arc"
          cx="70"
          cy="70"
          r={radius}
          style={{ '--c': circumference, '--to': offset }}
        />
      </svg>
      <div className="ring-readout">
        <span className="ring-value">{percent.toFixed(1)}%</span>
        {label ? <span className="ring-label">{label}</span> : null}
      </div>
    </div>
  )
}

/** Verdict block: the ring beside the verdict word and one line that explains it. */
export function Verdict({ word, tone = 'info', sub, eyebrow = 'Verdict', value, ringLabel, compact = false }) {
  return (
    <div className={'verdict is-' + tone}>
      <ProbabilityRing value={value} tone={tone} label={ringLabel} />
      <div className="verdict-text">
        <p className="verdict-eyebrow">{eyebrow}</p>
        <p className={'verdict-word' + (compact ? ' is-number' : '')}>{word}</p>
        {sub ? <p className="verdict-sub">{sub}</p> : null}
      </div>
    </div>
  )
}

export function ReportPanel({ result, title, emptyTitle, emptyText, onDismiss, children }) {
  const headingRef = useRef(null)

  useEffect(() => {
    if (!result) return
    const heading = headingRef.current
    if (!heading) return
    heading.focus({ preventScroll: true })
    heading.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [result])

  if (!result) {
    return (
      <aside className="report report-empty" aria-label="Result">
        <div className="report-empty-art" aria-hidden="true">
          <Icon name="gauge" size={30} />
        </div>
        <h2 className="report-empty-title">{emptyTitle ?? 'No Result Yet'}</h2>
        <p>{emptyText ?? 'Run a check and the verdict, probability and evidence appear here.'}</p>
      </aside>
    )
  }

  return (
    <aside className="report" aria-label="Result">
      <header className="report-head">
        <p className="report-title">{title}</p>
        <button type="button" className="linkbutt" onClick={onDismiss}>
          Dismiss
        </button>
      </header>
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Result
      </h2>
      {children}
    </aside>
  )
}

