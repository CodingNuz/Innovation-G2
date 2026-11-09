// App shell: translucent sidebar (desktop), top bar + tab bar (phone), hash routing,
// backend status, the shared prediction history and the About sheet.

import { useEffect, useRef, useState } from 'react'
import AboutDialog from './components/AboutDialog'
import ChameleonMark from './components/ChameleonMark'
import Icon from './components/Icon'
import { api } from './api/client'
import { refreshChartTheme } from './charts/setup'
import ChatView from './views/ChatView'
import HistoryView from './views/HistoryView'
import HomePage from './views/HomePage'
import MalwareView from './views/MalwareView'
import ProcessView from './views/ProcessView'
import SpamView from './views/SpamView'

// The route is the URL hash (#/spam), so reload and back/forward restore the screen.
// The sidebar groups the destinations; the phone tab bar lists every one except Home
// (the brand mark goes home), which keeps it to five tabs.
const GROUPS = [
  { items: [{ id: 'home', label: 'Home', icon: 'home' }] },
  {
    label: 'Detect',
    items: [
      { id: 'spam', label: 'Spam', icon: 'mail', component: SpamView },
      { id: 'malware', label: 'Malware', icon: 'bug', component: MalwareView },
      { id: 'process', label: 'Process', icon: 'chip', component: ProcessView },
    ],
  },
  { label: 'Assist', items: [{ id: 'chat', label: 'Assistant', icon: 'chat', component: ChatView }] },
  { label: 'Session', items: [{ id: 'history', label: 'History', icon: 'history' }] },
]
const ROUTES = GROUPS.flatMap((group) => group.items)

function readRoute() {
  const id = window.location.hash.replace(/^#\/?/, '')
  return ROUTES.some((route) => route.id === id) ? id : 'home'
}

/** Backend status: checking, ready or offline. Never blocks the UI. */
function HealthBadge({ health }) {
  let tone = 'wait'
  let label = 'Checking Backend'
  if (health) {
    const ready = health.status === 'ok' && health.models_loaded
    tone = ready ? 'ok' : 'bad'
    label = ready ? 'Models Ready' : 'Backend Offline'
  }
  return (
    <p className={'health is-' + tone} role="status" title="Backend status">
      <span className="health-dot" aria-hidden="true" />
      <span className="health-label">{label}</span>
    </p>
  )
}

export default function App() {
  const [tab, setTab] = useState(readRoute)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [health, setHealth] = useState(null)
  const [appearance, setAppearance] = useState(0)
  const mainRef = useRef(null)
  const firstRender = useRef(true)

  // Shared prediction history for the current session.
  const [predictionHistory, setPredictionHistory] = useState([])

  const recordPrediction = (prediction) => {
    setPredictionHistory((current) => [
      ...current,
      {
        ...prediction,
        id: Date.now() + '-' + current.length,
        createdAt: new Date().toISOString(),
      },
    ])
  }

  const clearHistory = () => setPredictionHistory([])

  useEffect(() => {
    const sync = () => setTab(readRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  // The system appearance can change while the app is open (Auto mode). Charts read their
  // colours when they are built, so refresh the defaults and rebuild the current screen.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      refreshChartTheme()
      setAppearance((count) => count + 1)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  // Honest page title, and focus on the new page's heading after a route change.
  useEffect(() => {
    const route = ROUTES.find((entry) => entry.id === tab)
    document.title = tab === 'home' ? 'SpamChameleon' : route.label + ' · SpamChameleon'
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.querySelector('h1')?.focus({ preventScroll: true })
  }, [tab])

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

  const Active = ROUTES.find((entry) => entry.id === tab)?.component

  let screen
  if (tab === 'home') {
    screen = <HomePage onAboutClick={() => setAboutOpen(true)} />
  } else if (tab === 'history') {
    screen = <HistoryView history={predictionHistory} onClearHistory={clearHistory} />
  } else {
    screen = <Active onPrediction={recordPrediction} />
  }

  const link = (route, variant) => (
    <li key={route.id}>
      <a
        className={'navlink' + (tab === route.id ? ' is-current' : '')}
        href={'#/' + route.id}
        aria-current={tab === route.id ? 'page' : undefined}
      >
        <Icon name={route.icon} size={variant === 'sidebar' ? 18 : 24} />
        <span className="navlabel">{route.label}</span>
        {route.id === 'history' && predictionHistory.length > 0 ? (
          <span className="navcount" aria-label={predictionHistory.length + ' predictions'}>
            {predictionHistory.length}
          </span>
        ) : null}
      </a>
    </li>
  )

  return (
    <div className="app">
      <a
        className="skip"
        href="#content"
        onClick={(event) => {
          event.preventDefault()
          mainRef.current?.focus()
        }}
      >
        Skip to Content
      </a>

      <aside className="sidebar">
        <a className="brand" href="#/home" aria-label="SpamChameleon home">
          <ChameleonMark size={30} />
          <span className="brand-name">SpamChameleon</span>
        </a>
        <HealthBadge health={health} />
        <nav className="sidebar-nav" aria-label="Primary">
          {GROUPS.map((group, index) => (
            <div className="navgroup" key={group.label ?? 'top'}>
              {group.label ? (
                <p className="navgroup-label" id={'navgroup-' + index}>
                  {group.label}
                </p>
              ) : null}
              <ul className="navlist" aria-labelledby={group.label ? 'navgroup-' + index : undefined}>
                {group.items.map((route) => link(route, 'sidebar'))}
              </ul>
            </div>
          ))}
        </nav>
        <button type="button" className="sidebar-about" onClick={() => setAboutOpen(true)}>
          <Icon name="info" size={18} />
          About
        </button>
      </aside>

      <header className="topbar material">
        <a className="brand" href="#/home" aria-label="SpamChameleon home">
          <ChameleonMark size={28} />
          <span className="brand-name">SpamChameleon</span>
        </a>
        <div className="topbar-right">
          <HealthBadge health={health} />
          <button
            type="button"
            className="iconbutt"
            onClick={() => setAboutOpen(true)}
            aria-label="About this project"
          >
            <Icon name="info" size={20} />
          </button>
        </div>
      </header>

      <div className="stage">
        <main className="main" id="content" ref={mainRef} tabIndex={-1} key={appearance}>
          {screen}
        </main>
        <footer className="sitefoot">
          <span>&copy; 2026 SpamChameleon</span>
          <a href="mailto:trucdnx@gmail.com">trucdnx@gmail.com</a>
        </footer>
      </div>

      <nav className="tabbar material" aria-label="Primary, mobile">
        <ul className="tablist">
          {ROUTES.filter((route) => route.id !== 'home').map((route) => link(route, 'tabbar'))}
        </ul>
      </nav>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}

