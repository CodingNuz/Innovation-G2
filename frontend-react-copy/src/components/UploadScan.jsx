// Scan a real file instead of typing its features (POST /api/scan/upload).
// An APK shows each Android model's vote next to the combined verdict.

import { useState } from 'react'
import Alert from './Alert'
import FilePicker from './FilePicker'
import { formatSize } from './fileSize'
import { api } from '../api/client'

const MODEL_LABELS = {
  pe_windows: 'Windows PE',
  android_permissions: 'Android permissions',
  android_drebin: 'Android Drebin',
  android_tuandromd: 'Android TUANDROMD',
}

export default function UploadScan({ onPrediction }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function pick(next) {
    setFile(next)
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
        inputSummary:
          reply.filename +
          ' (' +
          (reply.file_type === 'pe' ? 'Windows PE' : 'Android APK') +
          ', ' +
          formatSize(reply.size) +
          ')',
        sha256: reply.sha256,
        modelCount: reply.results?.length ?? 0,
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
  const isBad = result?.verdict === 'MALWARE' || result?.verdict === 'SPAM'

  return (
    <div className="uploadscan">
      <p className="fieldlabel" id="scan-label">
        Scan a File
      </p>
      <FilePicker
        id="scan-file"
        accept=".exe,.dll,.sys,.apk,.pdf,.txt,.eml,.html,.htm"
        file={file}
        onChange={pick}
        disabled={busy}
        prompt="Drop a file here or choose one"
        hint="Windows .exe / .dll, Android .apk, a PDF or text message, up to 100 MB."
      />
      <div className="uploadrow">
        <button type="button" className="butt butt-wide" disabled={!file || busy} onClick={scan} aria-busy={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> Scanning
            </>
          ) : (
            'Scan File'
          )}
        </button>
        <p className="uploadhint">The file is read, never run. Or set the features by hand below.</p>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      {result ? (
        <div className="uploadresult" role="status">
          <p className={'uploadverdict ' + (isBad ? 'is-bad' : 'is-good')}>
            {result.verdict} <span>{(result.probability * 100).toFixed(1)}%</span>
          </p>
          <p className="uploadmeta">
            {result.filename} &middot;{' '}
            {isSpamResult ? 'PDF or text' : result.file_type === 'pe' ? 'Windows PE' : 'Android APK'}{' '}
            &middot; {formatSize(result.size)} &middot; sha256 {result.sha256.slice(0, 12)}&hellip;
          </p>
          {isSpamResult ? (
            <p className="uploadhint">
              Scored as a message on its extracted text. The words behind the score are in the Spam
              tab.
            </p>
          ) : (
            <ul className="uploadmodels">
              {result.results.map((model) => (
                <li key={model.platform}>
                  <span>{MODEL_LABELS[model.platform] ?? model.platform}</span>
                  <span className="uploadbar" aria-hidden="true">
                    <span
                      className={model.verdict === 'MALWARE' ? 'is-bad' : 'is-good'}
                      style={{ width: model.probability * 100 + '%' }}
                    />
                  </span>
                  <span className="uploadvote">
                    {model.verdict} {(model.probability * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
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

