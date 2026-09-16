/**
 * Tipos TypeScript para las tablas de Supabase
 * Proyecto 4 – Sistema de Gestión de Inventario y Facturas
 */

export type UserRole = 'admin' | 'user'
export type InvoiceStatus = 'pending' | 'processed' | 'error'

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
  total_amount: number | null
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
// inventory_items
// ---------------------------------------------------------------
export interface InventoryItem {
  id: string
  invoice_id: string
  name: string
  description: string | null
  quantity: number
  unit_price: number
  /** Columna generada: quantity * unit_price */
  total_price: number
  sku: string | null
}

export type InventoryItemInsert = Omit<InventoryItem, 'id' | 'total_price'>
export type InventoryItemUpdate = Partial<
  Omit<InventoryItem, 'id' | 'invoice_id' | 'total_price'>
>

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
      }
      invoices: {
        Row: Invoice
        Insert: InvoiceInsert
        Update: InvoiceUpdate
      }
      inventory_items: {
        Row: InventoryItem
        Insert: InventoryItemInsert
        Update: InventoryItemUpdate
      }
    }
  }
}
