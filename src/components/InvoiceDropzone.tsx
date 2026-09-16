'use client'

/**
 * InvoiceDropzone – Componente de carga de facturas
 *
 * Características:
 *  - Drag & Drop nativo (sin librerías externas)
 *  - Selector de archivos como fallback
 *  - Acepta: PDF, JPG, PNG, WebP, TIFF (máx. 10 MB)
 *  - Estados visuales: idle → dragging → uploading → success | error
 *  - Sube el archivo a Supabase Storage (bucket: invoices/{userId}/{filename})
 *  - Inserta fila en tabla `invoices` con status: 'pending'
 *  - Llama a POST /api/webhooks/process-invoice para activar n8n
 */

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, InvoiceStatus } from '@/lib/supabase/types'

// ----------------------------------------------------------------
// Constantes
// ----------------------------------------------------------------
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
]
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.tiff,.tif'
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

// ----------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------
type UploadState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'uploading'; progress: number; fileName: string }
  | { phase: 'success'; fileName: string; invoiceId: string }
  | { phase: 'error'; message: string }

interface InvoiceDropzoneProps {
  /** Callback opcional que se llama tras una subida exitosa */
  onSuccess?: (invoiceId: string, fileUrl: string) => void
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return `Tipo de archivo no permitido. Acepta: PDF, JPG, PNG, WebP, TIFF.`
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `El archivo supera el límite de ${formatBytes(MAX_FILE_SIZE_BYTES)}.`
  }
  return null
}

