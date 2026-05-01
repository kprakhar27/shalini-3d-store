import { useEffect, type ReactNode } from 'react'
import { useStore } from '../store/useStore'
import { useCategories } from '../lib/hooks/useCategories'
import { useSubcategories } from '../lib/hooks/useSubcategories'
import { useProductsByCategory } from '../lib/hooks/useProductsByCategory'

export default function DataProvider({ children }: { children: ReactNode }) {
  const selectedCategory = useStore((s) => s.selectedCategory)

  const firestoreCategories    = useCategories()
  const firestoreSubcategories = useSubcategories(selectedCategory)
  const firestoreProducts      = useProductsByCategory(selectedCategory)

  // Sync categories from Firestore → store (keeps static fallback until data arrives).
  // Firestore category docs don't carry a `subcategories` field (those live in a
  // separate collection), so default it to [] here to avoid runtime crashes.
  useEffect(() => {
    if (firestoreCategories && firestoreCategories.length > 0) {
      useStore.setState({
        categories: firestoreCategories.map((c) => ({ ...c, subcategories: c.subcategories ?? [] })),
      })
    }
  }, [firestoreCategories])

  // Merge live subcategory labels into the matching category entry
  useEffect(() => {
    if (!selectedCategory || firestoreSubcategories.length === 0) return
    const labels = firestoreSubcategories.map((s) => s.label)
    useStore.setState((state) => ({
      categories: state.categories.map((c) =>
        c.id === selectedCategory ? { ...c, subcategories: labels } : c,
      ),
    }))
  }, [firestoreSubcategories, selectedCategory])

  // Sync products from Firestore → store, and refresh selectedProduct in place
  // so newly-set fields (e.g. glbUrl) propagate without forcing a re-click.
  // The name fallback handles the case where the user clicked a card while the
  // store still held the static-fallback PRODUCTS (whose IDs don't match Firestore's).
  useEffect(() => {
    if (!firestoreProducts || firestoreProducts.length === 0) return
    useStore.setState((state) => {
      let nextSelected = state.selectedProduct
      let nextVariant  = state.selectedVariant
      if (state.selectedProduct) {
        const fresh =
          firestoreProducts.find((p) => p.id   === state.selectedProduct!.id) ??
          firestoreProducts.find((p) => p.name === state.selectedProduct!.name)
        if (fresh) {
          nextSelected = fresh
          nextVariant = fresh.variants.find((v) => v.label === state.selectedVariant?.label) ?? fresh.variants[0]
        }
      }
      return { products: firestoreProducts, selectedProduct: nextSelected, selectedVariant: nextVariant }
    })
  }, [firestoreProducts])

  return <>{children}</>
}
