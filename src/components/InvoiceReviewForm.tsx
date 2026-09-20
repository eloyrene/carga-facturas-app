'use client'

import { useState, useMemo } from 'react'
import type { InvoiceForReview } from '@/app/verificacion/page'
import type { InvoiceItem } from '@/lib/supabase/types'

interface InvoiceReviewFormProps {
  invoice: InvoiceForReview
  onSaveSuccess: (invoiceId: string) => void
  onCancel: () => void
}

export default function InvoiceReviewForm({ invoice, onSaveSuccess, onCancel }: InvoiceReviewFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Estado local para la cabecera
  const [header, setHeader] = useState({
    vendor_name: invoice.vendor_name ?? '',
    invoice_number: invoice.invoice_number ?? '',
    invoice_date: invoice.invoice_date ?? '',
    total_amount: invoice.total_amount ?? 0,
  })

  // Estado local para los ítems
  const [items, setItems] = useState<InvoiceItem[]>(invoice.invoice_items || [])

  const handleHeaderChange = (field: keyof typeof header, value: string | number) => {
    setHeader((prev) => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (itemId: string, field: keyof InvoiceItem, value: any) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value }
          if (field === 'quantity' || field === 'unit_price') {
            updatedItem.total_price = Number(
              ((updatedItem.quantity || 0) * (updatedItem.unit_price || 0)).toFixed(2)
            )
          }
          return updatedItem
        }
        return item
      })
    )
  }

  // Calculamos el total de los ítems en tiempo real
  const calculatedTotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.total_price || 0), 0)
  }, [items])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Es importante enviar el 'confirmed_name' para la API de confirmación
    const payloadItems = items.map(item => ({
      ...item,
      confirmed_name: item.confirmed_name ?? item.extracted_name
    }))

    try {
      // Usamos el endpoint centralizado para que también haga el Upsert en el inventario
      const res = await fetch(`/api/invoices/${invoice.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          header,
          items: payloadItems 
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(errData.error || 'Ocurrió un error al confirmar la factura.')
      }

      onSaveSuccess(invoice.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition"
  const isPdf = invoice.file_url.toLowerCase().endsWith('.pdf')

  return (
    <article className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header superior del panel */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 px-6 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              ⚠ Requiere revisión
            </span>
            {invoice.confidence_score && (
              <span className="text-xs text-zinc-500 font-medium">
                Confianza: {Math.round(invoice.confidence_score * 100)}%
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            Revisión Manual
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Revisa y corrige los datos extraídos antes de ingresar al inventario.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPreviewOpen(!previewOpen)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
        >
          {previewOpen ? 'Ocultar documento' : 'Ver documento original'}
        </button>
      </div>

      {previewOpen && (
        <div className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950" style={{ height: '300px' }}>
          {isPdf ? (
            <iframe src={invoice.file_url} title="Documento" className="w-full h-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={invoice.file_url} alt="Factura" className="h-full max-w-full object-contain mx-auto" />
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* SECCIÓN 1: Cabecera de Factura */}
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cabecera de Factura</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Proveedor</label>
              <input
                type="text"
                value={header.vendor_name}
                onChange={(e) => handleHeaderChange('vendor_name', e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Nº Factura</label>
              <input
                type="text"
                value={header.invoice_number}
                onChange={(e) => handleHeaderChange('invoice_number', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Fecha</label>
              <input
                type="date"
                value={header.invoice_date}
                onChange={(e) => handleHeaderChange('invoice_date', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Monto Total</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={header.total_amount}
                  onChange={(e) => handleHeaderChange('total_amount', parseFloat(e.target.value) || 0)}
                  className={`${inputCls} pl-7`}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: Ítems de la Factura */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Ítems a ingresar</h3>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Suma de Ítems: <span className={Math.abs(calculatedTotal - header.total_amount) > 0.1 ? "text-rose-500" : "text-emerald-500"}>${calculatedTotal.toFixed(2)}</span>
            </p>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-zinc-500 italic py-4">No hay ítems detectados en esta factura.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Producto</th>
                    <th className="px-4 py-2 text-left font-medium w-32">Cód. Barras</th>
                    <th className="px-4 py-2 text-right font-medium w-24">Cant.</th>
                    <th className="px-4 py-2 text-right font-medium w-32">Precio Unit.</th>
                    <th className="px-4 py-2 text-right font-medium w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.confirmed_name ?? item.extracted_name}
                          onChange={(e) => handleItemChange(item.id, 'confirmed_name', e.target.value)}
                          className={inputCls}
                          placeholder={item.extracted_name}
                          required
                        />
                        {item.confirmed_name && item.confirmed_name !== item.extracted_name && (
                           <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                             Original: {item.extracted_name}
                           </p>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={item.barcode ?? ''}
                          onChange={(e) => handleItemChange(item.id, 'barcode', e.target.value || null)}
                          className={`${inputCls} font-mono text-xs`}
                          placeholder="—"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.001"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className={`${inputCls} text-right`}
                          required
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          className={`${inputCls} text-right`}
                          required
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        ${(item.total_price || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            Ignorar por ahora
          </button>
          <button
            type="submit"
            disabled={loading || items.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
               <>
                 <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 Confirmando...
               </>
            ) : (
               <>Confirmar e insertar en inventario</>
            )}
          </button>
        </div>
      </form>
    </article>
  )
}
