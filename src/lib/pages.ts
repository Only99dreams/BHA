import type { SupabaseClient } from '@supabase/supabase-js'

export type PageService = {
  name: string
  description: string
}

export type PageFact = string | { label: string; value: string }

export type PageImage = {
  url: string
  alt?: string
  caption?: string
}

export type PageFeature = {
  title: string
  description: string
}

export type PageProcessStep = {
  title: string
  description: string
}

export type PageFaq = {
  question: string
  answer: string
}

export type PageQuestion = {
  id: string
  question: string
  hint: string
}

export type PageAnswer = {
  question: string
  answer: string
}

export type PageContent = {
  seo_title?: string
  seo_description?: string
  page_headline?: string
  hero_eyebrow?: string
  hero_highlights?: string[]
  page_intro?: string
  about_title?: string
  about_section?: string
  suggested_services?: PageService[]
  features?: PageFeature[]
  process_steps?: PageProcessStep[]
  faq?: PageFaq[]
  contact_heading?: string
  contact_note?: string
  footer_note?: string
  key_facts?: PageFact[]
  hero_image_url?: string | null
  about_image_url?: string | null
  gallery_images?: PageImage[]
  logo_url?: string | null
  brand_color?: string | null
  hero_tagline?: string
  cta_text?: string
  value_proposition?: string
  sections?: Array<{ id: string; type: string; content: any }>
  [key: string]: unknown
}

export type PageVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED'

export type PageVersion = {
  id: string
  business_id: string
  version: number
  content: PageContent | null
  seo_metadata: { seo_title?: string; seo_description?: string } | null
  status: PageVersionStatus
  created_at: string
  reviewed_at?: string | null
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function pageContentFromVersion(version: PageVersion | null | undefined): PageContent {
  if (!version?.content) return {}
  return version.content
}

export async function getNextPageVersionNumber(client: SupabaseClient, businessId: string) {
  const { data } = await client
    .from('page_versions')
    .select('version')
    .eq('business_id', businessId)
    .order('version', { ascending: false })
    .limit(1)
  return (data?.[0]?.version || 0) + 1
}

type SavePageVersionInput = {
  businessId: string
  content: PageContent
  status?: PageVersionStatus
  versionId?: string | null
}

export async function savePageVersion(client: SupabaseClient, input: SavePageVersionInput) {
  const seoMetadata = {
    seo_title: input.content.seo_title ?? '',
    seo_description: input.content.seo_description ?? '',
  }

  if (input.versionId) {
    return client
      .from('page_versions')
      .update({
        content: input.content,
        seo_metadata: seoMetadata,
        status: input.status ?? 'DRAFT',
      })
      .eq('id', input.versionId)
      .select()
      .single()
  }

  const version = await getNextPageVersionNumber(client, input.businessId)
  return client
    .from('page_versions')
    .insert({
      business_id: input.businessId,
      version,
      content: input.content,
      seo_metadata: seoMetadata,
      status: input.status ?? 'DRAFT',
    })
    .select()
    .single()
}

const REVIEW_CHAIN = ['INFORMATION_PENDING', 'INFORMATION_RECEIVED', 'AI_PAGE_GENERATING', 'QUALITY_REVIEW']

/**
 * Walks a business through the only legal status transitions until it reaches
 * quality review. Live businesses keep their current status so their published
 * page is never taken offline by an edit.
 */
export async function ensureReviewStatus(client: SupabaseClient, businessId: string) {
  const { data, error } = await client
    .from('businesses')
    .select('status')
    .eq('id', businessId)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const status = data?.status as string | undefined
  const index = status ? REVIEW_CHAIN.indexOf(status) : -1
  if (index === -1) return status ?? null

  for (const next of REVIEW_CHAIN.slice(index + 1)) {
    const { error: updateError } = await client
      .from('businesses')
      .update({ status: next })
      .eq('id', businessId)
    if (updateError) throw new Error(updateError.message)
  }
  return 'QUALITY_REVIEW'
}

export async function invokeGeneratePage(client: SupabaseClient, businessId: string, answers: PageAnswer[] = []) {
  const { data, error } = await client.functions.invoke('generate-ai-page', {
    body: { business_id: businessId, answers },
  })
  if (error) throw new Error(error.message || 'AI generation could not be started.')
  if (data?.error) throw new Error(data.error)
  return data
}

export async function invokePageQuestions(client: SupabaseClient, businessId: string): Promise<PageQuestion[]> {
  const { data, error } = await client.functions.invoke('generate-ai-page', {
    body: { business_id: businessId, action: 'questions' },
  })
  if (error) throw new Error(error.message || 'Could not prepare AI questions.')
  if (data?.error) throw new Error(data.error)
  if (!Array.isArray(data?.questions)) return []

  return data.questions
    .map((question: any, index: number) => ({
      id: typeof question?.id === 'string' && question.id ? question.id : `question-${index + 1}`,
      question: typeof question?.question === 'string' ? question.question.trim() : '',
      hint: typeof question?.hint === 'string' ? question.hint.trim() : '',
    }))
    .filter((question: PageQuestion) => question.question)
    .slice(0, 4)
}

type DraftInput = {
  businessName: string
  shortDescription: string
  description?: string
  services?: { name: string; description: string }[]
  city?: string
  region?: string
  country?: string
  categoryName?: string
  subcategoryName?: string
  secondaryCategoryNames?: string[]
  businessTypeName?: string
  brandColor?: string | null
  coverImageUrl?: string | null
  logoUrl?: string | null
}

export const DEFAULT_BRAND_COLOR = '#092d67'

export function buildDraftContent(input: DraftInput): PageContent {
  const name = input.businessName.trim() || 'Your business'
  const short = (input.shortDescription || '').trim()
  const long = (input.description || '').trim()
  const services = (input.services || []).filter((service) => service.name.trim())
  const secondary = (input.secondaryCategoryNames || []).filter(Boolean)

  const facts: PageFact[] = []
  const location = [input.city, input.region, input.country].filter(Boolean).join(', ')
  if (location) facts.push({ label: 'Location', value: location })
  const sector = [input.categoryName, input.subcategoryName].filter(Boolean).join(' / ')
  if (sector) facts.push({ label: 'Sector', value: sector })
  if (secondary.length > 0) facts.push({ label: 'Also offers', value: secondary.join(', ') })
  if (input.businessTypeName) facts.push({ label: 'Business type', value: input.businessTypeName })
  if (services.length > 0) facts.push({ label: 'Services', value: `${services.length} listed` })

  return {
    seo_title: `${name} | Business Hub Africa`.substring(0, 60),
    seo_description: (short || long).substring(0, 160),
    page_headline: name,
    page_intro: short || long,
    about_section: long || short,
    suggested_services: services.slice(0, 5),
    key_facts: facts,
    hero_image_url: input.coverImageUrl || null,
    logo_url: input.logoUrl || null,
    brand_color: input.brandColor || DEFAULT_BRAND_COLOR,
  }
}
