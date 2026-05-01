import { OrbitControls, Grid } from '@react-three/drei'
import { useStore } from '../store/useStore'
import CategoryObject from '../components/CategoryObject'

export default function HomeScene() {
  const categories = useStore((s) => s.categories)

  return (
    <>
      <color attach="background" args={['#ebebeb']} />
      <fog attach="fog" args={['#ebebeb', 16, 32]} />

      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 6]} intensity={1.4} castShadow />
      <pointLight position={[-6, 4, -6]} intensity={0.3} color="#6c63ff" />
      <pointLight position={[6, 4, 6]} intensity={0.2} color="#3ecfcf" />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e0e0d8" metalness={0} roughness={1} />
      </mesh>

      <Grid
        position={[0, 0, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#d0d0c8"
        sectionSize={4}
        sectionThickness={0.8}
        sectionColor="#c0c0b8"
        fadeDistance={20}
        fadeStrength={2}
        infiniteGrid
      />

      {categories.map((cat) => (
        <CategoryObject key={cat.id} category={cat} />
      ))}

      <OrbitControls
        enablePan={false}
        minPolarAngle={0.25}
        maxPolarAngle={1.35}
        minDistance={6}
        maxDistance={18}
        target={[0, 0.5, 0]}
      />
    </>
  )
}
