import { useRef, useState } from 'react'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface Props {
  productId: string
  onUploaded: (url: string) => void
}

export default function ImageUploader({ productId, onUploaded }: Props) {
  const inputRef         = useRef<HTMLInputElement>(null)
  const [uploading, set] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    set(true)
    setError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        const file     = files[i]
        const filename = `${Date.now()}_${i}_${file.name.replace(/\s+/g, '_')}`

        // 1. Ask backend for a presigned PUT URL targeting Cloudflare R2.
        let presignRes: Response
        try {
          presignRes = await fetch(`${API}/storage/presigned-upload`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ productId, filename, contentType: file.type }),
          })
        } catch (e) {
          throw new Error(`Backend unreachable at ${API}. Is uvicorn running?`)
        }
        if (!presignRes.ok) {
          throw new Error(`Presign failed (${presignRes.status}): ${await presignRes.text()}`)
        }
        const { uploadUrl, publicUrl } = await presignRes.json()

        // 2. Upload the file directly from the browser to R2.
        let putRes: Response
        try {
          putRes = await fetch(uploadUrl, {
            method:  'PUT',
            headers: { 'Content-Type': file.type },
            body:    file,
          })
        } catch (e) {
          throw new Error(
            'R2 upload blocked. Check the bucket\'s CORS rules include this origin '
            + `(${window.location.origin}). Run \`python scripts/configure_r2_cors.py\` from the backend.`,
          )
        }
        if (!putRes.ok) {
          throw new Error(`R2 PUT failed (${putRes.status})`)
        }

        onUploaded(publicUrl)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      console.error('[ImageUploader]', e)
    } finally {
      set(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <div
        className={`admin-uploader${uploading ? ' uploading' : ''}`}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? 'Uploading…' : 'Drop images here or click to browse'}
      </div>
      {error && (
        <p
          style={{
            margin: '6px 0 0',
            color: '#a00',
            fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            background: 'rgba(200, 0, 0, 0.06)',
            padding: '6px 10px',
            borderRadius: 6,
          }}
        >
          ✗ {error}
        </p>
      )}
    </div>
  )
}
