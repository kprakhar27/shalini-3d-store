import { useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase/client'
import { useEffect } from 'react'
import type { Category, Subcategory } from '../data/categories'

const MESH_TYPES = ['sofa', 'bed', 'table', 'desk'] as const

// ── inline subcategory manager ────────────────────────────────────────────────

function SubcategoryList({ categoryId }: { categoryId: string }) {
  const [subs, setSubs]     = useState<Subcategory[]>([])
  const [newLabel, setNew]  = useState('')

  useEffect(() => {
    const q = query(
      collection(db, 'subcategories'),
      orderBy('order', 'asc'),
    )
    return onSnapshot(q, (snap) => {
      setSubs(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Subcategory)
          .filter((s) => s.categoryId === categoryId),
      )
    })
  }, [categoryId])

  async function addSub() {
    const label = newLabel.trim()
    if (!label) return
    await addDoc(collection(db, 'subcategories'), {
      categoryId,
      label,
      order:     subs.length,
      createdAt: serverTimestamp(),
    })
    setNew('')
  }

  async function deleteSub(id: string) {
    await deleteDoc(doc(db, 'subcategories', id))
  }

  return (
    <div className="admin-sub-list">
      {subs.map((s) => (
        <div key={s.id} className="admin-sub-item">
          <span>{s.label}</span>
          <button onClick={() => deleteSub(s.id)}>✕</button>
        </div>
      ))}
      <div className="admin-sub-add">
        <input
          placeholder="New subcategory…"
          value={newLabel}
          onChange={(e) => setNew(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSub()}
        />
        <button onClick={addSub}>Add</button>
      </div>
    </div>
  )
}

// ── category form ─────────────────────────────────────────────────────────────

const BLANK: Omit<Category, 'id' | 'subcategories'> = {
  label:    '',
  meshType: 'sofa',
  color:    '#7c6af7',
  position: [0, 0, 0],
  order:    0,
  glbUrl:   '',
}

function CategoryForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<typeof BLANK>
  onSave: (data: typeof BLANK) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK, ...initial })

  return (
    <div className="admin-form">
      <label>
        Label
        <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
      </label>
      <label>
        Mesh type
        <select value={form.meshType} onChange={(e) => setForm({ ...form, meshType: e.target.value as typeof BLANK['meshType'] })}>
          {MESH_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label>
        Color
        <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
      </label>
      <label>
        Order
        <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
      </label>
      <label>
        GLB URL <span style={{ fontWeight: 400, color: '#888' }}>(optional — replaces the procedural placeholder mesh on the home page)</span>
        <input
          value={form.glbUrl ?? ''}
          placeholder="https://example.com/sofa.glb"
          onChange={(e) => setForm({ ...form, glbUrl: e.target.value })}
        />
      </label>
      <div className="admin-form-actions">
        <button onClick={() => onSave(form)}>Save</button>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [editing, setEditing]       = useState<string | null>(null)
  const [adding, setAdding]         = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('order', 'asc'))
    return onSnapshot(q, (snap) => {
      setCategories(snap.docs.map((d) => ({ subcategories: [], ...d.data(), id: d.id }) as unknown as Category))
    })
  }, [])

  function normalize(data: typeof BLANK) {
    return { ...data, glbUrl: data.glbUrl?.trim() || null }
  }

  async function addCategory(data: typeof BLANK) {
    await addDoc(collection(db, 'categories'), { ...normalize(data), createdAt: serverTimestamp() })
    setAdding(false)
  }

  async function saveCategory(id: string, data: typeof BLANK) {
    await updateDoc(doc(db, 'categories', id), { ...normalize(data), updatedAt: serverTimestamp() })
    setEditing(null)
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete category and all its subcategories?')) return
    await deleteDoc(doc(db, 'categories', id))
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Categories</h2>
        <button onClick={() => setAdding(true)}>+ Add category</button>
      </div>

      {adding && (
        <CategoryForm onSave={addCategory} onCancel={() => setAdding(false)} />
      )}

      {categories.map((cat) => (
        <div key={cat.id} className="admin-card">
          <div className="admin-card-header">
            <span className="admin-color-dot" style={{ background: cat.color }} />
            <strong>{cat.label}</strong>
            <span className="admin-badge">{cat.meshType}</span>
            <div className="admin-card-actions">
              <button onClick={() => setEditing(cat.id)}>Edit</button>
              <button className="danger" onClick={() => deleteCategory(cat.id)}>Delete</button>
            </div>
          </div>

          {editing === cat.id && (
            <CategoryForm
              initial={{ label: cat.label, meshType: cat.meshType, color: cat.color, position: cat.position, order: cat.order, glbUrl: cat.glbUrl ?? '' }}
              onSave={(data) => saveCategory(cat.id, data)}
              onCancel={() => setEditing(null)}
            />
          )}

          <SubcategoryList categoryId={cat.id} />
        </div>
      ))}
    </div>
  )
}
