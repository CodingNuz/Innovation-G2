import React from 'react';
import '../HomePage.css';

import backgroundGif from './assets/background.gif';

const MODELS = [
  {
    id: 'spam',
    title: 'Spam',
    description:
      'Detect spam messages and emails through copy-paste text or PDF file uploads.',
  },
  {
    id: 'malware',
    title: 'Malware',
    description:
      'Detect malicious files categorised by platform or analyse their features.',
  },
  {
    id: 'chat',
    title: 'Assistant',
    description:
      'An AI assistant that helps users with spam and malware detection using text, files, and images.',
  },
  {
    id: 'process',
    title: 'Process',
    description:
      'Analyse running processes using system activity counters to identify potentially harmful behaviour.',
  },
];

function ChameleonIcon() {
  return (
    <i
      className="fa-brands fa-opensuse hp-logo-icon"
      aria-hidden="true"
    />
  )
}

function InfoIcon() {
  return (
    <svg className="hp-about-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <rect x="10.600" y="10" width="2.800" height="8" rx="1.100" fill="#ffd803" />
      <circle cx="12" cy="6.800" r="1.700" fill="#ffd803" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="hp-mail-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2" y="4.500" width="20" height="15" rx="2.500" fill="none" stroke="currentColor" strokeWidth="1.800" />
      <path d="M3 7l9 6.500L21 7" fill="none" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ModelCard({ model, onSelect }) {
  return (
    <button
      type="button"
      className="hp-card"
      onClick={() => onSelect && onSelect(model.id)}
    >
      <span className="hp-card-title">{model.title}</span>
      <span className="hp-card-desc">{model.description}</span>
    </button>
  );
}

/**
 * Standalone homepage.
 * @param {(modelId: 'spam'|'malware'|'assistant'|'process') => void} [onSelectModel]
 * @param {() => void} [onAboutClick]
 */
export default function HomePage({ onSelectModel, onAboutClick }) {
  return (
    <div className="hp">
      {/* Animated GIF background, kept behind everything */}
      <div
        className="hp-bg"
        style={{ backgroundImage: `url(${backgroundGif})` }}
        aria-hidden="true"
      />

      <header className="hp-header">
        <a className="hp-logo" href="/" aria-label="SpamChameleon home">
          <span className="hp-logo-text">SpamChameleon</span>
          <ChameleonIcon />
        </a>
        <button type="button" className="hp-about" onClick={onAboutClick}>
          <span>about us</span>
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
        </button>
      </header>

      <main className="hp-main">
        <section className="hp-intro" aria-labelledby="hp-welcome">
          <h1 id="hp-welcome" className="hp-welcome">
            Welcome to SpamChameleon<span className="hp-comma">,</span>
          </h1>
          <p className="hp-lead">
            Enhance your cybersecurity with intelligent detection of spam
            messages, suspicious emails, malicious files, and potentially
            harmful processes.
          </p>
        </section>

        <section className="hp-models" aria-label="Choose a model">
          <div className="hp-hint" aria-hidden="true">
            <span className="hp-hint-text">
              Please choose 1 of
              <br />
              these models
            </span>
            <svg className="hp-hint-arrow" viewBox="0 0 120 70" focusable="false">
              <path
                d="M2 8C30 -2 62 4 58 26c-3 16-24 14-18-2 5-13 32-10 62 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M88 43l14-1-3-14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="hp-panel">
            {MODELS.map((m) => (
              <ModelCard key={m.id} model={m} onSelect={onSelectModel} />
            ))}
          </div>
        </section>
      </main>

      <footer className="hp-footer">
        <span>© 2026 SpamChameleon</span>
        <a className="hp-email" href="mailto:trucdnx@gmail.com">
          <MailIcon />
          <span>trucdnx@gmail.com</span>
        </a>
      </footer>
    </div>
  );
}
