# Guía de Configuración del Flujo n8n

> **Versión**: 2.0  
> **Integración**: n8n + Gemini 3.6 Flash + Supabase  
> **Proyecto**: Sistema de Gestión de Inventario y Facturas

---

## Arquitectura del Flujo

```
[Webhook Trigger]
      │
      ▼
[Fetch File from URL]     ← descarga el binario desde Supabase Storage
      │
      ▼
[Binary → Base64]         ← nodo Code de n8n
      │
      ▼
[HTTP Request → Gemini]   ← REST API con imagen/PDF en Base64
      │
      ▼
[Parse & Sanitize JSON]   ← elimina delimitadores ```json de Markdown
      │
      ▼
[Evaluar Confianza]       ← nodo Code: asigna status según confidence_score
      │
      ├──► [PATCH invoices en Supabase]     ← actualiza estado + datos extraídos
      │
      └──► [INSERT invoice_items]           ← inserta ítems extraídos
                │
                └──► [UPSERT products]      ← actualiza stock si hay barcode
      │
      ▼
[Llamar n8n-callback]     ← notifica al frontend el estado final
      │
      ▼
[Respond to Webhook]      ← devuelve JSON 200 OK
```

---

## Nodo 1: Webhook Trigger

- **HTTP Method**: POST  
- **Path**: `/invoice-process` (configura tu propio path)  
- **Authentication**: Header Auth con `x-webhook-secret` (coincide con `N8N_WEBHOOK_SECRET` en `.env.local`)  
- **Response Mode**: `Using 'Respond to Webhook' Node`

**Datos que recibirá del frontend:**
```json
{
  "invoiceId": "uuid-de-la-factura",
  "fileUrl": "https://...supabase.co/storage/v1/object/invoices/userId/filename.pdf",
  "userId": "uuid-del-usuario",
  "triggeredAt": "2026-09-19T21:00:00.000Z"
}
```

---

## Nodo 2: Fetch File (HTTP Request)

- **Method**: GET  
- **URL**: `{{ $json.fileUrl }}`  
- **Response Format**: `File`  
- **Output Binary Field**: `data`

> Necesitas pasar el header de autenticación de Supabase si el bucket **no es público**:  
> `Authorization: Bearer <SUPABASE_ANON_KEY>`  
> `apikey: <SUPABASE_ANON_KEY>`

---

## Nodo 3: Binary → Base64 (Code Node - JavaScript)

```javascript
const binaryData = $input.first().binary.data;
const buffer = await this.helpers.getBinaryDataBuffer($input.first(), 'data');
const base64 = buffer.toString('base64');
const mimeType = binaryData.mimeType;

return [{
  json: {
    ...$input.first().json,
    fileBase64: base64,
    fileMimeType: mimeType,
  }
}];
```

---

## Nodo 4: HTTP Request → Gemini 3.6 Flash

- **Method**: POST  
- **URL**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=YOUR_GEMINI_API_KEY`  
- **Content-Type**: `application/json`

**Body (JSON):**
```json
{
  "contents": [
    {
      "parts": [
        {
          "inline_data": {
            "mime_type": "{{ $json.fileMimeType }}",
            "data": "{{ $json.fileBase64 }}"
          }
        },
        {
          "text": "Analiza este documento de factura comercial. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código Markdown (no uses ```json), sin explicaciones. El JSON debe tener exactamente esta estructura:\n\n{\n  \"confidence_score\": <flotante 0.0-1.0, qué tan legible y completo es el documento>,\n  \"is_legible\": <true o false>,\n  \"vendor_name\": \"<nombre del proveedor o null>\",\n  \"invoice_number\": \"<número o folio de la factura o null>\",\n  \"invoice_date\": \"<fecha de emisión en formato YYYY-MM-DD o null>\",\n  \"total_amount\": <monto total numérico sin símbolo de moneda o null>,\n  \"items\": [\n    {\n      \"extracted_name\": \"<nombre o descripción del producto>\",\n      \"barcode\": \"<código de barras o SKU visible en el documento, o null>\",\n      \"quantity\": <entero>,\n      \"unit_price\": <flotante>,\n      \"total_price\": <flotante>\n    }\n  ]\n}\n\nReglas estrictas:\n- confidence_score debe ser 1.0 si el documento es perfectamente legible, 0.0 si es completamente ilegible.\n- Si un campo no está visible en el documento, usa null (no cadenas vacías).\n- El arreglo items debe contener al menos un elemento si el documento es legible. Si no hay ítems visibles, usa un arreglo vacío [].\n- Devuelve SOLO el JSON. Nada más."
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.1,
    "responseMimeType": "application/json"
  }
}
```

---

## Nodo 5: Sanitizar y Parsear JSON (Code Node)

```javascript
// Extraer el texto de la respuesta de Gemini
const candidates = $input.first().json.candidates;
let rawText = candidates[0].content.parts[0].text;

// Eliminar posibles delimitadores de Markdown ```json ... ```
rawText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

// Parsear el JSON
let geminiData;
try {
  geminiData = JSON.parse(rawText);
} catch (e) {
  return [{
    json: {
      ...$input.first().json,
      parseError: true,
      rawText: rawText,
    }
  }];
}

