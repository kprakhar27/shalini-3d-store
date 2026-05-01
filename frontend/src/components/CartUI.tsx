import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'

// ── Flying ball animation: starts from viewer center, lands in cart icon ──────

interface FlyState {
  color: string
  fx: number
  fy: number
  tx: number
  ty: number
  key: number
}

const FLIGHT_MS = 700

function CartFly({ state }: { state: FlyState }) {
  // Bezier-like flight: arc up, then down into the cart with squash on landing.
  return (
    <motion.div
      key={state.key}
      className="cart-fly-ball"
      initial={{ x: state.fx, y: state.fy, scale: 0.6, opacity: 0 }}
      animate={{
        x: [state.fx, (state.fx + state.tx) / 2, state.tx],
        y: [state.fy, Math.min(state.fy, state.ty) - 220, state.ty],
        scale: [0.6, 1.4, 0.4],
        opacity: [0, 1, 1, 0.85],
      }}
      transition={{ duration: FLIGHT_MS / 1000, ease: ['easeOut', 'easeIn'], times: [0, 0.55, 1] }}
      style={{ background: state.color }}
    />
  )
}

// ── Cart drawer ───────────────────────────────────────────────────────────────

function CartDrawer() {
  const cartOpen           = useStore((s) => s.cartOpen)
  const setCartOpen        = useStore((s) => s.setCartOpen)
  const cartItems          = useStore((s) => s.cartItems)
  const removeCartItem     = useStore((s) => s.removeCartItem)
  const changeCartQuantity = useStore((s) => s.changeCartQuantity)

  const total    = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalQty = cartItems.reduce((s, i) => s + i.quantity, 0)

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            className="cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
          />
          <motion.aside
            className="cart-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36 }}
          >
            <header className="cart-drawer-header">
              <h2>Cart {totalQty > 0 && <span className="cart-drawer-count">({totalQty})</span>}</h2>
              <button className="cart-drawer-close" aria-label="Close" onClick={() => setCartOpen(false)}>×</button>
            </header>

            {cartItems.length === 0 ? (
              <div className="cart-drawer-empty">
                Your cart is empty.
                <span>Click any product → Add to Cart.</span>
              </div>
            ) : (
              <ul className="cart-drawer-list">
                {cartItems.map((item) => (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24, height: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    className="cart-drawer-item"
                  >
                    <span className="cart-drawer-swatch" style={{ background: item.variantColor }} />
                    <div className="cart-drawer-meta">
                      <strong>{item.productName}</strong>
                      <span className="cart-drawer-variant">{item.variantLabel}</span>
                      <span className="cart-drawer-price">${item.price.toLocaleString()}</span>
                    </div>
                    <div className="cart-drawer-qty">
                      <button onClick={() => changeCartQuantity(item.id, -1)} aria-label="Decrease">−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => changeCartQuantity(item.id,  1)} aria-label="Increase">+</button>
                    </div>
                    <button
                      className="cart-drawer-remove"
                      aria-label="Remove"
                      onClick={() => removeCartItem(item.id)}
                    >
                      ×
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}

            {cartItems.length > 0 && (
              <footer className="cart-drawer-footer">
                <div className="cart-drawer-total">
                  <span>Total</span>
                  <strong>${total.toLocaleString()}</strong>
                </div>
                <button className="cart-drawer-checkout" disabled>Checkout</button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Top-level cart icon + flight + drawer ─────────────────────────────────────

export default function CartUI() {
  const cartItems       = useStore((s) => s.cartItems)
  const cartAnimating   = useStore((s) => s.cartAnimating)
  const flightColor     = useStore((s) => s.cartFlightColor)
  const finishCartAnim  = useStore((s) => s.finishCartAnimation)
  const setCartOpen     = useStore((s) => s.setCartOpen)
  const cartRef = useRef<HTMLButtonElement>(null)
  const [flyState, setFlyState] = useState<FlyState | null>(null)
  const [badgeKey, setBadgeKey] = useState(0)

  const totalQty = cartItems.reduce((s, i) => s + i.quantity, 0)

  useEffect(() => {
    if (!cartAnimating || !cartRef.current || !flightColor) return

    const rect = cartRef.current.getBoundingClientRect()
    const tx = rect.left + rect.width / 2 - 14
    const ty = rect.top  + rect.height / 2 - 14
    const fx = window.innerWidth / 2 - 14
    const fy = window.innerHeight / 2 - 14

    setFlyState({ color: flightColor, fx, fy, tx, ty, key: Date.now() })

    const t = setTimeout(() => {
      finishCartAnim()
      setFlyState(null)
      setBadgeKey((k) => k + 1)
    }, FLIGHT_MS)

    return () => clearTimeout(t)
  }, [cartAnimating, flightColor, finishCartAnim])

  return (
    <>
      <button
        ref={cartRef}
        className="cart-icon"
        aria-label="Open cart"
        onClick={() => setCartOpen(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {totalQty > 0 && (
          <motion.span
            key={badgeKey}
            className="cart-badge"
            initial={{ scale: 0.6 }}
            animate={{ scale: [0.6, 1.4, 1] }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {totalQty}
          </motion.span>
        )}
      </button>

      <AnimatePresence>{flyState && <CartFly state={flyState} />}</AnimatePresence>

      <CartDrawer />
    </>
  )
}
