import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, Building2, Check, FileText, Globe2, ImagePlus, MapPin, Palette, Phone, Trash2, Upload, X } from 'lucide-react'
import { Brand } from '../Brand'
import { getSupabaseClient } from '../supabase'
import { buildDraftContent, DEFAULT_BRAND_COLOR, ensureReviewStatus, invokeGeneratePage, savePageVersion } from '../lib/pages'
import {
  DOCUMENT_TYPES,
  detectBrandColor,
  uploadBusinessDocument,
  uploadBusinessMedia,
  type BusinessDocument,
} from '../lib/uploads'

interface Category {
  id: string
  name: string
  slug: string
  legacy_industry_id?: string | null
}

interface Subcategory {
  id: string
  category_id: string
  name: string
}

interface BusinessType {
  id: string
  name: string
  slug: string
}

interface LocationNode {
  id: string
  country_code: string
  parent_id: string | null
  name: string
  location_type: string
  level: number
  path: string
}

interface OnboardingData {
  // Step 1: Business identity
  businessName: string
  registeredName: string
  registrationNumber: string
  yearEstablished: string
  businessSize: string
  // Step 2: Location
  countryCode: string
  region: string
  city: string
  address: string
  // Step 3: Contact
  email: string
  phone: string
  whatsapp: string
  website: string
  // Step 4: Classification
  primaryCategoryId: string
  primarySubcategoryId: string
  secondaryCategoryIds: string[]
  businessTypeVocabularyId: string
  // Step 5: Details
  shortDescription: string
  description: string
  services: { name: string; description: string }[]
  // Step 6: Media & verification
  logoUrl: string
  coverImageUrl: string
  brandColor: string
  // Step 7: Social
  socials: { platform: string; url: string }[]
  // Step 8: Hours
  openingHours: Record<string, { open: string; close: string; closed: boolean }>
}

const STEPS = [
  { id: 'identity', label: 'Business Identity', icon: Building2 },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'contact', label: 'Contact', icon: Phone },
  { id: 'classification', label: 'Classification', icon: FileText },
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'media', label: 'Brand & Documents', icon: Upload },
  { id: 'social', label: 'Social Links', icon: Globe2 },
  { id: 'hours', label: 'Opening Hours', icon: Phone },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SOCIAL_PLATFORMS = ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube', 'TikTok', 'WhatsApp']
const BUSINESS_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+']

const SETTLEMENT_TYPES = new Set([
  'town', 'city', 'area', 'suburb', 'village', 'neighbourhood', 'neighborhood',
  'locality', 'settlement', 'zone', 'market', 'community',
])

function rootLocationOptions(nodes: LocationNode[]) {
  const levelTwo = nodes.filter((node) => node.level === 2)
  const administrative = levelTwo.filter((node) => !SETTLEMENT_TYPES.has(node.location_type.trim().toLowerCase()))
  return administrative.length > 0 ? administrative : levelTwo
}

function childLocations(nodes: LocationNode[], parentId: string | null) {
  if (!parentId) return rootLocationOptions(nodes)
  return nodes.filter((node) => node.parent_id === parentId)
}

/**
 * Rebuilds the dropdown selection for an existing business from the stored
 * region/city names. Older records may only have a city, so both are tried.
 */
function resolveLocationPath(nodes: LocationNode[], region: string, city: string) {
  const roots = rootLocationOptions(nodes)
  let current = region ? roots.find((node) => node.name.toLowerCase() === region.toLowerCase()) : undefined
  if (!current && city) {
    current = roots.find((node) => node.name.toLowerCase() === city.toLowerCase())
      || nodes.find((node) => node.level === 2 && node.name.toLowerCase() === city.toLowerCase())
  }
  if (!current) return []

  const path = [current.id]
  if (!city || city.toLowerCase() === current.name.toLowerCase()) return path

  // Walk down matching the city name at any deeper level.
  const queue: { node: LocationNode; chain: string[] }[] = [{ node: current, chain: [] }]
  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) break
    for (const child of nodes.filter((node) => node.parent_id === next.node.id)) {
      const chain = [...next.chain, child.id]
      if (child.name.toLowerCase() === city.toLowerCase()) return [...path, ...chain]
      queue.push({ node: child, chain })
    }
  }
  return path
}

function locationLabel(nodes: LocationNode[]) {
  const types = [...new Set(nodes.map((node) => node.location_type.trim()).filter(Boolean))]
  return types.length === 1 ? types[0] : 'Location'
}

