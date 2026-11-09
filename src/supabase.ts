import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

let client: SupabaseClient | undefined

export function getSupabaseClient() {
  if (!hasSupabaseConfig || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured.')
  }

  client ??= createClient(supabaseUrl, supabaseAnonKey)
  return client
}

export function publicMediaUrl(pathOrUrl: string) {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  if (!supabaseUrl) return ''
  return `${supabaseUrl}/storage/v1/object/public/business-media/${encodeURI(pathOrUrl)}`
}

export type BusinessListing = {
  id: string
  slug: string
  business_name: string
  short_description: string
  country_code: string | null
  country: { name: string } | null
  city: string
  cover_image_url: string | null
  is_verified: boolean
  is_booking_enabled: boolean
  phone?: string | null
  email?: string | null
  website?: string | null
  services?: { name: string; description: string }[]
  business_categories?: {
    is_primary: boolean
    categories: { name: string; slug: string } | null
  }[]
  business_type?: { name: string } | null
}
