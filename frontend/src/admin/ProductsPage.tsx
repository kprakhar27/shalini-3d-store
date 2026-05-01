import { useEffect, useMemo, useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, onSnapshot, arrayUnion,
} from 'firebase/firestore'
import { db } from '../lib/firebase/client'
import type { Product, Variant } from '../data/products'
import type { Category, Subcategory } from '../data/categories'
import ImageUploader from './ImageUploader'
import { useGenerationJob } from '../lib/hooks/useGenerationJob'
import { useCategories } from '../lib/hooks/useCategories'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// All subcategories across the project — used to drive admin dropdowns.
function useAllSubcategories(): Subcategory[] {
  const [subs, setSubs] = useState<Subcategory[]>([])
  useEffect(() => {
    return onSnapshot(collection(db, 'subcategories'), (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Subcategory)
      docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      setSubs(docs)
    })
  }, [])
  return subs
}

// ── Generation status badge ───────────────────────────────────────────────────

function JobBadge({ jobId }: { jobId: string | null | undefined }) {
  const job = useGenerationJob(jobId ?? null)
  if (!jobId) return null
  const labels: Record<string, string> = {
    queued:     '⏳ Queued',
    processing: '⚙ Processing',
    completed:  '✓ Done',
    failed:     '✗ Failed',
  }
  return (
    <span className={`admin-badge status-${job?.status ?? 'queued'}`}>
      {labels[job?.status ?? 'queued']}
    </span>
  )
}

// ── Variant editor ────────────────────────────────────────────────────────────