// ----------------------------------------------------------------
// Componentes internos de UI
// ----------------------------------------------------------------
function ProgressRing({ progress }: { progress: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg className="rotate-[-90deg]" width="72" height="72" viewBox="0 0 72 72">
      {/* Track */}
      <circle
        cx="36" cy="36" r={radius}
        fill="none"
        stroke="rgba(139,92,246,0.15)"
        strokeWidth="5"
      />
      {/* Progress */}
      <circle
        cx="36" cy="36" r={radius}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
      <defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function IconUpload() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function IconError() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

// ----------------------------------------------------------------
// Componente principal
// ----------------------------------------------------------------
export default function InvoiceDropzone({ onSuccess }: InvoiceDropzoneProps) {
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // ------------------------------------------------------------
  // Upload logic
  // ------------------------------------------------------------
  const handleUpload = useCallback(
    async (file: File) => {
      // Validar archivo
      const validationError = validateFile(file)
      if (validationError) {
        setState({ phase: 'error', message: validationError })
        return
      }

      setState({ phase: 'uploading', progress: 0, fileName: file.name })

      const supabase = createClient()

      // 1. Obtener usuario autenticado
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setState({
          phase: 'error',
          message: 'Debes iniciar sesión para subir facturas.',
        })
        return
      }

      // 2. Generar ruta única: {userId}/{timestamp}-{nombre}
      const timestamp = Date.now()
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${timestamp}-${safeFileName}`

      // 3. Subir a Supabase Storage
      setState((prev) =>
        prev.phase === 'uploading' ? { ...prev, progress: 20 } : prev,
      )

      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) {
        setState({
          phase: 'error',
          message: `Error al subir archivo: ${uploadError.message}`,
        })
        return
      }

      setState((prev) =>
        prev.phase === 'uploading' ? { ...prev, progress: 50 } : prev,
      )

      // 4. Obtener URL pública/firmada del archivo
      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(storagePath)

      // Si el bucket es privado usaremos el path; la URL firmada se genera bajo demanda
      const fileUrl = urlData?.publicUrl ?? storagePath

      // 5. Insertar fila en tabla invoices con status 'pending'
      const { data: invoiceRow, error: dbError } = await (supabase as any)
        .from('invoices')
        .insert({
          user_id: user.id,
          file_url: fileUrl,
          status: 'pending',
        })
        .select('id')
        .single()

      if (dbError || !invoiceRow) {
        setState({
          phase: 'error',
          message: `Error al registrar factura: ${dbError?.message ?? 'unknown'}`,
        })
        return
      }

      setState((prev) =>
        prev.phase === 'uploading' ? { ...prev, progress: 75 } : prev,
      )

      // 6. Activar webhook de n8n
      try {
        const webhookRes = await fetch('/api/webhooks/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: invoiceRow.id,
            fileUrl,
            userId: user.id,
          }),
        })

        if (!webhookRes.ok) {
          console.warn('[InvoiceDropzone] Webhook respondió con error:', webhookRes.status)
          // No bloqueamos: la factura ya está en BD, el estado es 'pending'
        }
      } catch (err) {
        console.warn('[InvoiceDropzone] Error al llamar webhook:', err)
      }

      setState((prev) =>
        prev.phase === 'uploading' ? { ...prev, progress: 100 } : prev,
      )

      // 7. Estado final: éxito
      setState({ phase: 'success', fileName: file.name, invoiceId: invoiceRow.id })
      onSuccess?.(invoiceRow.id, fileUrl)
    },
    [onSuccess],
  )

  // ------------------------------------------------------------
  // Drag & Drop handlers
  // ------------------------------------------------------------
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (state.phase === 'idle') {
      setState({ phase: 'dragging' })
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setState({ phase: 'idle' })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    const file = e.dataTransfer.files[0]
    if (file) void handleUpload(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleUpload(file)
    // Reset input para permitir re-subir el mismo archivo
    e.target.value = ''
  }

  const handleReset = () => {
    dragCounterRef.current = 0
    setState({ phase: 'idle' })
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Input oculto */}
      <input
        ref={inputRef}
        id="invoice-file-input"
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        aria-label="Seleccionar factura"
        onChange={handleFileChange}
      />

      {/* Zona de drop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona para arrastrar y soltar factura"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={state.phase === 'uploading' ? undefined : handleDrop}
        onClick={() => {
          if (state.phase === 'idle' || state.phase === 'dragging') {
            inputRef.current?.click()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            inputRef.current?.click()
          }
        }}
        className={[
          'relative flex flex-col items-center justify-center gap-4',
          'rounded-2xl border-2 border-dashed p-10 text-center',
          'cursor-pointer select-none outline-none',
          'transition-all duration-300',
          // Anillo de foco para accesibilidad
          'focus-visible:ring-4 focus-visible:ring-violet-500/50',
          // Variantes de estado
          state.phase === 'idle'
            ? 'border-zinc-300 bg-zinc-50 hover:border-violet-400 hover:bg-violet-50/40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-500 dark:hover:bg-violet-950/20'
            : state.phase === 'dragging'
              ? 'border-violet-500 bg-violet-50 scale-[1.01] shadow-lg shadow-violet-200/60 dark:bg-violet-950/30 dark:shadow-violet-900/40'
              : state.phase === 'uploading'
                ? 'border-cyan-400 bg-cyan-50/40 cursor-default dark:bg-cyan-950/20'
                : state.phase === 'success'
                  ? 'border-emerald-400 bg-emerald-50/50 cursor-default dark:bg-emerald-950/20'
                  : 'border-rose-400 bg-rose-50/50 cursor-default dark:bg-rose-950/20',
        ].join(' ')}
      >
        {/* ---- IDLE ---- */}
        {state.phase === 'idle' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-md shadow-violet-300/40">
              <IconUpload />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-700 dark:text-zinc-200">
                Arrastra tu factura aquí
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                o{' '}
                <span className="font-medium text-violet-600 dark:text-violet-400 underline underline-offset-2">
                  haz clic para seleccionar
                </span>
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
              {['PDF', 'JPG', 'PNG', 'WebP', 'TIFF'].map((ext) => (
                <span
                  key={ext}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {ext}
                </span>
              ))}
              <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 dark:border-zinc-700 dark:bg-zinc-800">
                Máx 10 MB
              </span>
            </div>
          </>
        )}

        {/* ---- DRAGGING ---- */}
        {state.phase === 'dragging' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-400/50 animate-bounce">
              <IconUpload />
            </div>
            <p className="text-base font-bold text-violet-700 dark:text-violet-300">
              ¡Suelta para subir!
            </p>
          </>
        )}

        {/* ---- UPLOADING ---- */}
        {state.phase === 'uploading' && (
          <>
            <div className="relative flex items-center justify-center">
              <ProgressRing progress={state.progress} />
              <span className="absolute text-sm font-bold text-violet-700 dark:text-violet-300">
                {state.progress}%
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Subiendo…
              </p>
              <p className="mt-0.5 max-w-[240px] truncate text-xs text-zinc-500 dark:text-zinc-400">
                {state.fileName}
              </p>
            </div>
          </>
        )}

        {/* ---- SUCCESS ---- */}
        {state.phase === 'success' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-300/40">
              <IconCheck />
            </div>
            <div>
              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                ¡Factura recibida!
              </p>
              <p className="mt-0.5 max-w-[240px] truncate text-xs text-zinc-500 dark:text-zinc-400">
                {state.fileName}
              </p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">
                En procesamiento con IA…
              </p>
            </div>
            <button
              id="dropzone-reset-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
              }}
              className="mt-1 rounded-lg bg-emerald-100 px-4 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900"
            >
              Subir otra factura
            </button>
          </>
        )}

        {/* ---- ERROR ---- */}
        {state.phase === 'error' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-md shadow-rose-300/40">
              <IconError />
            </div>
            <div>
              <p className="text-base font-bold text-rose-700 dark:text-rose-400">
                Error al subir
              </p>
              <p className="mt-1 max-w-[280px] text-xs text-rose-600 dark:text-rose-500">
                {state.message}
              </p>
            </div>
            <button
              id="dropzone-retry-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
              }}
              className="mt-1 rounded-lg bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900"
            >
              Intentar de nuevo
            </button>
          </>
        )}
      </div>

      {/* Info de accesibilidad */}
      <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
        Tus facturas se almacenan de forma segura y son de acceso privado.
      </p>
    </div>
  )
}
