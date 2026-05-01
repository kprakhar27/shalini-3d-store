import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/client'

export interface GenerationJob {
  id: string
  productId: string
  provider: 'meshy'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  inputImageUrl: string
  outputGlbUrl: string | null
  providerJobId: string | null
  errorMessage: string | null
}

export function useGenerationJob(jobId: string | null) {
  const [job, setJob] = useState<GenerationJob | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured || !jobId) { setJob(null); return }
    return onSnapshot(doc(db, 'generationJobs', jobId), (snap) => {
      setJob(snap.exists() ? ({ id: snap.id, ...snap.data() } as GenerationJob) : null)
    })
  }, [jobId])

  return job
}
