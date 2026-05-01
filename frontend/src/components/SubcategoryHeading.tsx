import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useStore } from '../store/useStore'
import { useSubcategories } from '../lib/hooks/useSubcategories'
import { useProductsByCategory } from '../lib/hooks/useProductsByCategory'

const SUBCATEGORY_SPACING = 5.5

const wordVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  show:   { opacity: 1, y: 0,  transition: { type: 'spring' as const, stiffness: 260, damping: 24 } },
  exit:   { opacity: 0, y: 20, transition: { duration: 0.22 } },
}

/**
 * Big top-left subcategory name on the merged listing page —
 * mirrors the product viewer's `.viewer-bg-name` style. Crossfades
 * to the next subcategory as the user scrolls between carousels.
 */
export default function SubcategoryHeading() {
  const scene             = useStore((s) => s.scene)
  const selectedCategory  = useStore((s) => s.selectedCategory)
  const pageScrollY       = useStore((s) => s.pageScrollY)
  const subcategories     = useSubcategories(selectedCategory)
  const products          = useProductsByCategory(selectedCategory)

  // Subscribe to the smoothed pageScrollY value so the heading swap aligns
  // with the visual snap rather than the raw target.
  const [activeIndex, setActiveIndex] = useState(0)
  useEffect(() => {
    if (subcategories.length === 0) return
    const idx = Math.max(
      0,
      Math.min(subcategories.length - 1, Math.round(pageScrollY / SUBCATEGORY_SPACING)),
    )
    setActiveIndex(idx)
  }, [pageScrollY, subcategories])

  // Live count of products in whatever subcategory is currently centered.
  const currentSubProductCount = useMemo(() => {
    if (!products || subcategories.length === 0) return 0
    const label = subcategories[activeIndex]?.label
    if (!label) return 0
    return products.filter((p) => p.subcategoryId === label).length
  }, [products, subcategories, activeIndex])

  if (scene !== 'productListing' || subcategories.length === 0) return null
  const current = subcategories[activeIndex]
  if (!current) return null

  const words = current.label.toUpperCase().split(' ')
  const indexLabel = String(activeIndex + 1).padStart(2, '0')
  const totalLabel = String(Math.max(currentSubProductCount, 1)).padStart(2, '0')

  return (
    <AnimatePresence mode="wait">
      <motion.div key={current.label} className="viewer-bg-name">
        <motion.div className="viewer-bg-counter" variants={wordVariants} initial="hidden" animate="show" exit="exit">
          <span className="viewer-bg-counter-current">{indexLabel}</span>
          <span className="viewer-bg-counter-sep">—</span>
          <span className="viewer-bg-counter-total">{totalLabel}</span>
        </motion.div>
        {words.map((w, i) => (
          <div key={i} style={{ overflow: 'hidden' }}>
            <motion.div
              className="viewer-bg-word"
              variants={wordVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={{ delay: i * 0.04 }}
            >
              {w}
            </motion.div>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
