import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/client'
import type { Product } from '../../data/products'

export function useProducts(categoryId: string | null, subcategoryId: string | null) {
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured || !categoryId || !subcategoryId) { setProducts(null); return }
    const q = query(
      collection(db, 'products'),
      where('categoryId', '==', categoryId),
      where('subcategoryId', '==', subcategoryId),
      where('published', '==', true),
    )
    return onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product))
    })
  }, [categoryId, subcategoryId])

  return products
}
