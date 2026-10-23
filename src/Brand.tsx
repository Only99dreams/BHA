type BrandProps = {
  href?: string
  className?: string
  label?: string
}

export function Brand({ href = '/', className = '', label = 'Business Hub Africa' }: BrandProps) {
  return (
    <a className={`brand-lockup ${className}`} href={href} aria-label={label}>
      <img className="brand-logo-light" src="/logo_nobackgroung.png" alt="" />
      <img className="brand-logo-dark" src="/logo_blackbackground.jpg" alt="" />
      <span className="sr-only">Business Hub Africa, of Tech Groomers Africa</span>
    </a>
  )
}
