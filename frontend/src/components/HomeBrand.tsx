import { motion, type Variants } from 'framer-motion'
import { useStore } from '../store/useStore'

const wordVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  show:   { opacity: 1, y: 0,  transition: { type: 'spring' as const, stiffness: 260, damping: 24 } },
}

/**
 * Big top-left brand wordmark on the Home scene — same `.viewer-bg-name`
 * typography as the subcategory and product viewer headings, so the brand
 * carries through every screen.
 */
export default function HomeBrand() {
  const scene = useStore((s) => s.scene)
  if (scene !== 'home') return null

  return (
    <motion.div
      className="viewer-bg-name"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
    >
      <motion.div className="viewer-bg-counter" variants={wordVariants}>
        <span className="viewer-bg-counter-current">EST</span>
        <span className="viewer-bg-counter-sep">·</span>
        <span className="viewer-bg-counter-total">2026</span>
      </motion.div>
      <div style={{ overflow: 'hidden' }}>
        <motion.div className="viewer-bg-word" variants={wordVariants}>
          SHALINI
        </motion.div>
      </div>
      <div style={{ overflow: 'hidden' }}>
        <motion.div className="viewer-bg-word home-brand-outline" variants={wordVariants}>
          3D STORE
        </motion.div>
      </div>
    </motion.div>
  )
}
