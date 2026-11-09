export type WebsiteHours = { day: string; hours: string }
export type WebsiteSocial = { label: string; url: string }

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export function normaliseHours(value: unknown): WebsiteHours[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value
      .map((item: any) => ({
        day: typeof item?.day === 'string' ? item.day : typeof item?.label === 'string' ? item.label : '',
        hours: typeof item?.hours === 'string' ? item.hours : typeof item?.value === 'string' ? item.value : '',
      }))
      .filter((item) => item.day && item.hours)
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.entries(record)
      .map(([day, hours]) => ({ day, hours: typeof hours === 'string' ? hours : '' }))
      .filter((item) => item.hours)
      .sort((a, b) => {
        const first = DAY_ORDER.indexOf(a.day.toLowerCase())
        const second = DAY_ORDER.indexOf(b.day.toLowerCase())
        return (first === -1 ? 99 : first) - (second === -1 ? 99 : second)
      })
  }

  return []
}

export function normaliseSocials(value: unknown): WebsiteSocial[] {
  const socials: WebsiteSocial[] = []

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item?.url === 'string' && item.url) {
        socials.push({ label: item.platform || item.label || 'Social', url: item.url })
      }
    }
  } else if (value && typeof value === 'object') {
    for (const [label, url] of Object.entries(value as Record<string, unknown>)) {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) socials.push({ label, url })
    }
  }

  return socials.map((social) => ({
    label: social.label.charAt(0).toUpperCase() + social.label.slice(1),
    url: social.url,
  }))
}
