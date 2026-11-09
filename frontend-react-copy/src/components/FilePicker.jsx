// File chooser with a drop zone. Clicking opens the native picker (the non-drag
// alternative); dropping a file works too. Shows the chosen file with a remove button.

import { useRef, useState } from 'react'
import Icon from './Icon'
import { formatSize } from './fileSize'

export default function FilePicker({ id, accept, file, onChange, prompt, hint, disabled = false }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)

  function drop(event) {
    event.preventDefault()
    setOver(false)
    if (disabled) return
    const dropped = event.dataTransfer?.files?.[0]
    if (dropped) onChange(dropped)
  }

  return (
    <div
      className={'filepick' + (over ? ' is-over' : '') + (file ? ' has-file' : '')}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="visually-hidden"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
      />
      {file ? (
        <div className="filepick-chosen">
          <Icon name="file" size={22} />
          <span className="filepick-name" title={file.name}>
            {file.name}
          </span>
          <span className="tag">{formatSize(file.size)}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => onChange(null)}
            aria-label={'Remove ' + file.name}
            disabled={disabled}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      ) : (
        <label className="filepick-empty" htmlFor={id}>
          <Icon name="upload" size={22} />
          <span>
            <strong>{prompt}</strong>
            <span className="filepick-hint">{hint}</span>
          </span>
        </label>
      )}
    </div>
  )
}