return [{
  json: {
    ...$input.first().json,
    gemini: geminiData,
  }
}];
```

---

## Nodo 6: Evaluar Confianza y Asignar Estado (Code Node)

```javascript
const invoiceId = $input.first().json.invoiceId;
const userId = $input.first().json.userId;
const gemini = $input.first().json.gemini;
const parseError = $input.first().json.parseError;

let status;

if (parseError || !gemini) {
  status = 'failed';
} else if (gemini.is_legible === false || gemini.confidence_score < 0.8) {
  status = 'needs_review';
} else {
  status = 'processed';
}

return [{
  json: {
    invoiceId,
    userId,
    status,
    confidence_score: gemini?.confidence_score ?? null,
    vendor_name: gemini?.vendor_name ?? null,
    invoice_number: gemini?.invoice_number ?? null,
    invoice_date: gemini?.invoice_date ?? null,
    total_amount: gemini?.total_amount ?? null,
    raw_json: gemini ?? null,
    items: gemini?.items ?? [],
  }
}];
```

---

## Nodo 7: PATCH invoices en Supabase (HTTP Request)

- **Method**: PATCH  
- **URL**: `https://<TU_PROYECTO>.supabase.co/rest/v1/invoices?id=eq.{{ $json.invoiceId }}`  
- **Headers**:
  ```
  apikey: <SUPABASE_SERVICE_ROLE_KEY>
  Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
  Content-Type: application/json
  Prefer: return=representation
  ```
- **Body (JSON)**:
  ```json
  {
    "status": "{{ $json.status }}",
    "confidence_score": {{ $json.confidence_score }},
    "vendor_name": "{{ $json.vendor_name }}",
    "invoice_number": "{{ $json.invoice_number }}",
    "invoice_date": "{{ $json.invoice_date }}",
    "total_amount": {{ $json.total_amount }},
    "raw_json": {{ JSON.stringify($json.raw_json) }}
  }
  ```

> ⚠️ Usa `SUPABASE_SERVICE_ROLE_KEY` (no el anon key) para que el update no sea bloqueado por RLS desde n8n.

---

## Nodo 8: INSERT invoice_items (HTTP Request — Loop Over Items)

Usa un nodo **Split In Batches** o **Code** para iterar `$json.items`:

```javascript
// Code Node: preparar items para insertar
const items = $input.first().json.items ?? [];
const invoiceId = $input.first().json.invoiceId;

const rows = items.map(item => ({
  invoice_id: invoiceId,
  extracted_name: item.extracted_name,
  barcode: item.barcode ?? null,
  quantity: item.quantity,
  unit_price: item.unit_price,
  is_confirmed: false,
}));

// POST al endpoint de Supabase para inserción masiva
return [{ json: { rows } }];
```

- **Method**: POST  
- **URL**: `https://<TU_PROYECTO>.supabase.co/rest/v1/invoice_items`  
- **Headers**: (mismos que el PATCH)
- **Body**: `{{ JSON.stringify($json.rows) }}`

---

## Nodo 9: UPSERT products (solo si barcode existe)

**Filtrar ítems con barcode** (nodo IF o Code):
```javascript
return $input.first().json.rows.filter(r => r.barcode != null).map(r => ({ json: r }));
```

- **Method**: POST  
- **URL**: `https://<TU_PROYECTO>.supabase.co/rest/v1/products`  
- **Headers**:
  ```
  Prefer: resolution=merge-duplicates
  ```
- **Body (por item)**:
  ```json
  {
    "user_id": "{{ $json.userId }}",
    "name": "{{ $json.extracted_name }}",
    "barcode": "{{ $json.barcode }}",
    "unit_price": {{ $json.unit_price }},
    "stock": {{ $json.quantity }}
  }
  ```

> El índice `UNIQUE(user_id, barcode)` en la tabla `products` garantiza que el UPSERT actualice en lugar de duplicar.

---

## Nodo 10: Notificar al Frontend (HTTP Request)

Llama al callback de Next.js para que el frontend pueda actualizar la UI vía Supabase Realtime o polling:

- **Method**: POST  
- **URL**: `https://<TU_DOMINIO>/api/webhooks/n8n-callback`  
- **Headers**:
  ```
  Content-Type: application/json
  x-callback-secret: <mismo valor que N8N_CALLBACK_SECRET en .env.local>
  ```
- **Body**:
  ```json
  {
    "invoiceId": "{{ $json.invoiceId }}",
    "status": "{{ $json.status }}",
    "confidence_score": {{ $json.confidence_score }}
  }
  ```

---

## Nodo 11: Respond to Webhook

- **Response Code**: 200  
- **Response Body** (JSON):
  ```json
  {
    "success": true,
    "invoiceId": "{{ $json.invoiceId }}",
    "status": "{{ $json.status }}"
  }
  ```

---

## Variables de Entorno en Next.js (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# n8n
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://<tu-n8n>/webhook/invoice-process
N8N_WEBHOOK_SECRET=<secreto-compartido>
N8N_CALLBACK_SECRET=<secreto-para-el-callback>
```
