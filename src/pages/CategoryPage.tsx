import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, BadgeCheck, ChevronDown, MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { Brand } from '../Brand'
import { generateCategoryStructuredData } from '../lib/seo'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

interface Category {
  id: string
  name: string
  slug: string
  description: string
  seo_title: string | null
  seo_description: string | null
}

interface Subcategory {
  id: string
  category_id: string
  name: string
  slug: string
  sort_order: number
}

interface CategoryAttribute {
  id: string
  key: string
  label: string
  data_type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_ENUM' | 'RANGE'
  allowed_values: string[] | null
  is_searchable: boolean
  sort_order: number
}

interface BusinessResult {
  id: string
  slug: string
  business_name: string
  short_description: string
  city: string
  country: string
  cover_image_url: string | null
  is_verified: boolean
  is_booking_enabled: boolean
  primary_category_id: string
}

export function CategoryPage({ categorySlug }: { categorySlug: string }) {
  const [category, setCategory] = useState<Category | null>(null)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([])
  const [businesses, setBusinesses] = useState<BusinessResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [countries, setCountries] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 12

  // Fetch category data
  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) { setLoading(false); return }
    let isCurrent = true

    const loadCategory = async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey)

      const [catResult, , , countryResult] = await Promise.all([
        client.from('categories').select('*').eq('slug', categorySlug).eq('is_active', true).single(),
        client.from('subcategories').select('*').eq('category_id', '').order('sort_order'), // placeholder, will update after category loads
        client.from('category_attributes').select('*').eq('category_id', '').eq('is_active', true).order('sort_order'),
        client.from('countries').select('name').eq('is_active', true).order('name'),
      ])

      if (isCurrent && catResult.data) {
        setCategory(catResult.data)
        // Now load subcategories and attributes with the real category_id
        const [subRes, attrRes] = await Promise.all([
          client.from('subcategories').select('*').eq('category_id', catResult.data.id).eq('is_active', true).order('sort_order'),
          client.from('category_attributes').select('*').eq('category_id', catResult.data.id).eq('is_active', true).order('sort_order'),
        ])
        if (isCurrent) {
          setSubcategories(subRes.data || [])
          setAttributes(attrRes.data || [])
        }
      }

      if (isCurrent) {
        setCountries(countryResult.data?.map((c: any) => c.name) || [])
        setLoading(false)
      }
    }

    void loadCategory()
    return () => { isCurrent = false }
  }, [categorySlug])

  // Fetch businesses with filters
  const fetchBusinesses = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey || !category) return
    setLoading(true)
    const client = createClient(supabaseUrl, supabaseAnonKey)

    let query = client
      .from('businesses')
      .select('id, slug, business_name, short_description, city, country:countries(name), cover_image_url, is_verified, is_booking_enabled, primary_category_id, business_categories!inner(category_id)', { count: 'exact' })
      .eq('business_categories.category_id', category.id)
      .eq('status', 'LIVE')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

    if (selectedSubcategory) {
      query = query.eq('business_categories.subcategory_id', selectedSubcategory)
    }
    if (countryFilter) {
      query = query.eq('country.name', countryFilter)
    }
    if (searchQuery.trim()) {
      query = query.ilike('search_text', `%${searchQuery.trim()}%`)
    }

    // Apply attribute filters
    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) {
        const attr = attributes.find((a) => a.key === key)
        if (attr) {
          query = query.eq('business_attribute_values.attribute_id', attr.id)
          // Note: exact value matching would need a more complex query
          // This is a simplified version
        }
      }
    }

    const { data, error, count } = await query

    if (!error && data) {
      // Deduplicate by business_id (a business might appear multiple times if associated with multiple subcategories)
      const unique = new Map<string, BusinessResult>()
      for (const item of data as any[]) {
        if (!unique.has(item.id)) {
          unique.set(item.id, {
            id: item.id,
            slug: item.slug,
            business_name: item.business_name,
            short_description: item.short_description,
            city: item.city,
            country: item.country?.name || '',
            cover_image_url: item.cover_image_url,
            is_verified: item.is_verified,
            is_booking_enabled: item.is_booking_enabled,
            primary_category_id: item.primary_category_id,
          })
        }
      }
      setBusinesses(Array.from(unique.values()))
      setTotalCount(count || 0)
    }
    setLoading(false)
  }, [category, selectedSubcategory, countryFilter, searchQuery, activeFilters, attributes, currentPage])

  useEffect(() => { fetchBusinesses() }, [fetchBusinesses])

  const totalPages = Math.ceil(totalCount / pageSize)

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length + (selectedSubcategory ? 1 : 0) + (countryFilter ? 1 : 0)

  const clearAllFilters = () => {
    setSelectedSubcategory('')
    setCountryFilter('')
    setSearchQuery('')
    setActiveFilters({})
    setCurrentPage(1)
  }

  // Inject structured data
  useEffect(() => {
    if (!category) return
    const schema = generateCategoryStructuredData({
      name: category.name,
      description: category.description || `Discover verified ${category.name} businesses across Africa.`,
      url: `${window.location.origin}/category/${category.slug}`,
      businessCount: totalCount,
    })
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = schema
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [category, totalCount])

  if (loading && !category) {
    return <main className="profile-state" role="status">Loading category…</main>
  }

  if (!category) {
    return <main className="profile-state"><h1>Category not found</h1><a href="/">Back to discovery <ArrowRight size={15} /></a></main>
  }

  return (
    <div className="category-page">
      <header className="profile-header"><Brand href="/" /><a className="profile-back" href="/"><ArrowLeft size={15} /> Back to discovery</a></header>

      {/* Category Hero */}
      <section className="category-hero">
        <div className="category-hero-content">
          <div className="eyebrow"><span className="eyebrow-line" /> BHA BUSINESS NETWORK</div>
          <h1>{category.name}</h1>
          {category.description && <p>{category.description}</p>}
        </div>
        <div className="category-hero-stats">
          <span><strong>{totalCount}</strong> businesses</span>
          <span><strong>{subcategories.length}</strong> subcategories</span>
        </div>
      </section>

      {/* Subcategory Navigation */}
      {subcategories.length > 0 && (
        <nav className="subcategory-nav" aria-label="Subcategories">
          <button
            className={!selectedSubcategory ? 'active' : ''}
            onClick={() => { setSelectedSubcategory(''); setCurrentPage(1) }}
          >
            All
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              className={selectedSubcategory === sub.id ? 'active' : ''}
              onClick={() => { setSelectedSubcategory(sub.id); setCurrentPage(1) }}
            >
              {sub.name}
            </button>
          ))}
        </nav>
      )}

      {/* Search & Filters */}
      <div className="category-search-panel">
        <div className="category-search-row">
          <label className="keyword-field">
            <Search size={18} />
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              placeholder={`Search in ${category.name}…`}
            />
          </label>
          <label className="select-field">
            <MapPin size={16} />
            <select value={countryFilter} onChange={(e) => { setCountryFilter(e.target.value); setCurrentPage(1) }}>
              <option value="">All countries</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="select-chevron" size={13} />
          </label>
          <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
          </button>
        </div>

        {/* Dynamic Attribute Filters */}
        {showFilters && attributes.length > 0 && (
          <div className="dynamic-filters">
            <div className="filters-header">
              <h4>Filter by</h4>
              {activeFilterCount > 0 && <button className="clear-filters" onClick={clearAllFilters}>Clear all <X size={13} /></button>}
            </div>
            <div className="filters-grid">
              {attributes.filter((a) => a.is_searchable).map((attr) => (
                <FilterControl
                  key={attr.id}
                  attribute={attr}
                  value={activeFilters[attr.key] || ''}
                  onChange={(value) => { setActiveFilters((prev) => ({ ...prev, [attr.key]: value })); setCurrentPage(1) }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="category-results">
        <div className="results-toolbar">
          <div className="results-count">
            <span className="results-count-number">{loading ? '—' : totalCount}</span>
            <span>BUSINESSES<br />IN {category.name.toUpperCase()}</span>
          </div>
          {activeFilterCount > 0 && (
            <button className="sort-button" onClick={clearAllFilters}>Clear filters <X size={14} /></button>
          )}
        </div>

        {businesses.length > 0 ? (
          <div className="business-grid category-grid">
            {businesses.map((business, index) => (
              <article className="business-card" key={business.id} style={{ animationDelay: `${index * 50}ms` }}>
                <a className="business-image-link" href={`/business/${business.slug}`} aria-label={`View ${business.business_name}`}>
                  <img
                    className="business-image"
                    src={business.cover_image_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=85'}
                    alt={`${business.business_name} business profile`}
                    loading="lazy"
                  />
                  {business.is_verified && <span className="verified-pill"><BadgeCheck size={13} /> BHA VERIFIED</span>}
                </a>
                <div className="business-card-body">
                  <h3><a href={`/business/${business.slug}`}>{business.business_name}</a></h3>
                  <p>{business.short_description}</p>
                  <div className="business-card-footer">
                    <span><MapPin size={13} /> {business.city}, {business.country}</span>
                    <a href={`/business/${business.slug}`} aria-label={`View ${business.business_name}`}><ArrowRight size={17} /></a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : !loading ? (
          <div className="empty-state">
            <Search size={24} />
            <h3>No businesses found</h3>
            <p>Try adjusting your filters or search terms.</p>
            <button type="button" onClick={clearAllFilters}>Clear all filters <ArrowRight size={14} /></button>
          </div>
        ) : null}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ArrowLeft size={15} /> Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              Next <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>

      <footer className="site-footer"><Brand className="footer-wordmark" href="/" /><span className="footer-tagline">CREDIBILITY THAT CROSSES BORDERS.</span><span className="footer-copy">© 2026 BUSINESS HUB AFRICA</span></footer>
    </div>
  )
}

// Dynamic filter control renderer
function FilterControl({ attribute, value, onChange }: {
  attribute: CategoryAttribute
  value: string
  onChange: (value: string) => void
}) {
  switch (attribute.data_type) {
    case 'BOOLEAN':
      return (
        <label className="filter-control">
          <span className="filter-label">{attribute.label}</span>
          <select value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      )
    case 'ENUM':
      return (
        <label className="filter-control">
          <span className="filter-label">{attribute.label}</span>
          <select value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">All</option>
            {attribute.allowed_values?.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )
    case 'MULTI_ENUM':
      return (
        <div className="filter-control multi-select">
          <span className="filter-label">{attribute.label}</span>
          <div className="multi-options">
            {attribute.allowed_values?.map((v) => (
              <button
                key={v}
                type="button"
                className={value === v ? 'selected' : ''}
                onClick={() => onChange(value === v ? '' : v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )
    case 'RANGE':
      return (
        <label className="filter-control">
          <span className="filter-label">{attribute.label}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. 100-500"
          />
        </label>
      )
    default:
      return (
        <label className="filter-control">
          <span className="filter-label">{attribute.label}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Filter by ${attribute.label.toLowerCase()}`}
          />
        </label>
      )
  }
}
