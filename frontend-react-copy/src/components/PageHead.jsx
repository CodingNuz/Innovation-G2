// Page header shared by every route: mono kicker, serif title, one-line lead.
// The heading takes focus when the route changes (see App.jsx), so it is focusable but not tabbable.

import { forwardRef } from 'react'

const PageHead = forwardRef(function PageHead({ id, kicker, title, lead, children }, ref) {
  return (
    <header className="pagehead">
      {kicker ? <p className="tag pagehead-kicker">{kicker}</p> : null}
      <h1 className="pagehead-title" id={id} ref={ref} tabIndex={-1}>
        {title}
      </h1>
      {lead ? <p className="pagehead-lead">{lead}</p> : null}
      {children}
    </header>
  )
})

export default PageHead

