/**
 * One-time seed script — writes static CATEGORIES + PRODUCTS to Firestore.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service-account JSON
 * (or set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY directly).
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { CATEGORIES } from '../src/data/categories'
import { PRODUCTS } from '../src/data/products'

const serviceAccount: ServiceAccount = {
  projectId:    process.env.FIREBASE_PROJECT_ID!,
  clientEmail:  process.env.FIREBASE_CLIENT_EMAIL!,
  privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function seed() {
  const batch = db.batch()
  const now = Timestamp.now()

  // ── Categories ───────────────────────────────────────────────────────────────
  CATEGORIES.forEach((cat, i) => {
    const ref = db.collection('categories').doc(cat.id)
    batch.set(ref, {
      label:           cat.label,
      meshType:        cat.meshType,
      color:           cat.color,
      position:        cat.position,
      order:           i,
      createdAt:       now,
    })
  })

  // ── Subcategories ────────────────────────────────────────────────────────────
  let subOrder = 0
  for (const cat of CATEGORIES) {
    for (const label of cat.subcategories) {
      const ref = db.collection('subcategories').doc()
      batch.set(ref, {
        categoryId: cat.id,
        label,
        order:      subOrder++,
        createdAt:  now,
      })
    }
  }

  // ── Products (assigned to first category + first subcategory) ────────────────
  PRODUCTS.forEach((p, i) => {
    const ref = db.collection('products').doc(p.id)
    batch.set(ref, {
      name:             p.name,
      description:      p.description,
      price:            p.price,
      variants:         p.variants,
      categoryId:       CATEGORIES[0].id,
      subcategoryId:    CATEGORIES[0].subcategories[0],
      imageUrls:        [],
      glbUrl:           null,
      thumbnailUrl:     null,
      generationStatus: 'none',
      generationJobId:  null,
      published:        true,
      createdAt:        now,
      updatedAt:        now,
      order:            i,
    })
  })

  await batch.commit()
  console.log('Seed complete.')
}

seed().catch((err) => { console.error(err); process.exit(1) })
