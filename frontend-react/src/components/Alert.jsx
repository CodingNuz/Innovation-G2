// Message strip for an API error or a hint; the backend's reason is shown as it came back.

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
