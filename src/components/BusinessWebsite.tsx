import { useState, type CSSProperties, type MouseEvent } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock3,
  Globe2,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  X,
} from 'lucide-react'
import type { PageFaq, PageFeature, PageImage, PageProcessStep, PageService } from '../lib/pages'
import type { WebsiteHours, WebsiteSocial } from '../lib/website'

const CURRENT_YEAR = new Date().getFullYear()

export type WebsiteContact = {
  email?: string
  phone?: string
  whatsapp?: string
  website?: string
  address?: string
  hours?: WebsiteHours[]
  socials?: WebsiteSocial[]
}

export type WebsiteBusiness = {
  name: string
  headline: string
  tagline: string
  intro: string
  about: string
  aboutTitle?: string
  logoUrl?: string
  heroImage?: string
  aboutImage?: string
  gallery: PageImage[]
  brandColor: string
  category?: string
  subcategory?: string
  businessType?: string
  city?: string
  country?: string
  verified?: boolean
  ctaText?: string
  heroEyebrow?: string
  heroHighlights: string[]
  facts: { label: string; value: string }[]
  services: PageService[]
  features: PageFeature[]
  processSteps: PageProcessStep[]
  faq: PageFaq[]
  customSections: Array<{ id: string; type: string; content: any }>
  contactHeading?: string
  contactNote?: string
  footerNote?: string
}

function whatsappUrl(value: string) {
  const digits = value.replace(/[^\d]/g, '')
  return digits ? `https://wa.me/${digits}` : ''
}

