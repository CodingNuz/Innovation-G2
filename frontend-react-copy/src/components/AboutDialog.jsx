// About sheet on the native <dialog> element: showModal() gives the focus trap, Escape,
// inert background and focus restoration for free. Clicking the backdrop closes it too.

import { useEffect, useRef } from 'react'
import ChameleonMark from './ChameleonMark'
import Icon from './Icon'

export default function AboutDialog({ open, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="about-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="sheet-body">
        <div className="sheet-top">
          <ChameleonMark size={56} />
          <button type="button" className="sheet-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <h2 id="about-title">About SpamChameleon</h2>
        <p>
          A university machine-learning project that detects <strong>spam</strong> emails and text
          messages, and classifies files and processes as <strong>malware</strong> or benign.
        </p>
        <p>
          Fill in a message, a file description or a set of process counters. The server runs the
          trained model and answers with a verdict, the probability behind it, and the features that
          drove the decision.
        </p>
        <p>
          The back end is FastAPI and the front end is React. The spam model is TF-IDF with logistic
          regression; the malware models are gradient-boosted trees, one per platform; the process
          model predicts voluntary context switches.
        </p>
        <div className="sheet-foot">
          <a className="linkbutt" href="mailto:trucdnx@gmail.com">
            trucdnx@gmail.com
          </a>
          <button type="button" className="butt butt-wide" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  )
}

