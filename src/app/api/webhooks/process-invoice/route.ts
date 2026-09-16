/**
 * Route Handler: POST /api/webhooks/process-invoice
 *
 * Recibe la notificación de nueva factura y dispara el workflow de n8n
 * para la extracción de datos con OCR/IA.
 *
 * Body esperado (JSON):
 *   { invoiceId: string, fileUrl: string, userId: string }
 *
 * Responde:
 *   200 { success: true, n8nJobId?: string }
 *   400 { error: string }
 *   401 { error: 'Unauthorized' }
 *   500 { error: string }
 */
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { InvoiceStatus } from '@/lib/supabase/types'

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------
interface ProcessInvoiceBody {
  invoiceId: string
  fileUrl: string
  userId: string
}

interface N8nWebhookResponse {
  /** n8n puede devolver un execution id */
  executionId?: string
  [key: string]: unknown
}

// ----------------------------------------------------------------
// POST handler
// ----------------------------------------------------------------
export async function POST(request: NextRequest): Promise<Response> {
  // 1. Verificar autenticación
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parsear y validar body
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

  // 3. Verificar que la factura pertenece al usuario autenticado
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

  // 4. Disparar webhook de n8n
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
        // Opcional: clave secreta para validar que el request viene de tu app
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

    // Marcar la factura como 'error' si el webhook falló
    await (supabase as any)
      .from('invoices')
      .update({ status: 'error' })
      .eq('id', invoiceId)

    return Response.json(
      { error: 'Failed to trigger processing workflow' },
      { status: 502 },
    )
  }

  // 5. Respuesta exitosa
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
