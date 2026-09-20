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
export interface Profile {
  id: string
  email: string
  role: UserRole
  created_at: string
}

export type ProfileInsert = Omit<Profile, 'created_at'>
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>

// ---------------------------------------------------------------
// invoices
// ---------------------------------------------------------------
export interface Invoice {
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

export type InvoiceInsert = Pick<Invoice, 'user_id' | 'file_url'> &
  Partial<Omit<Invoice, 'id' | 'user_id' | 'file_url' | 'created_at'>>

export type InvoiceUpdate = Partial<
  Omit<Invoice, 'id' | 'user_id' | 'created_at'>
>

// ---------------------------------------------------------------
// invoice_items
//   Ítems extraídos directamente por la IA de cada factura.
//   (Renombrado de "inventory_items" en el esquema v1)
//   Los campos confirmed_name e is_confirmed son usados
//   por el Módulo de Verificación Humana.
// ---------------------------------------------------------------
export interface InvoiceItem {
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

export type InvoiceItemInsert = Omit<InvoiceItem, 'id' | 'total_price'>
export type InvoiceItemUpdate = Partial<
  Omit<InvoiceItem, 'id' | 'invoice_id' | 'total_price'>
>

// ---------------------------------------------------------------
// products
//   Maestro de catálogo / inventario confirmado.
//   Se pobla a partir de los invoice_items verificados.
// ---------------------------------------------------------------
export interface Product {
  id: string
  user_id: string
  name: string
  barcode: string | null
  stock: number
  unit_price: number
  updated_at: string
  created_at: string
}

export type ProductInsert = Omit<Product, 'id' | 'updated_at' | 'created_at'>
export type ProductUpdate = Partial<Omit<Product, 'id' | 'user_id' | 'created_at'>>

// ---------------------------------------------------------------
// Database – tipo genérico para el cliente Supabase
// ---------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: any[]
      }
      invoices: {
        Row: Invoice
        Insert: InvoiceInsert
        Update: InvoiceUpdate
        Relationships: any[]
      }
      invoice_items: {
        Row: InvoiceItem
        Insert: InvoiceItemInsert
        Update: InvoiceItemUpdate
        Relationships: any[]
      }
      products: {
        Row: Product
        Insert: ProductInsert
        Update: ProductUpdate
        Relationships: any[]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
