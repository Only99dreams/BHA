import { useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { AlertTriangle, Check, Clock3, MessageSquare, Send, Tag } from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

interface FeedbackItem {
  id: string
  type: 'CHANGE_REQUEST' | 'SUGGESTION' | 'ISSUE'
  message: string
  created_at: string
}

export function TaxonomyFeedbackPanel() {
  const [feedbackType, setFeedbackType] = useState<'CHANGE_REQUEST' | 'SUGGESTION' | 'ISSUE'>('SUGGESTION')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey || !message.trim()) return
    setSubmitting(true)
    setError(null)

    const client = createClient(supabaseUrl, supabaseAnonKey)

    // Log feedback as an audit event
    const { error } = await client
      .from('audit_logs')
      .insert({
        action: 'TAXONOMY_FEEDBACK',
        details: { type: feedbackType, message: message.trim() },
      })

    if (error) {
      setError('Failed to submit feedback')
    } else {
      setSuccess('Feedback submitted. Thank you for helping improve the taxonomy.')
      setMessage('')
    }
    setSubmitting(false)
  }, [feedbackType, message])

  return (
    <div className="feedback-panel">
      <div className="taxonomy-header">
        <h2><MessageSquare size={18} /> Taxonomy Feedback</h2>
        <p>Suggest changes, report issues, or propose improvements to the taxonomy. All feedback is logged for governance review.</p>
      </div>

      {error && <div className="taxonomy-alert taxonomy-error" onClick={() => setError(null)}>{error}</div>}
      {success && <div className="taxonomy-alert taxonomy-success" onClick={() => setSuccess(null)}>{success}</div>}

      <div className="feedback-form">
        <label>
          Feedback Type
          <div className="feedback-type-selector">
            {(['SUGGESTION', 'CHANGE_REQUEST', 'ISSUE'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={feedbackType === type ? 'selected' : ''}
                onClick={() => setFeedbackType(type)}
              >
                {type === 'SUGGESTION' && <Tag size={14} />}
                {type === 'CHANGE_REQUEST' && <Tag size={14} />}
                {type === 'ISSUE' && <AlertTriangle size={14} />}
                {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </label>

        <label className="full-width">
          Your Feedback
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Describe the change, suggestion or issue…"
          />
        </label>

        <div className="form-actions">
          <button className="primary-button" onClick={handleSubmit} disabled={submitting || !message.trim()}>
            <Send size={15} /> {submitting ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </div>
      </div>

      <div className="feedback-guidelines">
        <h4>Guidelines</h4>
        <ul>
          <li>Be specific about which category or filter you're referring to.</li>
          <li>Include examples of businesses that would be affected.</li>
          <li>Suggest the desired outcome, not just the problem.</li>
          <li>All feedback is reviewed before taxonomy changes are made.</li>
        </ul>
      </div>
    </div>
  )
}
