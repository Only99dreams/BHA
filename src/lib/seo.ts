// ============================================================================
// BHA SEO Helpers
// Structured data (Schema.org JSON-LD), Open Graph, Twitter Cards
// ============================================================================

export interface BusinessSEODData {
  name: string
  description: string
  url: string
  image: string | null
  city: string
  country: string
  phone: string | null
  email: string | null
  website: string | null
  category: string
  businessType: string
  verified: boolean
  services: { name: string; description: string }[]
  datePublished: string | null
}

export interface CategorySEODData {
  name: string
  description: string
  url: string
  businessCount: number
}

const SITE_NAME = 'Business Hub Africa'
const SITE_URL = 'https://businesshub.africa'
const DEFAULT_IMAGE = 'https://businesshub.africa/logo_nobackgroung.png'

// Generate Schema.org JSON-LD for a business
export function generateBusinessStructuredData(business: BusinessSEODData): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    description: business.description,
    url: business.url,
    image: business.image || DEFAULT_IMAGE,
    telephone: business.phone,
    email: business.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: business.city,
      addressCountry: business.country,
    },
    category: business.category,
    additionalType: business.businessType,
    ...(business.services.length > 0 && {
      makesOffer: business.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: s.name,
          description: s.description,
        },
      })),
    }),
    ...(business.datePublished && { datePublished: business.datePublished }),
    parentOrganization: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }

  return JSON.stringify(schema, null, 2)
}

// Generate Schema.org JSON-LD for a category
export function generateCategoryStructuredData(category: CategorySEODData): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name} - Business Hub Africa`,
    description: category.description,
    url: category.url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: category.businessCount,
    },
    parentOrganization: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }

  return JSON.stringify(schema, null, 2)
}

// Generate Open Graph meta tags
export function generateOpenGraphTags(data: {
  title: string
  description: string
  url: string
  image?: string | null
  type?: string
}): string {
  const image = data.image || DEFAULT_IMAGE
  return `
    <meta property="og:title" content="${escapeHtml(data.title)}" />
    <meta property="og:description" content="${escapeHtml(data.description)}" />
    <meta property="og:url" content="${data.url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:type" content="${data.type || 'website'}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="en_GB" />
  `.trim()
}

// Generate Twitter Card meta tags
export function generateTwitterCardTags(data: {
  title: string
  description: string
  image?: string | null
}): string {
  const image = data.image || DEFAULT_IMAGE
  return `
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(data.title)}" />
    <meta name="twitter:description" content="${escapeHtml(data.description)}" />
    <meta name="twitter:image" content="${image}" />
  `.trim()
}

// Generate canonical URL
export function generateCanonicalUrl(path: string): string {
  return `<link rel="canonical" href="${SITE_URL}${path}" />`
}

// Generate meta robots tag
export function generateRobotsTag(index: boolean = true, follow: boolean = true): string {
  const indexValue = index ? 'index' : 'noindex'
  const followValue = follow ? 'follow' : 'nofollow'
  return `<meta name="robots" content="${indexValue}, ${followValue}" />`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Generate full SEO head block for a business page
export function generateBusinessSEOHead(business: BusinessSEODData): string {
  const title = `${business.name} | ${business.category} in ${business.city}, ${business.country} | Business Hub Africa`
  const description = business.description.substring(0, 160)

  return [
    generateCanonicalUrl(`/business/${business.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
    generateRobotsTag(true, true),
    generateOpenGraphTags({ title, description, url: business.url, image: business.image, type: 'business.business' }),
    generateTwitterCardTags({ title, description, image: business.image }),
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<script type="application/ld+json">${generateBusinessStructuredData(business)}</script>`,
  ].join('\n')
}

// Generate full SEO head block for a category page
export function generateCategorySEOHead(category: CategorySEODData): string {
  const title = `${category.name} Businesses in Africa | Business Hub Africa`
  const description = category.description.substring(0, 160)

  return [
    generateCanonicalUrl(`/category/${category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
    generateRobotsTag(true, true),
    generateOpenGraphTags({ title, description, url: category.url, type: 'website' }),
    generateTwitterCardTags({ title, description }),
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<script type="application/ld+json">${generateCategoryStructuredData(category)}</script>`,
  ].join('\n')
}
