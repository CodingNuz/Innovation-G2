// Scan a real file instead of typing its features.
//
// The user picks a Windows executable or an Android APK.  The backend reads
// the file (POST /api/malware/upload), works out the platform itself, pulls
// the features out of the headers or the manifest and answers with a verdict.
// An APK is scored by three Android models, so each model's vote is listed
// next to the combined verdict.

import { useRef, useState } from 'react'
import Alert from './Alert'
import { api } from '../api/client'

const MODEL_LABELS = {
  pe_windows: 'Windows PE',
  android_permissions: 'Android permissions',
  android_drebin: 'Android Drebin',
  android_tuandromd: 'Android TUANDROMD',
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function UploadScan() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function pick(event) {
    setFile(event.target.files?.[0] ?? null)
    setResult(null)
    setError(null)
  }

  async function scan() {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    try {
      setResult(await api.malwareUpload(file))
    } catch (apiError) {
      setResult(null)
      setError(apiError.message)
    } finally {
      setBusy(false)
    }
  }

  const isMalware = result?.verdict === 'MALWARE'

  return (
    <div className="uploadscan">
      <p className="fieldlabel">Scan a file</p>
      <div className="uploadrow">
        <input
          ref={inputRef}
          type="file"
          accept=".exe,.dll,.sys,.apk"
          className="uploadinput"
          onChange={pick}
          aria-label="Choose a Windows executable or an Android APK"
        />
        <button type="button" className="butt checkbutt static" disabled={!file || busy} onClick={scan}>
          {busy ? 'Scanning...' : 'Scan file'}
        </button>
      </div>
      <p className="uploadhint">
        Windows .exe / .dll or Android .apk, up to 100 MB. The file is read, never run. Or set the
        features by hand below.
      </p>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {result ? (
        <div className="uploadresult">
          <p className="uploadverdict" style={{ color: isMalware ? 'var(--spam-red)' : 'var(--ham-green)' }}>
            IT IS {result.verdict} &middot; {(result.probability * 100).toFixed(1)}%
          </p>
          <p className="uploadmeta">
            {result.filename} &middot; {result.file_type === 'pe' ? 'Windows PE' : 'Android APK'} &middot;{' '}
            {formatSize(result.size)} &middot; sha256 {result.sha256.slice(0, 12)}...
          </p>
          <ul className="uploadmodels">
            {result.results.map((model) => (
              <li key={model.platform}>
                <span>{MODEL_LABELS[model.platform] ?? model.platform}</span>
                <span className="uploadbar" aria-hidden="true">
                  <span
                    style={{
                      width: `${model.probability * 100}%`,
                      background: model.verdict === 'MALWARE' ? 'var(--spam-red)' : 'var(--ham-green)',
                    }}
                  />
                </span>
                <span>
                  {model.verdict} {(model.probability * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
          {result.file_type === 'pe' ? (
            <p className="uploadhint">
              Read from the PE headers: {result.results[0].features_given} of 50 fields. A 64-bit or
              unusual build can score high even when it is clean, because the model learned from mostly
              32-bit files.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
