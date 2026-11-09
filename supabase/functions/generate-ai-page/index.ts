// ============================================================================
// BHA AI Page Generation Edge Function
// Triggered when a business reaches AI_PAGE_GENERATING status.
// Uses AI to draft page content from business data.
// Output is stored as a DRAFT page_version — NOT auto-published.
// ============================================================================

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''
const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY') || ''
const UNSPLASH_ACCESS_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY') || ''

const USE_GROQ = Boolean(GROQ_API_KEY) && !Boolean(OPENAI_API_KEY)
const API_KEY = OPENAI_API_KEY || GROQ_API_KEY
const API_BASE_URL = OPENAI_API_KEY ? 'https://api.openai.com/v1' : (GROQ_API_KEY ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1')
// Models
const GROQ_MODELS = ['gemma2-9b-it', 'llama-3.1-8b-instant']
const MODEL = OPENAI_API_KEY ? 'gpt-4o-mini' : (GROQ_API_KEY ? GROQ_MODELS[0] : 'gpt-4o-mini')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

interface BusinessData {
  id: string
  business_name: string
  short_description: string
  description: string
  city: string
  region: string
  country: string
  address: string
  services: { name: string; description: string }[]
  business_type: string
  categories: string[]
  primary_category: string
  subcategory: string
  secondary_categories: string[]
  brand_color: string
  year_established: number | string | null
  business_size: string | null
  website: string
  email: string
  phone: string
  whatsapp: string
  opening_hours: unknown
  social_links: unknown
  logo_url: string
  cover_image_url: string
  documents: { type: string; status: string }[]
}

const PROMPT_TEMPLATE = `You are an expert website designer creating a clean, professional, conversion-focused one-page business website.

CRITICAL RULES:
- ONLY use information from the provided business data and the owner's answers. Do NOT invent fake details.
- Create a COMPLETE website: hero, about, services, reasons to choose the business, how it works, gallery, FAQ, contact and footer.
- Use British English appropriate for African businesses.
- Be specific to THIS business using their actual name, description, services, location.
- Use the exact brand_color provided.
- If information is missing, omit it or return an empty list. Never use placeholder text such as "[To be confirmed]".

Business data (JSON):
{{BUSINESS_DATA}}

Answers the owner gave to clarifying questions (authoritative, use them):
{{ANSWERS}}

Generation seed: {{SEED}}

Generate the website content with this EXACT JSON structure:

{
  "seo_title": "Max 60 chars - clear and descriptive",
  "seo_description": "Max 160 chars - specific to business",
  "page_headline": "Clear, professional headline (max 80 chars)",
  "hero_eyebrow": "Short context line, e.g. 'Family-run bakery · Accra'",
  "hero_tagline": "Concise value proposition (1 line)",
  "hero_highlights": ["3 short, concrete proof points (max 6 words each)"],
  "page_intro": "2-3 sentences explaining what they do",
  "cta_text": "Action-oriented button text like 'Get in touch', 'Book now', 'Request a quote'",
  "about_title": "Specific section heading (max 60 chars)",
  "about_section": "Professional about section (150-250 words) based on their description",
  "suggested_services": [
    {"name": "Service name", "description": "Clear description (20-40 words)"}
  ],
  "features": [
    {"title": "Reason to choose them", "description": "One sentence of proof (max 30 words)"}
  ],
  "process_steps": [
    {"title": "Step name", "description": "What happens in this step (max 30 words)"}
  ],
  "faq": [
    {"question": "A real customer question", "answer": "A clear answer grounded in the data"}
  ],
  "key_facts": [
    {"label": "Location", "value": "..."},
    {"label": "Category", "value": "..."}
  ],
  "contact_heading": "Warm invitation to get in touch (max 60 chars)",
  "contact_note": "1-2 sentences on what happens when a customer reaches out",
  "footer_note": "One short line summarising the business",
  "brand_color": "Exact hex from data",
  "logo_url": "Use provided logo_url if exists, otherwise empty string",
  "hero_image_url": "Use provided cover_image_url if exists, otherwise empty string",
  "image_search_queries": {
    "hero": "Short stock-photo search phrase, e.g. 'modern dental clinic interior'",
    "about": "Short stock-photo search phrase for the about section",
    "gallery": ["Phrase 1", "Phrase 2", "Phrase 3", "Phrase 4", "Phrase 5", "Phrase 6"]
  }
}

REQUIREMENTS:
- The page is rendered as a full website. Do not repeat the same copy across sections.
- suggested_services: 4-6 services based on their actual offerings.
- features: 3-4 genuine reasons to choose them, derived only from the data (experience, location, specialisms, service style). Never invent awards, certifications or guarantees.
- process_steps: 3-4 steps a customer goes through, only when the data implies a clear process (consultation, booking, delivery, support). Otherwise return [].
- faq: 3-5 questions with answers strictly grounded in the data. Cover service area, booking, delivery or opening hours only when known. Never invent prices, payment terms, warranties or policies. Return [] when there is nothing solid to say.
- hero_highlights: 3 short concrete facts from the data.
- image_search_queries.gallery: exactly 6 short, specific phrases describing useful, realistic photos for THIS business and its location. Never return image URLs and never use generic phrases like "business" on their own.
- Keep it clean, scannable and professional, like a real business website.
- Vary slightly each time but maintain professional structure.

Respond with valid JSON only.`

function parseAiContent(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(cleaned)
}

interface ImageAsset {
  url: string
  alt: string
  caption?: string
}

interface ClarifyingQuestion {
  id: string
  question: string
  hint: string
}

interface ClarifyingAnswer {
  question: string
  answer: string
}

const QUESTION_PROMPT = `You are a senior website strategist for Business Hub Africa. Review the business data and identify ONLY the missing or weak information that would materially improve a professional business landing page.

Business data (JSON):
{{BUSINESS_DATA}}

Rules:
- Ask at most 4 questions.
- Do not ask for information already present in the data.
- Each question must be specific to this business and easy for the owner to answer in one or two sentences.
- Focus on what makes them different, who they serve, signature services or products, service area, pricing or booking expectations, and what real photos they can provide.
- Return {"questions": []} when the data is already enough for an excellent page.
- Never ask for passwords, payment details, or private documents.

Return valid JSON only in this shape:
{"questions":[{"id":"differentiator","question":"...","hint":"..."}]}`

// Verified Unsplash photo IDs used when no stock-photo API key is configured.
// Each sector has a small pool so generated pages still get relevant imagery.
const SECTOR_IMAGES: Record<string, string[]> = {
  dining: [
    '1414235077428-338989a2e8c0',
    '1517248135467-4c7edcad34c4',
    '1555396273-367ea4eb4db5',
    '1504674900247-0877df9cc836',
  ],
  hospitality: [
    '1566073771259-6a8506099945',
    '1542314831-068cd1dbfeeb',
    '1520250497591-112f2f40a3f4',
    '1571896349842-33c89424de2d',
  ],
  beauty: [
    '1560066984-138dadb4c035',
    '1540555700478-4be289fbecef',
    '1522337360788-8b13dee7a37e',
    '1600334089648-b0d9d3028eb2',
  ],
  health: [
    '1576091160399-112ba8d25d1d',
    '1579684385127-1ef15d508118',
    '1519494026892-80bbd2d6fd0d',
    '1538108149393-fbbd81895907',
  ],
  technology: [
    '1498050108023-c5249f4df085',
    '1518770660439-4636190af475',
    '1550751827-4bd374c3f58b',
    '1531297484001-80022131f5a1',
  ],
  construction: [
    '1541888946425-d81bb19240f5',
    '1503387762-592deb58ef4e',
    '1600585154340-be6161a56a0c',
    '1487958449943-2429e8be8625',
  ],
  retail: [
    '1472851294608-062f824d29cc',
    '1445205170230-053b83016050',
    '1567401893414-76b7b1e5a7a5',
    '1523240795612-9a054b0db644',
  ],
  education: [
    '1509062522246-3755977927d7',
    '1580582932707-520aed937b7b',
    '1497633762265-9d179a990aa6',
    '1427504494785-3a9ca7044f45',
  ],
  agriculture: [
    '1500937386664-56d1dfef3854',
    '1625246333195-78d9c38ad449',
    '1464226184884-fa280b87c399',
    '1500937386664-56d1dfef3854',
  ],
  logistics: [
    '1553413077-190dd305871c',
    '1586528116311-ad8dd3c8310d',
    '1566576912321-d58ddd7a6088',
    '1565043666747-69f6646db940',
  ],
  finance: [
    '1554224155-6726b3ff858f',
    '1579621970563-ebec7560ff3e',
    '1454165804606-c3d57bc86b40',
    '1521791136064-7986c2920216',
  ],
  automotive: [
    '1503376780353-7e6692767b70',
    '1492144534655-ae79c964c9d7',
    '1487754180451-c456f719a1fc',
  ],
  creative: [
    '1492724441997-5dc865305da7',
    '1516035069371-29a1b244cc32',
    '1542744173-8e7e53415bb0',
    '1522202176988-66273c2fd55f',
  ],
  fitness: [
    '1534438327276-14e5300c3a48',
    '1517836357463-d25dfeac3438',
  ],
  general: [
    '1486406146926-c627a92ad1ab',
    '1521737604893-d14cc237f11d',
    '1497366216548-37526070297c',
    '1521737711867-e3b97375f902',
    '1552664730-d307ca884978',
    '1560250097-0b93528c311a',
    '1556761175-4b46a572b786',
  ],
}

const SECTOR_PATTERNS: [string, RegExp][] = [
  ['dining', /restaurant|cafe|café|coffee|food|catering|bakery|bar|grill|kitchen|chef/i],
  ['hospitality', /hotel|lodge|travel|tourism|tour|resort|guest|accommodation|event/i],
  ['beauty', /beauty|spa|salon|barber|cosmetic|skincare|makeup|nail|hair/i],
  ['health', /health|medical|clinic|dental|hospital|pharmacy|doctor|nurse|therapy|wellness/i],
  ['technology', /tech|software|digital|web|app|it\b|data|cloud|cyber|startup/i],
  ['construction', /construction|engineering|architecture|real estate|property|builder|plumbing|electrical|survey/i],
  ['retail', /retail|shop|store|fashion|boutique|ecommerce|e-commerce|market|wholesale/i],
  ['education', /education|school|training|academy|college|university|tutor|learning/i],
  ['agriculture', /farm|agric|agro|poultry|livestock|crop|food production|horticulture/i],
  ['logistics', /logistics|transport|delivery|warehouse|manufactur|industrial|freight|shipping/i],
  ['finance', /finance|financial|account|bank|insurance|consult|legal|law|audit|tax/i],
  ['automotive', /auto|car|vehicle|mechanic|motor|garage|tyre|tire/i],
  ['creative', /creative|design|media|marketing|advert|photo|video|studio|brand|content/i],
  ['fitness', /fitness|gym|sport|athlet|personal train/i],
]

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

function classifyImageTheme(text: string) {
  for (const [sector, pattern] of SECTOR_PATTERNS) {
    if (pattern.test(text)) return sector
  }
  return 'general'
}

function unsplashUrl(photoId: string, width = 1600) {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=82`
}

function curatedImages(query: string, count: number, alt: string): ImageAsset[] {
  const sector = classifyImageTheme(query)
  const pool = [...(SECTOR_IMAGES[sector] || []), ...SECTOR_IMAGES.general]
  const start = hashString(query) % pool.length
  const images: ImageAsset[] = []
  for (let index = 0; index < count && index < pool.length; index += 1) {
    images.push({ url: unsplashUrl(pool[(start + index) % pool.length]), alt })
  }
  return images
}

async function searchStockImages(query: string, count: number, alt: string): Promise<ImageAsset[]> {
  const cleaned = query.trim()
  if (!cleaned) return []

  if (PEXELS_API_KEY) {
    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleaned)}&orientation=landscape&per_page=${count}`,
        { headers: { Authorization: PEXELS_API_KEY } },
      )
      if (response.ok) {
        const data = await response.json()
        const photos = (data.photos || [])
          .map((photo: any) => ({
            url: photo.src?.large2x || photo.src?.large || photo.src?.original || '',
            alt: photo.alt || alt,
          }))
          .filter((image: ImageAsset) => image.url)
        if (photos.length > 0) return photos
      } else {
        console.warn('Pexels image search failed:', response.status)
      }
    } catch (error) {
      console.warn('Pexels image search error:', error)
    }
  }

  if (UNSPLASH_ACCESS_KEY) {
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cleaned)}&per_page=${count}&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } },
      )
      if (response.ok) {
        const data = await response.json()
        const photos = (data.results || [])
          .map((photo: any) => ({
            url: photo.urls?.regular || photo.urls?.full || '',
            alt: photo.alt_description || alt,
          }))
          .filter((image: ImageAsset) => image.url)
        if (photos.length > 0) return photos
      } else {
        console.warn('Unsplash image search failed:', response.status)
      }
    } catch (error) {
      console.warn('Unsplash image search error:', error)
    }
  }

  return curatedImages(cleaned, count, alt)
}

