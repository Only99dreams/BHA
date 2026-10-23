import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Check, MessageSquare, Search, X } from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

interface BusinessReview {
  id: string
  slug: string
  business_name: string
  status: string
  short_description: string
  city: string
  country: string
  cover_image_url: string | null
  is_verified: boolean
  published_at: string | null
  created_at: string
  business_categories: { categories: { name: string }; subcategories: { name: string } | null }[]
  business_type_vocabulary: { name: string } | null
  page_versions: { id: string; version: number; status: string; content: any; seo_metadata: any }[]
}

export function QualityReviewPanel() {
  const [businesses, setBusinesses] = useState<BusinessReview[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BusinessReview | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('QUALITY_REVIEW')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  const fetchBusinesses = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey) return
    setLoading(true)
    const client = createClient(supabaseUrl, supabaseAnonKey)

    let query = client
      .from('businesses')
      .select('*, business_categories(categories(name), subcategories(name)), business_type_vocabulary(name), page_versions(id, version, status, content, seo_metadata)')
      .in('status', ['QUALITY_REVIEW', 'INFORMATION_RECEIVED', 'AI_PAGE_GENERATING', 'APPROVED', 'LIVE'])
      .order('updated_at', { ascending: false })

    if (filter !== 'ALL') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query
    if (!error && data) setBusinesses(data as BusinessReview[])
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchBusinesses() }, [fetchBusinesses])

  const handleApprove = async (business: BusinessReview) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)
    setError(null)

    // Publish the latest approved page version
    const latestVersion = business.page_versions?.[0]
    if (latestVersion) {
      await client
        .from('page_versions')
        .update({ status: 'PUBLISHED', reviewed_by: (await client.auth.getUser()).data.user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', latestVersion.id)
    }

    const { error } = await client
      .from('businesses')
      .update({ status: 'LIVE', is_published: true, publication_status: 'PUBLISHED', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', business.id)

    if (error) {
      setError(`Failed to approve: ${error.message}`)
    } else {
      setSuccess(`"${business.business_name}" is now LIVE`)
      fetchBusinesses()
      setSelected(null)
    }
  }

  const handleReject = async (business: BusinessReview) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)

    const { error } = await client
      .from('businesses')
      .update({ status: 'INFORMATION_PENDING', updated_at: new Date().toISOString() })
      .eq('id', business.id)

    if (error) {
      setError(`Failed to reject: ${error.message}`)
    } else {
      setSuccess(`"${business.business_name}" sent back for changes`)
      setShowRejectModal(false)
      setRejectionReason('')
      fetchBusinesses()
      setSelected(null)
    }
  }

  const handleRequestChanges = async (business: BusinessReview) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)

    const { error } = await client
      .from('businesses')
      .update({ status: 'INFORMATION_PENDING', updated_at: new Date().toISOString() })
      .eq('id', business.id)

    if (error) {
      setError(`Failed to request changes: ${error.message}`)
    } else {
      setSuccess(`Changes requested for "${business.business_name}"`)
      fetchBusinesses()
      setSelected(null)
    }
  }

  const filtered = businesses.filter((b) =>
    `${b.business_name} ${b.city} ${b.country}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="quality-review-panel">
      <div className="taxonomy-header">
        <h2>Quality Review</h2>
        <p>Review AI-generated pages, approve for publication, or request changes before going live.</p>
      </div>

      {error && <div className="taxonomy-alert taxonomy-error" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="taxonomy-alert taxonomy-success" onClick={() => setSuccess(null)}>{success}</div>}

      <div className="review-toolbar">
        <div className="filter-tabs">
          {['QUALITY_REVIEW', 'AI_PAGE_GENERATING', 'APPROVED', 'LIVE', 'ALL'].map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'ALL' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <label className="review-search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search businesses…" />
        </label>
      </div>

      <div className="review-content">
        {/* Business list */}
        <div className={`review-list ${selected ? 'has-selection' : ''}`}>
          {filtered.length === 0 && !loading && (
            <div className="empty-state">No businesses match this view.</div>
          )}
          {loading && <div className="taxonomy-loading">Loading…</div>}
          {filtered.map((biz) => (
            <button
              key={biz.id}
              className={`review-item ${selected?.id === biz.id ? 'selected' : ''}`}
              onClick={() => setSelected(biz)}
            >
              <div className="review-item-info">
                <b>{biz.business_name}</b>
                <span>{biz.city}, {biz.country}</span>
                <span className="review-categories">
                  {biz.business_categories?.map((bc) => bc.categories?.name).join(', ')}
                </span>
              </div>
              <span className={`status-badge status-${biz.status === 'LIVE' ? 'verified' : biz.status === 'QUALITY_REVIEW' ? 'review' : biz.status === 'APPROVED' ? 'active' : 'information'}`}>
                <i />{biz.status.replace(/_/g, ' ')}
              </span>
            </button>
          ))}
        </div>

        {/* Review detail */}
        {selected && (
          <div className="review-detail">
            <div className="review-detail-header">
              <h3>{selected.business_name}</h3>
              <button className="icon-btn" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>

            <div className="review-detail-meta">
              <span>{selected.city}, {selected.country}</span>
              <span>{selected.business_type_vocabulary?.name}</span>
              <span>{selected.business_categories?.map((bc) => bc.categories?.name).join(', ')}</span>
              {selected.is_verified && <span className="badge badge-searchable">Verified</span>}
            </div>

            <div className="review-detail-section">
              <h4>Short Description</h4>
              <p>{selected.short_description}</p>
            </div>

            {/* AI Generated Content */}
            {selected.page_versions && selected.page_versions.length > 0 && (
              <div className="review-detail-section">
                <h4>AI-Generated Page Content (v{selected.page_versions[0].version})</h4>
                <div className="ai-content-preview">
                  {selected.page_versions[0].content?.seo_title && (
                    <div><strong>SEO Title:</strong> {selected.page_versions[0].content.seo_title}</div>
                  )}
                  {selected.page_versions[0].content?.seo_description && (
                    <div><strong>SEO Description:</strong> {selected.page_versions[0].content.seo_description}</div>
                  )}
                  {selected.page_versions[0].content?.page_headline && (
                    <div><strong>Headline:</strong> {selected.page_versions[0].content.page_headline}</div>
                  )}
                  {selected.page_versions[0].content?.page_intro && (
                    <div><strong>Intro:</strong> {selected.page_versions[0].content.page_intro}</div>
                  )}
                  {selected.page_versions[0].content?.about_section && (
                    <div><strong>About:</strong> {selected.page_versions[0].content.about_section.substring(0, 200)}…</div>
                  )}
                  {selected.page_versions[0].content?.suggested_services && (
                    <div>
                      <strong>Suggested Services:</strong>
                      <ul>
                        {selected.page_versions[0].content.suggested_services.slice(0, 3).map((s: any, i: number) => (
                          <li key={i}>{s.name}: {s.description}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="review-actions">
              <button className="primary-button" onClick={() => handleApprove(selected)}>
                <Check size={16} /> Approve & Publish
              </button>
              <button className="secondary-button" onClick={() => handleRequestChanges(selected)}>
                <MessageSquare size={15} /> Request Changes
              </button>
              <button className="secondary-button" onClick={() => setShowRejectModal(true)}>
                <X size={15} /> Reject
              </button>
            </div>

            {showRejectModal && (
              <div className="reject-modal">
                <h4>Reject "{selected.business_name}"</h4>
                <p>Please provide a reason for rejection. This will be visible to the business owner.</p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Reason for rejection…"
                />
                <div className="form-actions">
                  <button className="primary-button" onClick={() => handleReject(selected)}>Confirm Rejection</button>
                  <button className="secondary-button" onClick={() => { setShowRejectModal(false); setRejectionReason('') }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
