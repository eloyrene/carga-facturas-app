'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// Solo PDF, JPG y PNG según la especificación técnica v2
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
]
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png'
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

type DropPhase = 'idle' | 'dragging' | 'uploading'

interface InvoiceDropzoneProps {
  onSuccess?: (invoiceId: string, fileUrl: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return `Formato no permitido (${file.type || 'desconocido'}). Solo se aceptan: PDF, JPG y PNG.`
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `El archivo supera el límite de ${formatBytes(MAX_FILE_SIZE_BYTES)}. Tamaño actual: ${formatBytes(file.size)}.`
  }
  return null
}

function ProgressRing({ progress }: { progress: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference
  return (
    <svg className="rotate-[-90deg]" width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="5" />
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

export default function InvoiceDropzone({ onSuccess }: InvoiceDropzoneProps) {
  const [phase, setPhase] = useState<DropPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const handleUpload = useCallback(
    async (file: File) => {
      // Validación de archivo
      const validationError = validateFile(file)
      if (validationError) {
        toast.error('Archivo no válido', {
          description: validationError,
        })
        return
      }

      setPhase('uploading')
      setProgress(5)
      setFileName(file.name)

      const toastId = toast.loading('Subiendo factura…', {
        description: `${file.name} (${formatBytes(file.size)})`,
      })

      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        toast.error('No autenticado', {
          id: toastId,
          description: 'Debes iniciar sesión para subir facturas.',
        })
        setPhase('idle')
        return
      }

      const timestamp = Date.now()
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${timestamp}-${safeFileName}`

      setProgress(20)

      // Upload al storage de Supabase
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) {
        toast.error('Error al subir el archivo', {
          id: toastId,
          description: uploadError.message,
        })
        setPhase('idle')
        return
      }

      setProgress(50)

      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(storagePath)

      const fileUrl = urlData?.publicUrl ?? storagePath

      // Crear el registro de la factura en la base de datos
      const { data: invoiceRow, error: dbError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          file_url: fileUrl,
          status: 'pending',
        })
        .select('id')
        .single()

      if (dbError || !invoiceRow) {
        toast.error('Error al registrar la factura', {
          id: toastId,
          description: dbError?.message ?? 'Error desconocido en la base de datos.',
        })
        setPhase('idle')
        return
      }

      setProgress(75)
      toast.loading('Enviando a procesamiento con IA…', {
        id: toastId,
        description: 'Gemini 2.5 Flash está analizando tu factura.',
      })

      // Llamar al webhook de n8n
      try {
        const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL
        if (webhookUrl) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('invoiceId', invoiceRow.id)
          formData.append('userId', user.id)

          const webhookRes = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
          })

          if (webhookRes.ok) {
            // Intentar leer la respuesta de n8n para saber el estado final
            try {
              const result = await webhookRes.json() as { status?: string; confidence_score?: number }
              if (result.status === 'needs_review') {
                toast.warning('Revisión requerida', {
                  id: toastId,
                  description: `La IA detectó baja confianza (${((result.confidence_score ?? 0) * 100).toFixed(0)}%). Ve a Verificación para confirmar los datos.`,
                  duration: 8000,
                })
              } else if (result.status === 'processed') {
                toast.success('Factura procesada con éxito', {
                  id: toastId,
                  description: 'Los datos han sido extraídos y guardados en el inventario.',
                })
              } else {
                toast.success('Factura en procesamiento', {
                  id: toastId,
                  description: 'La IA está analizando tu factura. Los resultados aparecerán en el historial.',
                })
              }
            } catch {
              toast.success('Factura enviada correctamente', {
                id: toastId,
                description: 'El procesamiento con IA comenzará en breve.',
              })
            }
          } else {
            toast.warning('Factura subida, IA pendiente', {
              id: toastId,
              description: 'El archivo fue subido pero el procesamiento automático no pudo iniciarse.',
            })
          }
        } else {
          toast.success('Factura registrada', {
            id: toastId,
            description: 'Archivo guardado. Configura NEXT_PUBLIC_N8N_WEBHOOK_URL para activar la IA.',
          })
        }
      } catch {
        toast.warning('Factura subida, pero la IA no respondió', {
          id: toastId,
          description: 'El archivo fue guardado. Puedes revisar el estado en Historial.',
          duration: 7000,
        })
      }

      setProgress(100)
      onSuccess?.(invoiceRow.id, fileUrl)

      // Resetear el dropzone después de un momento
      setTimeout(() => {
        setPhase('idle')
        setProgress(0)
        setFileName('')
      }, 2000)
    },
    [onSuccess],
  )

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (phase === 'idle') setPhase('dragging')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setPhase('idle')
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
    e.target.value = ''
  }

  const isUploading = phase === 'uploading'

  return (
    <div className="w-full max-w-xl mx-auto">
      <input
        ref={inputRef}
        id="invoice-file-input"
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        aria-label="Seleccionar factura"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Zona para arrastrar y soltar factura"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={isUploading ? undefined : handleDrop}
        onClick={() => {
          if (!isUploading) inputRef.current?.click()
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            inputRef.current?.click()
          }
        }}
        className={[
          'relative flex flex-col items-center justify-center gap-4',
          'rounded-2xl border-2 border-dashed p-10 text-center',
          'select-none outline-none',
          'transition-all duration-300',
          'focus-visible:ring-4 focus-visible:ring-violet-500/50',
          !isUploading ? 'cursor-pointer' : 'cursor-default',
          phase === 'idle'
            ? 'border-zinc-300 bg-zinc-50 hover:border-violet-400 hover:bg-violet-50/40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-500 dark:hover:bg-violet-950/20'
            : phase === 'dragging'
              ? 'border-violet-500 bg-violet-50 scale-[1.01] shadow-lg shadow-violet-200/60 dark:bg-violet-950/30 dark:shadow-violet-900/40'
              : 'border-cyan-400 bg-cyan-50/40 dark:bg-cyan-950/20',
        ].join(' ')}
      >
        {phase === 'idle' && (
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
              {['PDF', 'JPG', 'PNG'].map((ext) => (
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

        {phase === 'dragging' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-400/50 animate-bounce">
              <IconUpload />
            </div>
            <p className="text-base font-bold text-violet-700 dark:text-violet-300">
              ¡Suelta para subir!
            </p>
          </>
        )}

        {phase === 'uploading' && (
          <>
            <div className="relative flex items-center justify-center">
              <ProgressRing progress={progress} />
              <span className="absolute text-sm font-bold text-violet-700 dark:text-violet-300">
                {progress}%
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Procesando…
              </p>
              <p className="mt-0.5 max-w-[240px] truncate text-xs text-zinc-500 dark:text-zinc-400">
                {fileName}
              </p>
            </div>
          </>
        )}
      </div>

      <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
        Tus facturas se almacenan de forma segura y son de acceso privado.
      </p>
    </div>
  )
}
