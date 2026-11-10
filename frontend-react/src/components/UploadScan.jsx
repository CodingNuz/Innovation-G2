// Scan a real file instead of typing its features (POST /api/scan/upload).
// An APK shows each Android model's vote next to the combined verdict.

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

export default function UploadScan({ onPrediction }) {
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
      const reply = await api.malwareUpload(file)
      if (reply.error) throw new Error(reply.error)
      setResult(reply)

      // Record the successful file prediction in shared history.
      onPrediction?.({
        model: 'malware',
        verdict: reply.verdict,
        probability: reply.probability,
        platform: reply.file_type === 'pe' ? 'Windows' : 'Android', 
        inputType: 'File upload',
        inputSummary: `${reply.filename} (${reply.file_type === 'pe' ? 'Windows PE' : 'Android APK'}, ${formatSize(reply.size)})`,
        sha256: reply.sha256,
        modelCount: reply.details?.length ?? 0,
      })
    } catch (apiError) {
      setResult(null)
      setError(apiError.message)
    } finally {
    setBusy(false)
    }
  }

  // A PDF or text file is scored by the spam model, which has no per-model
  // votes, so the panel shows a different body for it.
  const isSpamResult = result?.kind === 'spam'
  const isMalware = result?.verdict === 'MALWARE' || result?.verdict === 'SPAM'

  return (
    <div className="uploadscan">
      <p className="fieldlabel">Scan a file</p>
      <div className="uploadrow">
        <input
          ref={inputRef}
          type="file"
          accept=".exe,.dll,.sys,.apk,.pdf,.txt,.eml,.html,.htm"
          className="uploadinput"
          onChange={pick}
          aria-label="Choose a file to scan"
        />
        <button type="button" className="butt checkbutt static" disabled={!file || busy} onClick={scan}>
          {busy ? 'Scanning...' : 'Scan file'}
        </button>
      </div>
      <p className="uploadhint">
        Windows .exe / .dll, Android .apk, a PDF or text message, up to 100 MB. The file is
        read, never run. Or set the features by hand below.
      </p>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {result ? (
        <div className="uploadresult">
          <p
            className="uploadverdict"
            style={{ color: isMalware ? 'var(--spam-red)' : 'var(--ham-green)' }}
          >
            IT IS {result.verdict} &middot; {(result.probability * 100).toFixed(1)}%
          </p>
          <p className="uploadmeta">
            {result.filename} &middot;{' '}
            {isSpamResult
              ? 'PDF or text'
              : result.format === 'pe'
                ? 'Windows PE'
                : 'Android APK'}{' '}
            &middot; {formatSize(result.size)} &middot; sha256 {result.sha256.slice(0, 12)}...
          </p>
          {isSpamResult ? (
            <p className="uploadhint">
              Scored as a message on its extracted text. The words behind the score are in the Spam
              tab.
            </p>
          ) : (
            <ul className="uploadmodels">
              {(result.details ?? []).map((model) => (
                <li key={model.model}>
                  <span>{MODEL_LABELS[model.model] ?? model.model}</span>
                  <span className="uploadbar" aria-hidden="true">
                    <span
                      style={{
                        width: `${model.probability * 100}%`,
                        background:
                          model.verdict === 'MALWARE' ? 'var(--spam-red)' : 'var(--ham-green)',
                      }}
                    />
                  </span>
                  <span>
                    {model.verdict} {(model.probability * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
