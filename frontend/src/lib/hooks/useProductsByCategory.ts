import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/client'
import type { Product } from '../../data/products'

/**
 * Real-time subscription to every published product within a category.
 * Used by the merged multi-carousel ProductScene which groups products
 * by subcategory client-side.
 */
export function useProductsByCategory(categoryId: string | null) {
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured || !categoryId) { setProducts(null); return }
    const q = query(
      collection(db, 'products'),
      where('categoryId', '==', categoryId),
      where('published',  '==', true),
    )
    return onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product))
    })
  }, [categoryId])

  return products
}
