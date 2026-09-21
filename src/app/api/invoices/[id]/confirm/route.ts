/**
 * POST /api/invoices/[id]/confirm
 *
 * Confirma manualmente los ítems de una factura con status 'needs_review'.
 * - Valida la sesión del usuario.
 * - Hace upsert de cada ítem corregido en la tabla `products`.
 * - Actualiza `invoice_items` con los datos confirmados.
 * - Cambia el status de la factura a 'processed'.
 */
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { InvoiceItem, InvoiceUpdate } from '@/lib/supabase/types'

interface ConfirmBody {
  header?: {
    vendor_name?: string | null
    invoice_number?: string | null
    invoice_date?: string | null
    total_amount?: number | null
  }
  items: InvoiceItem[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: invoiceId } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verificar que la factura pertenece al usuario y está en needs_review
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('id, user_id, status')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invError || !invoice) {
    return Response.json({ error: 'Invoice not found or access denied' }, { status: 404 })
  }

  if (invoice.status !== 'needs_review') {
    return Response.json(
      { error: `Cannot confirm invoice with status: ${invoice.status}` },
      { status: 409 },
    )
  }

  let body: ConfirmBody
  try {
    body = (await request.json()) as ConfirmBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { items, header } = body

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'items array is required and cannot be empty' }, { status: 400 })
  }

  // ── 0. Opcional: Actualizar cabecera de la factura ────────────────
  const updateInvoicePayload: InvoiceUpdate = {
    status: 'processed',
    ...(header?.vendor_name !== undefined ? { vendor_name: header.vendor_name } : {}),
    ...(header?.invoice_number !== undefined ? { invoice_number: header.invoice_number } : {}),
    ...(header?.invoice_date !== undefined ? { invoice_date: header.invoice_date } : {}),
    ...(header?.total_amount !== undefined ? { total_amount: header.total_amount } : {}),
  }

  // ── 1. Actualizar invoice_items con los datos corregidos ───────────
  for (const item of items) {
    const { error: updateError } = await supabase
      .from('invoice_items')
      .update({
        confirmed_name: item.confirmed_name ?? item.extracted_name,
        barcode: item.barcode ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        is_confirmed: true,
      })
      .eq('id', item.id)
      .eq('invoice_id', invoiceId)

    if (updateError) {
      console.error('[confirm] Error updating invoice_item:', item.id, updateError)
    }
  }

  // ── 2. Upsert en products (solo ítems con barcode o todos) ─────────
  // Se hace upsert de todos los ítems; si no tienen barcode se insertan siempre.
  const productsWithBarcode = items.filter((item) => item.barcode)
  const productsWithoutBarcode = items.filter((item) => !item.barcode)

  // Ítems con barcode → UPSERT por (user_id, barcode) acumulando stock
  if (productsWithBarcode.length > 0) {
    for (const item of productsWithBarcode) {
      // Buscar si ya existe el producto para sumar stock
      const { data: existing } = await supabase
        .from('products')
        .select('id, stock')
        .eq('user_id', user.id)
        .eq('barcode', item.barcode!)
        .single()

      if (existing) {
        await supabase
          .from('products')
          .update({
            name: item.confirmed_name ?? item.extracted_name,
            unit_price: item.unit_price,
            stock: (existing.stock ?? 0) + item.quantity,
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('products').insert({
          user_id: user.id,
          name: item.confirmed_name ?? item.extracted_name,
          barcode: item.barcode,
          unit_price: item.unit_price,
          stock: item.quantity,
        })
      }
    }
  }

  // Ítems sin barcode → INSERT directo sin upsert (no se pueden deduplicar)
  if (productsWithoutBarcode.length > 0) {
    const rows = productsWithoutBarcode.map((item) => ({
      user_id: user.id,
      name: item.confirmed_name ?? item.extracted_name,
      barcode: null,
      unit_price: item.unit_price,
      stock: item.quantity,
    }))

    const { error: insertError } = await supabase.from('products').insert(rows)
    if (insertError) {
      console.error('[confirm] Error inserting products without barcode:', insertError)
    }
  }

  // ── 3. Actualizar el status de la factura a 'processed' (y la cabecera si se envió) ───────────
  const { error: statusError } = await supabase
    .from('invoices')
    .update(updateInvoicePayload)
    .eq('id', invoiceId)

  if (statusError) {
    console.error('[confirm] Error updating invoice status:', statusError)
    return Response.json({ error: 'Failed to update invoice status' }, { status: 500 })
  }

  return Response.json(
    { success: true, invoiceId, itemsConfirmed: items.length },
    { status: 200 },
  )
}