function defaultHours(): OnboardingData['openingHours'] {
  return Object.fromEntries(DAYS.map((day) => [day, { open: '09:00', close: '17:00', closed: false }]))
}

function emptyForm(email = ''): OnboardingData {
  return {
    businessName: '',
    registeredName: '',
    registrationNumber: '',
    yearEstablished: '',
    businessSize: '',
    countryCode: '',
    region: '',
    city: '',
    address: '',
    email,
    phone: '',
    whatsapp: '',
    website: '',
    primaryCategoryId: '',
    primarySubcategoryId: '',
    secondaryCategoryIds: [],
    businessTypeVocabularyId: '',
    shortDescription: '',
    description: '',
    services: [{ name: '', description: '' }],
    logoUrl: '',
    coverImageUrl: '',
    brandColor: DEFAULT_BRAND_COLOR,
    socials: [],
    openingHours: defaultHours(),
  }
}

function normaliseHours(value: unknown): OnboardingData['openingHours'] {
  const hours = defaultHours()
  if (!value || typeof value !== 'object') return hours
  for (const day of DAYS) {
    const entry = (value as Record<string, unknown>)[day]
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>
      hours[day] = {
        open: typeof record.open === 'string' ? record.open : hours[day].open,
        close: typeof record.close === 'string' ? record.close : hours[day].close,
        closed: Boolean(record.closed),
      }
    }
  }
  return hours
}

