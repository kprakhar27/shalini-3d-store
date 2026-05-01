import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '../lib/firebase/client'
import LoginPage from './LoginPage'
import DashboardPage from './DashboardPage'
import CategoriesPage from './CategoriesPage'
import ProductsPage from './ProductsPage'
import './admin.css'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | 'loading'>('loading')
  const navigate        = useNavigate()

  useEffect(() => {
    // Fall back to "not signed in" if Firebase Auth doesn't resolve quickly
    // (this network has been flaky with Identity Toolkit). The unsubscribe
    // still updates if the real listener eventually fires.
    const timeout = setTimeout(() => {
      setUser((cur) => (cur === 'loading' ? auth.currentUser : cur))
    }, 2500)
    const unsub = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeout)
      setUser(u)
    })
    return () => { clearTimeout(timeout); unsub() }
  }, [])

  if (user === 'loading') return <div className="admin-loading">Loading…</div>
  if (!user) { navigate('/admin/login'); return null }
  return <>{children}</>
}

function AdminNav() {
  const navigate = useNavigate()
  return (
    <nav className="admin-nav">
      <span className="admin-nav-brand">⚙ Admin</span>
      <Link to="/admin/dashboard">Dashboard</Link>
      <Link to="/admin/categories">Categories</Link>
      <Link to="/admin/products">Products</Link>
      <button onClick={() => signOut(auth).then(() => navigate('/admin/login'))}>Sign out</button>
    </nav>
  )
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <div className="admin-layout">
              <AdminNav />
              <main className="admin-main">
                <Routes>
                  <Route path="dashboard"  element={<DashboardPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="products"   element={<ProductsPage />} />
                  <Route index             element={<Navigate to="dashboard" replace />} />
                </Routes>
              </main>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
