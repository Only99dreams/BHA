import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Activity, BarChart3, Building2, Globe2, Search, TrendingUp } from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

interface AnalyticsEvent {
  id: string
  event_type: string
  payload: any
  received_at: string
}

interface CategoryHealth {
  category: string
  category_slug: string
  business_count: number
  subcategories: number
  has_attributes: boolean
}

export function AnalyticsDashboard() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [categoryHealth, setCategoryHealth] = useState<CategoryHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7')

  const fetchData = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey) return
    setLoading(true)
    const client = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch analytics events
    const since = new Date()
    since.setDate(since.getDate() - parseInt(timeRange))

    const { data: eventData } = await client
      .from('webhook_events')
      .select('*')
      .eq('provider', 'BHA_ANALYTICS')
      .gte('received_at', since.toISOString())
      .order('received_at', { ascending: false })
      .limit(100)

    if (eventData) setEvents(eventData)

    // Fetch category health — count businesses per category
    const { data: bizData } = await client
      .from('business_categories')
      .select('category_id, businesses!inner(status, is_published)')

    const { data: catData } = await client
      .from('categories')
      .select('name, slug, subcategories(id)')

    const { data: attrData } = await client
      .from('category_attributes')
      .select('category_id')

    if (catData) {
      const health: CategoryHealth[] = catData.map((cat: any) => {
        const catBusinesses = (bizData || []).filter((bc: any) => bc.category_id === cat.id)
        const liveBusinesses = catBusinesses.filter((bc: any) => bc.businesses?.status === 'LIVE' && bc.businesses?.is_published)
        const hasAttr = (attrData || []).some((a: any) => a.category_id === cat.id)
        return {
          category: cat.name,
          category_slug: cat.slug,
          business_count: liveBusinesses.length,
          subcategories: cat.subcategories?.length || 0,
          has_attributes: hasAttr,
        }
      })
      setCategoryHealth(health.sort((a, b) => b.business_count - a.business_count))
    }

    setLoading(false)
  }, [timeRange])

  useEffect(() => { fetchData() }, [fetchData])

  // Aggregate stats
  const pageViews = events.filter((e) => e.event_type === 'page_view').length
  const searches = events.filter((e) => e.event_type === 'search').length
  const uniqueBusinesses = new Set(events.filter((e) => e.event_type === 'page_view').map((e) => e.payload?.slug)).size

  // Top searched terms
  const searchTerms: Record<string, number> = {}
  for (const e of events.filter((ev) => ev.event_type === 'search')) {
    const term = e.payload?.query || ''
    if (term) searchTerms[term] = (searchTerms[term] || 0) + 1
  }
  const topSearches = Object.entries(searchTerms).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Top viewed businesses
  const businessViews: Record<string, number> = {}
  for (const e of events.filter((ev) => ev.event_type === 'page_view')) {
    const slug = e.payload?.slug || ''
    if (slug) businessViews[slug] = (businessViews[slug] || 0) + 1
  }
  const topBusinesses = Object.entries(businessViews).sort((a, b) => b[1] - a[1]).slice(0, 10)

  if (loading) return <div className="taxonomy-loading">Loading analytics…</div>

  return (
    <div className="analytics-dashboard">
      <div className="taxonomy-header">
        <h2><BarChart3 size={18} /> Analytics & Category Health</h2>
        <p>Search patterns, page views and taxonomy health metrics for controlled iteration.</p>
      </div>

      <div className="analytics-controls">
        <label>
          Time range:
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
      </div>

      {/* Metric Cards */}
      <div className="analytics-metrics">
        <div className="metric-card">
          <span className="metric-heading">PAGE VIEWS <Activity size={15} /></span>
          <strong>{pageViews}</strong>
          <small>Last {timeRange} days</small>
        </div>
        <div className="metric-card">
          <span className="metric-heading">SEARCHES <Search size={15} /></span>
          <strong>{searches}</strong>
          <small>Last {timeRange} days</small>
        </div>
        <div className="metric-card">
          <span className="metric-heading">BUSINESSES VIEWED <Building2 size={15} /></span>
          <strong>{uniqueBusinesses}</strong>
          <small>Unique pages</small>
        </div>
        <div className="metric-card">
          <span className="metric-heading">CATEGORIES <Globe2 size={15} /></span>
          <strong>{categoryHealth.length}</strong>
          <small>{categoryHealth.filter((c) => c.business_count === 0).length} empty</small>
        </div>
      </div>

      <div className="analytics-columns">
        {/* Top Searches */}
        <div className="analytics-panel">
          <h3><Search size={15} /> Top Search Terms</h3>
          {topSearches.length === 0 ? (
            <div className="empty-state">No search data yet.</div>
          ) : (
            <div className="analytics-list">
              {topSearches.map(([term, count]) => (
                <div key={term} className="analytics-row">
                  <span className="analytics-label">{term}</span>
                  <span className="analytics-value">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Viewed Businesses */}
        <div className="analytics-panel">
          <h3><TrendingUp size={15} /> Most Viewed Businesses</h3>
          {topBusinesses.length === 0 ? (
            <div className="empty-state">No page view data yet.</div>
          ) : (
            <div className="analytics-list">
              {topBusinesses.map(([slug, count]) => (
                <div key={slug} className="analytics-row">
                  <span className="analytics-label">{slug}</span>
                  <span className="analytics-value">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Health */}
        <div className="analytics-panel analytics-panel-full">
          <h3><Globe2 size={15} /> Category Health</h3>
          <div className="health-table">
            <div className="health-row health-header">
              <span>CATEGORY</span>
              <span>BUSINESSES</span>
              <span>SUBCATEGORIES</span>
              <span>FILTERS</span>
            </div>
            {categoryHealth.map((cat) => (
              <div key={cat.category_slug} className={`health-row ${cat.business_count === 0 ? 'empty' : ''}`}>
                <span><a href={`/category/${cat.category_slug}`}>{cat.category}</a></span>
                <span className={cat.business_count === 0 ? 'warning-text' : ''}>{cat.business_count}</span>
                <span>{cat.subcategories}</span>
                <span>{cat.has_attributes ? 'Yes' : 'No'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