function cleanText(value: unknown, maxLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function cleanImageUrl(value: unknown) {
  const url = cleanText(value, 800)
  return /^https?:\/\//i.test(url) ? url : ''
}

function formatAnswers(answers: unknown) {
  if (!Array.isArray(answers)) return 'None'
  return answers
    .slice(0, 6)
    .map((item) => {
      const question = cleanText((item as ClarifyingAnswer)?.question, 220)
      const answer = cleanText((item as ClarifyingAnswer)?.answer, 600)
      return question && answer ? `Q: ${question}\nA: ${answer}` : ''
    })
    .filter(Boolean)
    .join('\n\n') || 'None'
}

function cleanStringList(value: unknown, limit: number, maxLength = 80) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, limit)
}

function normaliseWebsiteContent(content: Record<string, any>, business: BusinessData) {
  const services = (Array.isArray(content.suggested_services) ? content.suggested_services : [])
    .slice(0, 6)
    .map((service: any) => ({
      name: cleanText(service?.name, 90),
      description: cleanText(service?.description, 220),
    }))
    .filter((service) => service.name)

  const fallbackServices = (business.services || []).slice(0, 4).map((service) => ({
    name: cleanText(service.name, 90),
    description: cleanText(service.description, 220),
  })).filter((service) => service.name)

  const features = (Array.isArray(content.features) ? content.features : [])
    .slice(0, 4)
    .map((feature: any) => ({
      title: cleanText(feature?.title, 70),
      description: cleanText(feature?.description, 220),
    }))
    .filter((feature) => feature.title)

  const processSteps = (Array.isArray(content.process_steps) ? content.process_steps : [])
    .slice(0, 4)
    .map((step: any) => ({
      title: cleanText(step?.title, 70),
      description: cleanText(step?.description, 220),
    }))
    .filter((step) => step.title)

  const faq = (Array.isArray(content.faq) ? content.faq : [])
    .slice(0, 5)
    .map((item: any) => ({
      question: cleanText(item?.question, 160),
      answer: cleanText(item?.answer, 600),
    }))
    .filter((item) => item.question && item.answer)

  const facts = (Array.isArray(content.key_facts) ? content.key_facts : [])
    .slice(0, 5)
    .map((fact: any) => {
      if (typeof fact === 'string') return { label: 'Fact', value: cleanText(fact, 120) }
      return { label: cleanText(fact?.label, 40), value: cleanText(fact?.value, 120) }
    })
    .filter((fact) => fact.label && fact.value)

  const shortDescription = cleanText(business.short_description, 600)
  const description = cleanText(business.description, 2400)
  const seoTitle = cleanText(content.seo_title, 60) || `${business.business_name} | Business Hub Africa`.slice(0, 60)
  const seoDescription = cleanText(content.seo_description, 160) || shortDescription.slice(0, 160)

  return {
    ...content,
    seo_title: seoTitle,
    seo_description: seoDescription,
    page_headline: cleanText(content.page_headline, 80) || business.business_name,
    hero_tagline: cleanText(content.hero_tagline, 160) || shortDescription,
    page_intro: cleanText(content.page_intro, 600) || shortDescription || description,
    cta_text: cleanText(content.cta_text, 40) || 'Get in touch',
    hero_eyebrow: cleanText(content.hero_eyebrow, 70),
    hero_highlights: cleanStringList(content.hero_highlights, 4, 60),
    about_title: cleanText(content.about_title, 80),
    about_section: cleanText(content.about_section, 2400) || description || shortDescription,
    suggested_services: services.length > 0 ? services : fallbackServices,
    features,
    process_steps: processSteps,
    faq,
    key_facts: facts,
    contact_heading: cleanText(content.contact_heading, 80),
    contact_note: cleanText(content.contact_note, 260),
    footer_note: cleanText(content.footer_note, 160),
  }
}

