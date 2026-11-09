import type { SupabaseClient } from '@supabase/supabase-js'
import { slugify } from './pages'

export const MEDIA_BUCKET = 'business-media'
export const DOCUMENT_BUCKET = 'business-documents'

export type DocumentType = {
  value: string
  label: string
  required: boolean
  hint?: string
}

/**
 * The documents a business can attach during onboarding. Registration and
 * owner identity are required for the verification review; the rest help the
 * review team confirm the business faster.
 */
export const DOCUMENT_TYPES: DocumentType[] = [
  { value: 'BUSINESS_REGISTRATION', label: 'Business registration certificate', required: true, hint: 'Certificate of incorporation or business registration' },
  { value: 'IDENTITY_DOCUMENT', label: 'Owner ID or passport', required: true, hint: 'Government-issued photo identification' },
  { value: 'TAX_CERTIFICATE', label: 'Tax registration certificate', required: false, hint: 'TIN / tax clearance certificate' },
  { value: 'OPERATING_LICENCE', label: 'Operating licence or permit', required: false, hint: 'Sector licence, permit or regulatory approval' },
  { value: 'PROOF_OF_ADDRESS', label: 'Proof of business address', required: false, hint: 'Utility bill, lease or bank statement' },
  { value: 'OTHER', label: 'Other supporting document', required: false },
]

export function documentLabel(value: string) {
  return DOCUMENT_TYPES.find((type) => type.value === value)?.label || value.replaceAll('_', ' ')
}

export type BusinessDocument = {
  id?: string
  documentType: string
  fileName: string
  storagePath: string
  mimeType: string
  fileSize: number
  status?: string
}

export type NewUpload = {
  fileName: string
  storagePath: string
  mimeType: string
  fileSize: number
}

function fileExtension(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName)
  return match ? match[1].toLowerCase() : 'bin'
}

export function uploadPath(userId: string, businessId: string | null, fileName: string) {
  const base = slugify(fileName.replace(/\.[^.]+$/, '')).slice(0, 48) || 'file'
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${userId}/${businessId || 'pending'}/${unique}-${base}.${fileExtension(fileName)}`
}

export async function uploadBusinessMedia(
  client: SupabaseClient,
  userId: string,
  businessId: string | null,
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG, WebP or GIF).')
  if (file.size > 10 * 1024 * 1024) throw new Error('Images must be smaller than 10 MB.')

  const path = uploadPath(userId, businessId, file.name)
  const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadBusinessDocument(
  client: SupabaseClient,
  userId: string,
  businessId: string | null,
  file: File,
): Promise<NewUpload> {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowed.includes(file.type)) throw new Error('Upload a PDF, Word document or image (JPG, PNG, WebP).')
  if (file.size > 20 * 1024 * 1024) throw new Error('Documents must be smaller than 20 MB.')

  const path = uploadPath(userId, businessId, file.name)
  const { error } = await client.storage.from(DOCUMENT_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  return { fileName: file.name, storagePath: path, mimeType: file.type, fileSize: file.size }
}

export async function signedDocumentUrl(client: SupabaseClient, storagePath: string, expiresIn = 3600) {
  const { data, error } = await client.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, expiresIn)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

/**
 * Finds a representative, readable brand colour from an uploaded image.
 * Near-white, near-black and grey pixels are ignored so logos with transparent
 * or white backgrounds still produce a useful accent colour.
 */
export async function detectBrandColor(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      try {
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) {
          resolve(null)
          return
        }
        context.drawImage(image, 0, 0, size, size)
        const { data } = context.getImageData(0, 0, size, size)

        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()
        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3]
          if (alpha < 160) continue
          const r = data[index]
          const g = data[index + 1]
          const b = data[index + 2]
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const saturation = max === 0 ? 0 : (max - min) / max
          // Skip near-white, near-black and washed-out pixels.
          if (max > 245 || max < 35 || saturation < 0.18) continue
          const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`
          const bucket = buckets.get(key)
          if (bucket) {
            bucket.count += 1
            bucket.r += r
            bucket.g += g
            bucket.b += b
          } else {
            buckets.set(key, { count: 1, r, g, b })
          }
        }

        const best = [...buckets.values()].sort((a, b) => b.count - a.count)[0]
        if (!best) {
          resolve(null)
          return
        }
        const hex = (value: number) => Math.round(value / best.count).toString(16).padStart(2, '0')
        resolve(`#${hex(best.r)}${hex(best.g)}${hex(best.b)}`)
      } catch {
        resolve(null)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}
