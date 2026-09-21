'use client'

import { useState, useMemo } from 'react'
import type { InvoiceForReview } from '@/app/verificacion/page'
import type { InvoiceItem } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

interface InvoiceReviewFormProps {
  invoice: InvoiceForReview
  onSaveSuccess: (invoiceId: string) => void
  onCancel: () => void
}

export default function InvoiceReviewForm({ invoice, onSaveSuccess, onCancel }: InvoiceReviewFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Controles del visor
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

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
      const supabase = createClient()

      // Actualizar la factura (cabecera) y cambiar estado a 'processed'
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          vendor_name: header.vendor_name,
          invoice_number: header.invoice_number,
          invoice_date: header.invoice_date,
          total_amount: header.total_amount,
          status: 'processed'
        })
        .eq('id', invoice.id)

      if (invoiceError) throw new Error(`Error al actualizar factura: ${invoiceError.message}`)

      // Actualizar cada uno de los ítems
      for (const item of payloadItems) {
        const { error: itemError } = await supabase
          .from('invoice_items')
          .update({
            confirmed_name: item.confirmed_name,
            barcode: item.barcode,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          })
          .eq('id', item.id)

        if (itemError) throw new Error(`Error al actualizar ítem: ${itemError.message}`)
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
    <article className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col xl:flex-row min-h-[800px] xl:max-h-[85vh]">
      {/* PANEL IZQUIERDO: Visor de Documento */}
      <div className="w-full xl:w-1/2 border-b xl:border-b-0 xl:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 flex flex-col min-h-[400px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Documento Original</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleZoomOut} className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition" title="Alejar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
            </button>
            <span className="text-xs font-medium text-zinc-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={handleZoomIn} className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition" title="Acercar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
            </button>
            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
            <button type="button" onClick={handleRotate} className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition" title="Rotar">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto relative p-4 flex items-center justify-center">
          <div
            className="transition-transform duration-200 origin-center flex items-center justify-center w-full h-full"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          >
            {isPdf ? (
              <iframe src={invoice.file_url} title="Documento PDF" className="w-full h-[600px] border-0 shadow-lg bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invoice.file_url} alt="Factura" className="max-w-full max-h-[800px] shadow-lg bg-white object-contain" />
            )}
          </div>
        </div>
      </div>

      {/* PANEL DERECHO: Formulario */}
      <div className="w-full xl:w-1/2 flex flex-col bg-white dark:bg-zinc-900 relative">
        <div className="flex flex-col gap-2 border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center justify-between">
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
          </div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            Revisión Manual
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Revisa y corrige los datos extraídos antes de ingresar al inventario.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8 flex-1 overflow-y-auto">
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
      </div>
    </article>
  )
}
