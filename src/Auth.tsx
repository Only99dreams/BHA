import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { Brand } from './Brand'
import { getSupabaseClient, hasSupabaseConfig } from './supabase'
import './bha.css'

type AuthScreenProps = { mode: 'login' | 'signup' }

export function AuthScreen({ mode }: AuthScreenProps) {
  const [isSignup, setIsSignup] = useState(mode === 'signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(new URLSearchParams(window.location.search).has('confirmed') ? 'Your email is confirmed. Sign in to continue.' : '')

  // Confirmation links can create the session automatically. If that happened,
  // send the new owner straight into onboarding instead of showing the form again.
  useEffect(() => {
    if (!hasSupabaseConfig) return
    let isCurrent = true
    void getSupabaseClient().auth.getSession().then(({ data }) => {
      if (!isCurrent || !data.session) return
      const justConfirmed = new URLSearchParams(window.location.search).has('confirmed')
      window.location.assign(justConfirmed ? '/onboarding' : '/dashboard')
    })
    return () => { isCurrent = false }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!hasSupabaseConfig) {
      setError('Account access is not configured yet. Add the Supabase project URL and public anon key to continue.')
      return
    }

    setIsSubmitting(true)
    try {
      const client = getSupabaseClient()
      if (isSignup) {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
          },
        })
        if (authError) throw authError
        if (data.session) {
          window.location.assign('/onboarding')
          return
        }
        setNotice('Account created. Check your email for a confirmation link before signing in.')
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
        const next = new URLSearchParams(window.location.search).get('next')
        const currentPath = `${window.location.pathname}${window.location.search}`
        const fallback = window.location.pathname === '/login' || window.location.pathname === '/signup' ? '/dashboard' : currentPath
        const destination = next && next.startsWith('/') ? next : fallback
        window.location.assign(destination && destination.startsWith('/') ? destination : '/dashboard')
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'We could not complete that request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const changeMode = () => {
    setIsSignup(!isSignup)
    setError('')
    setNotice('')
    window.history.replaceState({}, '', isSignup ? '/login' : '/signup')
  }

  return <main className="auth-page">
    <section className="auth-story">
      <Brand className="auth-brand" href="/" />
      <div className="auth-story-copy">
        <span className="eyebrow"><span className="eyebrow-line" /> BUSINESS, WITH A PLACE TO GROW</span>
        <h1>Your next chapter<br />starts <em>here.</em></h1>
        <p>A credible business presence begins with a clear story and a verified identity.</p>
        <div className="auth-trust"><ShieldCheck size={18} /><span>Identity verification is completed securely during business onboarding.</span></div>
      </div>
      <div className="auth-story-image" role="img" aria-label="Business professionals collaborating in a bright workspace" />
      <a className="auth-home-link" href="/">Back to Business Hub Africa <ArrowRight size={14} /></a>
    </section>
    <section className="auth-form-side">
      <div className="auth-form-wrap">
        <span className="auth-kicker">{isSignup ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</span>
        <h2>{isSignup ? 'Make room for growth.' : 'Good to have you back.'}</h2>
        <p className="auth-intro">{isSignup ? 'Start with your account. Add your business details after signing in.' : 'Sign in to continue to your business workspace.'}</p>
        <form className="auth-form" onSubmit={submit}>
          {isSignup && <label className="auth-field"><span>Full name</span><input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" /></label>}
          <label className="auth-field"><span>Email address</span><span className="auth-input-wrap"><Mail size={16} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></span></label>
          <label className="auth-field"><span>Password</span><span className="auth-input-wrap"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /><button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          {error && <p className="auth-message auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-message auth-notice" role="status">{notice}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to Business Hub Africa?'} <button type="button" onClick={changeMode}>{isSignup ? 'Sign in' : 'Create an account'}</button></p>
        {!hasSupabaseConfig && <p className="auth-config-note">Supabase is not connected yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable account access.</p>}
        <p className="auth-legal">By continuing, you agree to use accurate business information. Verification results are reviewed before a public business page is published.</p>
      </div>
    </section>
  </main>
}