import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Eye, ExternalLink, FileText, Layout, Plus, RefreshCw, Save, Send, Sparkles, Trash2, Type, X } from 'lucide-react'
import { Brand } from '../Brand'
import { BusinessWebsite } from '../components/BusinessWebsite'
import { normaliseHours, normaliseSocials } from '../lib/website'
import { getSupabaseClient } from '../supabase'
import {
  buildDraftContent,
  ensureReviewStatus,
  invokeGeneratePage,
  invokePageQuestions,
  savePageVersion,
  type PageAnswer,
  type PageContent,
  type PageFact,
  type PageFaq,
  type PageFeature,
  type PageImage,
  type PageProcessStep,
  type PageQuestion,
  type PageService,
  type PageVersion,
} from '../lib/pages'

type OwnerBusiness = {
  id: string
  slug: string
  business_name: string
  short_description: string
  city: string
  country_code: string
  status: string
  publication_status: string
  cover_image_url: string | null
  logo_url: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  is_verified?: boolean
  business_profiles?: {
    description?: string
    region?: string
    brand_color?: string
    address?: string
    whatsapp?: string
    opening_hours?: unknown
    social_links?: unknown
    year_established?: number | string | null
  } | {
    description?: string
    region?: string
    brand_color?: string
    address?: string
    whatsapp?: string
    opening_hours?: unknown
    social_links?: unknown
    year_established?: number | string | null
  }[] | null
  business_categories?: {
    is_primary: boolean
    categories?: { name?: string } | null
    subcategories?: { name?: string } | null
  }[]
  business_type_vocabulary?: { name?: string } | null
  business_services?: { name: string; description: string }[]
  business_socials?: { platform: string; url: string }[]
}

function profileRecord(business: OwnerBusiness) {
  const profile = business.business_profiles
  if (Array.isArray(profile)) return profile[0] || null
  return profile || null
}

function profileDescription(business: OwnerBusiness) {
  return profileRecord(business)?.description || ''
}

function normaliseFacts(facts: PageFact[] | undefined) {
  return (facts || []).map((fact) => {
    if (typeof fact === 'string') return { label: 'Fact', value: fact }
    return { label: fact.label || '', value: fact.value || '' }
  })
}

