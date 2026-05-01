import { useRef, useEffect, useLayoutEffect } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'

const AnimatedGroup = animated('group')

const VIEWER_TARGET = new THREE.Vector3(0, 0.2, 5.5)
const CAROUSEL_POS = new THREE.Vector3(0, 1, 9)
const VIEWER_FOV = 50
const CAROUSEL_FOV = 55

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function ProductViewerMesh() {
  const selectedProduct = useStore((s) => s.selectedProduct)
  const selectedVariant = useStore((s) => s.selectedVariant)
  const setViewerHovered = useStore((s) => s.setViewerHovered)

  const color = selectedVariant?.color ?? '#7c6af7'

  const { posY, scale } = useSpring({
    from: { posY: -1, scale: 0.5 },
    to:   { posY: 0,  scale: 1   },
    config: { mass: 1, tension: 320, friction: 30 },
    reset: true,
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
      {/* Main body */}
      <mesh castShadow>
        <boxGeometry args={[1.8, 2.6, 0.28]} />
        <meshStandardMaterial color={color} metalness={0.05} roughness={0.42} />
      </mesh>

      {/* Front face highlight */}
      <mesh position={[0, 0.2, 0.145]}>
        <boxGeometry args={[1.35, 1.95, 0.01]} />
        <meshStandardMaterial color={color} transparent opacity={0.38} roughness={0.95} />
      </mesh>

      {/* Top edge bar */}
      <mesh position={[0, 1.31, 0.145]}>
        <boxGeometry args={[1.8, 0.055, 0.01]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.1} />
      </mesh>
    </AnimatedGroup>
  )
}

export default function ProductViewerScene() {
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const cameraStart = useStore((s) => s.cameraStartPosition)
  const isViewerExiting = useStore((s) => s.isViewerExiting)
  const endViewerExit = useStore((s) => s.endViewerExit)

  const startPos = useRef(new THREE.Vector3(...(cameraStart ?? [0, 2, 9])))

  const enterProgress = useRef(0)
  const isEnterDone = useRef(false)
  const isExiting = useRef(false)
  const exitProgress = useRef(0)
  const exitStartPos = useRef(new THREE.Vector3())

  // Set camera to starting position before first frame renders
  useLayoutEffect(() => {
    camera.position.copy(startPos.current)
    camera.fov = CAROUSEL_FOV
    camera.updateProjectionMatrix()
    camera.lookAt(0, 0, 0)
    enterProgress.current = 0
    isEnterDone.current = false
    isExiting.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Watch for back-button exit trigger
  useEffect(() => {
    if (isViewerExiting) {
      isExiting.current = true
      exitProgress.current = 0
      exitStartPos.current.copy(camera.position)
    }
  }, [isViewerExiting, camera])

  useFrame((_, delta) => {
    // Enter: zoom in from carousel position to viewer position
    if (!isEnterDone.current && !isExiting.current) {
      enterProgress.current = Math.min(enterProgress.current + delta * 1.2, 1)
      const t = easeInOutCubic(enterProgress.current)
      camera.position.lerpVectors(startPos.current, VIEWER_TARGET, t)
      camera.fov = THREE.MathUtils.lerp(CAROUSEL_FOV, VIEWER_FOV, t)
      camera.updateProjectionMatrix()
      camera.lookAt(0, 0, 0)
      if (enterProgress.current >= 1) {
        isEnterDone.current = true
        controlsRef.current?.update()
      }
    }

    // Exit: zoom out back to carousel position
    if (isExiting.current) {
      exitProgress.current = Math.min(exitProgress.current + delta * 1.0, 1)
      const t = easeInOutCubic(exitProgress.current)
      camera.position.lerpVectors(exitStartPos.current, CAROUSEL_POS, t)
      camera.fov = THREE.MathUtils.lerp(VIEWER_FOV, CAROUSEL_FOV, t)
      camera.updateProjectionMatrix()
      camera.lookAt(0, 0, 0)
      if (exitProgress.current >= 1) {
        isExiting.current = false
        endViewerExit()
      }
    }

    // Disable OrbitControls during camera animations
    if (controlsRef.current) {
      controlsRef.current.enabled = isEnterDone.current && !isExiting.current
    }
  })

  return (
    <>
      <color attach="background" args={['#ebebeb']} />

      <ambientLight intensity={0.88} />
      <directionalLight position={[4, 8, 5]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 3, -3]} intensity={0.45} />

      <ProductViewerMesh />

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
