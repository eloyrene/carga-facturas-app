import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import VerificationClient from '@/components/VerificationClient'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'

export const metadata: Metadata = {
  title: 'Verificación Humana',
  description: 'Revisa y confirma las facturas que requieren validación manual antes de insertarlas en el inventario.',
}

export type InvoiceForReview = Invoice & { invoice_items: InvoiceItem[] }

export default async function VerificacionPage() {
  const supabase = await createClient()

  // Traer solo las del día actual con status 'needs_review'
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      id,
      user_id,
      invoice_number,
      vendor_name,
      invoice_date,
      total_amount,
      confidence_score,
      status,
      raw_json,
      file_url,
      created_at,
      invoice_items (
        id,
        invoice_id,
        extracted_name,
        barcode,
        quantity,
        unit_price,
        total_price,
        confirmed_name,
        is_confirmed
      )
    `)
    .eq('status', 'needs_review')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })

  return (
    <AppShell>
      <VerificationClient invoices={(invoices as InvoiceForReview[]) ?? []} />
    </AppShell>
  )
}
