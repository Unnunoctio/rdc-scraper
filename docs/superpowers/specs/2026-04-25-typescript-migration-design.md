# RDC Scraper — Migración Python → TypeScript 6

**Fecha:** 2026-04-25  
**Rama:** v3  
**Estado:** Aprobado

---

## Contexto

RDC Scraper es un scraper serverless de precios de bebidas para e-commerce chileno. El proyecto corre sobre AWS Lambda + Step Functions + DynamoDB + S3 + MongoDB Atlas. Actualmente está implementado en Python 3.14.

El proyecto **no está en producción**, por lo que la migración se hace de una sola vez (rewrite completo), sin necesidad de migración incremental ni compatibilidad hacia atrás.

---

## Decisiones clave

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Estrategia | Rewrite completo (Opción A) | Sin producción, scope manejable, codebase limpio |
| Runtime Lambda | Node.js 24.x | Versión más reciente soportada por Lambda (2026) |
| Lenguaje | TypeScript 6 | Tipado estricto, tooling maduro |
| Package manager | pnpm (workspaces) | Eficiente en monorepos, workspaces nativos |
| Bundler | esbuild (via SAM) | Integración nativa con SAM, bundles mínimos, sin Lambda Layers |
| ODM | Mongoose | Schemas declarativos, índices, tipado |
| HTTP | `fetch` nativo (Node.js 24) | Sin dependencias externas |
| Imágenes | `sharp` + `@img/sharp-linux-arm64` | Conversión WebP, binario pre-compilado para Lambda ARM64 |

---

## Estructura del proyecto

```
rdc-scraper/
├── packages/
│   ├── spider/                     # @rdc/spider
│   │   ├── src/
│   │   │   ├── base-spider.ts      # Clase abstracta BaseSpider
│   │   │   ├── fetchers.ts         # JsonFetcher, HtmlFetcher, ProxyFetcher
│   │   │   ├── standard-format.ts  # ScrapedProduct interface + factory
│   │   │   └── path-resolver.ts    # Navegación de objetos con dot notation
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── database/                   # @rdc/database
│       ├── src/
│       │   ├── client.ts           # Conexión Mongoose persistente
│       │   ├── models/
│       │   │   ├── info.model.ts
│       │   │   ├── product.model.ts
│       │   │   └── price-log.model.ts
│       │   └── operations/
│       │       ├── find-by-path.ts
│       │       ├── sync-product.ts
│       │       └── mark-out-of-stock.ts
│       ├── package.json
│       └── tsconfig.json
├── src/
│   ├── spiders/
│   │   └── jumbo/
│   │       ├── spider.ts
│   │       ├── handler.ts
│   │       ├── package.json
│   │       └── tsconfig.json
│   └── pipeline/
│       ├── load-configs/
│       │   ├── handler.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       ├── merge-results/
│       │   ├── handler.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       ├── find-by-path/
│       │   ├── handler.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       ├── search-drinks/
│       │   ├── handler.ts
│       │   ├── drinks-client.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       ├── sync-product/
│       │   ├── handler.ts
│       │   ├── image-uploader.ts
│       │   ├── utils.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       ├── mark-out-of-stock/
│       │   ├── handler.ts
│       │   ├── package.json
│       │   └── tsconfig.json
│       └── send-report/
│           ├── handler.ts
│           ├── package.json
│           └── tsconfig.json
├── scripts/
│   ├── init-db.ts
│   └── seed-dynamo.ts
├── seed/
│   └── spider_configs.json         # sin cambios
├── package.json                    # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── template.yaml
```

---

## Librerías: Python → TypeScript

| Python | TypeScript | Notas |
|--------|------------|-------|
| `aiohttp` | `fetch` nativo (Node.js 24) | Sin dependencia externa |
| `pymongo` (async) | `mongoose` | ODM con schemas e índices declarativos |
| `boto3` | `@aws-sdk/client-s3` + `@aws-sdk/client-dynamodb` | AWS SDK v3 modular |
| `Pillow` | `sharp` + `@img/sharp-linux-arm64` | Pre-built para Lambda ARM64, marcado como `external` en esbuild |
| `resend` | `resend` | SDK oficial Node.js |
| `openpyxl` | `exceljs` | Generación de Excel |
| `beautifulsoup4` | — | No se usa actualmente |

---

## Modelos Mongoose (`@rdc/database`)

### Info
```typescript
interface IInfo {
  code: string   // unique
  name: string
  logo: string
  url: string    // unique
}
```

### Product
```typescript
interface IWebsite {
  info: Types.ObjectId  // ref: Info
  path: string          // unique globalmente (URL completa)
  price: number
  bestPrice: number
  lastUpdate: string    // sync_token (execution StartTime de Step Functions)
  inStock: boolean
}

interface IDrink {
  id: string
  name: string
  brand: string
  abv: number
  packaging: string
  volume: number
  // opcionales para todos:
  country?: string
  region?: string
  // solo cervezas:
  style?: string
  ibu?: number
  servingTempMinC?: number
  servingTempMaxC?: number
  // solo destilados:
  type?: string
  agingContainer?: string
  agingTimeMonths?: number
}

interface IProduct {
  sku: string                                    // unique, 8-char alphanumeric
  slug: string
  name: string
  quantity: number
  category: 'Cervezas' | 'Destilados' | 'Vinos'
  drink: IDrink
  images: string[]
  websites: IWebsite[]
}
```

