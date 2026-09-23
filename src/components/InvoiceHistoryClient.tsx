'use client'

import { useState, useMemo, useEffect } from 'react'
import type { InvoiceWithItems } from '@/app/historial/page'
import type { InvoiceItem } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

// Extrae la fecha local (YYYY-MM-DD) de una ISO timestamp
function isoToLocalDate(iso: string): string {
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Helpers ────────────────────────────────────────────────────────
function formatCurrency(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(iso))
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

// ── StatusBadge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    processed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
    needs_review: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
    pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400',
  }
  const labels: Record<string, string> = {
    processed: 'Procesada',
    needs_review: 'Revisión',
    pending: 'Pendiente',
    failed: 'Fallida',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? styles.pending}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── ConfidenceBar ──────────────────────────────────────────────────
function ConfidenceBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-zinc-400">—</span>
  const pct = Math.round(score * 100)
  const color = score >= 0.8 ? 'bg-emerald-500' : score >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{pct}%</span>
    </div>
  )
}

// ── CSV Export ─────────────────────────────────────────────────────
function exportToCSV(invoices: InvoiceWithItems[]) {
  const rows: string[][] = []

  // Headers
  rows.push([
    'ID Factura', 'Proveedor', 'Nº Factura', 'Fecha Factura', 'Monto Total',
    'Estado', 'Confianza IA', 'Fecha Carga',
    'Item: Nombre Extraído', 'Item: Código Barras', 'Item: Cantidad', 'Item: Precio Unitario', 'Item: Total'
  ])

  for (const inv of invoices) {
    if (!inv.invoice_items || inv.invoice_items.length === 0) {
      rows.push([
        inv.id, inv.vendor_name ?? '', inv.invoice_number ?? '',
        inv.invoice_date ?? '', String(inv.total_amount ?? ''),
        inv.status, String(inv.confidence_score ?? ''),
        inv.created_at,
        '', '', '', '', ''
      ])
    } else {
      for (const item of inv.invoice_items) {
        rows.push([
          inv.id, inv.vendor_name ?? '', inv.invoice_number ?? '',
          inv.invoice_date ?? '', String(inv.total_amount ?? ''),
          inv.status, String(inv.confidence_score ?? ''),
          inv.created_at,
          item.extracted_name, item.barcode ?? '',
          String(item.quantity), String(item.unit_price), String(item.total_price)
        ])
      }
    }
  }

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `facturas_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Invoice Detail Sheet ───────────────────────────────────────────
function InvoiceSheet({
  invoice,
  onClose,
}: {
  invoice: InvoiceWithItems
  onClose: () => void
}) {
  const isPdf = invoice.file_url?.toLowerCase().endsWith('.pdf') ?? false
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  // URL firmada para buckets privados de Supabase
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [signedUrlLoading, setSignedUrlLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchSignedUrl() {
      setSignedUrlLoading(true)
      setImgError(false)
      setImgLoaded(false)
      try {
        if (!invoice.file_url) {
          setSignedUrl(null)
          return
        }
        // Extraer el path relativo desde la URL pública almacenada
        // Formato típico: https://<project>.supabase.co/storage/v1/object/public/invoices/<user_id>/<file>
        // o bien puede ser ya una URL firmada o el storagePath directo
        const supabase = createClient()
        let storagePath: string
        const match = invoice.file_url.match(/\/storage\/v1\/object\/(public|sign)\/invoices\/(.+?)(?:\?|$)/)
        if (match) {
          storagePath = match[2]
        } else if (!invoice.file_url.startsWith('http')) {
          storagePath = invoice.file_url
        } else {
          // Fallback: intentar mostrar directamente la URL guardada
          setSignedUrl(invoice.file_url)
          return
        }
        const { data, error } = await supabase.storage
          .from('invoices')
          .createSignedUrl(storagePath, 3600) // válida por 1 hora
        if (!cancelled) {
          if (error || !data?.signedUrl) {
            // Fallback a la URL original si falla la firma
            setSignedUrl(invoice.file_url)
          } else {
            setSignedUrl(data.signedUrl)
          }
        }
      } catch {
        if (!cancelled) setSignedUrl(invoice.file_url)
      } finally {
        if (!cancelled) setSignedUrlLoading(false)
      }
    }
    void fetchSignedUrl()
    return () => { cancelled = true }
  }, [invoice.file_url])

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de factura"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {invoice.vendor_name ?? 'Factura sin proveedor'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {invoice.invoice_number ? `Nº ${invoice.invoice_number}` : 'Sin número'} · {formatDate(invoice.invoice_date)}
            </p>
          </div>
          <button
            id="invoice-sheet-close"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* File Preview */}
          <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 overflow-auto flex items-center justify-center relative">
            {signedUrlLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-500" />
                <p className="text-xs text-zinc-400">Cargando vista previa…</p>
              </div>
            ) : !signedUrl ? (
              <div className="text-center px-6">
                <span className="text-4xl mb-3 block">📎</span>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay archivo adjunto</p>
              </div>
            ) : isPdf ? (
              <iframe
                src={signedUrl}
                title="Factura PDF"
                className="h-full w-full min-h-[300px]"
                onError={() => setImgError(true)}
              />
            ) : imgError ? (
              <div className="text-center px-6 py-8">
                <span className="text-4xl mb-3 block">🖼️</span>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
                  No se pudo cargar la vista previa
                </p>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Abrir en nueva pestaña
                </a>
              </div>
            ) : (
              <>
                {!imgLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-950">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-500" />
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signedUrl}
                  alt="Imagen de factura"
                  className={`max-h-full max-w-full object-contain m-auto block p-4 transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                />
              </>
            )}
          </div>

          {/* Data Panel */}
          <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Summary */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Datos extraídos</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Estado</dt>
                    <dd><StatusBadge status={invoice.status} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Confianza IA</dt>
                    <dd><ConfidenceBar score={invoice.confidence_score} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Total</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-white">{formatCurrency(invoice.total_amount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Cargada</dt>
                    <dd className="text-zinc-700 dark:text-zinc-300">{formatDateTime(invoice.created_at)}</dd>
                  </div>
                </dl>
              </div>

              {/* Items */}
              {invoice.invoice_items && invoice.invoice_items.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Ítems ({invoice.invoice_items.length})
                  </h3>
                  <div className="space-y-2">
                    {invoice.invoice_items.map((item: InvoiceItem) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3 text-xs space-y-1"
                      >
                        <p className="font-medium text-zinc-800 dark:text-zinc-100 leading-tight">
                          {item.confirmed_name ?? item.extracted_name}
                        </p>
                        {item.barcode && (
                          <p className="font-mono text-zinc-400 dark:text-zinc-500">{item.barcode}</p>
                        )}
                        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                          <span>{item.quantity} × {formatCurrency(item.unit_price)}</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatCurrency(item.total_price)}</span>
                        </div>
                        {item.is_confirmed && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            Confirmado
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// ── Main Client Component ──────────────────────────────────────────
interface Props {
  invoices: InvoiceWithItems[]
}

export default function InvoiceHistoryClient({ invoices }: Props) {
  const [vendorFilter, setVendorFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithItems | null>(null)

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (vendorFilter && !inv.vendor_name?.toLowerCase().includes(vendorFilter.toLowerCase())) return false
      if (statusFilter && inv.status !== statusFilter) return false
      // Convertir la timestamp a fecha local antes de comparar
      const invLocalDate = isoToLocalDate(inv.created_at)
      if (dateFrom && invLocalDate < dateFrom) return false
      if (dateTo && invLocalDate > dateTo) return false
      return true
    })
  }, [invoices, vendorFilter, dateFrom, dateTo, statusFilter])

  const inputCls = 'rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-shadow'

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Historial de Facturas</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {filtered.length} de {invoices.length} facturas
          </p>
        </div>
        <button
          id="export-csv-btn"
          onClick={() => exportToCSV(filtered)}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm shadow-violet-500/20"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          id="filter-vendor"
          type="text"
          placeholder="Buscar proveedor…"
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className={inputCls}
        />
        <select
          id="filter-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={inputCls}
        >
          <option value="">Todos los estados</option>
          <option value="processed">Procesada</option>
          <option value="needs_review">Revisión requerida</option>
          <option value="pending">Pendiente</option>
          <option value="failed">Fallida</option>
        </select>
        <input
          id="filter-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={inputCls}
        />
        <input
          id="filter-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Sin resultados</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Ajusta los filtros para encontrar facturas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {['Proveedor', 'Nº Factura', 'Fecha', 'Monto total', 'Confianza', 'Estado', 'Acción'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 max-w-[180px] truncate">
                      {inv.vendor_name ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-mono text-xs whitespace-nowrap">
                      {inv.invoice_number ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {formatDate(inv.invoice_date)}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 font-semibold whitespace-nowrap">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-6 py-4">
                      <ConfidenceBar score={inv.confidence_score} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-4">
                      <button
                        id={`view-invoice-${inv.id}`}
                        onClick={() => setSelectedInvoice(inv)}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Ver factura
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sheet */}
      {selectedInvoice && (
        <InvoiceSheet
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  )
}
