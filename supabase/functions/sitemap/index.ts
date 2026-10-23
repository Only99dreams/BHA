// ============================================================================
// BHA Sitemap Generator
// Generates XML sitemap with all live businesses and category pages.
// Accessed at /functions/v1/sitemap
// ============================================================================

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const baseUrl = 'https://businesshub.africa'

  // Fetch all live businesses
  const { data: businesses } = await supabase
    .from('businesses')
    .select('slug, updated_at')
    .eq('status', 'LIVE')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })

  // Fetch all active categories
  const { data: categories } = await supabase
    .from('categories')
    .select('slug, updated_at')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch all active subcategories
  const { data: subcategories } = await supabase
    .from('subcategories')
    .select('slug, categories(slug)')
    .eq('is_active', true)
    .order('sort_order')

  const today = new Date().toISOString().split('T')[0]

  const businessUrls = (businesses || []).map((b: any) => `
  <url>
    <loc>${baseUrl}/business/${b.slug}</loc>
    <lastmod>${(b.updated_at || today).split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')

  const categoryUrls = (categories || []).map((c: any) => `
  <url>
    <loc>${baseUrl}/category/${c.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`).join('')

  const subcategoryUrls = (subcategories || []).map((s: any) => `
  <url>
    <loc>${baseUrl}/category/${s.categories?.slug}?sub=${s.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/#discover</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>${categoryUrls}${subcategoryUrls}${businessUrls}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
