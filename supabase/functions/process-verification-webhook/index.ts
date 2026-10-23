// ============================================================================
// BHA Prembly Verification Webhook Handler
// Receives verification results from Prembly and updates business records.
// ============================================================================

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const { business_id, status, reference, result } = payload

    if (!business_id || !status) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Map Prembly status to BHA status
    const verificationStatus = status === 'VERIFIED' ? 'VERIFIED' : status === 'FAILED' ? 'VERIFICATION_FAILED' : 'MANUAL_REVIEW'

    // Update verification record
    await supabase
      .from('business_verifications')
      .update({
        status: verificationStatus,
        provider_reference: reference,
        result: result || {},
        verified_at: verificationStatus === 'VERIFIED' ? new Date().toISOString() : null,
      })
      .eq('business_id', business_id)

    // Update business verification status
    await supabase
      .from('businesses')
      .update({
        verification_status: verificationStatus,
        is_verified: verificationStatus === 'VERIFIED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', business_id)

    // Log audit event
    await supabase
      .from('audit_logs')
      .insert({
        action: 'VERIFICATION_RESULT',
        business_id,
        details: { status: verificationStatus, reference, provider: 'PREMBLY' },
      })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('Verification webhook error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
