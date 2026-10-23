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

export type BusinessListing = {
  id: string
  slug: string
  business_name: string
  short_description: string
  country: string | { name: string } | null
  city: string
  industry: string | { name: string } | null
  business_type: string | { name: string } | null
  cover_image_url: string | null
  is_verified: boolean
  is_booking_enabled: boolean
  phone?: string | null
  email?: string | null
  website?: string | null
  services?: { name: string; description: string }[]
}
