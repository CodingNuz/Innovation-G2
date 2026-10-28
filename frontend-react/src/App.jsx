// The app shell: the header, the tabs and the about box.
//
// The layout follows the original SpamChameleon page (header, a centred
// working area, a footer) and adds a tab bar, because the app now covers
// three models instead of one.

import { useEffect, useState } from 'react'
import './App.css'
import ChatView from './views/ChatView'
import MalwareView from './views/MalwareView'
import ProcessView from './views/ProcessView'
import SpamView from './views/SpamView'
import { api } from './api/client'

const TABS = [
  { id: 'spam', label: 'Spam or HAM', icon: 'fa-solid fa-envelope', component: SpamView },
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
]

export default function App() {
  const [tab, setTab] = useState('spam')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [health, setHealth] = useState(null)

  // Ask the backend once whether it is up and the models are loaded, so the
  // user can see a broken connection instead of a mystery error later.
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

  const Active = TABS.find((entry) => entry.id === tab).component

  return (
    <>
      <header className="headah">
        <a className="logo" href="#top">
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
              {health.status === 'ok' && health.models_loaded ? 'model ready' : 'backend offline'}
            </span>
          ) : null}

          <button
            type="button"
            className="butt aboutus"
            onClick={() => setAboutOpen(true)}
          >
            about us <i className="fa-solid fa-circle-info" aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Models">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`tab ${tab === entry.id ? 'active' : ''}`}
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id ? 'page' : undefined}
          >
            <i className={entry.icon} aria-hidden="true" />
            <span>{entry.label}</span>
          </button>
        ))}
      </nav>

      <main className="main" id="top">
        <Active />
      </main>

      <footer className="footer">
        <p>&copy; 2026 SpamChameleon</p>
        <a href="mailto:trucdnx@gmail.com" className="mail">
          <i className="fa-regular fa-envelope" aria-hidden="true" /> trucdnx@gmail.com
        </a>
      </footer>

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
