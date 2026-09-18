import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ProcessInvoiceBody {
  invoiceId: string
  fileUrl: string
  userId: string
}

interface N8nWebhookResponse {
  executionId?: string
  [key: string]: unknown
}

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ProcessInvoiceBody
  try {
    body = (await request.json()) as ProcessInvoiceBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { invoiceId, fileUrl, userId } = body

  if (!invoiceId || typeof invoiceId !== 'string') {
    return Response.json({ error: 'invoiceId is required' }, { status: 400 })
  }
  if (!fileUrl || typeof fileUrl !== 'string') {
    return Response.json({ error: 'fileUrl is required' }, { status: 400 })
  }
  if (!userId || typeof userId !== 'string') {
    return Response.json({ error: 'userId is required' }, { status: 400 })
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, user_id, status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invoiceError || !invoice) {
    return Response.json(
      { error: 'Invoice not found or access denied' },
      { status: 404 },
    )
  }

  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
  if (!n8nWebhookUrl) {
    console.error('[process-invoice] N8N_WEBHOOK_URL is not configured')
    return Response.json(
      { error: 'Webhook service not configured' },
      { status: 503 },
    )
  }

  let n8nResponse: N8nWebhookResponse | null = null

  try {
    const webhookRes = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        invoiceId,
        fileUrl,
        userId,
        triggeredAt: new Date().toISOString(),
      }),
    })

    if (!webhookRes.ok) {
      const text = await webhookRes.text()
      console.error('[process-invoice] n8n webhook error:', webhookRes.status, text)
      throw new Error(`n8n responded with ${webhookRes.status}`)
    }

    n8nResponse = (await webhookRes.json()) as N8nWebhookResponse
  } catch (err) {
    console.error('[process-invoice] Failed to call n8n webhook:', err)

    await (supabase
      .from('invoices' as never) as unknown as {
        update: (doc: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<unknown>
        }
      })
      .update({ status: 'error' })
      .eq('id', invoiceId)

    return Response.json(
      { error: 'Failed to trigger processing workflow' },
      { status: 502 },
    )
  }

  return Response.json(
    {
      success: true,
      invoiceId,
      ...(n8nResponse?.executionId
        ? { n8nJobId: n8nResponse.executionId }
        : {}),
    },
    { status: 200 },
  )
}
