import { useStore } from '../store/useStore'

export default function VariantPicker() {
  const selectedProduct = useStore((s) => s.selectedProduct)
  const selectedVariant = useStore((s) => s.selectedVariant)
  const setSelectedVariant = useStore((s) => s.setSelectedVariant)
  const triggerAddToCart = useStore((s) => s.triggerAddToCart)
  const scene = useStore((s) => s.scene)

  if (scene !== 'productViewer' || !selectedProduct) return null

  return (
    <div className="variant-bar">
      <div className="variant-info">
        <h3>{selectedProduct.name}</h3>
        <p>${selectedProduct.price.toLocaleString()} &nbsp;·&nbsp; {selectedProduct.description}</p>
      </div>

      <div className="variant-swatches">
        {selectedProduct.variants.map((v) => (
          <div
            key={v.label}
            className={`swatch${selectedVariant?.label === v.label ? ' active' : ''}`}
            style={{ background: v.color }}
            title={v.label}
            onClick={() => setSelectedVariant(v)}
          />
        ))}
      </div>

      <div style={{ fontSize: '12px', color: '#6060a0', minWidth: '90px' }}>
        {selectedVariant?.label ?? ''}
      </div>

      <button className="add-to-cart-btn" onClick={triggerAddToCart}>
        Add to Cart
      </button>
    </div>
  )
}