export function LandingPageEditor({ session }: { session: Session }) {
  const [business, setBusiness] = useState<OwnerBusiness | null>(null)
  const [versions, setVersions] = useState<PageVersion[]>([])
  const [activeVersion, setActiveVersion] = useState<PageVersion | null>(null)
  const [content, setContent] = useState<PageContent>({})
  const [services, setServices] = useState<PageService[]>([])
  const [facts, setFacts] = useState<{ label: string; value: string }[]>([])
  const [features, setFeatures] = useState<PageFeature[]>([])
  const [processSteps, setProcessSteps] = useState<PageProcessStep[]>([])
  const [faqs, setFaqs] = useState<PageFaq[]>([])
  const [gallery, setGallery] = useState<PageImage[]>([])
  const [sections, setSections] = useState<Array<{ id: string; type: string; content: any }>>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [builderMode, setBuilderMode] = useState(false)
  const [questions, setQuestions] = useState<PageQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showQuestions, setShowQuestions] = useState(false)
  const [checkingQuestions, setCheckingQuestions] = useState(false)

  const selectVersion = useCallback((version: PageVersion | null) => {
    setActiveVersion(version)
    setContent(version?.content || {})
    setServices((version?.content?.suggested_services || []).map((service) => ({ name: service.name || '', description: service.description || '' })))
    setFacts(normaliseFacts(version?.content?.key_facts))
    setFeatures((version?.content?.features || []).map((feature) => ({ title: feature.title || '', description: feature.description || '' })))
    setProcessSteps((version?.content?.process_steps || []).map((step) => ({ title: step.title || '', description: step.description || '' })))
    setFaqs((version?.content?.faq || []).map((item) => ({ question: item.question || '', answer: item.answer || '' })))
    setGallery((version?.content?.gallery_images || []).filter((image) => Boolean(image?.url)).map((image) => ({ url: image.url, alt: image.alt || '', caption: image.caption || '' })))
    setSections(((version?.content?.sections as any) || []).filter((section: any) => !['about', 'services', 'cta'].includes(section?.id)))
  }, [])

  const loadVersions = useCallback(async (businessId: string, selectId?: string) => {
    const client = getSupabaseClient()
    const { data } = await client
      .from('page_versions')
      .select('*')
      .eq('business_id', businessId)
      .order('version', { ascending: false })
    const list = (data || []) as PageVersion[]
    setVersions(list)
    const target = list.find((version) => version.id === selectId) || list.find((version) => version.status === 'DRAFT' || version.status === 'IN_REVIEW') || list[0] || null
    selectVersion(target)
    return list
  }, [selectVersion])

  useEffect(() => {
    let isCurrent = true
    const load = async () => {
      const client = getSupabaseClient()
      const { data, error: businessError } = await client
        .from('businesses')
        .select('id, slug, business_name, short_description, city, country_code, status, publication_status, cover_image_url, logo_url, email, phone, website, is_verified, business_profiles(description, region, brand_color, address, whatsapp, opening_hours, social_links, year_established), business_categories(is_primary, categories(name), subcategories(name)), business_type_vocabulary(name), business_services(name, description), business_socials(platform, url)')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!isCurrent) return
      if (businessError) {
        setError(businessError.message)
        setLoading(false)
        return
      }
      const owned = data as OwnerBusiness | null
      setBusiness(owned)
      if (owned) {
        const list = await loadVersions(owned.id)
        if (list.length === 0) {
          const primary = owned.business_categories?.find((item) => item.is_primary) || owned.business_categories?.[0]
          const category = primary?.categories?.name
          const draft = buildDraftContent({
            businessName: owned.business_name,
            shortDescription: owned.short_description,
            description: profileDescription(owned),
            services: owned.business_services || [],
            city: owned.city,
            region: profileRecord(owned)?.region,
            country: owned.country_code,
            categoryName: category,
            subcategoryName: primary?.subcategories?.name,
            secondaryCategoryNames: (owned.business_categories || [])
              .filter((item) => !item.is_primary)
              .map((item) => item.categories?.name || '')
              .filter(Boolean),
            businessTypeName: owned.business_type_vocabulary?.name,
            brandColor: profileRecord(owned)?.brand_color,
            coverImageUrl: owned.cover_image_url,
            logoUrl: owned.logo_url,
          })
          setContent(draft)
          setServices(draft.suggested_services || [])
          setFacts(normaliseFacts(draft.key_facts))
        }
      }
      if (isCurrent) setLoading(false)
    }
    void load()
    return () => { isCurrent = false }
  }, [loadVersions, session.user.id])

  const updateContent = (key: keyof PageContent, value: string) => {
    setContent((current) => ({ ...current, [key]: value }))
  }

  const addSection = (type: string) => {
    const newSection = {
      id: `section-${Date.now()}`,
      type,
      content: type === 'text' ? { title: '', body: '' } : type === 'cta' ? { title: '', buttonText: 'Get in touch', buttonLink: '' } : {},
    }
    setSections([...sections, newSection])
  }

  const updateSection = (id: string, content: any) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, content: { ...s.content, ...content } } : s)))
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    const newSections = [...sections]
    const target = index + direction
    if (target < 0 || target >= newSections.length) return
    ;[newSections[index], newSections[target]] = [newSections[target], newSections[index]]
    setSections(newSections)
  }

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index))
  }

  const payload = (): PageContent => ({
    ...content,
    hero_highlights: (content.hero_highlights || [])
      .map((highlight) => (typeof highlight === 'string' ? highlight.trim() : ''))
      .filter(Boolean)
      .slice(0, 4),
    suggested_services: services.filter((service) => service.name.trim()).map((service) => ({
      name: service.name.trim(),
      description: service.description.trim(),
    })),
    features: features.filter((feature) => feature.title.trim()).map((feature) => ({
      title: feature.title.trim(),
      description: feature.description.trim(),
    })),
    process_steps: processSteps.filter((step) => step.title.trim()).map((step) => ({
      title: step.title.trim(),
      description: step.description.trim(),
    })),
    faq: faqs.filter((item) => item.question.trim() && item.answer.trim()).map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    })),
    gallery_images: gallery.filter((image) => image.url.trim()).map((image) => ({
      url: image.url.trim(),
      alt: image.alt?.trim() || '',
      caption: image.caption?.trim() || '',
    })),
    key_facts: facts.filter((fact) => fact.label.trim() || fact.value.trim()).map((fact) => ({
      label: fact.label.trim(),
      value: fact.value.trim(),
    })),
    sections,
  })

  const persist = async (status: 'DRAFT' | 'IN_REVIEW') => {
    if (!business) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const client = getSupabaseClient()
      const editable = activeVersion && (activeVersion.status === 'DRAFT' || activeVersion.status === 'IN_REVIEW') ? activeVersion : null
      const saved = await savePageVersion(client, {
        businessId: business.id,
        content: payload(),
        status,
        versionId: editable?.id || null,
      })
      if (saved.error) throw saved.error

      if (content.brand_color) {
        const { error: brandError } = await client
          .from('business_profiles')
          .update({ brand_color: content.brand_color })
          .eq('business_id', business.id)
        if (brandError) console.warn('Could not update the brand colour on the business profile:', brandError.message)
      }

      if (status === 'IN_REVIEW') {
        await ensureReviewStatus(client, business.id)
        const { data: refreshed } = await client.from('businesses').select('status').eq('id', business.id).maybeSingle()
        setBusiness((current) => current ? { ...current, status: refreshed?.status || current.status } : current)
      }

      await loadVersions(business.id, saved.data?.id)
      setMessage(status === 'IN_REVIEW' ? 'Page submitted for review.' : 'Draft saved. You can preview it before sending it for review.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the landing page.')
    } finally {
      setBusy(false)
    }
  }

  const generatePage = async (generationAnswers: PageAnswer[] = []) => {
    if (!business) return
    setBusy(true)
    setError('')
    setMessage('')
    const client = getSupabaseClient()
    try {
      const { data: beforeRows } = await client
        .from('page_versions')
        .select('id')
        .eq('business_id', business.id)
      const beforeCount = beforeRows?.length || 0

      const { data: current } = await client.from('businesses').select('status').eq('id', business.id).maybeSingle()
      if (current?.status === 'INFORMATION_PENDING') {
        await client.from('businesses').update({ status: 'INFORMATION_RECEIVED' }).eq('id', business.id)
      }
      if (current?.status === 'INFORMATION_PENDING' || current?.status === 'INFORMATION_RECEIVED') {
        await client.from('businesses').update({ status: 'AI_PAGE_GENERATING' }).eq('id', business.id)
        setBusiness((value) => value ? { ...value, status: 'AI_PAGE_GENERATING' } : value)
      }

      setMessage('AI is writing your page and sourcing relevant images. This may take a moment.')
      await invokeGeneratePage(client, business.id, generationAnswers)

      // Poll until a new version appears. Comparing the count avoids stopping
      // on the draft that existed before this regeneration started.
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 4000))
        const { data: refreshed } = await client.from('businesses').select('status').eq('id', business.id).maybeSingle()
        setBusiness((value) => value ? { ...value, status: refreshed?.status || value.status } : value)
        const list = await loadVersions(business.id)
        if (list.length > beforeCount) {
          setShowQuestions(false)
          setQuestions([])
          setAnswers({})
          setMessage('AI-generated draft ready! Your preview has been updated with new copy and images.')
          return
        }
        if (i === 29) {
          setError('AI generation is taking longer than expected. The function may not be deployed or API keys may not be configured.')
        }
      }
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'AI generation failed. Check that the AI function is deployed and API keys are configured.')
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async () => {
    if (!business || busy || checkingQuestions) return
    setCheckingQuestions(true)
    setError('')
    setMessage('')
    try {
      const client = getSupabaseClient()
      const asked = await invokePageQuestions(client, business.id)
      if (asked.length > 0) {
        setQuestions(asked)
        setAnswers(Object.fromEntries(asked.map((question) => [question.id, ''])))
        setShowQuestions(true)
        return
      }
    } catch (questionError) {
      // Questions are optional; generate with what we already know.
      console.warn('Could not load AI questions, generating directly:', questionError)
    } finally {
      setCheckingQuestions(false)
    }
    await generatePage()
  }

  const submitAnswers = () => {
    const answerList = questions
      .map((question) => ({ question: question.question, answer: (answers[question.id] || '').trim() }))
      .filter((answer) => answer.answer)
    void generatePage(answerList)
  }

  if (loading) return <main className="profile-state" role="status">Loading your landing page…</main>

  if (!business) {
    return <main className="profile-state">
      <h1>No business yet</h1>
      <p>Complete onboarding first, then you can generate and edit your landing page.</p>
      <a href="/onboarding">Start business onboarding <ArrowRight size={15} /></a>
    </main>
  }

  const previewUrl = activeVersion ? `/business/${business.slug}?preview=${activeVersion.version}` : ''
  const heroImage = (content.hero_image_url || business.cover_image_url || '') as string
  const aboutImage = (content.about_image_url || '') as string
  const galleryImages = gallery.length > 0
    ? gallery
    : Array.isArray(content.gallery_images)
      ? content.gallery_images.filter((image) => Boolean(image?.url))
      : []
  const profile = profileRecord(business)
  const primaryCategory = business.business_categories?.find((item) => item.is_primary) || business.business_categories?.[0]
  const brandCandidate = String(content.brand_color || profile?.brand_color || '')
  const previewBrandColor = /^#[0-9a-f]{6}$/i.test(brandCandidate) ? brandCandidate : '#092d67'
  const heroHighlights = Array.isArray(content.hero_highlights)
    ? content.hero_highlights.filter((highlight): highlight is string => typeof highlight === 'string' && Boolean(highlight.trim()))
    : []
  const previewContact = {
    email: business.email || '',
    phone: business.phone || '',
    whatsapp: profile?.whatsapp || '',
    website: business.website || '',
    address: profile?.address || '',
    hours: normaliseHours(profile?.opening_hours),
    socials: normaliseSocials(business.business_socials?.length ? business.business_socials : profile?.social_links),
  }

  return (
    <div className="onboarding-page page-editor-page">
      <header className="profile-header">
        <Brand href="/" />
        <a className="profile-back" href="/dashboard"><ArrowLeft size={15} /> Back to dashboard</a>
      </header>

      <main className="onboarding-content page-editor-content">
        <div className="onboarding-header">
          <h1>Landing page</h1>
          <p>Generate a unique page with AI, or use the visual builder to customize every element like a website builder.</p>
        </div>

        {error && <div className="onboarding-error">{error}</div>}
        {message && <div className="onboarding-success">{message}</div>}

        <div className="big-preview-section">
          <div className="big-preview-header">
            <span className="big-preview-title"><Eye size={18} /> Live Website Preview</span>
            <div className="big-preview-actions">
              <button
                type="button"
                className="preview-action"
                onClick={() => void regenerate()}
                disabled={busy || checkingQuestions}
              >
                <RefreshCw size={14} />
                {checkingQuestions ? 'Checking details…' : busy ? 'Generating…' : 'Regenerate'}
              </button>
              <a
                className="preview-action"
                href={previewUrl || `/business/${business.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} /> Preview in new window
              </a>
            </div>
          </div>
          <div className="big-preview-frame">
            <BusinessWebsite
              embedded
              idPrefix="editor-preview"
              business={{
                name: business.business_name,
                headline: content.page_headline || business.business_name,
                tagline: content.hero_tagline || content.page_intro || business.short_description,
                intro: content.page_intro || business.short_description,
                about: content.about_section || profileDescription(business) || business.short_description,
                aboutTitle: content.about_title || '',
                logoUrl: (content.logo_url || business.logo_url || '') as string,
                heroImage,
                aboutImage,
                gallery: galleryImages,
                brandColor: previewBrandColor,
                category: primaryCategory?.categories?.name || '',
                subcategory: primaryCategory?.subcategories?.name || '',
                businessType: business.business_type_vocabulary?.name || '',
                city: business.city,
                country: business.country_code,
                verified: business.is_verified,
                ctaText: content.cta_text || '',
                heroEyebrow: content.hero_eyebrow || '',
                heroHighlights,
                facts,
                services,
                features,
                processSteps,
                faq: faqs,
                customSections: sections,
                contactHeading: content.contact_heading || '',
                contactNote: content.contact_note || '',
                footerNote: content.footer_note || '',
              }}
              contact={previewContact}
            />
          </div>
        </div>

        <div className="page-builder-toggle">
          <button type="button" className={builderMode ? '' : 'active'} onClick={() => setBuilderMode(false)}><Type size={15} /> Content Editor</button>
          <button type="button" className={builderMode ? 'active' : ''} onClick={() => setBuilderMode(true)}><Layout size={15} /> Visual Builder</button>
        </div>

        <div className="page-editor-layout with-preview">
          <div className="page-editor-main">
            {!builderMode ? (
              <>
                <div className="form-section">
                  <h2>Search appearance</h2>
                  <div className="form-grid">
                    <label className="full-width">SEO title<input value={content.seo_title || ''} onChange={(event) => updateContent('seo_title', event.target.value)} maxLength={60} placeholder="A clear, search-friendly title" /></label>
                    <label className="full-width">SEO description<textarea value={content.seo_description || ''} onChange={(event) => updateContent('seo_description', event.target.value)} rows={2} maxLength={160} placeholder="One sentence that summarises the business" /></label>
                  </div>
                </div>

                <div className="form-section">
                  <h2>Page hero</h2>
                  <div className="form-grid">
                    <label className="full-width">Headline<input value={content.page_headline || ''} onChange={(event) => updateContent('page_headline', event.target.value)} maxLength={80} placeholder={business.business_name} /></label>
                    <label className="full-width">Tagline<input value={content.hero_tagline || ''} onChange={(event) => updateContent('hero_tagline', event.target.value)} placeholder="Short unique tagline" /></label>
                    <label className="full-width">Introduction<textarea value={content.page_intro || ''} onChange={(event) => updateContent('page_intro', event.target.value)} rows={3} placeholder="Two or three sentences that introduce the business" /></label>
                    <label className="full-width">Call to action<input value={content.cta_text || ''} onChange={(event) => updateContent('cta_text', event.target.value)} placeholder="e.g. Get in touch" /></label>
                    <label className="full-width">Eyebrow<input value={content.hero_eyebrow || ''} onChange={(event) => updateContent('hero_eyebrow', event.target.value)} maxLength={70} placeholder="e.g. Specialty coffee · Accra" /></label>
                    <label className="full-width">Proof points, one per line<textarea value={(content.hero_highlights || []).join('\n')} onChange={(event) => setContent((current) => ({ ...current, hero_highlights: event.target.value.split('\n') }))} rows={3} placeholder={'Locally owned\nSame-day delivery\nTrusted since 2015'} /></label>
                    <label className="full-width brand-color-field">
                      <span>Brand colour</span>
                      <div className="brand-color-controls">
                        <input type="color" value={content.brand_color || '#092d67'} onChange={(event) => updateContent('brand_color', event.target.value)} aria-label="Pick brand colour" />
                        <input value={content.brand_color || '#092d67'} onChange={(event) => updateContent('brand_color', event.target.value)} maxLength={7} placeholder="#092D67" />
                      </div>
                      <small>Used for the accent colour on your public page and shared with AI when regenerating.</small>
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <h2>Page images</h2>
                  <p className="page-editor-hint">Photos are sourced automatically when you regenerate. Paste your own URLs to override the hero or about photo.</p>
                  <div className="gallery-row">
                    {content.hero_image_url || business.cover_image_url
                      ? <img src={content.hero_image_url || business.cover_image_url || ''} alt="" />
                      : <span className="gallery-placeholder" />}
                    <div className="gallery-row-fields">
                      <input value={content.hero_image_url || ''} onChange={(event) => updateContent('hero_image_url', event.target.value)} placeholder="Hero image URL (defaults to your cover image)" />
                      <small className="page-editor-hint">Wide image shown beside the headline.</small>
                    </div>
                  </div>
                  <div className="gallery-row">
                    {content.about_image_url
                      ? <img src={content.about_image_url} alt="" />
                      : <span className="gallery-placeholder" />}
                    <div className="gallery-row-fields">
                      <input value={content.about_image_url || ''} onChange={(event) => updateContent('about_image_url', event.target.value)} placeholder="About image URL" />
                      <small className="page-editor-hint">Shown next to the about section.</small>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h2>About section</h2>
                  <div className="form-grid">
                    <label className="full-width">Section title<input value={content.about_title || ''} onChange={(event) => updateContent('about_title', event.target.value)} maxLength={80} placeholder="e.g. A neighbourhood kitchen with a difference" /></label>
                    <label className="full-width">
                      <textarea value={content.about_section || ''} onChange={(event) => updateContent('about_section', event.target.value)} rows={7} placeholder="Tell the story behind the business" />
                    </label>
                  </div>
                </div>

                <div className="form-section">
                  <div className="page-editor-section-heading">
                    <h2>Products & services</h2>
                    <button type="button" className="secondary-button" onClick={() => setServices([...services, { name: '', description: '' }])}><Plus size={14} /> Add service</button>
                  </div>
                  {services.length === 0 && <p className="page-editor-hint">No services on the page yet.</p>}
                  {services.map((service, index) => (
                    <div key={index} className="service-row">
                      <input value={service.name} onChange={(event) => { const next = [...services]; next[index] = { ...next[index], name: event.target.value }; setServices(next) }} placeholder="Service name" />
                      <input value={service.description} onChange={(event) => { const next = [...services]; next[index] = { ...next[index], description: event.target.value }; setServices(next) }} placeholder="Short description" />
                      <button type="button" onClick={() => setServices(services.filter((_, i) => i !== index))} aria-label="Remove service"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>

                <div className="form-section">
                  <div className="page-editor-section-heading">
                    <h2>Why choose us</h2>
                    <button type="button" className="secondary-button" onClick={() => setFeatures([...features, { title: '', description: '' }])}><Plus size={14} /> Add point</button>
                  </div>
                  {features.length === 0 && <p className="page-editor-hint">Short proof points such as expertise, service standards or guarantees.</p>}
                  {features.map((feature, index) => (
                    <div key={index} className="editor-item">
                      <div className="editor-item-head">
                        <b>Point {index + 1}</b>
                        <button type="button" onClick={() => setFeatures(features.filter((_, i) => i !== index))} aria-label="Remove point"><Trash2 size={14} /></button>
                      </div>
                      <input value={feature.title} onChange={(event) => { const next = [...features]; next[index] = { ...next[index], title: event.target.value }; setFeatures(next) }} placeholder="Title (e.g. Same-day delivery)" maxLength={60} />
                      <textarea value={feature.description} onChange={(event) => { const next = [...features]; next[index] = { ...next[index], description: event.target.value }; setFeatures(next) }} rows={2} maxLength={220} placeholder="One sentence of detail" />
                    </div>
                  ))}
                </div>

                <div className="form-section">
                  <div className="page-editor-section-heading">
                    <h2>How it works</h2>
                    <button type="button" className="secondary-button" onClick={() => setProcessSteps([...processSteps, { title: '', description: '' }])}><Plus size={14} /> Add step</button>
                  </div>
                  {processSteps.length === 0 && <p className="page-editor-hint">Three or four steps customers go through, from first enquiry to delivery.</p>}
                  {processSteps.map((step, index) => (
                    <div key={index} className="editor-item">
                      <div className="editor-item-head">
                        <b>Step {index + 1}</b>
                        <button type="button" onClick={() => setProcessSteps(processSteps.filter((_, i) => i !== index))} aria-label="Remove step"><Trash2 size={14} /></button>
                      </div>
                      <input value={step.title} onChange={(event) => { const next = [...processSteps]; next[index] = { ...next[index], title: event.target.value }; setProcessSteps(next) }} placeholder="Step title (e.g. Book a consultation)" maxLength={60} />
                      <textarea value={step.description} onChange={(event) => { const next = [...processSteps]; next[index] = { ...next[index], description: event.target.value }; setProcessSteps(next) }} rows={2} maxLength={220} placeholder="What happens in this step" />
                    </div>
                  ))}
                </div>

                <div className="form-section">
                  <div className="page-editor-section-heading">
                    <h2>Frequently asked questions</h2>
                    <button type="button" className="secondary-button" onClick={() => setFaqs([...faqs, { question: '', answer: '' }])}><Plus size={14} /> Add question</button>
                  </div>
                  {faqs.length === 0 && <p className="page-editor-hint">Answer the questions customers ask before booking or buying.</p>}
                  {faqs.map((item, index) => (
                    <div key={index} className="editor-item">
                      <div className="editor-item-head">
                        <b>Question {index + 1}</b>
                        <button type="button" onClick={() => setFaqs(faqs.filter((_, i) => i !== index))} aria-label="Remove question"><Trash2 size={14} /></button>
                      </div>
                      <input value={item.question} onChange={(event) => { const next = [...faqs]; next[index] = { ...next[index], question: event.target.value }; setFaqs(next) }} placeholder="e.g. Do you deliver outside the city?" maxLength={140} />
                      <textarea value={item.answer} onChange={(event) => { const next = [...faqs]; next[index] = { ...next[index], answer: event.target.value }; setFaqs(next) }} rows={3} maxLength={500} placeholder="A clear, honest answer" />
                    </div>
                  ))}
                </div>

                <div className="form-section">
                  <div className="page-editor-section-heading">
                    <h2>Gallery</h2>
                    <button type="button" className="secondary-button" onClick={() => setGallery([...gallery, { url: '', alt: '', caption: '' }])}><Plus size={14} /> Add image</button>
                  </div>
                  <p className="page-editor-hint">Images are sourced automatically on regeneration. Swap in your own photo URLs here any time.</p>
                  {gallery.map((image, index) => (
                    <div key={index} className="gallery-row">
                      {image.url ? <img src={image.url} alt="" /> : <span className="gallery-placeholder" />}
                      <div className="gallery-row-fields">
                        <input value={image.url} onChange={(event) => { const next = [...gallery]; next[index] = { ...next[index], url: event.target.value }; setGallery(next) }} placeholder="https://images..." />
                        <input value={image.alt || ''} onChange={(event) => { const next = [...gallery]; next[index] = { ...next[index], alt: event.target.value }; setGallery(next) }} placeholder="Describe the photo" maxLength={120} />
                      </div>
                      <button type="button" onClick={() => setGallery(gallery.filter((_, i) => i !== index))} aria-label="Remove image"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>

                <div className="form-section">
                  <h2>Contact & footer copy</h2>
                  <div className="form-grid">
                    <label className="full-width">Contact heading<input value={content.contact_heading || ''} onChange={(event) => updateContent('contact_heading', event.target.value)} maxLength={80} placeholder="Talk to us" /></label>
                    <label className="full-width">Contact note<textarea value={content.contact_note || ''} onChange={(event) => updateContent('contact_note', event.target.value)} rows={3} maxLength={260} placeholder="Invite customers to reach out and say what happens next." /></label>
                    <label className="full-width">Footer note<input value={content.footer_note || ''} onChange={(event) => updateContent('footer_note', event.target.value)} maxLength={160} placeholder="One line about the business" /></label>
                  </div>
                  <p className="page-editor-hint">Phone, email, address, opening hours and social links come from your business profile.</p>
                </div>

                <div className="form-section">
                  <div className="page-editor-section-heading">
                    <h2>Key facts</h2>
                    <button type="button" className="secondary-button" onClick={() => setFacts([...facts, { label: '', value: '' }])}><Plus size={14} /> Add fact</button>
                  </div>
                  {facts.length === 0 && <p className="page-editor-hint">Add facts such as location, sector or year established.</p>}
                  {facts.map((fact, index) => (
                    <div key={index} className="fact-row">
                      <input value={fact.label} onChange={(event) => { const next = [...facts]; next[index] = { ...next[index], label: event.target.value }; setFacts(next) }} placeholder="Label (e.g. Location)" />
                      <input value={fact.value} onChange={(event) => { const next = [...facts]; next[index] = { ...next[index], value: event.target.value }; setFacts(next) }} placeholder="Value (e.g. Accra)" />
                      <button type="button" onClick={() => setFacts(facts.filter((_, i) => i !== index))} aria-label="Remove fact"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="form-section builder-section">
                <div className="page-editor-section-heading">
                  <h2>Visual Page Builder</h2>
                  <div className="builder-actions">
                    <button type="button" className="secondary-button" onClick={() => addSection('text')}><Plus size={14} /> Text Block</button>
                    <button type="button" className="secondary-button" onClick={() => addSection('cta')}><Plus size={14} /> Call to Action</button>
                    <button type="button" className="secondary-button" onClick={() => addSection('image')}><Plus size={14} /> Image Block</button>
                  </div>
                </div>
                <p className="page-editor-hint">Drag and arrange sections to build your unique website layout. Each block is fully customizable.</p>
                {sections.length === 0 && <div className="builder-empty"><Layout size={24} /><p>Add blocks to start building your custom page</p></div>}
                {sections.map((section, index) => (
                  <div key={section.id} className="builder-block">
                    <div className="builder-block-header">
                      <span>{section.type === 'text' ? 'Text Block' : section.type === 'cta' ? 'Call to Action' : 'Image Block'}</span>
                      <div className="builder-block-controls">
                        <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
                        <button type="button" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1}><ArrowDown size={14} /></button>
                        <button type="button" onClick={() => removeSection(index)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {section.type === 'text' && (
                      <div className="builder-block-content">
                        <input value={section.content.title || ''} onChange={(e) => updateSection(section.id, { title: e.target.value })} placeholder="Section title" />
                        <textarea value={section.content.body || ''} onChange={(e) => updateSection(section.id, { body: e.target.value })} rows={4} placeholder="Section content" />
                      </div>
                    )}
                    {section.type === 'cta' && (
                      <div className="builder-block-content">
                        <input value={section.content.title || ''} onChange={(e) => updateSection(section.id, { title: e.target.value })} placeholder="CTA heading" />
                        <input value={section.content.buttonText || ''} onChange={(e) => updateSection(section.id, { buttonText: e.target.value })} placeholder="Button text" />
                        <input value={section.content.buttonLink || ''} onChange={(e) => updateSection(section.id, { buttonLink: e.target.value })} placeholder="Button link (mailto:, tel:, or URL)" />
                      </div>
                    )}
                    {section.type === 'image' && (
                      <div className="builder-block-content">
                        <input value={section.content.imageUrl || ''} onChange={(e) => updateSection(section.id, { imageUrl: e.target.value })} placeholder="Image URL" />
                        <input value={section.content.caption || ''} onChange={(e) => updateSection(section.id, { caption: e.target.value })} placeholder="Image caption" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="page-editor-side">
            <div className="page-editor-actions">
              <button type="button" className="primary-button" onClick={() => void persist('IN_REVIEW')} disabled={busy}>
                <Send size={15} /> {busy ? 'Working…' : 'Submit for review'}
              </button>
              <button type="button" className="secondary-button" onClick={() => void persist('DRAFT')} disabled={busy}>
                <Save size={15} /> Save draft
              </button>
              <button type="button" className="secondary-button" onClick={() => void regenerate()} disabled={busy || checkingQuestions}>
                <RefreshCw size={15} /> {checkingQuestions ? 'Checking details…' : 'Regenerate with AI'}
              </button>
              {previewUrl && <a className="outline-button" href={previewUrl} target="_blank" rel="noreferrer">Preview current draft <ArrowRight size={14} /></a>}
            </div>

            <div className="page-editor-meta">
              <span className={`status-badge status-${business.status === 'LIVE' ? 'verified' : business.status === 'QUALITY_REVIEW' ? 'review' : 'information'}`}><i />{business.status.replaceAll('_', ' ')}</span>
              <small>Public address: /business/{business.slug}</small>
            </div>

            <div className="page-editor-versions">
              <h3>Versions</h3>
              {versions.length === 0 && <p className="page-editor-hint">No saved versions yet. Save a draft to create version 1.</p>}
              {versions.map((version) => (
                <div key={version.id} className={`page-version-item-row ${activeVersion?.id === version.id ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="page-version-item"
                    onClick={() => selectVersion(version)}
                  >
                    <span><FileText size={14} /> Version {version.version}</span>
                    <span className={`status-pill status-${version.status.toLowerCase()}`}>{version.status.replaceAll('_', ' ')}</span>
                  </button>
                  {(version.status === 'DRAFT' || version.status === 'REJECTED') && (
                    <button
                      type="button"
                      className="version-delete"
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!confirm('Delete this version?')) return
                        const client = getSupabaseClient()
                        const { error: delError } = await client.from('page_versions').delete().eq('id', version.id)
                        if (delError) {
                          setError(delError.message)
                          return
                        }
                        if (business) {
                          await loadVersions(business.id)
                        }
                      }}
                      aria-label="Delete version"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="page-editor-note">
              <Check size={15} />
              <span>Published pages stay live while you edit a new draft. BHA reviews the new version before it replaces the public page.</span>
            </div>

            <div className="preview-card">
              <div className="preview-card-header"><Eye size={15} /> Page Preview</div>
              <div className="preview-card-body" style={{ borderTop: `3px solid ${content.brand_color || '#092d67'}` }}>
                <div className="preview-card-hero">
                  {(content.logo_url || business?.logo_url) && <img src={(content.logo_url || business?.logo_url) as string} alt="" />}
                  <h4>{content.page_headline || business?.business_name}</h4>
                  <p>{content.hero_tagline || content.page_intro}</p>
                </div>
                <div className="preview-card-section">
                  <strong>About</strong>
                  <p>{content.about_section}</p>
                </div>
                {services.length > 0 && (
                  <div className="preview-card-section">
                    <strong>Services</strong>
                    <ul>
                      {services.slice(0, 2).map((s, i) => <li key={i}>{s.name}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {showQuestions && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ai-questions-title">
          <div className="application-modal ai-questions-modal">
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowQuestions(false)}
              disabled={busy}
              aria-label="Close questions"
            >
              <X size={16} />
            </button>
            <span className="modal-step">AI PAGE BUILDER</span>
            <h2 id="ai-questions-title">A few details = a stronger website.</h2>
            <p className="modal-description">
              The AI wants to make this page more specific to your business. Answer what you can, or skip and generate with the details you already provided.
            </p>
            <div className="ai-question-list">
              {questions.map((question, index) => (
                <label key={question.id} className="ai-question">
                  <span><b>{index + 1}.</b> {question.question}</span>
                  {question.hint && <small>{question.hint}</small>}
                  <textarea
                    value={answers[question.id] || ''}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                    rows={3}
                    maxLength={600}
                    placeholder="Your answer (optional)"
                  />
                </label>
              ))}
            </div>
            <div className="ai-question-actions">
              <button type="button" className="secondary-button" onClick={() => void generatePage()} disabled={busy}>
                Skip & generate
              </button>
              <button type="button" className="primary-button" onClick={submitAnswers} disabled={busy}>
                <Sparkles size={15} /> {busy ? 'Generating…' : 'Generate page'}
              </button>
            </div>
            <p className="modal-note">Only your business data and answers are used. Photos come from your uploads and trusted stock libraries.</p>
          </div>
        </div>
      )}
    </div>
  )
}
