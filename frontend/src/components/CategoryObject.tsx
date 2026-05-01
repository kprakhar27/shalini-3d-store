import { useRef, useState, useMemo, Suspense } from 'react'
import { Text, useGLTF } from '@react-three/drei'
import { useStore } from '../store/useStore'
import type { Category } from '../data/categories'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

const CATEGORY_TARGET = 1.6   // world height of the auto-fit GLB

function CategoryGltf({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const obj = scene.clone(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const longest = Math.max(size.x, size.y, size.z) || 1
    const scale = CATEGORY_TARGET / longest
    obj.position.sub(center.multiplyScalar(scale))
    obj.position.y += CATEGORY_TARGET / 2     // sit on the ground
    obj.scale.setScalar(scale)
    return obj
  }, [scene])
  return <primitive object={cloned} />
}

interface Props {
  category: Category
}

function SofaMesh({ color }: { color: string }) {
  return (
    <group>
      {/* seat */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[2.2, 0.3, 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* back */}
      <mesh position={[0, 0.65, -0.4]}>
        <boxGeometry args={[2.2, 0.7, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* left arm */}
      <mesh position={[-1.05, 0.4, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* right arm */}
      <mesh position={[1.05, 0.4, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* legs */}
      {([-0.9, 0.9] as number[]).map((x) =>
        ([-0.35, 0.35] as number[]).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0, z]}>
            <boxGeometry args={[0.1, 0.15, 0.1]} />
            <meshStandardMaterial color="#5a4030" />
          </mesh>
        ))
      )}
    </group>
  )
}

function BedMesh({ color }: { color: string }) {
  return (
    <group>
      {/* platform */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[2, 0.24, 2.8]} />
        <meshStandardMaterial color="#6a5040" />
      </mesh>
      {/* mattress */}
      <mesh position={[0, 0.32, 0.1]}>
        <boxGeometry args={[1.8, 0.2, 2.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* headboard */}
      <mesh position={[0, 0.7, -1.35]}>
        <boxGeometry args={[2, 0.9, 0.14]} />
        <meshStandardMaterial color="#6a5040" />
      </mesh>
      {/* pillow L */}
      <mesh position={[-0.4, 0.46, -0.85]}>
        <boxGeometry args={[0.65, 0.14, 0.5]} />
        <meshStandardMaterial color="#e8e0d4" />
      </mesh>
      {/* pillow R */}
      <mesh position={[0.4, 0.46, -0.85]}>
        <boxGeometry args={[0.65, 0.14, 0.5]} />
        <meshStandardMaterial color="#e8e0d4" />
      </mesh>
    </group>
  )
}

function TableMesh({ color }: { color: string }) {
  return (
    <group>
      {/* top */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[2.4, 0.08, 1.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* legs */}
      {([-1.0, 1.0] as number[]).map((x) =>
        ([-0.5, 0.5] as number[]).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.35, z]}>
            <cylinderGeometry args={[0.05, 0.05, 0.7, 8]} />
            <meshStandardMaterial color="#7a6050" />
          </mesh>
        ))
      )}
    </group>
  )
}

function DeskMesh({ color }: { color: string }) {
  return (
    <group>
      {/* main surface */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[2.2, 0.07, 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* left side panel */}
      <mesh position={[-1.05, 0.38, 0]}>
        <boxGeometry args={[0.07, 0.75, 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* right leg */}
      <mesh position={[1.05, 0.38, 0]}>
        <boxGeometry args={[0.07, 0.75, 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* small shelf */}
      <mesh position={[-0.7, 1.1, -0.35]}>
        <boxGeometry args={[0.9, 0.06, 0.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

export default function CategoryObject({ category }: Props) {
  const [hovered, setHovered] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  const startTransition = useStore((s) => s.startTransition)
  const setSelectedCategory = useStore((s) => s.setSelectedCategory)

  const scale = hovered ? 1.08 : 1

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation()
    setSelectedCategory(category.id)
    // Reset scroll so we land at the top of the multi-carousel page.
    useStore.setState({ pageScrollY: 0, carouselAngles: {} })
    startTransition('productListing')
  }

  const meshProps = { color: category.color }

  return (
    <group
      ref={groupRef}
      position={category.position}
      scale={scale}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {category.glbUrl ? (
        <Suspense fallback={null}>
          <CategoryGltf url={category.glbUrl} />
        </Suspense>
      ) : (
        <>
          {category.meshType === 'sofa' && <SofaMesh {...meshProps} />}
          {category.meshType === 'bed' && <BedMesh {...meshProps} />}
          {category.meshType === 'table' && <TableMesh {...meshProps} />}
          {category.meshType === 'desk' && <DeskMesh {...meshProps} />}
        </>
      )}

      <Text
        position={[0, 1.7, 0]}
        fontSize={0.42}
        color="#0a0a14"
        anchorX="center"
        anchorY="middle"
        letterSpacing={-0.02}
        outlineWidth={0.012}
        outlineColor="#0a0a14"
      >
        {category.label.toUpperCase()}
      </Text>

      {/* hover ring */}
      {hovered && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.3, 1.5, 32]} />
          <meshBasicMaterial color={category.color} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  )
}