async function sourcePageImages(content: Record<string, any>, business: BusinessData, ownerMedia: ImageAsset[]) {
  const queries = content.image_search_queries || {}
  const heroQuery = cleanText(queries.hero) ||
    [business.primary_category || business.business_type, business.city, 'professional business'].filter(Boolean).join(' ')
  const aboutQuery = cleanText(queries.about) ||
    [business.business_name, business.primary_category || business.business_type].filter(Boolean).join(' ')
  const galleryQueries = Array.isArray(queries.gallery)
    ? queries.gallery.map((query: unknown) => cleanText(query)).filter(Boolean).slice(0, 6)
    : []

  const used = new Set<string>()
  const unique = (images: ImageAsset[]) => images.filter((image) => {
    if (!image?.url || used.has(image.url)) return false
    used.add(image.url)
    return true
  })

  let heroUrl = cleanImageUrl(business.cover_image_url)
  if (!heroUrl) {
    const heroImages = unique(await searchStockImages(heroQuery, 2, `${business.business_name} hero`))
    heroUrl = heroImages[0]?.url || ''
  }

  const aboutImages = unique(await searchStockImages(aboutQuery, 2, `${business.business_name} about`))
  const gallery: ImageAsset[] = [...ownerMedia.map((image) => ({ ...image, url: cleanImageUrl(image.url) })).filter((image) => image.url)]
  const queriesToUse = galleryQueries.length > 0 ? galleryQueries : [heroQuery, aboutQuery]
  for (const query of queriesToUse) {
    if (gallery.length >= 6) break
    const sourced = unique(await searchStockImages(query, 2, query))
    gallery.push(...sourced)
  }
  while (gallery.length < 6) {
    const filler = unique(curatedImages(heroQuery, 8, `${business.business_name} gallery`))
    if (filler.length === 0) break
    gallery.push(...filler)
  }

  const dedupedGallery = unique(gallery).slice(0, 6)

  delete content.image_search_queries
  return {
    ...content,
    hero_image_url: heroUrl || content.hero_image_url || null,
    about_image_url: aboutImages.find((image) => image.url !== heroUrl)?.url || dedupedGallery[0]?.url || null,
    gallery_images: dedupedGallery.map((image) => ({
      url: image.url,
      alt: image.alt || `${business.business_name} gallery image`,
    })),
  }
}

