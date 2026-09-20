import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import InvoiceHistoryClient from '@/components/InvoiceHistoryClient'
import type { Invoice, InvoiceItem } from '@/lib/supabase/types'

export const metadata: Metadata = {
  title: 'Historial de Facturas',
  description: 'Listado completo de facturas procesadas con filtros y exportación CSV.',
}

export type InvoiceWithItems = Invoice & { invoice_items: InvoiceItem[] }

export default async function HistorialPage() {
  const supabase = await createClient()

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
    .order('created_at', { ascending: false })

  return (
    <AppShell>
      <InvoiceHistoryClient invoices={(invoices as InvoiceWithItems[]) ?? []} />
    </AppShell>
  )
}
