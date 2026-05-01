import { useRef, useEffect, useLayoutEffect, useMemo, Component, Suspense, type ReactNode } from 'react'
import { PerspectiveCamera, OrbitControls, MeshTransmissionMaterial, useGLTF } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { easing } from 'maath'
import { useStore } from '../store/useStore'
import ProductCard from '../components/ProductCard'
import { carouselPosition } from '../utils/carousel'
import { useSubcategories } from '../lib/hooks/useSubcategories'
import { useProductsByCategory } from '../lib/hooks/useProductsByCategory'
import type { Product } from '../data/products'

const RADIUS = 4.2
const VIEWER_TARGET = new THREE.Vector3(0, 0.2, 5.5)
const CAROUSEL_POS = new THREE.Vector3(0, 1, 9)
const VIEWER_FOV = 50
const CAROUSEL_FOV = 55
const CAROUSEL_BASE_Y = 0.6
const SUBCATEGORY_SPACING = 5.5

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ── Viewer product mesh ───────────────────────────────────────────────────────

const AnimatedGroup = animated('group')

// Target world height the viewer expects (matches BoxPlaceholder's 2.6 unit height).
const TARGET_HEIGHT = 2.6

function GltfModel({ url, color }: { url: string; color?: string }) {
  const { scene } = useGLTF(url)

  // Fit-to-box transform — clones the scene so original cache stays untouched,
  // recomputes scale + center offset from the AABB so any GLB renders the same size
  // as the box placeholder regardless of source units. Also clones the materials
  // (drei's clone shares materials by default) so variant tint changes don't
  // leak across instances of the same GLB elsewhere in the page.
  const cloned = useMemo(() => {
    const obj = scene.clone(true)
    obj.traverse((child) => {
      const m = child as THREE.Mesh
      if (m.isMesh && m.material) {
        const cloneMat = (mat: THREE.Material) => {
          const c = mat.clone() as THREE.MeshStandardMaterial
          c.userData.originalColor = (mat as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color(0xffffff)
          return c
        }
        m.material = Array.isArray(m.material) ? m.material.map(cloneMat) : cloneMat(m.material)
      }
    })

    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const longest = Math.max(size.x, size.y, size.z) || 1
    const scale = TARGET_HEIGHT / longest

    obj.position.sub(center.multiplyScalar(scale))
    obj.scale.setScalar(scale)
    return obj
  }, [scene])

  // Variant tint — multiplies the variant color into the original material
  // color so any diffuse texture is tinted (rather than replaced) and
  // brightness/saturation of the asset are preserved.
  useEffect(() => {
    const tint = color ? new THREE.Color(color) : null
    cloned.traverse((child) => {
      const m = child as THREE.Mesh
      if (!m.isMesh || !m.material) return
      const apply = (mat: THREE.Material) => {
        const std = mat as THREE.MeshStandardMaterial
        if (!std.color) return
        const orig = (std.userData.originalColor as THREE.Color) ?? std.color
        if (tint) std.color.copy(orig).multiply(tint)
        else      std.color.copy(orig)
      }
      Array.isArray(m.material) ? m.material.forEach(apply) : apply(m.material)
    })
  }, [cloned, color])

  return <primitive object={cloned} />
}

// Catches GLB load failures (CORS, 404, malformed) so the viewer falls back
// to the box placeholder instead of crashing the whole canvas.
class GltfErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { errored: boolean }
> {
  state = { errored: false }
  static getDerivedStateFromError() { return { errored: true } }
  componentDidCatch(err: Error) { console.error('[GltfModel] failed to load:', err) }
  render() { return this.state.errored ? this.props.fallback : this.props.children }
}

function BoxPlaceholder({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[1.8, 2.6, 0.28]} />
        <meshStandardMaterial color={color} metalness={0.05} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.2, 0.145]}>
        <boxGeometry args={[1.35, 1.95, 0.01]} />
        <meshStandardMaterial color={color} transparent opacity={0.38} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.31, 0.145]}>
        <boxGeometry args={[1.8, 0.055, 0.01]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.1} />
      </mesh>
    </group>
  )
}

