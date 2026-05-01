import { create } from 'zustand'
import type { Product, Variant } from '../data/products'
import type { Category } from '../data/categories'
import { CATEGORIES } from '../data/categories'
import { PRODUCTS } from '../data/products'

export type Scene = 'home' | 'productListing' | 'productViewer'

export interface CartItem {
  id: string                    // unique per product+variant entry
  productId: string
  productName: string
  variantLabel: string
  variantColor: string
  price: number
  quantity: number
}

interface Store {
  scene: Scene
  transitioning: boolean
  pendingScene: Scene | null
  selectedCategory: string | null
  selectedSubcategory: string | null
  selectedProduct: Product | null
  selectedVariant: Variant | null
  // Firestore-backed data (initialized from static fallbacks)
  categories: Category[]
  products: Product[]
  carouselAngles: Record<string, number>     // keyed by subcategory label
  pageScrollY: number                         // current vertical scroll offset (world units)
  listingIndex: number
  listingHovered: boolean
  expandingProductId: string | null
  cartItems: CartItem[]
  cartAnimating: boolean
  cartFlightColor: string | null
  cartOpen: boolean
  aiPanelOpen: boolean
  isViewerExiting: boolean
  viewerHovered: boolean
  cameraStartPosition: [number, number, number] | null
  snapCarousel: boolean

  startTransition: (next: Scene) => void
  endTransition: () => void
  setSelectedCategory: (id: string) => void
  setSelectedSubcategory: (label: string) => void
  setSelectedProduct: (p: Product | null) => void
  setSelectedVariant: (v: Variant) => void
  setCarouselAngle: (label: string, a: number) => void
  setPageScrollY: (y: number) => void
  setListingIndex: (i: number) => void
  setListingHovered: (v: boolean) => void
  setExpandingProduct: (id: string | null) => void
  triggerAddToCart: () => void
  finishCartAnimation: () => void
  removeCartItem: (id: string) => void
  changeCartQuantity: (id: string, delta: number) => void
  setCartOpen: (open: boolean) => void
  setAiPanelOpen: (v: boolean) => void
  startViewerExit: () => void
  endViewerExit: () => void
  setViewerHovered: (v: boolean) => void
  setSnapCarousel: (v: boolean) => void
  goBack: () => void
}

export const useStore = create<Store>((set, get) => ({
  scene: 'home',
  transitioning: false,
  pendingScene: null,
  selectedCategory: null,
  selectedSubcategory: null,
  selectedProduct: null,
  selectedVariant: null,
  categories: CATEGORIES,
  products: PRODUCTS,
  carouselAngles: {},
  pageScrollY: 0,
  listingIndex: 0,
  listingHovered: false,
  expandingProductId: null,
  cartItems: [],
  cartAnimating: false,
  cartFlightColor: null,
  cartOpen: false,
  aiPanelOpen: false,
  isViewerExiting: false,
  viewerHovered: false,
  cameraStartPosition: null,
  snapCarousel: false,

  startTransition: (next) => set({ transitioning: true, pendingScene: next, expandingProductId: null }),

  endTransition: () => {
    const { pendingScene } = get()
    if (pendingScene) {
      set({ scene: pendingScene, transitioning: false, pendingScene: null })
    }
  },

  setSelectedCategory: (id) => set({ selectedCategory: id }),
  setSelectedSubcategory: (label) => set({ selectedSubcategory: label }),
  setSelectedProduct: (p) =>
    set({ selectedProduct: p, selectedVariant: p ? p.variants[0] : null }),
  setSelectedVariant: (v) => set({ selectedVariant: v }),
  setCarouselAngle: (label, a) => set((s) => ({ carouselAngles: { ...s.carouselAngles, [label]: a } })),
  setPageScrollY: (y) => set({ pageScrollY: y }),
  setListingIndex: (i) => set({ listingIndex: i, listingHovered: false }),
  setListingHovered: (v) => set({ listingHovered: v }),
  setExpandingProduct: (id) => set({ expandingProductId: id }),

  triggerAddToCart: () => {
    const s = get()
    if (!s.selectedProduct || !s.selectedVariant) return
    set({ cartAnimating: true, cartFlightColor: s.selectedVariant.color })
  },

  finishCartAnimation: () => {
    const s = get()
    if (!s.selectedProduct || !s.selectedVariant) {
      set({ cartAnimating: false, cartFlightColor: null })
      return
    }
    const product = s.selectedProduct
    const variant = s.selectedVariant
    const itemId  = `${product.id}__${variant.label}`
    const existing = s.cartItems.find((i) => i.id === itemId)
    const cartItems = existing
      ? s.cartItems.map((i) => i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i)
      : [...s.cartItems, {
          id:           itemId,
          productId:    product.id,
          productName:  product.name,
          variantLabel: variant.label,
          variantColor: variant.color,
          price:        product.price,
          quantity:     1,
        }]
    set({ cartItems, cartAnimating: false, cartFlightColor: null })
  },

  removeCartItem: (id) => set((s) => ({ cartItems: s.cartItems.filter((i) => i.id !== id) })),

  changeCartQuantity: (id, delta) => set((s) => ({
    cartItems: s.cartItems
      .map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
      .filter((i) => i.quantity > 0),
  })),

  setCartOpen: (open) => set({ cartOpen: open }),

  setAiPanelOpen: (v) => set({ aiPanelOpen: v }),

  startViewerExit: () => set({ isViewerExiting: true }),
  endViewerExit: () => set({ isViewerExiting: false, viewerHovered: false, scene: 'productListing' }),
  setViewerHovered: (v) => set({ viewerHovered: v }),
  setSnapCarousel: (v) => set({ snapCarousel: v }),

  goBack: () => {
    const { scene } = get()
    if (scene === 'productViewer') {
      set({ isViewerExiting: true })
      return
    }
    const prev: Record<Scene, Scene> = {
      home: 'home',
      productListing: 'home',
      productViewer: 'productListing',
    }
    const next = prev[scene]
    if (next !== scene) {
      set({ transitioning: true, pendingScene: next })
    }
  },
}))
