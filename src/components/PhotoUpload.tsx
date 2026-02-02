import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import './PhotoUpload.css'

interface PhotoUploadProps {
  householdId: string
  entryId: string | null
  photoPath: string | null
  onPhotoChange: (path: string | null) => void
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(blob!),
        'image/jpeg',
        0.8
      )
    }
    img.src = url
  })
}

export function PhotoUpload({ householdId, entryId, photoPath, onPhotoChange }: PhotoUploadProps) {
  const { language } = useLanguage()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const photoUrl = photoPath ? `${supabaseUrl}/storage/v1/object/public/item-photos/${photoPath}` : null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const resized = await resizeImage(file, 800)
      const id = entryId ?? crypto.randomUUID()
      const path = `${householdId}/${id}.jpg`

      const { error } = await supabase.storage
        .from('item-photos')
        .upload(path, resized, { contentType: 'image/jpeg', upsert: true })

      if (!error) {
        onPhotoChange(path)
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleRemove() {
    onPhotoChange(null)
  }

  return (
    <div className="photo-upload">
      {photoUrl ? (
        <div className="photo-upload__preview">
          <img src={photoUrl} alt="" />
          <button className="photo-upload__remove" onClick={handleRemove} type="button">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          className="photo-upload__add-btn"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          type="button"
        >
          <Camera size={16} />
          {uploading ? '...' : ui('photo.add', language)}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="photo-upload__file-input"
        onChange={handleFileChange}
      />
    </div>
  )
}