function ViewerMesh() {
  const selectedProduct = useStore((s) => s.selectedProduct)
  const selectedVariant = useStore((s) => s.selectedVariant)
  const setViewerHovered = useStore((s) => s.setViewerHovered)
  const color = selectedVariant?.color ?? '#7c6af7'
  const floatRef = useRef<THREE.Group>(null)

  const { posY, scale } = useSpring({
    from: { posY: -1, scale: 0.5 },
    to: { posY: 0, scale: 1 },
    config: { mass: 1, tension: 320, friction: 30 },
    reset: true,
  })

  // Gentle floating + tilt so it reads as a real 3-D object
  useFrame((state) => {
    if (!floatRef.current) return
    const t = state.clock.getElapsedTime()
    floatRef.current.rotation.y = Math.sin(t / 3) * 0.18   // ±10° side-to-side
    floatRef.current.rotation.x = Math.cos(t / 4) * 0.08   // ±5° forward/back
    floatRef.current.position.y = Math.sin(t / 2) * 0.06   // subtle float
  })

  if (!selectedProduct) return null

  return (
    <AnimatedGroup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      position-y={posY as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scale={scale as any}
      onPointerOver={(e) => { e.stopPropagation(); setViewerHovered(true) }}
      onPointerOut={() => setViewerHovered(false)}
    >
      <group ref={floatRef}>
        {selectedProduct.glbUrl ? (
          <GltfErrorBoundary fallback={<BoxPlaceholder color={color} />}>
            <Suspense fallback={<BoxPlaceholder color={color} />}>
              <GltfModel url={selectedProduct.glbUrl} color={color} />
            </Suspense>
          </GltfErrorBoundary>
        ) : (
          <BoxPlaceholder color={color} />
        )}
      </group>
    </AnimatedGroup>
  )
}

// ── Glass circle selector ─────────────────────────────────────────────────────

function GlassSelector() {
  const meshRef = useRef<THREE.Mesh>(null)
  const viewerHovered = useStore((s) => s.viewerHovered)

  useFrame(({ viewport, camera, pointer }, delta) => {
    if (!meshRef.current) return
    const { width, height } = viewport.getCurrentViewport(camera, [0, 0, 1.5])

    if (viewerHovered) {
      // Expand to center and fill the whole screen
      easing.damp3(meshRef.current.position, [0, 0, 1.5], 0.2, delta)
      easing.damp3(meshRef.current.scale, 7, 0.4, delta)
    } else {
      // Shrink and follow the pointer
      easing.damp3(
        meshRef.current.position,
        [(pointer.x * width) / 2, (pointer.y * height) / 2, 1.5],
        0.1,
        delta,
      )
      easing.damp3(meshRef.current.scale, 0.01, 0.2, delta)
    }
  })

  return (
    <mesh ref={meshRef}>
      <circleGeometry args={[1, 64]} />
      <MeshTransmissionMaterial
        samples={16}
        resolution={1024}
        anisotropicBlur={0.18}
        thickness={0.25}
        roughness={0.6}
        toneMapped={true}
      />
    </mesh>
  )
}

// ── Merged multi-carousel + viewer scene ──────────────────────────────────────

export default function ProductScene() {
  const scene = useStore((s) => s.scene)
  const isViewer = scene === 'productViewer'
  const isViewerExiting = useStore((s) => s.isViewerExiting)
  const endViewerExit = useStore((s) => s.endViewerExit)
  const expandingProductId = useStore((s) => s.expandingProductId)
  const selectedProduct = useStore((s) => s.selectedProduct)
  const selectedCategory = useStore((s) => s.selectedCategory)

  // Subcategories + their products from Firestore
  const subcategories = useSubcategories(selectedCategory)
  const firestoreProducts = useProductsByCategory(selectedCategory)
  const productsBySub = useMemo(() => {
    const map: Record<string, Product[]> = {}
    if (!firestoreProducts) return map
    for (const sub of subcategories) {
      map[sub.label] = firestoreProducts.filter((p) => p.subcategoryId === sub.label)
    }
    return map
  }, [subcategories, firestoreProducts])

  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const pageGroupRef = useRef<THREE.Group>(null)
  const subGroupRefs = useRef<Map<string, THREE.Group>>(new Map())
  const currentAngles = useRef<Record<string, number>>({})
  const currentScroll = useRef(0)
  const lastInputAtRef = useRef(performance.now())
  const dragRef = useRef({ active: false, lastX: 0 })

  // Camera animation state
  const startPos = useRef(new THREE.Vector3(0, 1, 9))
  const enterProgress = useRef(0)
  const isEnterDone = useRef(!isViewer)
  const isExiting = useRef(false)
  const exitProgress = useRef(0)
  const exitStartPos = useRef(new THREE.Vector3())

  // Set carousel camera on mount
  useLayoutEffect(() => {
    camera.position.copy(CAROUSEL_POS)
    camera.fov = CAROUSEL_FOV
    camera.updateProjectionMatrix()
    camera.lookAt(0, 0, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start enter animation when transitioning to viewer
  useLayoutEffect(() => {
    if (!isViewer) return
    const start = useStore.getState().cameraStartPosition ?? CAROUSEL_POS.toArray()
    startPos.current.set(start[0], start[1], start[2])
    camera.position.copy(startPos.current)
    camera.fov = CAROUSEL_FOV
    camera.updateProjectionMatrix()
    camera.lookAt(0, 0, 0)
    enterProgress.current = 0
    isEnterDone.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer])

  // Watch for back-button exit trigger
  useEffect(() => {
    if (isViewerExiting) {
      isExiting.current = true
      exitProgress.current = 0
      exitStartPos.current.copy(camera.position)
    }
  }, [isViewerExiting, camera])

  // Active subcategory label = whichever's closest to centered, derived from pageScrollY.
  function currentSubLabel(): string | null {
    const subs = subcategories
    if (subs.length === 0) return null
    const idx = Math.max(0, Math.min(subs.length - 1, Math.round(useStore.getState().pageScrollY / SUBCATEGORY_SPACING)))
    return subs[idx]?.label ?? null
  }

  useFrame((_, delta) => {
    // Enter: zoom camera from carousel to viewer position
    if (isViewer && !isEnterDone.current && !isExiting.current) {
      enterProgress.current = Math.min(enterProgress.current + delta * 1.2, 1)
      const t = ease(enterProgress.current)
      camera.position.lerpVectors(startPos.current, VIEWER_TARGET, t)
      camera.fov = THREE.MathUtils.lerp(CAROUSEL_FOV, VIEWER_FOV, t)
      camera.updateProjectionMatrix()
      camera.lookAt(0, 0, 0)
      if (enterProgress.current >= 1) {
        isEnterDone.current = true
        useStore.setState({ expandingProductId: null })
        controlsRef.current?.update()
      }
    }

    // Exit: zoom camera back to carousel position
    if (isExiting.current) {
      exitProgress.current = Math.min(exitProgress.current + delta * 1.0, 1)
      const t = ease(exitProgress.current)
      camera.position.lerpVectors(exitStartPos.current, CAROUSEL_POS, t)
      camera.fov = THREE.MathUtils.lerp(VIEWER_FOV, CAROUSEL_FOV, t)
      camera.updateProjectionMatrix()
      camera.lookAt(0, 0, 0)
      if (exitProgress.current >= 1) {
        isExiting.current = false
        endViewerExit()
      }
    }

    // Page scroll: ease pageGroup Y toward target. Snap to nearest section
    // when no input has been received recently.
    if (pageGroupRef.current && (!isViewer || isExiting.current)) {
      const idleMs = performance.now() - lastInputAtRef.current
      const N = subcategories.length
      const maxScroll = Math.max(0, (N - 1) * SUBCATEGORY_SPACING)

      let target = useStore.getState().pageScrollY
      if (idleMs > 180 && N > 0 && !expandingProductId) {
        const snapped = Math.round(target / SUBCATEGORY_SPACING) * SUBCATEGORY_SPACING
        target = THREE.MathUtils.clamp(snapped, 0, maxScroll)
        if (Math.abs(target - useStore.getState().pageScrollY) > 1e-3) {
          useStore.getState().setPageScrollY(target)
        }
      }
      target = THREE.MathUtils.clamp(target, 0, maxScroll)
      currentScroll.current += (target - currentScroll.current) * 0.12
      pageGroupRef.current.position.y = currentScroll.current
    }

    // Per-subcategory carousel rotation (listing mode or during exit).
    if (!isViewer || isExiting.current) {
      const angles = useStore.getState().carouselAngles
      const snap = useStore.getState().snapCarousel
      for (const sub of subcategories) {
        const ref = subGroupRefs.current.get(sub.label)
        if (!ref) continue
        const target = angles[sub.label] ?? 0
        const cur = currentAngles.current[sub.label] ?? 0
        const next = expandingProductId ? cur : cur + (target - cur) * (snap ? 0.18 : 0.07)
        currentAngles.current[sub.label] = next
        ref.rotation.y = next
      }
    }

    // Visibility:
    //   - listing mode (not viewer): all subcategories visible
    //   - viewer enter (still animating): only the active subcategory visible
    //                                     so the expanding card stays in frame
    //   - viewer enter done: hide everything; only ViewerMesh remains
    //   - viewer exiting: all visible again so the camera pulls back into them
    if (subcategories.length > 0) {
      const activeLabel = isViewer && selectedProduct ? selectedProduct.subcategoryId : null
      for (const sub of subcategories) {
        const ref = subGroupRefs.current.get(sub.label)
        if (!ref) continue
        if (!isViewer || isExiting.current) {
          ref.visible = true
        } else if (!isEnterDone.current) {
          ref.visible = sub.label === activeLabel
        } else {
          ref.visible = false
        }
      }
    }

    // OrbitControls active only after zoom-in completes
    if (controlsRef.current) {
      controlsRef.current.enabled = isViewer && isEnterDone.current && !isExiting.current
    }
  })

  // ── Input handlers ─────────────────────────────────────────────────────────
  function onWheel(e: WheelEvent) {
    if (expandingProductId || isViewer) return
    lastInputAtRef.current = performance.now()
    const N = subcategories.length
    const maxScroll = Math.max(0, (N - 1) * SUBCATEGORY_SPACING)
    const next = THREE.MathUtils.clamp(
      useStore.getState().pageScrollY + e.deltaY * 0.012,
      0,
      maxScroll,
    )
    useStore.getState().setPageScrollY(next)
  }
  function onPointerDown(e: PointerEvent) {
    if (isViewer) return
    dragRef.current = { active: true, lastX: e.clientX }
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragRef.current.active || expandingProductId || isViewer) return
    const dx = e.clientX - dragRef.current.lastX
    dragRef.current.lastX = e.clientX
    lastInputAtRef.current = performance.now()
    const label = currentSubLabel()
    if (!label) return
    const cur = useStore.getState().carouselAngles[label] ?? 0
    useStore.getState().setCarouselAngle(label, cur - dx * 0.008)
  }
  function onPointerUp() { dragRef.current.active = false }

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1, 9]} fov={55} near={0.1} far={200} />

      {!isViewer && (
        <EventBinder
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      )}

      <color attach="background" args={['#ebebeb']} />

      <ambientLight intensity={1.0} />
      <pointLight position={[0, 8, 0]} intensity={0.8} />
      <pointLight position={[5, 3, 5]} intensity={0.3} color="#7c6af7" />
      <directionalLight position={[4, 8, 5]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 3, -3]} intensity={0.45} />

      {/* Stack of subcategory carousels — parent's Y follows pageScrollY (lerped). */}
      <group ref={pageGroupRef}>
        {subcategories.map((sub, i) => {
          const subProducts = productsBySub[sub.label] ?? []
          return (
            <group
              key={sub.label}
              ref={(el) => {
                if (el) subGroupRefs.current.set(sub.label, el)
                else subGroupRefs.current.delete(sub.label)
              }}
              position={[0, CAROUSEL_BASE_Y - i * SUBCATEGORY_SPACING, 0]}
            >
              {subProducts.map((product, idx) => {
                const { position, rotationY } = carouselPosition(idx, subProducts.length, RADIUS)
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    position={position}
                    rotationY={rotationY}
                    subcategoryLabel={sub.label}
                    subcategoryIndex={i}
                  />
                )
              })}
            </group>
          )
        })}
      </group>

      {/* Viewer product + glass selector — only in viewer state */}
      {isViewer && <ViewerMesh />}
      {isViewer && <GlassSelector />}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={2.5}
        maxDistance={8}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI - 0.1}
        target={[0, 0, 0]}
      />
    </>
  )
}

// ── Native canvas event binder ────────────────────────────────────────────────

function EventBinder({
  onWheel, onPointerDown, onPointerMove, onPointerUp,
}: {
  onWheel: (e: WheelEvent) => void
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
}) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, [gl, onWheel, onPointerDown, onPointerMove, onPointerUp])
  return null
}
