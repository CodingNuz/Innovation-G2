// Message strip for an API error or a hint; the backend's reason is shown as it came back.

import Icon from './Icon'

export default function Alert({ kind = 'error', children, onDismiss }) {
  if (!children) return null

  return (
    <div className={'alert alert-' + kind} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'error' ? 'alert' : 'info'} size={18} />
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" className="alert-close" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="x" size={16} />
        </button>
      ) : null}
    </div>
  )
}