function informationGaps(business: BusinessData) {
  const gaps: string[] = []
  if ((business.description || business.short_description || '').trim().length < 160) gaps.push('Business story and differentiators')
  if (business.services.length < 2) gaps.push('Signature products or services')
  if (!business.email && !business.phone && !business.whatsapp) gaps.push('Preferred contact method')
  if (!business.cover_image_url) gaps.push('Real business photos')
  if (!business.year_established) gaps.push('Years of experience and service area')
  return gaps
}

function fallbackQuestions(business: BusinessData): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = []
  const description = (business.description || business.short_description || '').trim()

  if (description.length < 160) {
    questions.push({
      id: 'story',
      question: `In one or two sentences, what makes ${business.business_name} different from similar businesses?`,
      hint: 'Think about your experience, quality, service or the customers you know best.',
    })
  }
  if (business.services.length < 2) {
    questions.push({
      id: 'services',
      question: 'What are your three most important products or services, and who are they for?',
      hint: 'List the names and a short note about each one.',
    })
  }
  if (!business.email && !business.phone && !business.whatsapp) {
    questions.push({
      id: 'contact',
      question: 'How should new customers get in touch with you?',
      hint: 'For example WhatsApp, phone, email, a booking link or a contact form.',
    })
  }
  if (!business.cover_image_url) {
    questions.push({
      id: 'photos',
      question: 'What real photos or visual details best represent your business?',
      hint: 'For example your team, premises, products, work in progress or happy customers.',
    })
  }
  if (!business.year_established) {
    questions.push({
      id: 'experience',
      question: 'How long have you been operating, and which areas do you serve?',
      hint: 'This helps us build trust with new visitors.',
    })
  }

  return questions.slice(0, 4)
}

