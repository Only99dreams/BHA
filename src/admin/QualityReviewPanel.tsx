import { useState, useEffect, useCallback } from 'react'
import { Check, FileText, MessageSquare, Search, X } from 'lucide-react'
import { getSupabaseClient } from '../supabase'
import { documentLabel, signedDocumentUrl } from '../lib/uploads'

interface ReviewPageVersion {
  id: string
  version: number
  status: string
  content: any
  seo_metadata: any
}

interface BusinessReview {
  id: string
  slug: string
  business_name: string
  status: string
  short_description: string
  city: string
  country_code: string | null
  cover_image_url: string | null
  is_verified: boolean
  published_at: string | null
  created_at: string
  business_categories: { categories: { name: string }; subcategories: { name: string } | null }[]
  business_type_vocabulary: { name: string } | null
  page_versions: ReviewPageVersion[]
  business_documents?: {
    id: string
    document_type: string
    file_name: string
    storage_path: string
    status: string
  }[]
}

function latestReviewable(versions: ReviewPageVersion[] | undefined) {
  const pending = (versions || []).filter((version) => ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(version.status))
  return pending.sort((a, b) => b.version - a.version)[0] || null
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
  const [busy, setBusy] = useState(false)

  const fetchBusinesses = useCallback(async () => {
    setLoading(true)
    const client = getSupabaseClient()

    let query = client
      .from('businesses')
      .select('id, slug, business_name, status, short_description, city, country_code, cover_image_url, is_verified, published_at, created_at, business_categories(categories(name), subcategories(name)), business_type_vocabulary(name), page_versions(id, version, status, content, seo_metadata), business_documents(id, document_type, file_name, storage_path, status)')
      .in('status', ['QUALITY_REVIEW', 'INFORMATION_RECEIVED', 'AI_PAGE_GENERATING', 'APPROVED', 'LIVE'])
      .order('updated_at', { ascending: false })
      .order('version', { referencedTable: 'page_versions', ascending: false })

    if (filter !== 'ALL') {
      query = query.eq('status', filter)
    }

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError.message)
      setBusinesses([])
    } else {
      setBusinesses((data || []) as unknown as BusinessReview[])
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { void fetchBusinesses() }, [fetchBusinesses])

  const logReview = async (businessId: string, action: string, details: Record<string, unknown>) => {
    const client = getSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    await client.from('audit_logs').insert({
      actor_id: user?.id ?? null,
      business_id: businessId,
      action,
      details,
    })
  }

  const openDocument = async (storagePath: string) => {
    setError(null)
    try {
      const url = await signedDocumentUrl(getSupabaseClient(), storagePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (documentError) {
      setError(documentError instanceof Error ? documentError.message : 'Could not open that document.')
    }
  }

  const handleApprove = async (business: BusinessReview) => {
    setError(null)
    setSuccess(null)

    if (!['QUALITY_REVIEW', 'APPROVED', 'LIVE'].includes(business.status)) {
      setError('This business is not ready for page approval yet.')
      return
    }

    const version = latestReviewable(business.page_versions)
    if (!version) {
      setError('There is no draft or submitted page version to publish.')
      return
    }

    setBusy(true)
    const client = getSupabaseClient()
    try {
      const { data: { user } } = await client.auth.getUser()
      const now = new Date().toISOString()

      // Publish the reviewed version and retire any previously published ones.
      const { error: archiveError } = await client
        .from('page_versions')
        .update({ status: 'APPROVED' })
        .eq('business_id', business.id)
        .eq('status', 'PUBLISHED')
      if (archiveError) throw archiveError

      const { error: versionError } = await client
        .from('page_versions')
        .update({ status: 'PUBLISHED', reviewed_by: user?.id ?? null, reviewed_at: now })
        .eq('id', version.id)
      if (versionError) throw versionError

      // Move through the state machine one legal step at a time.
      if (business.status === 'QUALITY_REVIEW') {
        const { error: approveError } = await client
          .from('businesses')
          .update({ status: 'APPROVED' })
          .eq('id', business.id)
        if (approveError) throw approveError
      }

      if (business.status !== 'LIVE') {
        const { error: liveError } = await client
          .from('businesses')
          .update({
            status: 'LIVE',
            is_published: true,
            publication_status: 'PUBLISHED',
            is_verified: true,
            verification_status: 'VERIFIED',
            published_at: now,
          })
          .eq('id', business.id)
        if (liveError) throw liveError
      } else {
        const { error: refreshError } = await client
          .from('businesses')
          .update({
            is_published: true,
            publication_status: 'PUBLISHED',
            is_verified: true,
            verification_status: 'VERIFIED',
          })
          .eq('id', business.id)
        if (refreshError) throw refreshError
      }

      await logReview(business.id, 'PAGE_APPROVED', { version: version.version, version_id: version.id })
      setSuccess(`"${business.business_name}" version ${version.version} is now LIVE.`)
      setSelected(null)
      await fetchBusinesses()
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Failed to approve this business.')
    } finally {
      setBusy(false)
    }
  }

  const sendBack = async (business: BusinessReview, reason: string, action: string) => {
    setError(null)
    setSuccess(null)

    if (business.status !== 'QUALITY_REVIEW') {
      setError('Only businesses in quality review can be sent back for changes.')
      return
    }

    setBusy(true)
    const client = getSupabaseClient()
    try {
      const { error: updateError } = await client
        .from('businesses')
        .update({ status: 'INFORMATION_PENDING' })
        .eq('id', business.id)
      if (updateError) throw updateError

      const version = latestReviewable(business.page_versions)
      if (version?.status === 'IN_REVIEW') {
        await client.from('page_versions').update({ status: 'DRAFT' }).eq('id', version.id)
      }

      await logReview(business.id, action, { reason, version: version?.version ?? null })
      setSuccess(`"${business.business_name}" was sent back for changes.`)
      setShowRejectModal(false)
      setRejectionReason('')
      setSelected(null)
      await fetchBusinesses()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to send this business back.')
    } finally {
      setBusy(false)
    }
  }

  const filtered = businesses.filter((business) =>
    `${business.business_name} ${business.city} ${business.country_code || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="quality-review-panel">
      <div className="taxonomy-header">
        <h2>Quality Review</h2>
        <p>Review generated and edited pages, publish a version, or send it back for changes. Approving a business marks it verified and publishes the selected page version.</p>
      </div>

      {error && <div className="taxonomy-alert taxonomy-error" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="taxonomy-alert taxonomy-success" onClick={() => setSuccess(null)}>{success}</div>}

      <div className="review-toolbar">
        <div className="filter-tabs">
          {['QUALITY_REVIEW', 'AI_PAGE_GENERATING', 'APPROVED', 'LIVE', 'ALL'].map((item) => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} type="button">
              {item === 'ALL' ? 'All' : item.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <label className="review-search">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search businesses…" />
        </label>
      </div>

      <div className="review-content">
        <div className={`review-list ${selected ? 'has-selection' : ''}`}>
          {filtered.length === 0 && !loading && <div className="empty-state">No businesses match this view.</div>}
          {loading && <div className="taxonomy-loading">Loading…</div>}
          {filtered.map((business) => (
            <button
              key={business.id}
              type="button"
              className={`review-item ${selected?.id === business.id ? 'selected' : ''}`}
              onClick={() => { setSelected(business); setShowRejectModal(false) }}
            >
              <div className="review-item-info">
                <b>{business.business_name}</b>
                <span>{business.city}{business.country_code ? `, ${business.country_code}` : ''}</span>
                <span className="review-categories">
                  {business.business_categories?.map((category) => category.categories?.name).filter(Boolean).join(', ')}
                </span>
              </div>
              <span className={`status-badge status-${business.status === 'LIVE' ? 'verified' : business.status === 'QUALITY_REVIEW' ? 'review' : business.status === 'APPROVED' ? 'active' : 'information'}`}>
                <i />{business.status.replace(/_/g, ' ')}
              </span>
            </button>
          ))}
        </div>

        {selected && (() => {
          const version = latestReviewable(selected.page_versions)
          return (
            <div className="review-detail">
              <div className="review-detail-header">
                <h3>{selected.business_name}</h3>
                <button className="icon-btn" onClick={() => setSelected(null)} type="button"><X size={18} /></button>
              </div>

              <div className="review-detail-meta">
                <span>{selected.city}{selected.country_code ? `, ${selected.country_code}` : ''}</span>
                <span>{selected.business_type_vocabulary?.name}</span>
                <span>{selected.business_categories?.map((category) => category.categories?.name).filter(Boolean).join(', ')}</span>
                {selected.is_verified ? <span className="badge badge-searchable">Verified</span> : <span className="badge">Verification pending</span>}
              </div>

              <div className="review-detail-section">
                <h4>Short Description</h4>
                <p>{selected.short_description || 'No short description provided.'}</p>
              </div>

              <div className="review-detail-section">
                <h4>Verification documents</h4>
                {(selected.business_documents || []).length === 0 && <p>No documents were uploaded with this application.</p>}
                <div className="review-documents">
                  {(selected.business_documents || []).map((document) => (
                    <button key={document.id} type="button" className="review-document" onClick={() => void openDocument(document.storage_path)}>
                      <FileText size={15} />
                      <span>
                        <b>{documentLabel(document.document_type)}</b>
                        <small>{document.file_name}</small>
                      </span>
                      <span className={`status-pill status-${document.status === 'APPROVED' ? 'approved' : document.status === 'REJECTED' ? 'rejected' : 'in_review'}`}>{document.status}</span>
                    </button>
                  ))}
                </div>
              </div>

              {version ? (
                <div className="review-detail-section">
                  <h4>Page content — version {version.version}</h4>
                  <span className={`status-pill status-${version.status.toLowerCase()}`}>{version.status.replace(/_/g, ' ')}</span>
                  <div className="ai-content-preview">
                    {version.content?.seo_title && <div><strong>SEO title:</strong> {version.content.seo_title}</div>}
                    {version.content?.seo_description && <div><strong>SEO description:</strong> {version.content.seo_description}</div>}
                    {version.content?.page_headline && <div><strong>Headline:</strong> {version.content.page_headline}</div>}
                    {version.content?.page_intro && <div><strong>Intro:</strong> {version.content.page_intro}</div>}
                    {version.content?.about_section && <div><strong>About:</strong> {String(version.content.about_section).substring(0, 240)}…</div>}
                    {version.content?.suggested_services?.length > 0 && (
                      <div>
                        <strong>Suggested services:</strong>
                        <ul>
                          {version.content.suggested_services.slice(0, 5).map((service: any, index: number) => (
                            <li key={index}>{service.name}: {service.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <a href={`/business/${selected.slug}?preview=${version.version}`} target="_blank" rel="noreferrer">Open full preview</a>
                  </div>
                </div>
              ) : (
                <div className="review-detail-section">
                  <h4>Page content</h4>
                  <p>This business has no page version to review yet.</p>
                </div>
              )}

              <div className="review-actions">
                <button className="primary-button" type="button" onClick={() => void handleApprove(selected)} disabled={busy || !version}>
                  <Check size={16} /> Approve & Publish
                </button>
                <button className="secondary-button" type="button" onClick={() => void sendBack(selected, 'Changes requested during quality review.', 'PAGE_CHANGES_REQUESTED')} disabled={busy || selected.status !== 'QUALITY_REVIEW'}>
                  <MessageSquare size={15} /> Request Changes
                </button>
                <button className="secondary-button" type="button" onClick={() => setShowRejectModal(true)} disabled={busy || selected.status !== 'QUALITY_REVIEW'}>
                  <X size={15} /> Reject
                </button>
              </div>

              {showRejectModal && (
                <div className="reject-modal">
                  <h4>Reject "{selected.business_name}"</h4>
                  <p>Provide a reason for rejection. It is recorded in the BHA audit log.</p>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={3}
                    placeholder="Reason for rejection…"
                  />
                  <div className="form-actions">
                    <button className="primary-button" type="button" onClick={() => void sendBack(selected, rejectionReason.trim() || 'Rejected during quality review.', 'PAGE_REJECTED')} disabled={busy}>Confirm Rejection</button>
                    <button className="secondary-button" type="button" onClick={() => { setShowRejectModal(false); setRejectionReason('') }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
