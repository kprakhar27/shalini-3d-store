import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/client'
import type { Subcategory } from '../../data/categories'

export function useSubcategories(categoryId: string | null) {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  useEffect(() => {
    if (!isFirebaseConfigured || !categoryId) { setSubcategories([]); return }
    // Sort client-side to avoid needing a composite (categoryId + order) index.
    const q = query(collection(db, 'subcategories'), where('categoryId', '==', categoryId))
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Subcategory)
      docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setSubcategories(docs)
    })
  }, [categoryId])

  return subcategories
}
