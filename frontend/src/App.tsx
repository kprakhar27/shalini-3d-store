import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { useStore } from './store/useStore'
import HomeScene from './scenes/HomeScene'
import ProductScene from './scenes/ProductScene'
import WormholeOverlay from './components/WormholeOverlay'
import CartUI from './components/CartUI'
import AIPipelinePanel from './components/AIPipelinePanel'
import ViewerPanel from './components/ProductListingOverlay'
import SubcategoryHeading from './components/SubcategoryHeading'
import HomeBrand from './components/HomeBrand'
import DataProvider from './components/DataProvider'

// Admin pages — lazy loaded so they don't bloat the storefront bundle
const AdminApp    = lazy(() => import('./admin/AdminApp'))

// ── Storefront ────────────────────────────────────────────────────────────────

function SceneRouter() {
  const scene = useStore((s) => s.scene)
  if (scene === 'home') return <HomeScene />
  return <ProductScene />
}

function BackButton() {
  const scene = useStore((s) => s.scene)
  const goBack = useStore((s) => s.goBack)
  if (scene === 'home') return null
  return (
    <button className="back-btn" onClick={goBack}>
      ← Back
    </button>
  )
}

function SceneHint() {
  const scene = useStore((s) => s.scene)
  if (scene === 'productViewer') return null
  const hints: Record<string, string> = {
    home: 'Click a category to explore',
    subcategory: 'Choose a subcategory',
    productListing: 'Scroll or drag to spin · Click a product',
  }
  return <div className="scene-hint">{hints[scene] ?? ''}</div>
}

function AiButton() {
  const setAiPanelOpen = useStore((s) => s.setAiPanelOpen)
  return (
    <button className="ai-btn" onClick={() => setAiPanelOpen(true)}>
      Admin & AI
    </button>
  )
}

function StorefrontApp() {
  const scene = useStore((s) => s.scene)
  const isViewer = scene === 'productViewer'

  return (
    <DataProvider>
      <div style={{ width: '100vw', height: '100vh', background: '#ebebeb', overflow: 'hidden' }}>
        <div className="scene-canvas-wrapper">
          <Canvas
            shadows
            camera={{ position: [0, 4, 10], fov: 55, near: 0.1, far: 200 }}
            dpr={[1, 2]}
            gl={{ antialias: true }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <SceneRouter />
            </Suspense>
          </Canvas>
        </div>

        {isViewer && <ViewerPanel />}
        <HomeBrand />
        <SubcategoryHeading />
        <WormholeOverlay />
        <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AiButton />
          <BackButton />
        </div>
        <CartUI />
        <AIPipelinePanel />
        {!isViewer && <SceneHint />}
      </div>
    </DataProvider>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
        <Route path="/*" element={<StorefrontApp />} />
      </Routes>
    </BrowserRouter>
  )
}