### PriceLog
```typescript
interface IPriceLog {
  productId: Types.ObjectId
  websitePath: string
  price: number
  bestPrice: number
  date: Date   // TTL 180 días
}
```

### Índices (declarados en los schemas Mongoose)
- `Info`: `code` unique, `url` unique
- `Product`: `sku` unique, `websites.path` unique, `(drink.id, drink.volume, drink.packaging, quantity)` unique, `category`
- `PriceLog`: `(productId, websitePath, date)` unique, TTL 180 días sobre `date`

---

## SAM Template

### Cambios respecto al template actual

**Eliminado:**
- `SharedUtilsLayer` — esbuild inlinea `@rdc/spider`
- `SharedDbLayer` — esbuild inlinea `@rdc/database`

**Modificado:**
```yaml
Globals:
  Function:
    Runtime: nodejs24.x
    Architectures: [arm64]
    # Sin variables globales de MongoDB — solo en las Lambdas que lo necesitan
```

**Build con esbuild (por cada Lambda):**
```yaml
Metadata:
  BuildMethod: esbuild
  BuildProperties:
    Minify: true
    Target: es2022
    Sourcemap: false
    EntryPoints: [handler.ts]
    # External solo en sync-product:
    External: [sharp]
```

**Variables de entorno por Lambda:**

| Lambda | Variables de entorno |
|--------|---------------------|
| `load-configs` | `MONGODB_URI`, `MONGODB_DB` |
| `find-by-path` | `MONGODB_URI`, `MONGODB_DB` |
| `sync-product` | `MONGODB_URI`, `MONGODB_DB`, `S3_BUCKET`, `DRINKS_API_URL`, `DRINKS_API_KEY` |
| `mark-out-of-stock` | `MONGODB_URI`, `MONGODB_DB` |
| `spider-jumbo` | `S3_BUCKET` |
| `merge-results` | `S3_BUCKET` |
| `search-drinks` | `DRINKS_API_URL`, `DRINKS_API_KEY` |
| `send-report` | `RESEND_API_KEY`, `EMAIL_SENDER`, `EMAIL_RECIPIENT` |

**Sin cambios:**
- `SpiderConfigsTable` (DynamoDB)
- `ProductImagesBucket` (S3)
- `RDCScraperOrchestrator` (Step Functions — misma definición de estados)
- Todos los parámetros SAM (`MongoDbUri`, `MongoDbDatabase`, etc.)

---

## TypeScript Config

### `tsconfig.base.json` (raíz)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

Cada paquete y Lambda extiende este base con su propio `tsconfig.json`.

### `pnpm-workspace.yaml`
```yaml
packages:
  - "packages/*"
  - "src/spiders/*"
  - "src/pipeline/*"
```

### `package.json` raíz
```json
{
  "name": "rdc-scraper",
  "private": true,
  "devDependencies": {
    "typescript": "6.0.0",
    "@types/node": "24.0.0"
  }
}
```

Versiones exactas en todos los `package.json` (sin `^` ni `~`).

---

## Conexión MongoDB persistente en Lambda

En Python se usaba un event loop manual + `AsyncMongoClient` a nivel de módulo. En TypeScript esto se simplifica con Mongoose:

```typescript
// packages/database/src/client.ts
import mongoose from 'mongoose'

let connection: typeof mongoose | null = null

export async function getConnection(): Promise<typeof mongoose> {
  if (connection && mongoose.connection.readyState === 1) {
    return connection
  }
  connection = await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB,
  })
  return connection
}
```

Cada handler que necesita MongoDB llama `await getConnection()` al inicio del handler. En la primera invocación del contenedor crea la conexión; en invocaciones subsiguientes la reutiliza.

---

## Flujo de pipeline (sin cambios)

```
LoadConfigs → ScrapeParallel (Map, max 5) → MergeResults → SyncPipeline (Map, max 10)
                      ↓                                              ↓
            Spiders escriben JSON a S3              FindByPath → SearchDrinks → SyncProduct
                                                                        ↓
                                                              MarkOutOfStock
```

---

## Scripts

- `scripts/init-db.ts` — Inicializa colecciones e índices en MongoDB (reemplaza `init_db.py`)
- `scripts/seed-dynamo.ts` — Seed de DynamoDB desde `seed/spider_configs.json` (reemplaza `seed_dynamo.py`)

Ambos se ejecutan con `pnpm tsx scripts/init-db.ts` (usando `tsx` para ejecutar TypeScript directamente).

---

## Lo que NO cambia

- Lógica de negocio de cada Lambda (mismos algoritmos)
- Definición de estados de Step Functions
- Schema de MongoDB (mismo modelo de datos)
- `seed/spider_configs.json`
- Parámetros SAM
- Arquitectura ARM64
- Configuración de S3 (rutas, permisos)
- DynamoDB table schema
