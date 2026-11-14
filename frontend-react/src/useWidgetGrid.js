// Draggable, resizable widget grid for the History charts. Ported from the
// reference project's dashboard.js (Pointer Events + FLIP + localStorage),
// expressed as a React hook so the DOM stays owned by React.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const WIDGET_IDS = ['verdicts', 'by-model', 'activity']
export const WIDGET_SIZES = ['default', 'wide', 'tall', 'small']
const STORE_KEY = 'spamchameleon-history-widgets'
const EASE = 'transform .28s cubic-bezier(.2,.75,.3,1)'
const DEFAULT_LAYOUT = [
  { id: 'verdicts', size: 'default' },
  { id: 'by-model', size: 'default' },
  { id: 'activity', size: 'wide' },
]

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function readLayout() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT
    const seen = new Set()
    const ordered = []
    for (const item of parsed) {
      if (!item || !WIDGET_IDS.includes(item.id) || !WIDGET_SIZES.includes(item.size)) continue
      if (seen.has(item.id)) continue
      seen.add(item.id)
      ordered.push({ id: item.id, size: item.size })
    }
    for (const fallback of DEFAULT_LAYOUT) {
      if (!seen.has(fallback.id)) ordered.push(fallback)
    }
    return ordered
  } catch {
    return DEFAULT_LAYOUT
  }
}

function saveLayout(layout) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(layout))
  } catch {
    /* localStorage disabled or full: layout simply is not persisted. */
  }
}

