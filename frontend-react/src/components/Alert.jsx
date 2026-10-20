// A message strip that shows an API error or a hint.
//
// The backend rejects a request for a reason (empty text, an unknown platform,
// a feature the model has never seen), and that reason is the useful part of
// the answer, so it is shown as it came back.

export default function Alert({ kind = 'error', children, onDismiss }) {
  if (!children) return null

  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <i
        className={
          kind === 'error'
            ? 'fa-solid fa-triangle-exclamation'
            : 'fa-solid fa-circle-info'
        }
        aria-hidden="true"
      />
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" className="alert-close" onClick={onDismiss} aria-label="Dismiss">
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
