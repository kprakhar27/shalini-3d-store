import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/client'
import type { Category } from '../../data/categories'

export function useCategories() {
  const [categories, setCategories] = useState<Category[] | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    const q = query(collection(db, 'categories'), orderBy('order', 'asc'))
    return onSnapshot(q, (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category))
    })
  }, [])

  return categories
}