export function OnboardingPage({ session, onComplete }: { session: Session; onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([])
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [businessSlug, setBusinessSlug] = useState('')
  const [businessStatus, setBusinessStatus] = useState<string | null>(null)
  const [locations, setLocations] = useState<LocationNode[]>([])
  const [locationPath, setLocationPath] = useState<string[]>([])
  const [documents, setDocuments] = useState<BusinessDocument[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [form, setForm] = useState<OnboardingData>(() => emptyForm(session.user.email ?? ''))

  useEffect(() => {
    let isCurrent = true
    const load = async () => {
      const client = getSupabaseClient()
      const [catRes, subRes, btRes, countryRes, businessRes] = await Promise.all([
        client.from('categories').select('id, name, slug, legacy_industry_id').eq('is_active', true).order('sort_order'),
        client.from('subcategories').select('id, category_id, name').eq('is_active', true).order('sort_order'),
        client.from('business_type_vocabulary').select('id, name, slug').eq('is_active', true).order('sort_order'),
        client.from('countries').select('code, name').eq('is_active', true).order('name'),
        client
          .from('businesses')
          .select('*, business_profiles(*), business_categories(category_id, subcategory_id, is_primary), business_services(name, description), business_socials(platform, url)')
          .eq('owner_id', session.user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ])
      if (!isCurrent) return

      if (catRes.data) setCategories(catRes.data as Category[])
      if (subRes.data) setSubcategories(subRes.data as Subcategory[])
      if (btRes.data) setBusinessTypes(btRes.data as BusinessType[])
      if (countryRes.data) setCountries(countryRes.data)

      const business = businessRes.data as any
      if (business) {
        const profile = (Array.isArray(business.business_profiles) ? business.business_profiles[0] : business.business_profiles) || {}
        const primary = (business.business_categories || []).find((item: any) => item.is_primary)
        const secondary = (business.business_categories || []).filter((item: any) => !item.is_primary)
        const services = (business.business_services || []).map((service: any) => ({
          name: service.name || '',
          description: service.description || '',
        }))
        const socials = (business.business_socials || []).map((social: any) => ({
          platform: social.platform || 'Facebook',
          url: social.url || '',
        }))

        setBusinessId(business.id)
        setBusinessSlug(business.slug || '')
        setBusinessStatus(business.status || null)
        setForm({
          businessName: business.business_name || '',
          registeredName: profile.registered_name || '',
          registrationNumber: profile.registration_number || '',
          yearEstablished: profile.year_established ? String(profile.year_established) : '',
          businessSize: profile.business_size || '',
          countryCode: business.country_code || '',
          region: profile.region || '',
          city: business.city || '',
          address: profile.address || '',
          email: business.email || session.user.email || '',
          phone: business.phone || '',
          whatsapp: profile.whatsapp || '',
          website: business.website || '',
          primaryCategoryId: business.primary_category_id || primary?.category_id || '',
          primarySubcategoryId: business.primary_subcategory_id || primary?.subcategory_id || '',
          secondaryCategoryIds: secondary.map((item: any) => item.category_id).filter(Boolean),
          businessTypeVocabularyId: business.business_type_vocabulary_id || '',
          shortDescription: business.short_description || '',
          description: profile.description || '',
          services: services.length > 0 ? services : [{ name: '', description: '' }],
          logoUrl: business.logo_url || '',
          coverImageUrl: business.cover_image_url || '',
          brandColor: profile.brand_color || DEFAULT_BRAND_COLOR,
          socials,
          openingHours: normaliseHours(profile.opening_hours),
        })

        if (business.country_code) {
          const { data: locationData } = await client
            .from('locations')
            .select('id, country_code, parent_id, name, location_type, level, path')
            .eq('country_code', business.country_code)
            .order('level', { ascending: true })
            .order('path', { ascending: true })
          if (!isCurrent) return
          const nodes = (locationData || []) as LocationNode[]
          setLocations(nodes)
          setLocationPath(resolveLocationPath(nodes, profile.region || '', business.city || ''))
        }

        const { data: documentData } = await client
          .from('business_documents')
          .select('id, document_type, file_name, storage_path, mime_type, file_size, status')
          .eq('business_id', business.id)
          .order('created_at', { ascending: true })
        if (!isCurrent) return
        setDocuments((documentData || []).map((document: any) => ({
          id: document.id,
          documentType: document.document_type,
          fileName: document.file_name,
          storagePath: document.storage_path,
          mimeType: document.mime_type || '',
          fileSize: document.file_size || 0,
          status: document.status,
        })))
      }

      setLoading(false)
    }
    void load()
    return () => { isCurrent = false }
  }, [session.user.email, session.user.id])

  const selectedCategory = categories.find((category) => category.id === form.primaryCategoryId)
  const availableSubcategories = subcategories.filter((subcategory) => subcategory.category_id === form.primaryCategoryId)

  const locationColumns: { label: string; options: LocationNode[]; selectedId: string; index: number }[] = []
  let parentId: string | null = null
  for (let index = 0; index <= locationPath.length; index += 1) {
    const options = childLocations(locations, parentId)
    if (options.length === 0) break
    locationColumns.push({
      label: index === 0 ? (locationLabel(options).toLowerCase().includes('region') ? 'State / Region' : locationLabel(options)) : locationLabel(options),
      options,
      selectedId: locationPath[index] || '',
      index,
    })
    if (!locationPath[index]) break
    parentId = locationPath[index]
  }

  const handleCountryChange = async (countryCode: string) => {
    setForm((current) => ({ ...current, countryCode, region: '', city: '' }))
    setLocationPath([])
    setLocations([])
    if (!countryCode) return
    const { data, error: locationError } = await getSupabaseClient()
      .from('locations')
      .select('id, country_code, parent_id, name, location_type, level, path')
      .eq('country_code', countryCode)
      .order('level', { ascending: true })
      .order('path', { ascending: true })
    if (locationError) {
      setError(`Could not load locations: ${locationError.message}`)
      return
    }
    setLocations((data || []) as LocationNode[])
  }

  const handleLocationSelect = (index: number, id: string) => {
    if (!id) {
      const previous = locationPath[index - 1]
      setLocationPath(previous ? [previous] : [])
      const previousNode = locations.find((node) => node.id === previous)
      setForm((current) => ({
        ...current,
        region: locationPath[0] ? locations.find((node) => node.id === locationPath[0])?.name || '' : '',
        city: previousNode?.name || '',
      }))
      return
    }

    const nextPath = [...locationPath.slice(0, index), id]
    const first = locations.find((node) => node.id === nextPath[0])
    const last = locations.find((node) => node.id === nextPath[nextPath.length - 1])
    setLocationPath(nextPath)
    setForm((current) => ({
      ...current,
      region: first?.name || '',
      city: last?.name || '',
    }))
  }

  const handleMediaUpload = async (kind: 'logo' | 'cover', file: File | undefined) => {
    if (!file) return
    setUploading(kind)
    setError(null)
    try {
      const url = await uploadBusinessMedia(getSupabaseClient(), session.user.id, businessId, file)
      setForm((current) => ({ ...current, [kind === 'logo' ? 'logoUrl' : 'coverImageUrl']: url }))
      const detected = await detectBrandColor(file)
      if (detected) setForm((current) => ({ ...current, brandColor: detected }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload that image.')
    } finally {
      setUploading(null)
    }
  }

  const handleDocumentUpload = async (documentType: string, file: File | undefined) => {
    if (!file) return
    setUploading(documentType)
    setError(null)
    try {
      const uploaded = await uploadBusinessDocument(getSupabaseClient(), session.user.id, businessId, file)
      setDocuments((current) => [
        ...current.filter((document) => document.documentType !== documentType),
        { documentType, ...uploaded, status: 'PENDING' },
      ])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload that document.')
    } finally {
      setUploading(null)
    }
  }

  const documentFor = (documentType: string) => documents.find((document) => document.documentType === documentType)

  const validateStep = (index: number) => {
    if (index === 0 && !form.businessName.trim()) return 'Enter your business name to continue.'
    if (index === 1) {
      if (!form.countryCode) return 'Select the country where your business operates.'
      if (locationPath.length === 0) return 'Select your state or region from the dropdowns.'
      if (!form.city.trim()) return 'Select the location where your business is based.'
    }
    if (index === 2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid business email address.'
    if (index === 3) {
      if (!form.primaryCategoryId) return 'Choose a primary category for your business.'
      if (!form.businessTypeVocabularyId) return 'Choose a business type for your business.'
    }
    if (index === 4 && !form.shortDescription.trim()) return 'Add a short summary so we can introduce your business.'
    if (index === 5) {
      const missing = DOCUMENT_TYPES.filter((type) => type.required && !documentFor(type.value))
      if (missing.length > 0) return `Upload the required document: ${missing.map((type) => type.label).join(', ')}.`
      if (!/^#[0-9a-f]{6}$/i.test(form.brandColor)) return 'Choose a brand colour for your page.'
    }
    return null
  }

  const handleNext = () => {
    const message = validateStep(step)
    if (message) {
      setError(message)
      return
    }
    setError(null)
    if (step < STEPS.length - 1) setStep(step + 1)
  }

  const handleBack = () => {
    setError(null)
    if (step > 0) setStep(step - 1)
  }

  const saveProfileRecords = async (client: ReturnType<typeof getSupabaseClient>, id: string) => {
    const { error: profileError } = await client.from('business_profiles').upsert({
      business_id: id,
      registered_name: form.registeredName.trim() || null,
      trading_name: form.businessName.trim(),
      registration_number: form.registrationNumber.trim() || null,
      region: form.region.trim() || null,
      address: form.address.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      year_established: form.yearEstablished ? Number.parseInt(form.yearEstablished, 10) : null,
      business_size: form.businessSize || null,
      brand_color: form.brandColor || null,
      description: form.description.trim(),
      opening_hours: form.openingHours,
      social_links: Object.fromEntries(form.socials.filter((social) => social.url.trim()).map((social) => [social.platform, social.url.trim()])),
    }, { onConflict: 'business_id' })
    if (profileError) throw new Error(`Could not save your business profile: ${profileError.message}`)

    const { error: categoriesError } = await client.from('business_categories').delete().eq('business_id', id)
    if (categoriesError) throw new Error(`Could not update your business categories: ${categoriesError.message}`)

    const categoryRows: { business_id: string; category_id: string; subcategory_id: string | null; is_primary: boolean }[] = []
    if (form.primaryCategoryId) {
      categoryRows.push({
        business_id: id,
        category_id: form.primaryCategoryId,
        subcategory_id: form.primarySubcategoryId || null,
        is_primary: true,
      })
    }
    for (const categoryId of form.secondaryCategoryIds) {
      if (categoryId && categoryId !== form.primaryCategoryId) {
        categoryRows.push({ business_id: id, category_id: categoryId, subcategory_id: null, is_primary: false })
      }
    }
    if (categoryRows.length > 0) {
      const { error: insertCategoriesError } = await client.from('business_categories').insert(categoryRows)
      if (insertCategoriesError) throw new Error(`Could not save your business categories: ${insertCategoriesError.message}`)
    }

    const { error: servicesDeleteError } = await client.from('business_services').delete().eq('business_id', id)
    if (servicesDeleteError) throw new Error(`Could not update your services: ${servicesDeleteError.message}`)
    const services = form.services
      .filter((service) => service.name.trim())
      .map((service, index) => ({
        business_id: id,
        name: service.name.trim(),
        description: service.description.trim(),
        sort_order: index,
      }))
    if (services.length > 0) {
      const { error: servicesError } = await client.from('business_services').insert(services)
      if (servicesError) throw new Error(`Could not save your services: ${servicesError.message}`)
    }

    const { error: socialsDeleteError } = await client.from('business_socials').delete().eq('business_id', id)
    if (socialsDeleteError) throw new Error(`Could not update your social links: ${socialsDeleteError.message}`)
    const socials = form.socials
      .filter((social) => social.url.trim())
      .map((social) => ({ business_id: id, platform: social.platform, url: social.url.trim() }))
    if (socials.length > 0) {
      const { error: socialsError } = await client.from('business_socials').insert(socials)
      if (socialsError) throw new Error(`Could not save your social links: ${socialsError.message}`)
    }
  }

  const saveDocuments = async (client: ReturnType<typeof getSupabaseClient>, id: string) => {
    const { data: existing, error: existingError } = await client
      .from('business_documents')
      .select('id, storage_path')
      .eq('business_id', id)
    if (existingError) throw new Error(`Could not load your documents: ${existingError.message}`)

    const keepIds = new Set(documents.map((document) => document.id).filter(Boolean) as string[])
    const removed = (existing || []).filter((document: any) => !keepIds.has(document.id))
    if (removed.length > 0) {
      const paths = removed.map((document: any) => document.storage_path).filter(Boolean)
      if (paths.length > 0) await client.storage.from('business-documents').remove(paths)
      const { error: deleteError } = await client
        .from('business_documents')
        .delete()
        .in('id', removed.map((document: any) => document.id))
      if (deleteError) throw new Error(`Could not remove your old documents: ${deleteError.message}`)
    }

    const newDocuments = documents.filter((document) => !document.id)
    if (newDocuments.length > 0) {
      const { error: insertError } = await client.from('business_documents').insert(
        newDocuments.map((document) => ({
          business_id: id,
          document_type: document.documentType,
          file_name: document.fileName,
          storage_path: document.storagePath,
          mime_type: document.mimeType || null,
          file_size: document.fileSize || null,
          status: 'PENDING',
        })),
      )
      if (insertError) throw new Error(`Could not save your documents: ${insertError.message}`)
    }
  }

  const handleSubmit = async () => {
    for (let index = 0; index < STEPS.length; index += 1) {
      const message = validateStep(index)
      if (message) {
        setStep(index)
        setError(message)
        return
      }
    }

    setSaving(true)
    setError(null)
    const client = getSupabaseClient()
    const wasNew = !businessId

    try {
      const categoryName = categories.find((category) => category.id === form.primaryCategoryId)?.name || ''
      const subcategoryName = subcategories.find((subcategory) => subcategory.id === form.primarySubcategoryId)?.name || ''
      const secondaryCategoryNames = form.secondaryCategoryIds
        .map((categoryId) => categories.find((category) => category.id === categoryId)?.name || '')
        .filter(Boolean)
      const businessTypeName = businessTypes.find((type) => type.id === form.businessTypeVocabularyId)?.name || ''
      const countryName = countries.find((country) => country.code === form.countryCode)?.name || form.countryCode
      const draftContent = buildDraftContent({
        businessName: form.businessName,
        shortDescription: form.shortDescription,
        description: form.description,
        services: form.services,
        city: form.city,
        region: form.region,
        country: countryName,
        categoryName,
        subcategoryName,
        secondaryCategoryNames,
        businessTypeName,
        brandColor: form.brandColor,
        coverImageUrl: form.coverImageUrl,
        logoUrl: form.logoUrl,
      })

      let id = businessId
      if (id) {
        const { error: updateError } = await client
          .from('businesses')
          .update({
            business_name: form.businessName.trim(),
            short_description: form.shortDescription.trim(),
            country_code: form.countryCode,
            city: form.city.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            website: form.website.trim() || null,
            logo_url: form.logoUrl.trim() || null,
            cover_image_url: form.coverImageUrl.trim() || null,
            primary_category_id: form.primaryCategoryId || null,
            primary_subcategory_id: form.primarySubcategoryId || null,
            business_type_vocabulary_id: form.businessTypeVocabularyId || null,
          })
          .eq('id', id)
        if (updateError) throw new Error(`Could not save your business: ${updateError.message}`)

        if (businessStatus === 'INFORMATION_PENDING') {
          await client.from('businesses').update({ status: 'INFORMATION_RECEIVED' }).eq('id', id)
        }
      } else {
        const baseSlug = form.businessName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'business'

        let created: any = null
        let slug = baseSlug
        for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
          const { data, error: insertError } = await client
            .from('businesses')
            .insert({
              owner_id: session.user.id,
              slug,
              business_name: form.businessName.trim(),
              short_description: form.shortDescription.trim(),
              country_code: form.countryCode,
              city: form.city.trim(),
              email: form.email.trim() || null,
              phone: form.phone.trim() || null,
              website: form.website.trim() || null,
              logo_url: form.logoUrl.trim() || null,
              cover_image_url: form.coverImageUrl.trim() || null,
              primary_category_id: form.primaryCategoryId || null,
              primary_subcategory_id: form.primarySubcategoryId || null,
              business_type_vocabulary_id: form.businessTypeVocabularyId || null,
              status: 'INFORMATION_RECEIVED',
              verification_status: 'UNVERIFIED',
              payment_status: 'UNPAID',
              publication_status: 'DRAFT',
            })
            .select()
            .single()
          if (insertError) {
            if (insertError.code === '23505' && attempt < 2) {
              slug = `${baseSlug}-${Date.now().toString().slice(-5)}`
              continue
            }
            throw new Error(`Could not create your business: ${insertError.message}`)
          }
          created = data
        }
        if (!created) throw new Error('Could not create your business. Please try again.')
        id = created.id as string
        setBusinessId(id)
        setBusinessSlug(created.slug as string)
        setBusinessStatus(created.status as string)
      }

      await saveProfileRecords(client, id)
      await saveDocuments(client, id)
      await savePageVersion(client, {
        businessId: id,
        content: draftContent,
        status: 'DRAFT',
      })

      if (wasNew) {
        await client.from('businesses').update({ status: 'AI_PAGE_GENERATING' }).eq('id', id)
        try {
          await invokeGeneratePage(client, id)
        } catch (generationError) {
          console.error('AI page generation failed, keeping the draft version:', generationError)
          await ensureReviewStatus(client, id)
        }
      }

      onComplete()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save business information.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="profile-state" role="status">Loading your business details…</main>
  }

  const isEditing = Boolean(businessId)

  return (
    <div className="onboarding-page">
      <header className="profile-header"><Brand href="/" /><a className="profile-back" href="/dashboard"><ArrowLeft size={15} /> Back to dashboard</a></header>

      <main className="onboarding-content">
        <div className="onboarding-header">
          <h1>{isEditing ? 'Update your business' : 'Tell us about your business'}</h1>
          <p>{isEditing ? 'Keep your details and landing page content up to date. Changes are saved as a new draft until reviewed.' : 'This information will be used to create your professional business page. You can update it later.'}</p>
        </div>

        <div className="step-indicator">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`step-item ${i === step ? 'active' : i < step ? 'complete' : ''}`}
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
            >
              <span className="step-icon">{i < step ? <Check size={14} /> : <s.icon size={14} />}</span>
              <span className="step-label">{s.label}</span>
            </button>
          ))}
        </div>

        {error && <div className="onboarding-error">{error}</div>}

        <div className="step-content">
          {step === 0 && (
            <div className="form-section">
              <h2>Business Identity</h2>
              <div className="form-grid">
                <label>Business Name *<input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Your business name" /></label>
                <label>Registered Name<input value={form.registeredName} onChange={(e) => setForm({ ...form, registeredName: e.target.value })} placeholder="Legal registered name" /></label>
                <label>Registration Number<input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="e.g. RC123456" /></label>
                <label>Year Established<input type="number" value={form.yearEstablished} onChange={(e) => setForm({ ...form, yearEstablished: e.target.value })} placeholder="e.g. 2015" /></label>
                <label>Business Size<select value={form.businessSize} onChange={(e) => setForm({ ...form, businessSize: e.target.value })}><option value="">Select size</option>{BUSINESS_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}</select></label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="form-section">
              <h2>Location</h2>
              <div className="form-grid">
                <label>Country *<select value={form.countryCode} onChange={(e) => void handleCountryChange(e.target.value)}><option value="">Select country</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
                {locationColumns.map((column) => (
                  <label key={`${column.label}-${column.index}`}>
                    {column.label}{column.index === 0 ? ' *' : ''}
                    <select value={column.selectedId} onChange={(e) => handleLocationSelect(column.index, e.target.value)}>
                      <option value="">Select {column.label.toLowerCase()}</option>
                      {column.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                  </label>
                ))}
                <label>Town / city / area *<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Accra" /></label>
                <label>Street address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" /></label>
              </div>
              {form.countryCode && locationColumns.length === 0 && <p className="upload-hint">Locations for this country are still being loaded. You can type your town or city above.</p>}
            </div>
          )}

          {step === 2 && (
            <div className="form-section">
              <h2>Contact Information</h2>
              <div className="form-grid">
                <label>Business Email *<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="business@example.com" /></label>
                <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+233 ..." /></label>
                <label>WhatsApp<input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+233 ..." /></label>
                <label>Website<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." /></label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-section">
              <h2>Classification</h2>
              <div className="form-grid">
                <label>Primary Category *<select value={form.primaryCategoryId} onChange={(e) => setForm({ ...form, primaryCategoryId: e.target.value, primarySubcategoryId: '' })}><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                {selectedCategory && <label>Subcategory<select value={form.primarySubcategoryId} onChange={(e) => setForm({ ...form, primarySubcategoryId: e.target.value })}><option value="">Select subcategory</option>{availableSubcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
                <label>Business Type *<select value={form.businessTypeVocabularyId} onChange={(e) => setForm({ ...form, businessTypeVocabularyId: e.target.value })}><option value="">Select type</option>{businessTypes.map((bt) => <option key={bt.id} value={bt.id}>{bt.name}</option>)}</select></label>
                <label>Secondary Categories<select multiple value={form.secondaryCategoryIds} onChange={(e) => setForm({ ...form, secondaryCategoryIds: Array.from(e.target.selectedOptions, (option) => option.value) })}>{categories.filter((c) => c.id !== form.primaryCategoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="form-section">
              <h2>Business Details</h2>
              <div className="form-grid">
                <label className="full-width">Short Summary *<textarea value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} rows={2} placeholder="One or two sentences about your business" maxLength={200} /></label>
                <label className="full-width">Detailed Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Tell your story. What do you do, who do you serve, what makes you different?" /></label>
              </div>
              <div className="services-section">
                <h3>Products & Services</h3>
                {form.services.map((service, index) => (
                  <div key={index} className="service-row">
                    <input value={service.name} onChange={(e) => { const next = [...form.services]; next[index] = { ...next[index], name: e.target.value }; setForm({ ...form, services: next }) }} placeholder="Service name" />
                    <input value={service.description} onChange={(e) => { const next = [...form.services]; next[index] = { ...next[index], description: e.target.value }; setForm({ ...form, services: next }) }} placeholder="Brief description" />
                    <button type="button" onClick={() => setForm({ ...form, services: form.services.filter((_, i) => i !== index) })} aria-label="Remove service"><X size={14} /></button>
                  </div>
                ))}
                <button type="button" className="secondary-button" onClick={() => setForm({ ...form, services: [...form.services, { name: '', description: '' }] })}><ArrowRight size={14} /> Add Service</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="form-section">
              <h2>Brand & Documents</h2>
              <p className="upload-hint">Upload your logo, cover image and verification documents directly. Your brand colour is used to theme your public landing page.</p>

              <div className="upload-grid">
                <div className="upload-card">
                  <span className="upload-card-label">Business logo</span>
                  {form.logoUrl
                    ? <div className="upload-preview upload-preview-logo"><img src={form.logoUrl} alt="Business logo preview" /><button type="button" onClick={() => setForm({ ...form, logoUrl: '' })} aria-label="Remove logo"><Trash2 size={14} /></button></div>
                    : <div className="upload-placeholder"><ImagePlus size={22} /><span>PNG, JPG or WebP</span></div>}
                  <label className={`upload-button ${uploading === 'logo' ? 'is-busy' : ''}`}>
                    {uploading === 'logo' ? 'Uploading…' : form.logoUrl ? 'Replace logo' : 'Upload logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(e) => void handleMediaUpload('logo', e.target.files?.[0])} />
                  </label>
                </div>

                <div className="upload-card">
                  <span className="upload-card-label">Cover image</span>
                  {form.coverImageUrl
                    ? <div className="upload-preview"><img src={form.coverImageUrl} alt="Cover preview" /><button type="button" onClick={() => setForm({ ...form, coverImageUrl: '' })} aria-label="Remove cover image"><Trash2 size={14} /></button></div>
                    : <div className="upload-placeholder"><ImagePlus size={22} /><span>Shown as your page banner</span></div>}
                  <label className={`upload-button ${uploading === 'cover' ? 'is-busy' : ''}`}>
                    {uploading === 'cover' ? 'Uploading…' : form.coverImageUrl ? 'Replace cover' : 'Upload cover'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={(e) => void handleMediaUpload('cover', e.target.files?.[0])} />
                  </label>
                </div>
              </div>

              <label className="brand-color-field">
                <span><Palette size={15} /> Brand colour</span>
                <div className="brand-color-controls">
                  <input type="color" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} aria-label="Pick brand colour" />
                  <input value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} placeholder="#092D67" maxLength={7} />
                </div>
                <small>Detected from your logo where possible. This colour themes your landing page.</small>
              </label>

              <div className="documents-section">
                <h3>Verification documents</h3>
                <p className="upload-hint">Upload files rather than pasting links. Required documents are marked with an asterisk. Files stay private and are only visible to you and the BHA review team.</p>
                {DOCUMENT_TYPES.map((type) => {
                  const document = documentFor(type.value)
                  return (
                    <div className={`document-row ${document ? 'has-file' : ''}`} key={type.value}>
                      <div className="document-info">
                        <b>{type.label}{type.required ? ' *' : ''}</b>
                        <span>{type.hint || 'PDF, Word or image up to 20 MB'}</span>
                      </div>
                      {document ? (
                        <div className="document-file">
                          <FileText size={15} />
                          <span title={document.fileName}>{document.fileName}</span>
                          <button type="button" onClick={() => setDocuments((current) => current.filter((item) => item.documentType !== type.value))} aria-label={`Remove ${type.label}`}><X size={14} /></button>
                        </div>
                      ) : (
                        <label className={`upload-button ${uploading === type.value ? 'is-busy' : ''}`}>
                          {uploading === type.value ? 'Uploading…' : 'Upload file'}
                          <input type="file" accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp" onChange={(e) => void handleDocumentUpload(type.value, e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="form-section">
              <h2>Social Links</h2>
              {form.socials.map((social, index) => (
                <div key={index} className="social-row">
                  <select value={social.platform} onChange={(e) => { const next = [...form.socials]; next[index] = { ...next[index], platform: e.target.value }; setForm({ ...form, socials: next }) }}>
                    {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                  </select>
                  <input value={social.url} onChange={(e) => { const next = [...form.socials]; next[index] = { ...next[index], url: e.target.value }; setForm({ ...form, socials: next }) }} placeholder="https://..." />
                  <button type="button" onClick={() => setForm({ ...form, socials: form.socials.filter((_, i) => i !== index) })} aria-label="Remove social link"><X size={14} /></button>
                </div>
              ))}
              <button type="button" className="secondary-button" onClick={() => setForm({ ...form, socials: [...form.socials, { platform: 'Facebook', url: '' }] })}><ArrowRight size={14} /> Add Social Link</button>
            </div>
          )}

          {step === 7 && (
            <div className="form-section">
              <h2>Opening Hours</h2>
              <div className="hours-grid">
                {DAYS.map((day) => (
                  <div key={day} className="hours-row">
                    <span className="hours-day">{day}</span>
                    <label className="hours-closed">
                      <input type="checkbox" checked={form.openingHours[day].closed} onChange={(e) => setForm({ ...form, openingHours: { ...form.openingHours, [day]: { ...form.openingHours[day], closed: e.target.checked } } })} />
                      Closed
                    </label>
                    {!form.openingHours[day].closed && (
                      <>
                        <input type="time" value={form.openingHours[day].open} onChange={(e) => setForm({ ...form, openingHours: { ...form.openingHours, [day]: { ...form.openingHours[day], open: e.target.value } } })} />
                        <span className="hours-sep">to</span>
                        <input type="time" value={form.openingHours[day].close} onChange={(e) => setForm({ ...form, openingHours: { ...form.openingHours, [day]: { ...form.openingHours[day], close: e.target.value } } })} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="step-navigation">
          {step > 0 && <button className="secondary-button" onClick={handleBack}><ArrowLeft size={15} /> Back</button>}
          <div className="step-nav-right">
            {step < STEPS.length - 1 ? (
              <button className="primary-button" onClick={handleNext}>Continue <ArrowRight size={15} /></button>
            ) : (
              <button className="primary-button" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Submit for Review'} <ArrowRight size={15} /></button>
            )}
          </div>
        </div>
        {businessSlug && <p className="onboarding-slug">Your page address will be /business/{businessSlug}</p>}
      </main>
    </div>
  )
}
