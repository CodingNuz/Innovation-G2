// Animated "light ripple" background: a full-area Three.js fragment shader of glowing
// concentric arcs sliced by a diagonal grid (from the light-ripple skill, MIT-licensed
// three.js). Ported to plain JSX for this Vite app, with three additions:
//   - a base colour, so the dark areas match the brand ink instead of pure black;
//   - rendering pauses while the element is offscreen or the tab is hidden;
//   - it draws one still frame under prefers-reduced-motion and silently does nothing
//     when WebGL is unavailable (the parent's own background shows instead).

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const VERTEX = 'void main() { gl_Position = vec4(position, 1.0); }'

const FRAGMENT = [
  'precision highp float;',
  'uniform vec2 resolution;',
  'uniform float time;',
  'uniform float uLineWidth;',
  'uniform float uDispersion;',
  'uniform vec3 uTint;',
  'uniform float uUseTint;',
  'uniform float uBrightness;',
  'uniform vec3 uBase;',
  'void main(void) {',
  '  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);',
  '  float t = time * 0.05;',
  '  vec3 color = vec3(0.0);',
  '  for (int j = 0; j < 3; j++) {',
  '    for (int i = 0; i < 5; i++) {',
  '      color[j] += uLineWidth * float(i * i) /',
  '        abs(fract(t - uDispersion * float(j) + float(i) * 0.01) * 5.0',
  '            - length(uv) + mod(uv.x + uv.y, 0.2));',
  '    }',
  '  }',
  '  float mono = (color.r + color.g + color.b) / 3.0;',
  '  vec3 finalColor = mix(color, mono * uTint, uUseTint);',
  '  gl_FragColor = vec4(uBase + finalColor * uBrightness, 1.0);',
  '}',
].join('\n')

export default function ShaderAnimation({
  speed = 1,
  lineWidth = 0.002,
  dispersion = 0.01,
  tint = null,
  brightness = 1,
  base = [0, 0, 0],
  className = '',
}) {
  const containerRef = useRef(null)
  // Arrays are compared by value so a new literal each render does not rebuild the scene.
  const tintKey = tint ? tint.join(',') : ''
  const baseKey = base.join(',')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const effectiveSpeed = reduceMotion ? 0 : speed

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      return undefined
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const camera = new THREE.Camera()
    camera.position.z = 1
    const scene = new THREE.Scene()
    const geometry = new THREE.PlaneGeometry(2, 2)

    const tintValue = tintKey ? tintKey.split(',').map(Number) : [1, 1, 1]
    const baseValue = baseKey.split(',').map(Number)
    const uniforms = {
      time: { value: 1.0 },
      resolution: { value: new THREE.Vector2() },
      uLineWidth: { value: lineWidth },
      uDispersion: { value: dispersion },
      uTint: { value: new THREE.Vector3(...tintValue) },
      uUseTint: { value: tintKey ? 1.0 : 0.0 },
      uBrightness: { value: brightness },
      uBase: { value: new THREE.Vector3(...baseValue) },
    }
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })
    scene.add(new THREE.Mesh(geometry, material))

    const draw = () => renderer.render(scene, camera)

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      renderer.setSize(width, height)
      uniforms.resolution.value.set(renderer.domElement.width, renderer.domElement.height)
      draw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    let frame = 0
    let visible = true
    const tick = () => {
      uniforms.time.value += 0.05 * effectiveSpeed
      draw()
      frame = visible ? requestAnimationFrame(tick) : 0
    }
    const start = () => {
      if (!frame && visible && effectiveSpeed > 0) frame = requestAnimationFrame(tick)
    }
    start()

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
    })
    io.observe(container)

    return () => {
      visible = false
      cancelAnimationFrame(frame)
      io.disconnect()
      observer.disconnect()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [speed, lineWidth, dispersion, tintKey, brightness, baseKey])

  return <div ref={containerRef} className={className} aria-hidden="true" />
}

