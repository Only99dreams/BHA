// ============================================================================
// BHA Flutterwave Payment Webhook Handler
// Verifies payments, activates subscriptions, never auto-publishes pages.
// ============================================================================

const FLW_SECRET_HASH = Deno.env.get('FLW_SECRET_HASH') || ''

Deno.serve(async (req) => {
  // Verify webhook signature
  const signature = req.headers.get('verif-hash')
  if (signature !== FLW_SECRET_HASH) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 })
  }

  try {
    const { event, data } = await req.json()

    if (event !== 'charge.completed') {
      return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 })
    }

    if (data.status !== 'successful') {
      return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 })
    }

    const txRef = data.tx_ref
    const flutterwaveRef = data.id?.toString()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find the payment record by our reference
    const { data: payment, error: payError } = await supabase
      .from('payments')
      .select('*, subscriptions(*)')
      .eq('reference', txRef)
      .single()

    if (payError || !payment) {
      console.error('Payment not found:', txRef)
      return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404 })
    }

    // Idempotency check
    if (payment.status === 'SUCCESSFUL') {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
    }

    // Update payment record
    await supabase
      .from('payments')
      .update({
        status: 'SUCCESSFUL',
        provider_reference: flutterwaveRef,
        verified_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    // Activate subscription
    if (payment.subscription_id) {
      const plan = payment.subscriptions
      const now = new Date()
      const endDate = new Date(now)
      endDate.setFullYear(endDate.getFullYear() + 1)

      await supabase
        .from('subscriptions')
        .update({
          status: 'ACTIVE',
          starts_at: now.toISOString(),
          ends_at: endDate.toISOString(),
        })
        .eq('id', payment.subscription_id)
    }

    // Update business payment status — but do NOT publish
    await supabase
      .from('businesses')
      .update({
        payment_status: 'PAID',
        status: 'PAID',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.business_id)

    // Log audit event
    await supabase
      .from('audit_logs')
      .insert({
        action: 'PAYMENT_SUCCESS',
        business_id: payment.business_id,
        details: { tx_ref: txRef, amount: payment.amount, currency: payment.currency, flutterwave_ref: flutterwaveRef },
      })

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('Webhook processing error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
