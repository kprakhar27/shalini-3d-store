import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID

// Only initialise Firebase when credentials are actually present.
// This lets the storefront run with static fallback data during local dev
// before Firebase is configured.
export const isFirebaseConfigured = Boolean(projectId)

let _app: FirebaseApp | null = null
let _db: Firestore | null = null
let _auth: Auth | null = null

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  }
  _app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  _db   = getFirestore(_app)
  _auth = getAuth(_app)
}

export const db   = _db!
export const auth = _auth!
