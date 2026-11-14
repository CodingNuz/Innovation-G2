// A one-line typing greeting shown each time the Assistant tab is opened.
// Ported from the reference project's greeting.js.

import { useEffect, useState } from 'react'
import './AssistantGreeting.css'

const TEXT = 'Assistant is ready to help you.'
const KEY = 'sc-assistant-greet'

export default function AssistantGreeting({ onDone }) {
  const [phase, setPhase] = useState('open')
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Reloading the page in the same tab session should not replay it.
    let alreadyShown = false
    try {
      alreadyShown = sessionStorage.getItem(KEY) === '1'
      sessionStorage.setItem(KEY, '1')
    } catch { alreadyShown = false }

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cancelled = false
    const timers = []
    const at = (fn, ms) => {
      timers.push(setTimeout(() => { if (!cancelled) fn() }, ms))
    }

    const finish = () => {
      setPhase('done')
      at(() => {
        setVisible(false)
        if (onDone) onDone()
      }, 500)
    }

    if (alreadyShown || reduce) {
      at(() => { setText(TEXT) }, 0)
      at(finish, 1200)
    } else {
      let i = 0
      const type = () => {
        if (i <= TEXT.length) {
          setText(TEXT.slice(0, i))
          i += 1
          at(type, 45)
        } else {
          at(erase, 900)
        }
      }
      const erase = () => {
        if (i > 0) {
          i -= 1
          setText(TEXT.slice(0, i))
          at(erase, 25)
        } else {
          finish()
        }
      }
      at(type, 260)
    }

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      // Leaving the tab clears the guard so the next visit animates again.
      try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
    }
  }, [onDone])

  if (!visible) return null
  return (
    <div className={`assistant-greet assistant-greet-${phase}`} aria-live="polite">
      <span className="assistant-greet-text">{text}</span>
      {phase !== 'done' ? <span className="assistant-greet-caret" aria-hidden="true" /> : null}
    </div>
  )
}