async function generateQuestions(business: BusinessData, gaps: string[]): Promise<ClarifyingQuestion[]> {
  const fallback = fallbackQuestions(business)
  if (!API_KEY) return fallback

  const prompt = QUESTION_PROMPT.replace(
    '{{BUSINESS_DATA}}',
    JSON.stringify({ ...business, information_gaps: gaps }, null, 2),
  )

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a careful website strategist. You only ask for information that is genuinely missing. You never invent facts.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) return fallback
    const data = await response.json()
    const parsed = parseAiContent(data.choices?.[0]?.message?.content || '{"questions":[]}')
    if (!Array.isArray(parsed.questions)) return fallback

    const cleaned = parsed.questions
      .slice(0, 4)
      .map((question: any, index: number) => ({
        id: cleanText(question?.id, 40) || `question-${index + 1}`,
        question: cleanText(question?.question, 240),
        hint: cleanText(question?.hint, 240),
      }))
      .filter((question: ClarifyingQuestion) => question.question)

    return cleaned.length > 0 ? cleaned : fallback
  } catch (error) {
    console.warn('AI question generation failed:', error)
    return fallback
  }
}

async function generatePageContent(business: BusinessData, answers?: unknown): Promise<Record<string, unknown>> {
  if (!API_KEY && !OPENAI_API_KEY) {
    throw new Error('AI API key is not configured (set GROQ_API_KEY or OPENAI_API_KEY)')
  }

  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const prompt = PROMPT_TEMPLATE
    .replace('{{BUSINESS_DATA}}', JSON.stringify(business, null, 2))
    .replace('{{ANSWERS}}', formatAnswers(answers))
    .replace('{{SEED}}', seed)
  const modelsToTry = OPENAI_API_KEY ? ['gpt-4o-mini', 'gpt-4o'] : (GROQ_API_KEY ? GROQ_MODELS : ['gpt-4o-mini'])

  let lastError: unknown = null
  for (const model of modelsToTry) {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a professional copywriter for business directories. You write in British English. You never invent facts.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 3200,
          response_format: { type: 'json_object' },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
          throw new Error('AI provider returned empty content')
        }

        return parseAiContent(content)
      }

      const errorText = await response.text()
      lastError = new Error(`AI API error: ${response.status} ${errorText}`)
      // Only try next model on model_not_found/errors related to model
      try {
        const parsed = JSON.parse(errorText)
        if (parsed?.error?.code !== 'model_not_found' && parsed?.error?.code !== 'model_decommissioned' && !errorText.includes('model_not_found') && !errorText.includes('decommissioned') && parsed?.error?.code !== 'invalid_request_error') {
          throw lastError
        }
      } catch (e) {
        if (e === lastError) throw e
      }
    } catch (e) {
      lastError = e
    }
  }

  // If Groq failed, try OpenAI as fallback
  if (USE_GROQ && OPENAI_API_KEY && OPENAI_API_KEY !== API_KEY) {
    const openaiModels = ['gpt-4o-mini', 'gpt-3.5-turbo']
    for (const model of openaiModels) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are a professional copywriter for business directories. You write in British English. You never invent facts.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 3200,
            response_format: { type: 'json_object' },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const content = data.choices?.[0]?.message?.content
          if (!content) throw new Error('AI provider returned empty content')
          return parseAiContent(content)
        }
      } catch (e) {
        lastError = e
      }
    }
  }

  // Fallback: return a basic draft if all AI calls fail
  try {
    const location = [business.city, business.region, business.country].filter(Boolean).join(', ')
    const sector = [business.primary_category, business.subcategory].filter(Boolean).join(' / ')
    const facts: any[] = []
    if (location) facts.push({ label: 'Location', value: location })
    if (sector) facts.push({ label: 'Sector', value: sector })
    if (business.business_type) facts.push({ label: 'Business type', value: business.business_type })
    if (business.services?.length > 0) facts.push({ label: 'Services', value: `${business.services.length} listed` })
    if (business.brand_color) facts.push({ label: 'Brand colour', value: business.brand_color })

    const themes = ['modern', 'elegant', 'bold', 'minimal', 'warm']
    const theme = themes[Math.floor(Math.random() * themes.length)]

    const highlights = [
      business.year_established ? `Established ${business.year_established}` : '',
      business.city ? `Based in ${business.city}` : '',
      business.services?.length ? `${business.services.length} services offered` : '',
      business.business_type || '',
    ].filter(Boolean).slice(0, 3)

    return {
      seo_title: `${business.business_name} | Business Hub Africa`.substring(0, 60),
      seo_description: (business.short_description || business.description || '').substring(0, 160),
      page_headline: business.business_name,
      hero_eyebrow: [sector, location].filter(Boolean).join(' · '),
      hero_highlights: highlights,
      page_intro: business.short_description || business.description || '',
      about_title: `About ${business.business_name}`,
      about_section: business.description || business.short_description || '',
      suggested_services: (business.services || []).slice(0, 6).map((s: any) => ({ name: s.name, description: s.description || '' })),
      features: [],
      process_steps: [],
      faq: [],
      key_facts: facts,
      contact_heading: `Talk to ${business.business_name}`,
      contact_note: business.phone || business.email || business.whatsapp
        ? 'Reach us by phone, WhatsApp or email and we will respond as soon as possible.'
        : 'Get in touch to find out more about what we offer.',
      footer_note: business.short_description || '',
      brand_color: business.brand_color || '#092d67',
      hero_image_url: business.cover_image_url || null,
      logo_url: business.logo_url || null,
      hero_tagline: business.short_description || `Quality ${business.primary_category || 'services'} in ${business.city || 'Africa'}`,
      cta_text: business.business_type ? `Connect with ${business.business_name}` : 'Get in touch',
      value_proposition: business.short_description || `Trusted ${business.business_type || 'business'} delivering excellence`,
      style_theme: theme,
      hero_style: `${theme} hero design`,
    }
  } catch {
    throw lastError instanceof Error ? lastError : new Error('AI API error: all models failed')
  }
}

