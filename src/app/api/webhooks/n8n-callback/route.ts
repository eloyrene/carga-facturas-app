/**
 * POST /api/webhooks/n8n-callback
 *
 * n8n llama a este endpoint cuando termina el procesamiento de una factura.
 * Se autentica con un secreto compartido (N8N_CALLBACK_SECRET).
 *
 * Body esperado de n8n:
 * {
 *   "invoiceId": "uuid",
 *   "status": "processed" | "needs_review" | "failed",
 *   "confidence_score": 0.95
 * }
 *
 * Este endpoint usa el Service Role key para saltarse RLS,
 * ya que n8n no tiene sesión de usuario de Supabase.
 */
import type { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database, InvoiceStatus } from '@/lib/supabase/types'

interface CallbackBody {
  invoiceId: string
  status: InvoiceStatus
  confidence_score?: number
}

export async function POST(request: NextRequest): Promise<Response> {
  // Verificar secreto compartido
  const secret = request.headers.get('x-callback-secret')
  const expectedSecret = process.env.N8N_CALLBACK_SECRET

  if (expectedSecret && secret !== expectedSecret) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CallbackBody
  try {
    body = (await request.json()) as CallbackBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { invoiceId, status, confidence_score } = body

  if (!invoiceId || typeof invoiceId !== 'string') {
    return Response.json({ error: 'invoiceId is required' }, { status: 400 })
  }

  const validStatuses: InvoiceStatus[] = ['pending', 'processed', 'needs_review', 'failed']
  if (!validStatuses.includes(status)) {
    return Response.json({ error: `Invalid status: ${status}` }, { status: 400 })
  }

  // Usar el Service Role key para que n8n pueda actualizar sin RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[n8n-callback] Missing SUPABASE_SERVICE_ROLE_KEY in environment')
    return Response.json(
      { error: 'Server configuration error' },
      { status: 503 },
    )
  }

  const supabase = createServiceClient<Database>(supabaseUrl, serviceRoleKey)

  const updatePayload: Record<string, unknown> = { status }
  if (typeof confidence_score === 'number') {
    updatePayload.confidence_score = confidence_score
  }

  const { error } = await supabase
    .from('invoices')
    .update(updatePayload)
    .eq('id', invoiceId)

  if (error) {
    console.error('[n8n-callback] Failed to update invoice:', error)
    return Response.json(
      { error: 'Failed to update invoice status' },
      { status: 500 },
    )
  }

  console.info(`[n8n-callback] Invoice ${invoiceId} updated to status: ${status}`)

  return Response.json({ success: true, invoiceId, status }, { status: 200 })
}
