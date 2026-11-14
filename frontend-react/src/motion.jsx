// Motion primitives shared by every view. Ported from the reference
// project's motion.js, expressed as React hooks so the observers are scoped
// to the tree that owns them and cleaned up on unmount.

import { useEffect, useRef } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Reveal every .reveal descendant as it enters the viewport, once. */
export function useReveal(rootRef, revision) {
  useEffect(() => {
    const root = rootRef && rootRef.current
    const scope = root || document
    const items = scope.querySelectorAll('.reveal:not(.is-in)')
    if (!items.length) return undefined

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'))
      return undefined
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [rootRef, revision])
}

/** Reveal a single element as soon as it mounts (chat answers, new rows). */
export function useRevealOnMount() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      el.classList.add('is-in')
      return
    }
    requestAnimationFrame(() => el.classList.add('is-in'))
  }, [])
  return ref
}

/** Count from 0 to value with easeOutCubic over 1000ms. */
export function useCountUp(value) {
  const ref = useRef(null)
  const target = Number(value) || 0

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const final = target.toLocaleString()
    if (prefersReducedMotion() || !('requestAnimationFrame' in window)) {
      el.textContent = final
      return undefined
    }

    let raf = 0
    let start = null
    const step = (ts) => {
      if (start === null) start = ts
      const progress = Math.min((ts - start) / 1000, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      el.textContent = Math.round(target * eased).toLocaleString()
      if (progress < 1) raf = requestAnimationFrame(step)
      else el.textContent = final
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return ref
}

/** Root-level motion: re-scans the DOM whenever the active tab changes. */
export function useMotionRoot(revision) {
  const ref = useRef(null)
  useReveal(ref, revision)
  return ref
}

