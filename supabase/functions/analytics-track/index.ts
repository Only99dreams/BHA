// ============================================================================
// BHA Analytics Tracker
// Lightweight page view and search query tracking.
// POST /functions/v1/analytics-track
// Body: { type: 'page_view' | 'search', slug?: string, query?: string, category?: string }
// ============================================================================

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const body = await req.json()
    const { type, slug, query, category, userAgent } = body

    if (!type || !['page_view', 'search'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid type' }), { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Store in a simple analytics table (would need to be created in schema)
    // For now, log to console and webhook_events for tracking
    await supabase
      .from('webhook_events')
      .insert({
        provider: 'BHA_ANALYTICS',
        event_id: crypto.randomUUID(),
        event_type: type,
        payload: {
          slug: slug || null,
          query: query || null,
          category: category || null,
          user_agent: userAgent || req.headers.get('user-agent') || null,
          timestamp: new Date().toISOString(),
        },
      })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('Analytics tracking error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