function readableText(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return '#ffffff'
  const value = parseInt(match[1], 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#14231a' : '#ffffff'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

function splitParagraphs(value: string) {
  return value.split(/\n{2,}|\r\n\r\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
}

export function BusinessWebsite({
  business,
  contact,
  embedded = false,
  idPrefix = 'biz',
}: {
  business: WebsiteBusiness
  contact: WebsiteContact
  embedded?: boolean
  idPrefix?: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const sectionId = (key: string) => `${idPrefix}-${key}`

  const contactEmail = contact.email?.trim()
  const contactPhone = contact.phone?.trim()
  const contactWhatsapp = contact.whatsapp?.trim()
  const contactWebsite = contact.website?.trim()
  const whatsappLink = contactWhatsapp ? whatsappUrl(contactWhatsapp) : ''

  const primaryHref = contactEmail
    ? `mailto:${contactEmail}`
    : contactPhone
      ? `tel:${contactPhone.replace(/\s/g, '')}`
      : whatsappLink || contactWebsite || `#${sectionId('contact')}`

  const navItems = [
    { key: 'about', label: 'About' },
    business.services.length > 0 && { key: 'services', label: 'Services' },
    business.features.length > 0 && { key: 'why-us', label: 'Why us' },
    business.processSteps.length > 1 && { key: 'process', label: 'How we work' },
    business.gallery.length > 0 && { key: 'gallery', label: 'Gallery' },
    business.faq.length > 0 && { key: 'faq', label: 'FAQ' },
    { key: 'contact', label: 'Contact' },
  ].filter(Boolean) as { key: string; label: string }[]

  const goTo = (event: MouseEvent<HTMLAnchorElement>, key: string) => {
    setMenuOpen(false)
    if (!embedded) return
    event.preventDefault()
    document.getElementById(sectionId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const localArea = [business.city, business.country].filter(Boolean).join(', ')
  const eyebrow = business.heroEyebrow || [business.subcategory || business.category, localArea].filter(Boolean).join(' · ')
  const aboutParagraphs = splitParagraphs(business.about || business.intro || business.tagline)
  const hours = contact.hours || []
  const socials = contact.socials || []
  const addressLine = [contact.address, business.city, business.country].filter(Boolean).join(', ')
  const gallery = business.gallery.slice(0, 6)
  const hasContactDetails = Boolean(contactEmail || contactPhone || contactWhatsapp || contactWebsite || addressLine || hours.length > 0)

  const brand = (
    <>
      {business.logoUrl ? (
        <img src={business.logoUrl} alt="" />
      ) : (
        <span className="biz-brand-mark">{initials(business.name) || 'B'}</span>
      )}
      <span className="biz-brand-copy">
        <span className="biz-brand-name">{business.name}</span>
        {(business.category || business.businessType) && (
          <small>{business.businessType || business.category}</small>
        )}
      </span>
    </>
  )

  return (
    <div
      className="biz-site"
      style={{
        '--biz-accent': business.brandColor || '#092d67',
        '--biz-accent-text': readableText(business.brandColor || '#092d67'),
      } as CSSProperties}
    >
      <header className="biz-header">
        <div className="biz-header-inner">
          <a className="biz-brand" href={`#${sectionId('top')}`} onClick={(event) => goTo(event, 'top')} aria-label={business.name}>
            {brand}
          </a>
          <nav className="biz-nav" aria-label={`${business.name} navigation`}>
            {navItems.map((item) => (
              <a key={item.key} href={`#${sectionId(item.key)}`} onClick={(event) => goTo(event, item.key)}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="biz-header-actions">
            <a className="biz-button biz-button-accent" href={primaryHref}>
              {business.ctaText || 'Get in touch'} <ArrowRight size={15} />
            </a>
            <button
              type="button"
              className="biz-menu-button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="biz-mobile-nav" aria-label={`${business.name} mobile navigation`}>
            {navItems.map((item) => (
              <a key={item.key} href={`#${sectionId(item.key)}`} onClick={(event) => goTo(event, item.key)}>
                {item.label} <ArrowRight size={14} />
              </a>
            ))}
            <a className="biz-button biz-button-accent" href={primaryHref} onClick={() => setMenuOpen(false)}>
              {business.ctaText || 'Get in touch'} <ArrowRight size={15} />
            </a>
          </nav>
        )}
      </header>

      <div id={sectionId('top')} />
      <section className="biz-hero" aria-labelledby={sectionId('headline')}>
        <div className="biz-container biz-hero-inner">
          <div className="biz-hero-copy">
            {eyebrow && <span className="biz-eyebrow">{eyebrow}</span>}
            <h1 id={sectionId('headline')}>{business.headline}</h1>
            <p className="biz-hero-tagline">{business.tagline || business.intro}</p>
            {business.heroHighlights.length > 0 && (
              <ul className="biz-hero-highlights">
                {business.heroHighlights.map((highlight, index) => (
                  <li key={`${highlight}-${index}`}>
                    <Check size={14} /> {highlight}
                  </li>
                ))}
              </ul>
            )}
            <div className="biz-hero-actions">
              <a className="biz-button biz-button-accent" href={primaryHref}>
                {business.ctaText || 'Get in touch'} <ArrowRight size={16} />
              </a>
              {business.services.length > 0 && (
                <a className="biz-button biz-button-ghost" href={`#${sectionId('services')}`} onClick={(event) => goTo(event, 'services')}>
                  Explore services
                </a>
              )}
            </div>
            {business.verified && (
              <span className="biz-verified"><BadgeCheck size={15} /> Verified by Business Hub Africa</span>
            )}
          </div>
          {business.heroImage && (
            <figure className="biz-hero-media">
              <img src={business.heroImage} alt={`${business.name} — ${business.tagline || business.category || 'business'}`} />
            </figure>
          )}
        </div>
      </section>

      {business.facts.length > 0 && (
        <div className="biz-facts">
          <div className="biz-container biz-facts-grid">
            {business.facts.slice(0, 5).map((fact, index) => (
              <div key={`${fact.label}-${index}`} className="biz-fact">
                <span>{fact.label}</span>
                <b>{fact.value}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="biz-section" id={sectionId('about')}>
        <div className={`biz-container biz-about-grid ${business.aboutImage ? 'has-media' : ''}`}>
          <div>
            <span className="biz-kicker">About {business.name}</span>
            <h2>{business.aboutTitle || `Who we are`}</h2>
            {aboutParagraphs.length > 0 ? (
              aboutParagraphs.map((paragraph, index) => (
                <p key={index} className="biz-body-copy">{paragraph}</p>
              ))
            ) : (
              <p className="biz-body-copy">Details about this business are being prepared.</p>
            )}
            {business.services.length > 0 && (
              <a className="biz-text-link" href={`#${sectionId('services')}`} onClick={(event) => goTo(event, 'services')}>
                See what we offer <ArrowRight size={14} />
              </a>
            )}
          </div>
          {business.aboutImage && (
            <figure className="biz-about-media">
              <img src={business.aboutImage} alt={`${business.name} at work`} loading="lazy" />
            </figure>
          )}
        </div>
      </section>

      {business.services.length > 0 && (
        <section className="biz-section biz-section-paper" id={sectionId('services')}>
          <div className="biz-container">
            <div className="biz-section-head">
              <span className="biz-kicker">What we do</span>
              <h2>Products & services</h2>
              <p>Everything {business.name} offers, presented clearly for you.</p>
            </div>
            <div className="biz-services-grid">
              {business.services.map((service, index) => (
                <article key={`${service.name}-${index}`} className="biz-service-card">
                  <span className="biz-service-index">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{service.name}</h3>
                  {service.description && <p>{service.description}</p>}
                  <a className="biz-text-link" href={primaryHref}>
                    Enquire <ArrowUpRight size={14} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {business.features.length > 0 && (
        <section className="biz-section" id={sectionId('why-us')}>
          <div className="biz-container">
            <div className="biz-section-head">
              <span className="biz-kicker">Why {business.name}</span>
              <h2>Built on doing it properly</h2>
            </div>
            <div className="biz-features-grid">
              {business.features.map((feature, index) => (
                <article key={`${feature.title}-${index}`} className="biz-feature">
                  <span className="biz-feature-icon"><Check size={16} /></span>
                  <h3>{feature.title}</h3>
                  {feature.description && <p>{feature.description}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {business.processSteps.length > 1 && (
        <section className="biz-section biz-section-paper" id={sectionId('process')}>
          <div className="biz-container">
            <div className="biz-section-head">
              <span className="biz-kicker">Working with us</span>
              <h2>How it works</h2>
            </div>
            <ol className="biz-process">
              {business.processSteps.map((step, index) => (
                <li key={`${step.title}-${index}`}>
                  <span className="biz-process-number">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{step.title}</h3>
                  {step.description && <p>{step.description}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="biz-section" id={sectionId('gallery')}>
          <div className="biz-container">
            <div className="biz-section-head">
              <span className="biz-kicker">A closer look</span>
              <h2>{business.category ? `${business.category} in pictures` : 'Our work & space'}</h2>
            </div>
            <div className="biz-gallery">
              {gallery.map((image, index) => (
                <figure key={`${image.url}-${index}`}>
                  <img
                    src={image.url}
                    alt={image.alt || `${business.name} photo ${index + 1}`}
                    loading="lazy"
                  />
                  {image.caption && <figcaption>{image.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {business.customSections.map((section, index) => {
        if (section.type === 'text' && (section.content?.title || section.content?.body)) {
          return (
            <section key={section.id || index} className="biz-section biz-section-paper">
              <div className="biz-container biz-custom-copy">
                {section.content?.title && <h2>{section.content.title}</h2>}
                {splitParagraphs(String(section.content?.body || '')).map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} className="biz-body-copy">{paragraph}</p>
                ))}
              </div>
            </section>
          )
        }
        if (section.type === 'cta' && section.content?.title) {
          const href = String(section.content?.buttonLink || primaryHref)
          return (
            <section key={section.id || index} className="biz-section">
              <div className="biz-container biz-inline-cta">
                <h2>{section.content.title}</h2>
                <a className="biz-button biz-button-accent" href={href}>
                  {section.content?.buttonText || business.ctaText || 'Get in touch'} <ArrowRight size={16} />
                </a>
              </div>
            </section>
          )
        }
        if (section.type === 'image' && section.content?.imageUrl) {
          return (
            <section key={section.id || index} className="biz-section biz-section-paper">
              <div className="biz-container">
                <figure className="biz-custom-image">
                  <img src={section.content.imageUrl} alt={section.content?.caption || business.name} loading="lazy" />
                  {section.content?.caption && <figcaption>{section.content.caption}</figcaption>}
                </figure>
              </div>
            </section>
          )
        }
        return null
      })}

      {business.faq.length > 0 && (
        <section className="biz-section biz-section-paper" id={sectionId('faq')}>
          <div className="biz-container biz-faq-layout">
            <div className="biz-section-head">
              <span className="biz-kicker">Good to know</span>
              <h2>Frequently asked questions</h2>
              <p>Everything you might want to check before reaching out.</p>
            </div>
            <div className="biz-faq-list">
              {business.faq.map((item, index) => (
                <details key={`${item.question}-${index}`} className="biz-faq-item">
                  <summary>{item.question}<span aria-hidden="true">+</span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="biz-contact" id={sectionId('contact')}>
        <div className="biz-container biz-contact-grid">
          <div className="biz-contact-copy">
            <span className="biz-kicker">Get in touch</span>
            <h2>{business.contactHeading || `Talk to ${business.name}`}</h2>
            <p>{business.contactNote || `Have a question or ready to start? Reach out and ${business.name} will get back to you.`}</p>
            <div className="biz-contact-actions">
              {contactEmail && (
                <a className="biz-button biz-button-accent" href={`mailto:${contactEmail}`}>
                  <Mail size={16} /> Email us
                </a>
              )}
              {contactPhone && (
                <a className="biz-button biz-button-outline" href={`tel:${contactPhone.replace(/\s/g, '')}`}>
                  <Phone size={16} /> {contactPhone}
                </a>
              )}
              {whatsappLink && (
                <a className="biz-button biz-button-outline" href={whatsappLink} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="biz-contact-panel">
            {hasContactDetails ? (
              <>
                {addressLine && (
                  <div className="biz-contact-item">
                    <MapPin size={17} />
                    <div><b>Visit us</b><span>{addressLine}</span></div>
                  </div>
                )}
                {contactEmail && (
                  <a className="biz-contact-item" href={`mailto:${contactEmail}`}>
                    <Mail size={17} />
                    <div><b>Email</b><span>{contactEmail}</span></div>
                    <ArrowUpRight size={15} />
                  </a>
                )}
                {contactPhone && (
                  <a className="biz-contact-item" href={`tel:${contactPhone.replace(/\s/g, '')}`}>
                    <Phone size={17} />
                    <div><b>Phone</b><span>{contactPhone}</span></div>
                    <ArrowUpRight size={15} />
                  </a>
                )}
                {contactWebsite && (
                  <a className="biz-contact-item" href={contactWebsite} target="_blank" rel="noreferrer">
                    <Globe2 size={17} />
                    <div><b>Website</b><span>{contactWebsite.replace(/^https?:\/\//i, '')}</span></div>
                    <ArrowUpRight size={15} />
                  </a>
                )}
                {hours.length > 0 && (
                  <div className="biz-contact-item biz-hours">
                    <Clock3 size={17} />
                    <div>
                      <b>Opening hours</b>
                      <ul>
                        {hours.map((slot) => (
                          <li key={slot.day}><span>{slot.day}</span><span>{slot.hours}</span></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {socials.length > 0 && (
                  <div className="biz-socials">
                    {socials.map((social) => (
                      <a key={`${social.label}-${social.url}`} href={social.url} target="_blank" rel="noreferrer">
                        {social.label} <ArrowUpRight size={13} />
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="biz-contact-empty">Contact details are being confirmed. Check back soon.</p>
            )}
          </div>
        </div>
      </section>

      <footer className="biz-footer">
        <div className="biz-container biz-footer-top">
          <div className="biz-footer-brand">
            <a className="biz-brand" href={`#${sectionId('top')}`} onClick={(event) => goTo(event, 'top')}>
              {brand}
            </a>
            {business.footerNote && <p>{business.footerNote}</p>}
          </div>
          <nav className="biz-footer-nav" aria-label="Footer navigation">
            {navItems.map((item) => (
              <a key={item.key} href={`#${sectionId(item.key)}`} onClick={(event) => goTo(event, item.key)}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="biz-footer-contact">
            {contactPhone && <a href={`tel:${contactPhone.replace(/\s/g, '')}`}>{contactPhone}</a>}
            {contactEmail && <a href={`mailto:${contactEmail}`}>{contactEmail}</a>}
            {addressLine && <span>{addressLine}</span>}
          </div>
        </div>
        <div className="biz-container biz-footer-bottom">
          <span>© {CURRENT_YEAR} {business.name}. All rights reserved.</span>
          <span className="biz-footer-bha">
            Business page by <a href="/">Business Hub Africa</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
