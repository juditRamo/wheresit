import { useRef, useState } from 'react'
import { Camera as CameraIcon, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { supabase } from '../supabaseClient'
import { useLanguage } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import './PhotoUpload.css'

interface PhotoUploadProps {
  householdId: string
  entryId: string | null
  photoPath: string | null
  onPhotoChange: (path: string | null) => void
  onUploadingChange?: (uploading: boolean) => void
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url)
      reject(new Error('Image resize timed out'))
    }, 10_000)
    img.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.onload = () => {
      clearTimeout(timeout)
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
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create image blob'))
          }
        },
        'image/jpeg',
        0.8
      )
    }
    img.src = url
  })
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64)
  const bytes = new Uint8Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    bytes[i] = byteCharacters.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType })
}

export function PhotoUpload({ householdId, entryId, photoPath, onPhotoChange, onUploadingChange }: PhotoUploadProps) {
  const { language } = useLanguage()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setUploadingState(value: boolean) {
    setUploading(value)
    onUploadingChange?.(value)
  }

  const photoUrl = photoPath ? `${supabaseUrl}/storage/v1/object/public/item-photos/${photoPath}` : null

  async function uploadBlob(blob: Blob) {
    const id = entryId ?? crypto.randomUUID()
    const path = `${householdId}/${id}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('item-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) {
      setError(ui('photo.upload_error', language))
      return
    }

    onPhotoChange(path)
  }

  async function handleNativeCapture() {
    setUploadingState(true)
    setError(null)
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        width: 800,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
      })
      if (photo.base64String) {
        const blob = base64ToBlob(photo.base64String, 'image/jpeg')
        await uploadBlob(blob)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : ''
      if (!msg.includes('cancel')) {
        setError(ui('photo.upload_error', language))
      }
    } finally {
      setUploadingState(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingState(true)
    setError(null)
    try {
      const resized = await resizeImage(file, 800)
      await uploadBlob(resized)
    } catch {
      setError(ui('photo.upload_error', language))
    } finally {
      setUploadingState(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleAddClick() {
    if (Capacitor.isNativePlatform()) {
      handleNativeCapture()
    } else {
      fileRef.current?.click()
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
          onClick={handleAddClick}
          disabled={uploading}
          type="button"
        >
          <CameraIcon size={16} />
          {uploading ? ui('photo.uploading', language) : ui('photo.add', language)}
        </button>
      )}
      {error && <p className="photo-upload__error">{error}</p>}
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
