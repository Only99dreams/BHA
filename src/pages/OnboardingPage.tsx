import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, Building2, Check, FileText, Globe2, MapPin, Phone, Upload, X } from 'lucide-react'
import { Brand } from '../Brand'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

interface Category {
  id: string
  name: string
  slug: string
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
  // Step 6: Media
  logoUrl: string
  coverImageUrl: string
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
  { id: 'media', label: 'Media', icon: Upload },
  { id: 'social', label: 'Social Links', icon: Globe2 },
  { id: 'hours', label: 'Opening Hours', icon: Phone },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SOCIAL_PLATFORMS = ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube', 'TikTok', 'WhatsApp']
const BUSINESS_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+']

export function OnboardingPage({ session, onComplete }: { session: any; onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories] = useState<Subcategory[]>([])
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([])
  const [form, setForm] = useState<OnboardingData>({
    businessName: '',
    registeredName: '',
    registrationNumber: '',
    yearEstablished: '',
    businessSize: '',
    countryCode: '',
    region: '',
    city: '',
    address: '',
    email: '',
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
    socials: [],
    openingHours: Object.fromEntries(DAYS.map((d) => [d, { open: '09:00', close: '17:00', closed: false }])),
  })

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)
    Promise.all([
      client.from('categories').select('id, name, slug').eq('is_active', true).order('sort_order'),
      client.from('business_type_vocabulary').select('id, name, slug').eq('is_active', true).order('sort_order'),
      client.from('countries').select('code, name').eq('is_active', true).order('name'),
    ]).then(([catRes, btRes, ctryRes]) => {
      if (catRes.data) setCategories(catRes.data)
      if (btRes.data) setBusinessTypes(btRes.data)
      if (ctryRes.data) setCountries(ctryRes.data)
    })
  }, [])

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1)
  }
  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleSubmit = async () => {
    if (!supabaseUrl || !supabaseAnonKey) return
    setLoading(true)
    setError(null)
    const client = createClient(supabaseUrl, supabaseAnonKey)

    try {
      // 1. Create or update business
      const slug = form.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const { data: biz, error: bizError } = await client.from('businesses').upsert({
        owner_id: session.user.id,
        slug,
        business_name: form.businessName,
        short_description: form.shortDescription,
        country_code: form.countryCode,
        city: form.city,
        email: form.email,
        phone: form.phone,
        website: form.website,
        status: 'INFORMATION_RECEIVED',
        verification_status: 'UNVERIFIED',
        payment_status: 'UNPAID',
        publication_status: 'DRAFT',
      }, { onConflict: 'owner_id' }).select().single()

      if (bizError) throw bizError

      // 2. Create business profile
      await client.from('business_profiles').upsert({
        business_id: biz.id,
        registered_name: form.registeredName,
        trading_name: form.businessName,
        registration_number: form.registrationNumber,
        region: form.region,
        address: form.address,
        whatsapp: form.whatsapp,
        year_established: form.yearEstablished ? parseInt(form.yearEstablished) : null,
        business_size: form.businessSize,
        description: form.description,
        opening_hours: form.openingHours,
      })

      // 3. Create business categories
      await client.from('business_categories').insert({
        business_id: biz.id,
        category_id: form.primaryCategoryId,
        subcategory_id: form.primarySubcategoryId || null,
        is_primary: true,
      })

      // 4. Add secondary categories
      for (const catId of form.secondaryCategoryIds) {
        if (catId !== form.primaryCategoryId) {
          await client.from('business_categories').insert({
            business_id: biz.id,
            category_id: catId,
            is_primary: false,
          })
        }
      }

      // 5. Add services
      for (const svc of form.services.filter((s) => s.name)) {
        await client.from('business_services').insert({
          business_id: biz.id,
          name: svc.name,
          description: svc.description,
        })
      }

      // 6. Add socials
      for (const soc of form.socials.filter((s) => s.url)) {
        await client.from('business_socials').insert({
          business_id: biz.id,
          platform: soc.platform,
          url: soc.url,
        })
      }

      // 7. Update status to trigger AI generation
      await client.from('businesses').update({ status: 'AI_PAGE_GENERATING' }).eq('id', biz.id)

      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to save business information')
    } finally {
      setLoading(false)
    }
  }

  const selectedCategory = categories.find((c) => c.id === form.primaryCategoryId)
  const availableSubcategories = subcategories.filter((s) => s.category_id === form.primaryCategoryId)

  return (
    <div className="onboarding-page">
      <header className="profile-header"><Brand href="/" /><a className="profile-back" href="/dashboard"><ArrowLeft size={15} /> Back to dashboard</a></header>

      <main className="onboarding-content">
        <div className="onboarding-header">
          <h1>Tell us about your business</h1>
          <p>This information will be used to create your professional business page. You can update it later.</p>
        </div>

        {/* Step Indicator */}
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

        {/* Step Content */}
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
                <label>Country *<select value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}><option value="">Select country</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
                <label>Region/State<input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Greater Accra" /></label>
                <label>City *<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Accra" /></label>
                <label>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" /></label>
              </div>
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
                <label>Secondary Categories<select multiple value={form.secondaryCategoryIds} onChange={(e) => setForm({ ...form, secondaryCategoryIds: Array.from(e.target.selectedOptions, (o) => o.value) })}><option value="">None</option>{categories.filter((c) => c.id !== form.primaryCategoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
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
                {form.services.map((svc, i) => (
                  <div key={i} className="service-row">
                    <input value={svc.name} onChange={(e) => { const s = [...form.services]; s[i].name = e.target.value; setForm({ ...form, services: s }) }} placeholder="Service name" />
                    <input value={svc.description} onChange={(e) => { const s = [...form.services]; s[i].description = e.target.value; setForm({ ...form, services: s }) }} placeholder="Brief description" />
                    <button type="button" onClick={() => setForm({ ...form, services: form.services.filter((_, j) => j !== i) })}><X size={14} /></button>
                  </div>
                ))}
                <button type="button" className="secondary-button" onClick={() => setForm({ ...form, services: [...form.services, { name: '', description: '' }] })}><ArrowRight size={14} /> Add Service</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="form-section">
              <h2>Media</h2>
              <div className="form-grid">
                <label>Logo URL<input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." /></label>
                <label>Cover Image URL<input value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} placeholder="https://..." /></label>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="form-section">
              <h2>Social Links</h2>
              {form.socials.map((soc, i) => (
                <div key={i} className="social-row">
                  <select value={soc.platform} onChange={(e) => { const s = [...form.socials]; s[i].platform = e.target.value; setForm({ ...form, socials: s }) }}>
                    {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input value={soc.url} onChange={(e) => { const s = [...form.socials]; s[i].url = e.target.value; setForm({ ...form, socials: s }) }} placeholder="https://..." />
                  <button type="button" onClick={() => setForm({ ...form, socials: form.socials.filter((_, j) => j !== i) })}><X size={14} /></button>
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

        {/* Navigation */}
        <div className="step-navigation">
          {step > 0 && <button className="secondary-button" onClick={handleBack}><ArrowLeft size={15} /> Back</button>}
          <div className="step-nav-right">
            {step < STEPS.length - 1 ? (
              <button className="primary-button" onClick={handleNext}>Continue <ArrowRight size={15} /></button>
            ) : (
              <button className="primary-button" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving…' : 'Submit for Review'} <ArrowRight size={15} /></button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
