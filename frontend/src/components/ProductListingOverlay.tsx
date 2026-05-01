import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useStore } from '../store/useStore'


// Stagger container — children slide up one after another
const barContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.45 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.04, staggerDirection: -1 as const },
  },
}

const barItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
  exit:   { opacity: 0, y: 12, transition: { duration: 0.18 } },
}

const nameItem: Variants = {
  hidden: { opacity: 0, y: -20 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 24 } },
  exit:   { opacity: 0, y: -20, transition: { duration: 0.22 } },
}

const hoverContainer: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
  exit:   { opacity: 0, transition: { staggerChildren: 0.04, staggerDirection: -1 as const } },
}

const hoverItem: Variants = {
  hidden: { opacity: 0, y: '100%' },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 24 } },
  exit:   { opacity: 0, y: '80%', transition: { duration: 0.16 } },
}

export default function ViewerPanel() {
  const selectedProduct    = useStore((s) => s.selectedProduct)
  const selectedVariant    = useStore((s) => s.selectedVariant)
  const setSelectedVariant = useStore((s) => s.setSelectedVariant)
  const triggerAddToCart   = useStore((s) => s.triggerAddToCart)
  const viewerHovered      = useStore((s) => s.viewerHovered)
  const isViewerExiting    = useStore((s) => s.isViewerExiting)
  const allProducts        = useStore((s) => s.products)

  if (!selectedProduct) return null

  // Position within the current subcategory (live store products), not the static fallback.
  const subProducts = allProducts.filter((p) => p.subcategoryId === selectedProduct.subcategoryId)
  const idx = subProducts.findIndex(
    (p) => p.id === selectedProduct.id || p.name === selectedProduct.name,
  )
  const words = selectedProduct.name.toUpperCase().split(' ')
  const indexLabel = String(idx >= 0 ? idx + 1 : 1).padStart(2, '0')
  const totalLabel = String(Math.max(subProducts.length, 1)).padStart(2, '0')

  const showHover = viewerHovered && !isViewerExiting

  return (
    <>
      {/* ── Ghost name top-left — staggered words slide down ── */}
      <motion.div
        className="viewer-bg-name"
        variants={barContainer}
        initial="hidden"
        animate={isViewerExiting ? 'exit' : 'show'}
      >
        <motion.div className="viewer-bg-counter" variants={nameItem}>
          <span className="viewer-bg-counter-current">{indexLabel}</span>
          <span className="viewer-bg-counter-sep">—</span>
          <span className="viewer-bg-counter-total">{totalLabel}</span>
        </motion.div>
        {words.map((w, i) => (
          <div key={i} style={{ overflow: 'hidden' }}>
            <motion.div className="viewer-bg-word" variants={nameItem}>{w}</motion.div>
          </div>
        ))}
      </motion.div>

      {/* ── Nike-style hover card ── */}
      <AnimatePresence>
        {showHover && (
          <motion.div
            className="viewer-center-desc"
            variants={hoverContainer}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {/* Counter */}
            <div style={{ overflow: 'hidden' }}>
              <motion.div className="viewer-card-counter" variants={hoverItem}>
                {indexLabel}
              </motion.div>
            </div>

            {/* Stacked product name — last word as outline accent */}
            {words.map((w, i) => (
              <div key={i} style={{ overflow: 'hidden' }}>
                <motion.div
                  className={i === words.length - 1 ? 'viewer-card-name-accent' : 'viewer-card-name'}
                  variants={hoverItem}
                >
                  {w}
                </motion.div>
              </div>
            ))}

            {/* Category */}
            <div style={{ overflow: 'hidden' }}>
              <motion.div className="viewer-card-category" variants={hoverItem}>
                Living Room · Seating
              </motion.div>
            </div>

            {/* Price */}
            <div style={{ overflow: 'hidden' }}>
              <motion.div className="viewer-card-price" variants={hoverItem}>
                ${selectedProduct.price.toLocaleString()}
              </motion.div>
            </div>

            {/* Description */}
            <div style={{ overflow: 'hidden' }}>
              <motion.p className="viewer-card-desc" variants={hoverItem}>
                {selectedProduct.description}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom bar — staggered items slide up ── */}
      <motion.div
        className="viewer-bottom-bar"
        variants={barContainer}
        initial="hidden"
        animate={isViewerExiting ? 'exit' : 'show'}
      >
        <motion.div className="viewer-bottom-swatches" variants={barItem}>
          {selectedProduct.variants.map((v) => (
            <button
              key={v.label}
              className={`viewer-swatch${selectedVariant?.label === v.label ? ' viewer-swatch--active' : ''}`}
              style={{ background: v.color }}
              title={v.label}
              onClick={() => setSelectedVariant(v)}
            />
          ))}
          <span className="viewer-bottom-variant">{selectedVariant?.label}</span>
        </motion.div>

        <motion.div className="viewer-bottom-divider" variants={barItem} />

        <motion.span className="listing-price" variants={barItem}>
          ${selectedProduct.price.toLocaleString()}
        </motion.span>

        <motion.button className="viewer-atc-btn" variants={barItem} onClick={triggerAddToCart}>
          Add to Cart
        </motion.button>

        <div style={{ flex: 1 }} />

        <motion.span className="viewer-hint" variants={barItem}>
          Drag to rotate · Scroll to zoom
        </motion.span>
      </motion.div>
    </>
  )
}