export function useWidgetGrid() {
  const [layout, setLayout] = useState(readLayout)
  const gridRef = useRef(null)
  const dragged = useRef(null)
  const state = useRef({ grabX: 0, grabY: 0, ptrX: 0, ptrY: 0, baseLeft: 0, baseTop: 0, lastX: 0, lastY: 0, pointerId: null })
  const reorderRAF = useRef(null)
  const [draggingId, setDraggingId] = useState(null)

  // Single-step undo: the layout as it was before the most recent change.
  const previousLayout = useRef(null)
  const [canUndo, setCanUndo] = useState(false)

  // Apply a layout change while remembering the prior layout for undo. The
  // producer receives the current layout and returns the next one (or the
  // same reference when nothing should change).
  const commit = useCallback((producer) => {
    setLayout((current) => {
      const next = producer(current)
      if (next === current) return current
      previousLayout.current = current
      saveLayout(next)
      return next
    })
    setCanUndo(true)
  }, [])

  const getAfterElement = useCallback((x, y, skip) => {
    const grid = gridRef.current
    if (!grid) return null
    let closest = { dist: Infinity, el: null }
    Array.from(grid.querySelectorAll('.history-widget')).forEach((el) => {
      if (el === skip) return
      const box = el.getBoundingClientRect()
      const d = Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2))
      if (d < closest.dist) closest = { dist: d, el }
    })
    if (!closest.el) return null
    const box = closest.el.getBoundingClientRect()
    return y < box.top + box.height / 2 ? closest.el : closest.el.nextElementSibling
  }, [])

  const positionCard = useCallback((w) => {
    const s = state.current
    w.style.transform =
      `translate(${s.ptrX - s.grabX - s.baseLeft}px, ${s.ptrY - s.grabY - s.baseTop}px) scale(1.03)`
  }, [])

  // Reorder via React state, then FLIP the neighbours back into their new
  // slots. Layout reads happen once per animation frame, never per pointermove.
  const maybeReorder = useCallback(() => {
    reorderRAF.current = null
    const w = dragged.current
    if (!w) return
    const s = state.current
    if (Math.abs(s.ptrX - s.lastX) < 8 && Math.abs(s.ptrY - s.lastY) < 8) return
    s.lastX = s.ptrX
    s.lastY = s.ptrY
    const after = getAfterElement(s.ptrX, s.ptrY, w)
    if (after === w || (after && after === w.nextElementSibling)) return
    if (after === null && w === gridRef.current.lastElementChild) return

    const grid = gridRef.current
    const items = Array.from(grid.querySelectorAll('.history-widget'))
    const first = new Map()
    items.forEach((el) => { if (el !== w) first.set(el, el.getBoundingClientRect()) })

    const dragId = w.getAttribute('data-widget')
    const targetId = after === null ? null : after.getAttribute('data-widget')
    commit((current) => {
      const moving = current.find((item) => item.id === dragId)
      if (!moving) return current
      const rest = current.filter((item) => item.id !== dragId)
      let next
      if (targetId === null) {
        next = [...rest, moving]
      } else {
        const idx = rest.findIndex((item) => item.id === targetId)
        if (idx < 0) return current
        next = [...rest.slice(0, idx), moving, ...rest.slice(idx)]
      }
      return next
    })

    if (reducedMotion()) return
    requestAnimationFrame(() => {
      items.forEach((el) => {
        if (el === w) return
        const a = first.get(el)
        if (!a) return
        const b = el.getBoundingClientRect()
        const dx = a.left - b.left
        const dy = a.top - b.top
        if (!dx && !dy) return
        el.style.transition = 'none'
        el.style.transform = `translate(${dx}px, ${dy}px)`
        requestAnimationFrame(() => {
          el.style.transition = EASE
          el.style.transform = ''
        })
      })
    })
  }, [commit, getAfterElement])

  const onPointerDown = useCallback((event, id) => {
    if (event.button !== 0 || event.target.closest('.w-size')) return
    const w = event.currentTarget.closest('.history-widget')
    if (!w) return
    const s = state.current
    const box = w.getBoundingClientRect()
    s.grabX = event.clientX - box.left
    s.grabY = event.clientY - box.top
    s.baseLeft = box.left
    s.baseTop = box.top
    s.ptrX = event.clientX
    s.ptrY = event.clientY
    s.lastX = event.clientX
    s.lastY = event.clientY
    s.pointerId = event.pointerId
    dragged.current = w
    setDraggingId(id)
    w.classList.add('is-dragging')
    w.style.width = box.width + 'px'
    w.style.height = box.height + 'px'
    w.style.left = box.left + 'px'
    w.style.top = box.top + 'px'
    w.style.transition = 'none'
    positionCard(w)

    // Listen on window, not on the card. Reordering calls appendChild on the
    // grid children mid-drag, so pointer events can stop reaching the card
    // itself. A stuck pointerup leaves the widget in position:fixed forever,
    // which collapses the grid and hides the table below it.
    function handleMove(e) {
      if (!dragged.current) return
      if (s.pointerId !== null && e.pointerId !== s.pointerId) return
      s.ptrX = e.clientX
      s.ptrY = e.clientY
      positionCard(w)
      if (reorderRAF.current === null) reorderRAF.current = requestAnimationFrame(maybeReorder)
    }

    function cleanup() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      window.removeEventListener('blur', handleUp)
      if (reorderRAF.current !== null) {
        cancelAnimationFrame(reorderRAF.current)
        reorderRAF.current = null
      }
      s.pointerId = null
    }

    function handleUp() {
      cleanup()
      // React may have re-rendered the list while dragging. If this node is
      // no longer in the document, just clear the drag state and stop.
      if (!w.isConnected) {
        dragged.current = null
        setDraggingId(null)
        return
      }
      const floatBox = w.getBoundingClientRect()
      w.classList.remove('is-dragging')
      w.style.width = w.style.height = w.style.left = w.style.top = ''
      w.style.transition = 'none'
      w.style.transform = ''
      const slotBox = w.getBoundingClientRect()
      const dx = floatBox.left - slotBox.left
      const dy = floatBox.top - slotBox.top
      dragged.current = null
      setDraggingId(null)
      if (!reducedMotion() && (dx || dy)) {
        w.style.transform = `translate(${dx}px, ${dy}px)`
        requestAnimationFrame(() => {
          w.style.transition = EASE
          w.style.transform = ''
        })
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    window.addEventListener('blur', handleUp)
    event.preventDefault()
  }, [positionCard, maybeReorder])

  const cycleSize = useCallback((id) => {
    commit((current) => {
      return current.map((item) => {
        if (item.id !== id) return item
        const i = WIDGET_SIZES.indexOf(item.size || 'default')
        return { ...item, size: WIDGET_SIZES[(i + 1) % WIDGET_SIZES.length] }
      })
    })
  }, [commit])

  const resetLayout = useCallback(() => {
    try { window.localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
    commit(() => DEFAULT_LAYOUT)
  }, [commit])

  // Restore the layout from before the most recent change.
  const undoLayout = useCallback(() => {
    if (!previousLayout.current) return
    const restore = previousLayout.current
    previousLayout.current = null
    setLayout(restore)
    saveLayout(restore)
    setCanUndo(false)
  }, [])

  // Keyboard reorder: move a widget earlier/later by one slot, or to an end.
  const moveWidget = useCallback((id, action) => {
    const current = layout
    const idx = current.findIndex((item) => item.id === id)
    if (idx < 0) return
    const len = current.length
    let target
    if (action === 'first') target = 0
    else if (action === 'last') target = len - 1
    else {
      const delta = action === 'earlier' ? -1 : 1
      target = idx + delta
      if (target < 0 || target > len - 1) return
    }
    if (target === idx) return
    const without = current.filter((item) => item.id !== id)
    const moving = current[idx]
    const next = [...without.slice(0, target), moving, ...without.slice(target)]
    commit(() => next)
  }, [layout, commit])

  useEffect(() => () => {
    if (reorderRAF.current !== null) cancelAnimationFrame(reorderRAF.current)
  }, [])

  // Keep DOM order in sync when layout changes from reset/restore.
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid || dragged.current) return
    const order = Array.from(grid.querySelectorAll('.history-widget')).map((el) => el.getAttribute('data-widget'))
    const wanted = layout.map((item) => item.id)
    if (order.join() !== wanted.join()) {
      wanted.forEach((id) => {
        const el = grid.querySelector(`.history-widget[data-widget="${id}"]`)
        if (el) grid.appendChild(el)
      })
    }
  }, [layout])

  return { layout, gridRef, draggingId, onPointerDown, cycleSize, resetLayout, moveWidget, undoLayout, canUndo }
}

