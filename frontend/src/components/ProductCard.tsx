import { useRef, useState, useMemo, Suspense } from 'react'
import { Text, useGLTF } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import type { Product } from '../data/products'
import type { ThreeEvent } from '@react-three/fiber'

// Card-sized GLB renderer — auto-fits to fit in the carousel slot.
const CARD_TARGET = 1.2

function GltfCardModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const obj = scene.clone(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const longest = Math.max(size.x, size.y, size.z) || 1
    const scale = CARD_TARGET / longest
    obj.position.sub(center.multiplyScalar(scale))
    obj.scale.setScalar(scale)
    return obj
  }, [scene])
  return <primitive object={cloned} />
}

interface Props {
  product: Product
  position: [number, number, number]
  rotationY: number
  subcategoryLabel: string
  subcategoryIndex: number
}

const AnimatedGroup = animated('group')

const SUBCATEGORY_SPACING = 5.5

export default function ProductCard({ product, position, rotationY, subcategoryLabel, subcategoryIndex }: Props) {
  const [hovered, setHovered] = useState(false)
  const expandingProductId = useStore((s) => s.expandingProductId)
  const setExpandingProduct = useStore((s) => s.setExpandingProduct)
  const setSelectedProduct = useStore((s) => s.setSelectedProduct)
  const setCarouselAngle = useStore((s) => s.setCarouselAngle)
  const setSnapCarousel = useStore((s) => s.setSnapCarousel)
  const camera = useThree((s) => s.camera)

  const mat1Ref = useRef<THREE.MeshStandardMaterial>(null)
  const mat2Ref = useRef<THREE.MeshStandardMaterial>(null)
  const innerRef = useRef<THREE.Group>(null)

  const scene = useStore((s) => s.scene)
  const isViewer = scene === 'productViewer'

  const baseColor = product.variants[0].color
  const isExpanding = expandingProductId === product.id
  const isFading = expandingProductId !== null && !isExpanding
  const anyExpanding = expandingProductId !== null

  const { scale, opacity } = useSpring({
    scale: isExpanding && !isViewer ? 2.8 : hovered && !anyExpanding ? 1.1 : 1,
    opacity: isFading || (isExpanding && isViewer) ? 0 : 1,
    config: { mass: 1, tension: 200, friction: 24 },
  })

  useFrame(() => {
    // Drive material opacity
    const op = opacity.get()
    if (mat1Ref.current) mat1Ref.current.opacity = op
    if (mat2Ref.current) mat2Ref.current.opacity = op

    // Counter-rotate inner group against all ancestors so card always faces +Z (camera)
    if (innerRef.current) {
      let totalY = 0
      let obj: THREE.Object3D | null = innerRef.current.parent
      while (obj) {
        totalY += obj.rotation.y
        obj = obj.parent
      }
      innerRef.current.rotation.y = -totalY
    }
  })

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    if (anyExpanding) return

    // Phase 0 — scroll the page so this card's carousel is centered.
    useStore.getState().setPageScrollY(subcategoryIndex * SUBCATEGORY_SPACING)

    // Compute the carousel group rotation needed to bring THIS card to front-center.
    // Card sits at local angle θ = atan2(z, x); group needs rotation cardAngle - π/2.
    const cardAngle = Math.atan2(position[2], position[0])
    const targetGroupAngle = cardAngle - Math.PI / 2

    // Shortest-path delta from current carousel angle for THIS subcategory.
    const current = useStore.getState().carouselAngles[subcategoryLabel] ?? 0
    let delta = targetGroupAngle - current
    delta = delta - Math.round(delta / (Math.PI * 2)) * (Math.PI * 2)
    setCarouselAngle(subcategoryLabel, current + delta)
    setSnapCarousel(true) // use faster lerp while centering

    // Phase 1 — wait for scroll + carousel to settle, then expand.
    setTimeout(() => {
      setSnapCarousel(false)
      setExpandingProduct(product.id)

      // Phase 2 — wait for expand animation, then zoom camera into viewer.
      // Look up the latest version of the product so Firestore updates that
      // landed after the carousel last rendered (e.g. glbUrl) reach the viewer.
      setTimeout(() => {
        const latest = useStore.getState().products.find(
          (p) => p.id === product.id || p.name === product.name,
        ) ?? product
        setSelectedProduct(latest)
        useStore.setState({
          cameraStartPosition: camera.position.toArray() as [number, number, number],
          scene: 'productViewer',
        })
      }, 320)
    }, 520)
  }

  const yOffset = hovered && !anyExpanding ? 0.12 : 0

  return (
    <AnimatedGroup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      position={[position[0], position[1] + yOffset, position[2]] as any}
      rotation={[0, rotationY, 0]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scale={scale as any}
      onClick={handleClick}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        if (!anyExpanding) { setHovered(true); document.body.style.cursor = 'pointer' }
      }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      <group ref={innerRef}>
        {product.glbUrl ? (
          <Suspense fallback={null}>
            <GltfCardModel url={product.glbUrl} />
          </Suspense>
        ) : (
          <>
            {/* Main body */}
            <mesh castShadow>
              <boxGeometry args={[1.1, 1.5, 0.18]} />
              <meshStandardMaterial
                ref={mat1Ref}
                color={baseColor}
                emissive={isExpanding ? baseColor : hovered && !anyExpanding ? baseColor : '#000000'}
                emissiveIntensity={isExpanding ? 0.5 : hovered && !anyExpanding ? 0.25 : 0}
                metalness={0.1}
                roughness={0.55}
                transparent
              />
            </mesh>

            {/* Inner detail panel */}
            <mesh position={[0, 0.1, 0.095]}>
              <boxGeometry args={[0.85, 1.1, 0.01]} />
              <meshStandardMaterial
                ref={mat2Ref}
                color={baseColor}
                emissive={baseColor}
                emissiveIntensity={0.15}
                roughness={0.9}
                transparent
              />
            </mesh>
          </>
        )}

        {/* Labels — hidden as soon as any expand starts */}
        {!anyExpanding && (
          <>
            <Text
              position={[0, -0.95, 0.1]}
              fontSize={0.14}
              color="#0a0a14"
              anchorX="center"
              anchorY="top"
              maxWidth={1.1}
            >
              {product.name}
            </Text>
            <Text
              position={[0, -1.15, 0.1]}
              fontSize={0.12}
              color="#5a5a70"
              anchorX="center"
              anchorY="top"
            >
              {`$${product.price.toLocaleString()}`}
            </Text>
          </>
        )}

        {/* Hover glow ring */}
        {hovered && !anyExpanding && (
          <mesh position={[0, -0.76, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.3, 0.25]} />
            <meshBasicMaterial color={baseColor} transparent opacity={0.28} />
          </mesh>
        )}
      </group>
    </AnimatedGroup>
  )
}