function VariantEditor({
  variants, onChange,
}: { variants: Variant[]; onChange: (v: Variant[]) => void }) {
  function update(i: number, field: keyof Variant, value: string) {
    const next = variants.map((v, idx) => idx === i ? { ...v, [field]: value } : v)
    onChange(next)
  }
  function remove(i: number) { onChange(variants.filter((_, idx) => idx !== i)) }
  function add()             { onChange([...variants, { label: '', color: '#aaaaaa' }]) }

  return (
    <div className="admin-variant-editor">
      {variants.map((v, i) => (
        <div key={i} className="admin-variant-row">
          <input placeholder="Label" value={v.label} onChange={(e) => update(i, 'label', e.target.value)} />
          <input type="color" value={v.color} onChange={(e) => update(i, 'color', e.target.value)} />
          <button onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <button className="secondary" onClick={add}>+ Variant</button>
    </div>
  )
}

// ── Product form ──────────────────────────────────────────────────────────────

type FormData = { name: string; description: string; price: number; categoryId: string; subcategoryId: string; variants: Variant[]; published: boolean; glbUrl: string }
const BLANK_FORM: FormData = { name: '', description: '', price: 0, categoryId: '', subcategoryId: '', variants: [], published: true, glbUrl: '' }

function ProductForm({ initial, productId, categories, subcategories, onSave, onCancel }: {
  initial?: Partial<FormData>
  productId?: string
  categories: Category[]
  subcategories: Subcategory[]
  onSave: (data: FormData) => void
  onCancel: () => void
}) {
  const [form, setForm]         = useState<FormData>({ ...BLANK_FORM, ...initial })
  const [images, setImages]     = useState<string[]>([])
  const [bgJobId, setBgJobId]   = useState<string | null>(null)
  const [genJobId, setGenJobId] = useState<string | null>(null)
  const bgJob  = useGenerationJob(bgJobId)
  const genJob = useGenerationJob(genJobId)

  async function removeBg(imageUrl: string): Promise<string | null> {
    if (!productId) return null
    const res = await fetch(`${API}/generate-bg-remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, imageUrl }),
    })
    const data = await res.json()
    setBgJobId(data.jobId ?? null)
    if (data.cleanedUrl) setImages((prev) => [...prev, data.cleanedUrl])
    return data.cleanedUrl ?? null
  }

  async function generate3d(imageUrl: string): Promise<string | null> {
    if (!productId) return null
    const res = await fetch(`${API}/generate-3d`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, imageUrl }),
    })
    const data = await res.json()
    setGenJobId(data.jobId ?? null)
    return data.jobId ?? null
  }

  // End-to-end pipeline triggered automatically on each upload:
  // R2 (already done) → bg-removal → 3D generation. The 3D job runs
  // asynchronously on the backend and Firestore onSnapshot pushes the new
  // glbUrl to the storefront when it lands.
  async function autoPipeline(originalUrl: string) {
    try {
      const cleaned = await removeBg(originalUrl)
      if (cleaned) await generate3d(cleaned)
      else        await generate3d(originalUrl)   // fall back to original photo
    } catch (e) {
      console.error('[auto-pipeline]', e)
    }
  }

  const selectedImage = images[0] ?? null

  return (
    <div className="admin-form">
      <div className="admin-form-row">
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Price ($)
          <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        </label>
      </div>
      <label>
        Description
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </label>
      <div className="admin-form-row">
        <label>
          Category
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value, subcategoryId: '' })}
          >
            <option value="">— select —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label>
          Subcategory
          <select
            value={form.subcategoryId}
            onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}
            disabled={!form.categoryId}
          >
            <option value="">— select —</option>
            {subcategories
              .filter((s) => s.categoryId === form.categoryId)
              .map((s) => (
                <option key={s.id} value={s.label}>{s.label}</option>
              ))}
          </select>
        </label>
      </div>

      <label>Variants</label>
      <VariantEditor variants={form.variants} onChange={(v) => setForm({ ...form, variants: v })} />

      <label>
        GLB URL <span style={{ fontWeight: 400, color: '#888' }}>(paste a public .glb URL, or leave blank and use Generate 3D below)</span>
        <input
          value={form.glbUrl}
          placeholder="https://example.com/model.glb"
          onChange={(e) => setForm({ ...form, glbUrl: e.target.value })}
        />
      </label>

      {productId && (
        <>
          <label>Images</label>
          <ImageUploader
            productId={productId}
            onUploaded={(url) => {
              setImages((prev) => [...prev, url])
              updateDoc(doc(db, 'products', productId), { imageUrls: arrayUnion(url) })
              // Fire-and-forget: kick off the BG-removal → 3D-generation chain
              // automatically. The user can still trigger them manually too.
              autoPipeline(url)
            }}
          />
          <p className="admin-hint">
            Auto-pipeline: each upload runs background removal, then sends the cleaned image to
            the 3D generator. The viewer auto-updates when the GLB lands. You can also click the
            buttons below to retry any step manually.
          </p>

          {images.length > 0 && (
            <div className="admin-images">
              {images.map((url) => (
                <div key={url} className="admin-image-thumb">
                  <img src={url} alt="" />
                  <div className="admin-image-actions">
                    <button onClick={() => removeBg(url)}>Remove BG</button>
                    <button onClick={() => generate3d(url)}>Generate 3D</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="admin-generation-status">
            {bgJobId  && <div>BG removal: <JobBadge jobId={bgJobId} /></div>}
            {genJobId && <div>3D model: <JobBadge jobId={genJobId} /></div>}
            {genJob?.status === 'completed' && (
              <p className="admin-success">3D model ready — product viewer will update automatically.</p>
            )}
            {genJob?.status === 'failed' && genJob.errorMessage && (
              <p className="admin-error-msg">✗ {genJob.errorMessage}</p>
            )}
            {bgJob?.status === 'failed' && bgJob.errorMessage && (
              <p className="admin-error-msg">✗ {bgJob.errorMessage}</p>
            )}
          </div>
        </>
      )}

      <label className="admin-checkbox">
        <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
        Published (visible in storefront)
      </label>

      <div className="admin-form-actions">
        <button onClick={() => onSave(form)}>Save</button>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]       = useState<Product[]>([])
  const [editing, setEditing]         = useState<string | null>(null)
  const [adding, setAdding]           = useState(false)
  const [newId, setNewId]             = useState<string | null>(null)
  const [filterCat, setFilterCat]     = useState<string>('')
  const [filterSub, setFilterSub]     = useState<string>('')
  const [search, setSearch]           = useState<string>('')

  const categories    = useCategories() ?? []
  const subcategories = useAllSubcategories()

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product))
    })
  }, [])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (filterCat && p.categoryId !== filterCat) return false
      if (filterSub && p.subcategoryId !== filterSub) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, filterCat, filterSub, search])

  async function addProduct(data: FormData) {
    const { glbUrl, ...rest } = data
    const docRef = await addDoc(collection(db, 'products'), {
      ...rest,
      glbUrl:           glbUrl.trim() || null,
      imageUrls:        [],
      thumbnailUrl:     null,
      generationStatus: 'none',
      generationJobId:  null,
      createdAt:        serverTimestamp(),
      updatedAt:        serverTimestamp(),
    })
    setNewId(docRef.id)
    setAdding(false)
    setEditing(docRef.id)
  }

  async function saveProduct(id: string, data: FormData) {
    const { glbUrl, ...rest } = data
    await updateDoc(doc(db, 'products', id), {
      ...rest,
      glbUrl:    glbUrl.trim() || null,
      updatedAt: serverTimestamp(),
    })
    setEditing(null)
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product?')) return
    await deleteDoc(doc(db, 'products', id))
  }

  async function togglePublished(p: Product) {
    await updateDoc(doc(db, 'products', p.id), { published: !p.published })
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Products <span className="admin-page-count">({filteredProducts.length}/{products.length})</span></h2>
        <button onClick={() => setAdding(true)}>+ Add product</button>
      </div>

      <div className="admin-filter-bar">
        <input
          className="admin-filter-search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={filterCat}
          onChange={(e) => { setFilterCat(e.target.value); setFilterSub('') }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select
          value={filterSub}
          onChange={(e) => setFilterSub(e.target.value)}
          disabled={!filterCat}
        >
          <option value="">All subcategories</option>
          {subcategories
            .filter((s) => !filterCat || s.categoryId === filterCat)
            .map((s) => (
              <option key={s.id} value={s.label}>{s.label}</option>
            ))}
        </select>
        {(filterCat || filterSub || search) && (
          <button
            className="secondary"
            onClick={() => { setFilterCat(''); setFilterSub(''); setSearch('') }}
          >
            Clear
          </button>
        )}
      </div>

      {adding && (
        <ProductForm
          categories={categories}
          subcategories={subcategories}
          onSave={addProduct}
          onCancel={() => setAdding(false)}
        />
      )}

      {filteredProducts.map((p) => (
        <div key={p.id} className="admin-card">
          <div className="admin-card-header">
            <strong>{p.name}</strong>
            <span className="admin-badge">${p.price.toLocaleString()}</span>
            <JobBadge jobId={p.generationJobId} />
            <label className="admin-toggle">
              <input type="checkbox" checked={p.published ?? false} onChange={() => togglePublished(p)} />
              Published
            </label>
            <div className="admin-card-actions">
              <button onClick={() => setEditing(p.id)}>Edit</button>
              <button className="danger" onClick={() => deleteProduct(p.id)}>Delete</button>
            </div>
          </div>
          <p className="admin-meta">{p.categoryId} · {p.subcategoryId}</p>

          {editing === p.id && (
            <ProductForm
              productId={p.id}
              categories={categories}
              subcategories={subcategories}
              initial={{ name: p.name, description: p.description, price: p.price, categoryId: p.categoryId ?? '', subcategoryId: p.subcategoryId ?? '', variants: p.variants, published: p.published ?? false, glbUrl: p.glbUrl ?? '' }}
              onSave={(data) => saveProduct(p.id, data)}
              onCancel={() => setEditing(null)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