function firstRecord(value: unknown): Record<string, any> {
  if (Array.isArray(value)) return (value[0] as Record<string, any>) || {}
  return (value as Record<string, any>) || {}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json().catch(() => ({}))
  const businessId = typeof body.business_id === 'string' ? body.business_id : ''

  if (!businessId) {
    return json({ error: 'business_id is required' }, 400)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: 'Supabase environment is not configured' }, 500)
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')

    // Verify the caller and make sure they own the business (or review it).
    const caller = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await caller.auth.getUser(authHeader.slice('Bearer '.length))
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: owned, error: ownedError } = await caller
      .from('businesses')
      .select('id, owner_id, status')
      .eq('id', businessId)
      .maybeSingle()
    if (ownedError) return json({ error: ownedError.message }, 400)
    if (!owned) return json({ error: 'Business not found' }, 404)

    if (owned.owner_id !== user.id) {
      const { data: roles } = await caller
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['ADMIN', 'REVIEWER'])
      if (!roles?.length) return json({ error: 'You do not have access to this business' }, 403)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch business data for the prompt.
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*, business_profiles(*), business_categories(categories(name), subcategories(name)), business_services(name, description), business_type_vocabulary(name)')
      .eq('id', businessId)
      .single()

    if (businessError || !business) {
      return json({ error: 'Business not found' }, 404)
    }

    const profile = firstRecord(business.business_profiles)
    const categoryRows = business.business_categories || []
    const primaryCategoryRow = categoryRows.find((item: any) => item.is_primary) || categoryRows[0] || {}
    const categories = categoryRows
      .map((item: any) => item.categories?.name)
      .filter(Boolean)
    const secondaryCategories = categoryRows
      .filter((item: any) => item !== primaryCategoryRow)
      .map((item: any) => item.categories?.name)
      .filter(Boolean)

    // Documents and owner media are optional context; a missing table must not
    // break generation.
    const { data: documents } = await supabase
      .from('business_documents')
      .select('document_type, status')
      .eq('business_id', businessId)

    const { data: mediaRows } = await supabase
      .from('business_media')
      .select('storage_path, alt_text')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })

    const ownerMedia: ImageAsset[] = (mediaRows || [])
      .map((item: any) => {
        const path = typeof item.storage_path === 'string' ? item.storage_path : ''
        const url = /^https?:\/\//i.test(path)
          ? path
          : (path ? `${supabaseUrl}/storage/v1/object/public/business-media/${encodeURI(path)}` : '')
        return { url, alt: item.alt_text || business.business_name }
      })
      .filter((image) => image.url)

    const businessData: BusinessData = {
      id: business.id,
      business_name: business.business_name,
      short_description: business.short_description || '',
      description: profile.description || business.short_description || '',
      city: business.city || '',
      region: profile.region || '',
      country: business.country_code || '',
      address: profile.address || '',
      services: business.business_services || [],
      business_type: business.business_type_vocabulary?.name || '',
      categories,
      primary_category: primaryCategoryRow.categories?.name || categories[0] || '',
      subcategory: primaryCategoryRow.subcategories?.name || '',
      secondary_categories: secondaryCategories,
      brand_color: profile.brand_color || '#092d67',
      year_established: profile.year_established ?? null,
      business_size: profile.business_size ?? null,
      website: business.website || '',
      email: business.email || '',
      phone: business.phone || '',
      whatsapp: profile.whatsapp || '',
      opening_hours: profile.opening_hours || {},
      social_links: profile.social_links || {},
      logo_url: business.logo_url || '',
      cover_image_url: business.cover_image_url || '',
      documents: (documents || []).map((document: any) => ({
        type: document.document_type,
        status: document.status,
      })),
    }

    const action = typeof body.action === 'string' ? body.action : 'generate'

    if (action === 'questions') {
      const questions = await generateQuestions(businessData, informationGaps(businessData))
      return json({ success: true, questions })
    }

    const aiContent = await generatePageContent(businessData, body.answers)
    const normalised = normaliseWebsiteContent(aiContent as Record<string, any>, businessData)

    // Keep owner-supplied assets and brand colour authoritative. The model is
    // never allowed to invent a URL or override the chosen brand colour.
    const merged = {
      ...normalised,
      hero_image_url: null,
      logo_url: businessData.logo_url || null,
      brand_color: businessData.brand_color || (normalised.brand_color as string) || '#092d67',
    }
    const content = await sourcePageImages(merged, businessData, ownerMedia)

    const { data: versions } = await supabase
      .from('page_versions')
      .select('version')
      .eq('business_id', businessId)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = (versions?.[0]?.version || 0) + 1

    // Save as DRAFT (not published).
    const { error: insertError } = await supabase
      .from('page_versions')
      .insert({
        business_id: businessId,
        version: nextVersion,
        content,
        seo_metadata: {
          seo_title: content.seo_title,
          seo_description: content.seo_description,
        },
        status: 'DRAFT',
      })

    if (insertError) throw insertError

    // Only move a business that is actively generating into review. A LIVE
    // business regenerating a draft must keep its published status.
    if (business.status === 'AI_PAGE_GENERATING') {
      const { error: statusError } = await supabase
        .from('businesses')
        .update({ status: 'QUALITY_REVIEW' })
        .eq('id', businessId)
      if (statusError) console.error('Could not move business to review:', statusError.message)
    }

    // Log audit event.
    await supabase
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        action: 'AI_PAGE_GENERATED',
        business_id: businessId,
        details: {
          version: nextVersion,
          ai_model: MODEL,
          provider: USE_GROQ ? 'groq' : 'openai',
          images_sourced: Array.isArray(content.gallery_images) ? content.gallery_images.length : 0,
          answers_used: Array.isArray(body.answers)
            ? body.answers.filter((answer: any) => typeof answer?.answer === 'string' && answer.answer.trim()).length
            : 0,
        },
      })

    return json({
      success: true,
      business_id: businessId,
      version: nextVersion,
      content,
      message: 'AI page content generated and saved as draft. Awaiting quality review.',
    })
  } catch (err) {
    console.error('AI page generation error:', err)
    return json({ error: err instanceof Error ? err.message : 'Failed to generate page content' }, 500)
  }
})
