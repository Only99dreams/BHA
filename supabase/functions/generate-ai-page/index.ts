// ============================================================================
// BHA AI Page Generation Edge Function
// Triggered when a business reaches AI_PAGE_GENERATING status.
// Uses OpenAI to draft page content from verified business data.
// Output is stored as a DRAFT page_version — NOT auto-published.
// ============================================================================

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''

interface BusinessData {
  id: string
  business_name: string
  short_description: string
  description: string
  city: string
  country: string
  services: { name: string; description: string }[]
  business_type: string
  categories: string[]
  year_established: string | null
  business_size: string | null
}

const PROMPT_TEMPLATE = `You are writing a professional business landing page for Business Hub Africa (BHA).
BHA is Africa's Business Credibility & Visibility Platform.

CRITICAL RULES:
- You may ONLY use the information provided below.
- Do NOT invent or assume: awards, licences, certifications, clients, partnerships, revenue, years in operation, or regulatory approvals.
- If information is missing, write "[To be confirmed by business]" rather than inventing content.
- Keep the tone professional, warm, and factual.
- Write in British English (African business context).

Business data (JSON):
{{BUSINESS_DATA}}

Write the following:
1. seo_title: Max 60 characters, compelling and search-friendly
2. seo_description: Max 160 characters, summarising the business
3. page_headline: A short, impactful headline for the page hero (max 80 characters)
4. page_intro: A 2-3 sentence introduction that could appear below the headline
5. about_section: A longer "About" section (max 300 words) based on the description
6. suggested_services: Array of 3-5 service offerings with names and 1-sentence descriptions
7. key_facts: Array of 4-6 key facts about the business (only from provided data)

Respond with valid JSON only, no markdown formatting.`

async function generatePageContent(business: BusinessData): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const prompt = PROMPT_TEMPLATE.replace(
    '{{BUSINESS_DATA}}',
    JSON.stringify(business, null, 2)
  )

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional copywriter for business directories. You write in British English. You never invent facts.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('OpenAI returned empty content')
  }

  return JSON.parse(content)
}

Deno.serve(async (req) => {
  // Verify request is from Supabase (service role key or internal trigger)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    const { business_id } = await req.json()

    if (!business_id) {
      return new Response(JSON.stringify({ error: 'business_id is required' }), { status: 400 })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch business data
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('*, business_profiles(*), business_categories(categories(name), subcategories(name)), business_services(name, description)')
      .eq('id', business_id)
      .single()

    if (bizError || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), { status: 404 })
    }

    // Gather verified data only
    const profile = business.business_profiles?.[0] || {}
    const categories = (business.business_categories || [])
      .map((bc: any) => bc.categories?.name)
      .filter(Boolean)

    const businessData: BusinessData = {
      id: business.id,
      business_name: business.business_name,
      short_description: business.short_description,
      description: profile.description || business.short_description,
      city: business.city,
      country: business.country_code,
      services: business.business_services || [],
      business_type: business.business_type_vocabulary?.name || '',
      categories,
      year_established: profile.year_established,
      business_size: profile.business_size,
    }

    // Generate AI content
    const aiContent = await generatePageContent(businessData)

    // Get next version number
    const { data: versions } = await supabase
      .from('page_versions')
      .select('version')
      .eq('business_id', business_id)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = (versions?.[0]?.version || 0) + 1

    // Save as DRAFT (not published)
    const { error: insertError } = await supabase
      .from('page_versions')
      .insert({
        business_id,
        version: nextVersion,
        content: aiContent,
        seo_metadata: {
          seo_title: aiContent.seo_title,
          seo_description: aiContent.seo_description,
        },
        status: 'DRAFT',
      })

    if (insertError) throw insertError

    // Move business to QUALITY_REVIEW
    await supabase
      .from('businesses')
      .update({ status: 'QUALITY_REVIEW', updated_at: new Date().toISOString() })
      .eq('id', business_id)

    // Log audit event
    await supabase
      .from('audit_logs')
      .insert({
        action: 'AI_PAGE_GENERATED',
        business_id,
        details: { version: nextVersion, ai_model: 'gpt-4o-mini' },
      })

    return new Response(
      JSON.stringify({
        success: true,
        business_id,
        version: nextVersion,
        message: 'AI page content generated and saved as draft. Awaiting quality review.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('AI page generation error:', err)

    // Move business back to INFORMATION_PENDING on failure
    const { business_id } = await req.json().catch(() => ({}))
    if (business_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      await supabase
        .from('businesses')
        .update({ status: 'INFORMATION_PENDING' })
        .eq('id', business_id)
    }

    return new Response(
      JSON.stringify({ error: err.message || 'Failed to generate page content' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
