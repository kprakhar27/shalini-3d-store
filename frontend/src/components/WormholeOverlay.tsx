import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

// Total transition length in ms — split 50/50 between implode and emerge.
const DURATION = 1800

// ── Easings ──────────────────────────────────────────────────────────────────

function easeInCubic(t: number)  { return t * t * t }
function easeOutCubic(t: number) { const u = 1 - t; return 1 - u * u * u }

// ── Streak (light particle) ──────────────────────────────────────────────────

interface Streak {
  angle: number
  dist: number       // 0 = at center, 1 = at far edge
  speed: number
  baseLen: number
}

function spawnStreaks(count = 140): Streak[] {
  const out: Streak[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      angle:   Math.random() * Math.PI * 2,
      dist:    0.45 + Math.random() * 0.55,    // start spread out
      speed:   0.7 + Math.random() * 1.3,
      baseLen: 0.04 + Math.random() * 0.10,
    })
  }
  return out
}

// ── Black-hole renderer ──────────────────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
  streaks: Streak[],
  dt: number,
) {
  const cx = w / 2
  const cy = h / 2
  const maxR = Math.hypot(cx, cy)

  // Black-hole radius timeline:
  //   implode (0 → 0.5):  0  →  maxR * 1.4   (just past edge → covers everything)
  //   emerge  (0.5 → 1):  maxR * 1.4 → 0
  const implode = progress < 0.5
  const phaseT  = implode ? progress / 0.5 : (progress - 0.5) / 0.5
  const radius  = maxR * 1.4 * (implode ? easeInCubic(phaseT) : 1 - easeOutCubic(phaseT))

  ctx.clearRect(0, 0, w, h)

  // ── Streaks (light bending into / erupting out of the hole) ────────────────
  ctx.lineCap = 'round'
  for (const s of streaks) {
    // Drift toward center while imploding, away while emerging.
    if (implode) {
      // Acceleration scales with 1/dist (gravitational, simplified). Near-center streaks zip fastest.
      const grav = 0.9 / Math.max(s.dist, 0.05)
      s.dist -= s.speed * grav * dt * 0.0009
      s.angle += dt * 0.0008 * (1 / Math.max(s.dist, 0.08))   // slight spiral inward
      if (s.dist < 0) s.dist = 0
    } else {
      const accel = 1.6 + s.speed
      s.dist += accel * dt * 0.0011
      s.angle -= dt * 0.0004
    }

    if (s.dist <= 0 || s.dist > 1.4) continue

    const r1 = s.dist * maxR
    const tail = s.baseLen * maxR + r1 * 0.18
    const r2 = r1 + tail

    const x1 = cx + Math.cos(s.angle) * r1
    const y1 = cy + Math.sin(s.angle) * r1
    const x2 = cx + Math.cos(s.angle) * r2
    const y2 = cy + Math.sin(s.angle) * r2

    // Brightness: brightest near event horizon and during the implode/emerge peaks.
    const horizonNear = Math.max(0, 1 - Math.abs(r1 - radius) / (maxR * 0.35))
    const phaseBoost  = implode ? 1 - progress : (progress - 0.5) * 2
    const opacity     = Math.min(1, horizonNear * 0.9 + phaseBoost * 0.3)

    if (opacity <= 0.02) continue

    const grad = ctx.createLinearGradient(x1, y1, x2, y2)
    grad.addColorStop(0,    `rgba(255, 220, 170, 0)`)
    grad.addColorStop(0.4,  `rgba(255, 240, 210, ${opacity * 0.85})`)
    grad.addColorStop(1,    `rgba(255, 180,  80, 0)`)
    ctx.strokeStyle = grad
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // ── Black sphere ───────────────────────────────────────────────────────────
  if (radius > 0.5) {
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()

    // Accretion-disk glow ring (just inside the event horizon)
    if (radius > 18 && radius < maxR * 1.2) {
      const inner = radius * 0.78
      const outer = radius * 1.08
      const ring = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer)
      ring.addColorStop(0,    'rgba(255, 130,  40, 0)')
      ring.addColorStop(0.55, 'rgba(255, 170,  70, 0.45)')
      ring.addColorStop(0.85, 'rgba(255, 230, 180, 0.85)')
      ring.addColorStop(1,    'rgba(255, 255, 255, 0)')
      ctx.fillStyle = ring
      ctx.beginPath()
      ctx.arc(cx, cy, outer, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ── White flash at the singularity (peaks at 50%) ──────────────────────────
  const flashEnv = Math.max(0, 1 - Math.abs(progress - 0.5) * 12)
  if (flashEnv > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashEnv * 0.95})`
    ctx.fillRect(0, 0, w, h)
  }
}

// ── Underlying canvas distortion (paired with the overlay) ───────────────────

function applySceneDistortion(el: HTMLElement | null, progress: number) {
  if (!el) return

  if (progress < 0.5) {
    const t = easeInCubic(progress / 0.5)
    const scale    = 1 - t * 0.96
    const rotation = t * 540
    const blur     = t * 16
    const opacity  = 1 - t * 0.95
    el.style.transform = `scale(${scale}) rotate(${rotation}deg)`
    el.style.filter    = `blur(${blur}px)`
    el.style.opacity   = String(opacity)
  } else {
    const t = easeOutCubic((progress - 0.5) / 0.5)
    const scale    = 0.04 + t * 0.96
    const rotation = (1 - t) * -540
    const blur     = (1 - t) * 16
    const opacity  = 0.05 + t * 0.95
    el.style.transform = `scale(${scale}) rotate(${rotation}deg)`
    el.style.filter    = `blur(${blur}px)`
    el.style.opacity   = String(opacity)
  }
}

function clearSceneDistortion(el: HTMLElement | null) {
  if (!el) return
  el.style.transform = ''
  el.style.filter    = ''
  el.style.opacity   = ''
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WormholeOverlay() {
  const transitioning = useStore((s) => s.transitioning)
  const endTransition = useStore((s) => s.endTransition)

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const versionRef   = useRef(0)
  const swappedRef   = useRef(false)
  const lastFrameRef = useRef(0)
  const streaksRef   = useRef<Streak[]>([])

  useEffect(() => {
    if (!transitioning) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    versionRef.current += 1
    const myVersion   = versionRef.current
    const startedAt   = performance.now()
    swappedRef.current = false
    streaksRef.current = spawnStreaks()
    lastFrameRef.current = startedAt

    const sceneEl = document.querySelector<HTMLElement>('.scene-canvas-wrapper')

    function tick(now: number) {
      // A newer transition has started → abandon this loop.
      if (versionRef.current !== myVersion) return

      const elapsed  = now - startedAt
      const progress = Math.min(elapsed / DURATION, 1)
      const dt       = now - lastFrameRef.current
      lastFrameRef.current = now

      drawFrame(ctx!, canvas!.width, canvas!.height, progress, streaksRef.current, dt)
      applySceneDistortion(sceneEl, progress)

      // At 50%: the screen is fully white-flashed, swap the scene out of sight.
      if (progress >= 0.5 && !swappedRef.current) {
        swappedRef.current = true
        endTransition()
      }

      if (progress < 1) {
        requestAnimationFrame(tick)
      } else {
        clearSceneDistortion(sceneEl)
      }
    }

    requestAnimationFrame(tick)

    // Don't cancel the rAF in cleanup — `transitioning` flips to false at the
    // 50% mark when we call endTransition(), but the emerge half still needs to play.
    // versionRef.current is the safety net for back-to-back transitions.
  }, [transitioning, endTransition])

  return (
    <canvas
      ref={canvasRef}
      className={`wormhole-canvas${transitioning ? ' active' : ''}`}
    />
  )
}
