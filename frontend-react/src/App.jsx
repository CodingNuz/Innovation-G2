// App shell: header, tabs and the about box.

import { useEffect, useState } from 'react'
import './App.css'
import HomePage from './views/HomePage'
import ChatView from './views/ChatView'
import MalwareView from './views/MalwareView'
import ProcessView from './views/ProcessView'
import SpamView from './views/SpamView'
import { api } from './api/client'
import HistoryView from './views/HistoryView'
import backgroundGif from './views/assets/background.gif'
import { useMotionRoot } from './motion.jsx'

const TABS = [
  { id: 'spam', label: 'Spam', icon: 'fa-solid fa-envelope', component: SpamView },
  {
    id: 'malware',
    label: 'Malware',
    icon: 'fa-solid fa-bug',
    component: MalwareView,
  },
  {
    id: 'process',
    label: 'Process',
    icon: 'fa-solid fa-microchip',
    component: ProcessView,
  },
  {
    id: 'chat',
    label: 'Assistant',
    icon: 'fa-solid fa-comments',
    component: ChatView,
  },
  // History takes different props, so it is rendered directly below rather
  // than through the `component` field.
  { id: 'history', label: 'History', icon: 'fa-solid fa-clock-rotate-left' },
]

export default function App() {
  const [tab, setTab] = useState('home')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [health, setHealth] = useState(null)
  useMotionRoot(tab)

  // Shared prediction history for the current session.
  const [predictionHistory, setPredictionHistory] = useState([])

  // Add a successful prediction to the shared history.
  const recordPrediction = (prediction) => {
    setPredictionHistory((current) => [
      ...current,
      {
        ...prediction,
        id: `${Date.now()}-${current.length}`,
        createdAt: new Date().toISOString(),
      },
    ])
  }

  const clearHistory = () => setPredictionHistory([])

  // Ask the backend once if it's up and the models are loaded, so a broken
  // connection shows up here and not as a mystery error later.
  useEffect(() => {
    let cancelled = false
    api
      .health()
      .then((reply) => !cancelled && setHealth(reply))
      .catch(() => !cancelled && setHealth({ status: 'unreachable', models_loaded: false }))
    return () => {
      cancelled = true
    }
  }, [])

  // Keyboard shortcuts: "1".."5" jump to the matching tab. Ignored while the
  // user is typing in a form control or holding a modifier key.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key >= '1' && event.key <= '5') {
        const entry = TABS[Number(event.key) - 1]
        if (entry) setTab(entry.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setTab])

  const Active = TABS.find((entry) => entry.id === tab)?.component

  return (
    <>
      {tab === 'home' ? (
        <HomePage
          onSelectModel={setTab}
          onAboutClick={() => setAboutOpen(true)}
          onHistoryClick={() => setTab('history')}
        />
      ) : (
        <div className="view-page">
          <div
            className="view-bg"
            style={{ backgroundImage: `url(${backgroundGif})` }}
            aria-hidden="true"
          />
          <header className="headah">
            <a className="logo" href="#top" onClick={() => setTab('home')}>
              <span className="spamchameleon">SpamChameleon</span>
              <i className="fa-brands fa-opensuse" aria-hidden="true" />
            </a>
 
            <div className="headright">
              {health ? (
                <span
                  className={`health ${health.status === 'ok' && health.models_loaded ? 'ok' : 'bad'}`}
                  title="Backend status"
                >
                  <i
                    className={
                      health.status === 'ok' && health.models_loaded
                        ? 'fa-solid fa-circle-check'
                        : 'fa-solid fa-triangle-exclamation'
                    }
                    aria-hidden="true"
                  />
                  {health.status === 'ok' && health.models_loaded
                    ? 'model ready'
                    : 'backend offline'}
                </span>
              ) : null}

              <button
                type="button"
                className="butt aboutus"
                onClick={() => setAboutOpen(true)}
              >
                About Us <i className="fa-solid fa-circle-info" aria-hidden="true" />
              </button>
            </div>

          <nav className="appnav" aria-label="Sections">
            {TABS.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className="appnav-tab"
                aria-current={tab === entry.id ? 'page' : undefined}
                onClick={() => setTab(entry.id)}
              >
                <i className={entry.icon} aria-hidden="true" />
                <span>{entry.label}</span>
              </button>
            ))}
          </nav>
          </header>

          <main className="main" id="top">
            {tab === 'history' ? (
              <HistoryView key={tab} history={predictionHistory} onClearHistory={clearHistory} />
            ) : (
              <Active
                key={tab}
                onPrediction={recordPrediction}
              />
            )}
          </main>
          
          <div className="back-home-container">
            <button
              type="button"
              className="back-home"
              onClick={() => setTab('home')}
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              <span>Back to Homepage</span>
            </button>
          </div>

          <footer className="footer">
            <p>&copy; 2026 SpamChameleon</p>
            <a href="mailto:trucdnx@gmail.com" className="mail">
              <i className="fa-regular fa-envelope" aria-hidden="true" /> trucdnx@gmail.com
            </a>
          </footer>
        </div>
      )}

      {aboutOpen ? (
        <div
          className="AUbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby="AUtitle"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAboutOpen(false)
          }}
        >
          <div className="AUinfo">
            <h2 id="AUtitle">About SpamChameleon</h2>
            <p>
              This is a university machine-learning project that detects <strong>SPAM</strong>{' '}
              emails and text messages, and classifies files and processes as{' '}
              <strong>MALWARE</strong> or benign.
            </p>
            <p>
              Fill in a message, a file description or a set of process counters, and the
              server runs the trained model and answers with a verdict, the probability behind
              it, and the features that drove the decision.
            </p>
            <p>
              The back end is FastAPI and the front end is React. The spam model is TF-IDF with
              logistic regression; the malware models are gradient-boosted trees, one per
              platform; the process model predicts voluntary context switches.
            </p>
            <button
              type="button"
              className="butt closebutt"
              onClick={() => setAboutOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
