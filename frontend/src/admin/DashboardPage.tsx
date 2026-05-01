import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase/client'
import { useCategories } from '../lib/hooks/useCategories'
import type { Product } from '../data/products'
import type { Subcategory } from '../data/categories'

interface GenerationJob {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  productId: string
  startedAt?: { seconds: number }
  completedAt?: { seconds: number } | null
}

export default function DashboardPage() {
  const categories = useCategories() ?? []
  const [products, setProducts]   = useState<Product[]>([])
  const [subs, setSubs]           = useState<Subcategory[]>([])
  const [jobs, setJobs]           = useState<GenerationJob[]>([])

  useEffect(() => onSnapshot(collection(db, 'products'), (s) =>
    setProducts(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Product))), [])
  useEffect(() => onSnapshot(collection(db, 'subcategories'), (s) =>
    setSubs(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Subcategory))), [])
  useEffect(() => onSnapshot(collection(db, 'generationJobs'), (s) =>
    setJobs(s.docs.map((d) => ({ id: d.id, ...d.data() }) as GenerationJob))), [])

  const stats = useMemo(() => ({
    categories:    categories.length,
    subcategories: subs.length,
    products:      products.length,
    published:     products.filter((p) => p.published).length,
    withGlb:       products.filter((p) => !!p.glbUrl).length,
    withoutGlb:    products.filter((p) => !p.glbUrl).length,
    activeJobs:    jobs.filter((j) => j.status === 'processing' || j.status === 'queued').length,
    completedJobs: jobs.filter((j) => j.status === 'completed').length,
    failedJobs:    jobs.filter((j) => j.status === 'failed').length,
  }), [categories, subs, products, jobs])

  // Products per category, for the breakdown card.
  const byCategory = useMemo(() => {
    const map = new Map<string, { label: string; count: number; published: number; withGlb: number }>()
    for (const c of categories) map.set(c.id, { label: c.label, count: 0, published: 0, withGlb: 0 })
    for (const p of products) {
      const row = map.get(p.categoryId ?? '')
      if (!row) continue
      row.count    += 1
      row.published += p.published ? 1 : 0
      row.withGlb  += p.glbUrl ? 1 : 0
    }
    return Array.from(map.values())
  }, [categories, products])

  const recentJobs = useMemo(() => {
    return [...jobs]
      .sort((a, b) => (b.startedAt?.seconds ?? 0) - (a.startedAt?.seconds ?? 0))
      .slice(0, 6)
  }, [jobs])

  function productName(id: string) {
    return products.find((p) => p.id === id)?.name ?? id.slice(0, 8)
  }

  function fmtAgo(ts?: { seconds: number }) {
    if (!ts) return '—'
    const sec = Math.max(0, Math.floor(Date.now() / 1000 - ts.seconds))
    if (sec < 60)   return `${sec}s ago`
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
    return `${Math.floor(sec / 86400)}d ago`
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Dashboard</h2>
      </div>

      {/* Top stats grid */}
      <div className="dash-grid">
        <StatTile label="Categories"    value={stats.categories}    accent="#7c6af7" />
        <StatTile label="Subcategories" value={stats.subcategories} accent="#3ecfcf" />
        <StatTile label="Products"      value={stats.products}      accent="#0a0a14"
                  sub={`${stats.published} published`} />
        <StatTile label="With 3-D model" value={stats.withGlb}      accent="#34a853"
                  sub={`${stats.withoutGlb} pending`} />
        <StatTile label="AI jobs running" value={stats.activeJobs}  accent="#ff9f43"
                  sub={`${stats.completedJobs} done · ${stats.failedJobs} failed`} />
      </div>

      {/* Quick actions */}
      <section className="admin-card">
        <h3 className="dash-h3">Quick actions</h3>
        <div className="dash-actions">
          <Link className="dash-action" to="/admin/products">+ Add or edit products</Link>
          <Link className="dash-action" to="/admin/categories">+ Manage categories</Link>
          <a className="dash-action" href="/" target="_blank" rel="noreferrer">Open storefront ↗</a>
        </div>
      </section>

      {/* Per-category breakdown */}
      <section className="admin-card">
        <h3 className="dash-h3">Catalogue by category</h3>
        {byCategory.length === 0 ? (
          <p className="dash-empty">No categories yet — add one to get started.</p>
        ) : (
          <table className="dash-table">
            <thead>
              <tr><th>Category</th><th>Products</th><th>Published</th><th>With GLB</th></tr>
            </thead>
            <tbody>
              {byCategory.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{r.count}</td>
                  <td>{r.published}</td>
                  <td>{r.withGlb}/{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Recent AI jobs */}
      <section className="admin-card">
        <h3 className="dash-h3">Recent AI jobs</h3>
        {recentJobs.length === 0 ? (
          <p className="dash-empty">No generation jobs yet. Upload a product photo and click <strong>Generate 3D</strong>.</p>
        ) : (
          <table className="dash-table">
            <thead>
              <tr><th>Product</th><th>Status</th><th>Started</th></tr>
            </thead>
            <tbody>
              {recentJobs.map((j) => (
                <tr key={j.id}>
                  <td>{productName(j.productId)}</td>
                  <td><span className={`admin-badge status-${j.status}`}>{j.status}</span></td>
                  <td>{fmtAgo(j.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function StatTile({
  label, value, sub, accent,
}: { label: string; value: number | string; sub?: string; accent: string }) {
  return (
    <div className="dash-tile" style={{ borderTop: `3px solid ${accent}` }}>
      <span className="dash-tile-label">{label}</span>
      <span className="dash-tile-value">{value}</span>
      {sub && <span className="dash-tile-sub">{sub}</span>}
    </div>
  )
}
