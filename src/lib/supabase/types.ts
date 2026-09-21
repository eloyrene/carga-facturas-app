/**
 * Tipos TypeScript para las tablas de Supabase
 * Proyecto 4 – Sistema de Gestión de Inventario y Facturas
 * Versión 2 – Incluye invoice_items, products, confidence_score
 */

export type UserRole = 'admin' | 'user'

/**
 * Estados de la factura:
 * - pending: recién subida, esperando procesamiento de n8n
 * - processed: procesada correctamente con confidence >= 0.8
 * - needs_review: confianza < 0.8 o documento ilegible; requiere verificación humana
 * - failed: error irrecuperable en el pipeline de n8n
 */
export type InvoiceStatus = 'pending' | 'processed' | 'needs_review' | 'failed'

// ---------------------------------------------------------------
// profiles
// ---------------------------------------------------------------
export type Profile = {
  id: string
  email: string
  role: UserRole
  created_at: string
}

export type ProfileInsert = {
  id?: string
  email: string
  role?: UserRole
  created_at?: string
}

export type ProfileUpdate = {
  id?: string
  email?: string
  role?: UserRole
  created_at?: string
}

// ---------------------------------------------------------------
// invoices
// ---------------------------------------------------------------
export type Invoice = {
  id: string
  user_id: string
  invoice_number: string | null
  vendor_name: string | null
  /** Fecha de emisión extraída por la IA (formato YYYY-MM-DD) */
  invoice_date: string | null
  total_amount: number | null
  /** Score de confianza de lectura devuelto por Gemini: 0.000 – 1.000 */
  confidence_score: number | null
  status: InvoiceStatus
  raw_json: Record<string, unknown> | null
  file_url: string
  created_at: string
}

export type InvoiceInsert = {
  id?: string
  user_id: string
  file_url: string
  invoice_number?: string | null
  vendor_name?: string | null
  invoice_date?: string | null
  total_amount?: number | null
  confidence_score?: number | null
  status?: InvoiceStatus
  raw_json?: Record<string, unknown> | null
  created_at?: string
}

export type InvoiceUpdate = {
  id?: string
  user_id?: string
  file_url?: string
  invoice_number?: string | null
  vendor_name?: string | null
  invoice_date?: string | null
  total_amount?: number | null
  confidence_score?: number | null
  status?: InvoiceStatus
  raw_json?: Record<string, unknown> | null
  created_at?: string
}

// ---------------------------------------------------------------
// invoice_items
// ---------------------------------------------------------------
export type InvoiceItem = {
  id: string
  invoice_id: string
  /** Nombre tal como lo leyó la IA */
  extracted_name: string
  /** Código de barras / SKU si estaba visible en el documento */
  barcode: string | null
  quantity: number
  unit_price: number
  /** Columna generada: quantity * unit_price */
  total_price: number
  /** Nombre corregido manualmente por el usuario */
  confirmed_name: string | null
  /** true cuando el usuario confirma el ítem y se inserta en products */
  is_confirmed: boolean
}

export type InvoiceItemInsert = {
  id?: string
  invoice_id: string
  extracted_name: string
  barcode?: string | null
  quantity?: number
  unit_price?: number
  total_price?: number
  confirmed_name?: string | null
  is_confirmed?: boolean
}

export type InvoiceItemUpdate = {
  id?: string
  invoice_id?: string
  extracted_name?: string
  barcode?: string | null
  quantity?: number
  unit_price?: number
  total_price?: number
  confirmed_name?: string | null
  is_confirmed?: boolean
}

// ---------------------------------------------------------------
// products
// ---------------------------------------------------------------
export type Product = {
  id: string
  user_id: string
  name: string
  barcode: string | null
  stock: number
  unit_price: number
  updated_at: string
  created_at: string
}

export type ProductInsert = {
  id?: string
  user_id: string
  name: string
  barcode?: string | null
  stock?: number
  unit_price?: number
  updated_at?: string
  created_at?: string
}

export type ProductUpdate = {
  id?: string
  user_id?: string
  name?: string
  barcode?: string | null
  stock?: number
  unit_price?: number
  updated_at?: string
  created_at?: string
}

// ---------------------------------------------------------------
// Database – tipo genérico para el cliente Supabase
// ---------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      invoices: {
        Row: Invoice
        Insert: InvoiceInsert
        Update: InvoiceUpdate
        Relationships: []
      }
      invoice_items: {
        Row: InvoiceItem
        Insert: InvoiceItemInsert
        Update: InvoiceItemUpdate
        Relationships: []
      }
      products: {
        Row: Product
        Insert: ProductInsert
        Update: ProductUpdate
        Relationships: []
      }
    }
    Views: Record<string, any>
    Functions: Record<string, any>
    Enums: Record<string, any>
    CompositeTypes: Record<string, any>
  }
}
