import { useState } from 'react'
import { useStore } from '../store/useStore'

const STEPS = [
  { icon: '📷', label: 'Photo\nupload',     sub: 'Browser → R2 (presigned PUT)' },
  { icon: '✂️',  label: 'Background\nremoval',  sub: 'rembg · U²-Net (FastAPI)' },
  { icon: '🧠', label: 'Image →\n3D mesh',    sub: 'TripoSR · HF Space' },
  { icon: '🪣', label: 'GLB stored\nin R2',     sub: 'Cloudflare R2 (S3)' },
  { icon: '🔥', label: 'Firestore\npropagates',  sub: 'onSnapshot — live' },
  { icon: '🖥️',  label: 'R3F viewer\nrenders', sub: '@react-three/fiber' },
]

const ADMIN_EMAIL = 'testuser@test.com'
const ADMIN_PASSWORD = 'test1234'

export default function AIPipelinePanel() {
  const aiPanelOpen = useStore((s) => s.aiPanelOpen)
  const setAiPanelOpen = useStore((s) => s.setAiPanelOpen)
  const [copied, setCopied] = useState<'email' | 'password' | null>(null)

  function copy(text: string, which: 'email' | 'password') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which)
      setTimeout(() => setCopied(null), 1200)
    })
  }

  if (!aiPanelOpen) return null

  return (
    <div className="ai-modal-backdrop" onClick={() => setAiPanelOpen(false)}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <h2>How this works</h2>
        <p className="subtitle">
          The catalogue is editable from a built-in admin panel. Real photos uploaded there
          flow through an open-source AI pipeline that produces 3D models, which appear live
          in the storefront viewer.
        </p>

        {/* Pipeline diagram (real services, not simulated) */}
        <div className="pipeline-diagram">
          {STEPS.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div className="pipe-step">
                <div className="pipe-icon">{step.icon}</div>
                <div className="pipe-label">{step.label}</div>
                <div className="pipe-sub">{step.sub}</div>
              </div>
              {i < STEPS.length - 1 && <span className="pipe-arrow">›</span>}
            </div>
          ))}
        </div>

        {/* AI section */}
        <section className="ai-section">
          <h3>AI in this site</h3>
          <ul className="ai-bullets">
            <li>
              <strong>Background removal</strong> — when you upload a product photo in the admin
              panel, the FastAPI backend strips the background using <em>rembg</em> (U²-Net).
              The transparent PNG is uploaded to Cloudflare R2.
            </li>
            <li>
              <strong>Image-to-3D</strong> — the cleaned PNG is sent to the public TripoSR
              Hugging Face Space via <code>gradio_client</code>. TripoSR generates a textured
              GLB from a single image. The result is downloaded by the backend and stored in R2.
            </li>
            <li>
              <strong>Live propagation</strong> — once the GLB URL is written to Firestore,
              the storefront's <code>useGLTF</code> viewer (React Three Fiber) swaps the box
              placeholder for the real mesh in seconds — no reload, via <code>onSnapshot</code>.
            </li>
          </ul>
        </section>

        {/* Admin section */}
        <section className="ai-section ai-admin-section">
          <h3>Try the admin panel</h3>
          <ol className="ai-bullets">
            <li>
              Open <a className="ai-admin-link" href="/admin/login" target="_blank" rel="noreferrer">
                /admin/login
              </a>
            </li>
            <li>
              Sign in with the test account:
              <div className="ai-creds">
                <button className="ai-cred" onClick={() => copy(ADMIN_EMAIL, 'email')}>
                  <span className="ai-cred-key">email</span>
                  <span className="ai-cred-value">{ADMIN_EMAIL}</span>
                  <span className="ai-cred-copy">{copied === 'email' ? '✓ copied' : 'copy'}</span>
                </button>
                <button className="ai-cred" onClick={() => copy(ADMIN_PASSWORD, 'password')}>
                  <span className="ai-cred-key">password</span>
                  <span className="ai-cred-value">{ADMIN_PASSWORD}</span>
                  <span className="ai-cred-copy">{copied === 'password' ? '✓ copied' : 'copy'}</span>
                </button>
              </div>
            </li>
            <li>Edit categories, subcategories, or products. Changes appear live in the storefront.</li>
            <li>
              On a product, drag-drop a photo, then click <strong>Remove BG</strong> followed
              by <strong>Generate 3D</strong> to run the full AI pipeline. The viewer will
              swap to the new GLB when the job finishes (~1–3 min).
            </li>
          </ol>
        </section>

        <button className="modal-close" onClick={() => setAiPanelOpen(false)}>
          Close
        </button>
      </div>
    </div>
  )
}
