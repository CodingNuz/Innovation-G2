// Home: what the tool is, and the four tools to open.

import { Suspense, lazy } from 'react'
import Icon from '../components/Icon'

// three.js is large, so the shader is a separate chunk that loads after the hero is on screen.
const ShaderAnimation = lazy(() => import('../components/ShaderAnimation'))

// Light-ripple preset: the accent blue on a near-black base. Calm speed keeps text readable.
const SHADER_TINT = [0.3, 0.62, 1.0]
const SHADER_BASE = [0.02, 0.02, 0.035]

const TOOLS = [
  {
    id: 'spam',
    title: 'Spam',
    icon: 'mail',
    kind: 'Text classifier',
    description: 'Detect spam messages and emails through copy-paste text or PDF file uploads.',
  },
  {
    id: 'malware',
    title: 'Malware',
    icon: 'bug',
    kind: 'File and feature classifier',
    description: 'Detect malicious files categorised by platform or analyse their features.',
  },
  {
    id: 'process',
    title: 'Process',
    icon: 'chip',
    kind: 'Regression',
    description:
      'Analyse running processes using system activity counters to identify potentially harmful behaviour.',
  },
  {
    id: 'chat',
    title: 'Assistant',
    icon: 'chat',
    kind: 'Tool-calling agent',
    description:
      'An AI assistant that helps users with spam and malware detection using text, files, and images.',
  },
]

export default function HomePage({ onAboutClick }) {
  return (
    <div className="home">
      <section className="hero" aria-labelledby="home-title">
        <Suspense fallback={null}>
          <ShaderAnimation
            className="hero-shader"
            tint={SHADER_TINT}
            base={SHADER_BASE}
            speed={0.6}
            lineWidth={0.0034}
            brightness={0.95}
          />
        </Suspense>
        <h1 id="home-title" className="hero-title" tabIndex={-1}>
          Spot what&rsquo;s hiding in plain sight.
        </h1>
        <p className="hero-lead">
          Enhance your cybersecurity with intelligent detection of spam messages, suspicious emails,
          malicious files, and potentially harmful processes.
        </p>
        <div className="hero-actions">
          <a className="butt butt-pill" href="#/spam">
            Check a Message
          </a>
          <button type="button" className="hero-link" onClick={onAboutClick}>
            How It Works <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </section>

      <section className="tools" aria-labelledby="tools-title">
        <h2 id="tools-title" className="section-title">
          Choose a tool.
        </h2>
        <ul className="toolgrid">
          {TOOLS.map((tool, index) => (
            <li key={tool.id} style={{ '--i': index }}>
              <a className="toolcard" href={'#/' + tool.id}>
                <span className="toolcard-icon">
                  <Icon name={tool.icon} size={24} />
                </span>
                <span className="toolcard-kind">{tool.kind}</span>
                <span className="toolcard-title">{tool.title}</span>
                <span className="toolcard-desc">{tool.description}</span>
                <span className="toolcard-open">
                  Open <Icon name="chevronRight" size={14} />
                </span>
              </a>
            </li>
          ))}
        </ul>

        <a className="historyrow" href="#/history">
          <span className="historyrow-icon">
            <Icon name="history" size={20} />
          </span>
          <span className="historyrow-text">
            <strong>Session History</strong>
            <span>Every prediction you run is logged here, with charts and a CSV export.</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </a>
      </section>
    </div>
  )
}

