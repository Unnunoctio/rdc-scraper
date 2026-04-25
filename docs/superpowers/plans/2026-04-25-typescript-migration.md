# TypeScript 6 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the entire RDC Scraper project from Python 3.14 to TypeScript 6, replacing pymongo with Mongoose, aiohttp with native fetch, boto3 with AWS SDK v3, and restructuring as a pnpm monorepo bundled with esbuild via SAM.

**Architecture:** pnpm workspaces monorepo with two shared packages (`@rdc/spider`, `@rdc/database`) and nine Lambda functions. esbuild (via SAM BuildMethod) inlines all workspace packages into each Lambda bundle — no Lambda Layers in AWS.

**Tech Stack:** TypeScript 6.0.3 · Node.js 24.x (Lambda) · pnpm workspaces · esbuild (SAM) · Mongoose 9.5.0 · AWS SDK v3 · sharp 0.34.5 · vitest 4.1.5

**Spec:** `docs/superpowers/specs/2026-04-25-typescript-migration-design.md`

---

## File Map

```
packages/
  spider/
    src/
      standard-format.ts   ScrapedProduct interface + isComplete helper
      path-resolver.ts     Dot-notation traversal of nested objects
      fetchers.ts          JsonFetcher, HtmlFetcher (native fetch wrappers)
      base-spider.ts       Abstract BaseSpider class
      index.ts             Package exports
    package.json
    tsconfig.json

  database/
    src/
      client.ts            Mongoose connection (persistent across invocations)
      models/
        info.model.ts      Info collection schema + model
        product.model.ts   Product collection schema + model (drink + websites)
        price-log.model.ts PriceLog collection schema + model (TTL 180d)
      operations/
        find-by-path.ts    findProductByUrl, updatePriceIfChanged
        sync-product.ts    findProductByDrink, uniqueSku, addWebsite, createProduct
        mark-out-of-stock.ts markOutOfStock
      index.ts             Package exports
    package.json
    tsconfig.json

src/
  spiders/
    jumbo/
      spider.ts            JumboSpider extends BaseSpider
      handler.ts           Lambda entry point: runs spider, writes JSON to S3
      package.json
      tsconfig.json

  pipeline/
    load-configs/
      handler.ts           Scan DynamoDB, upsert infos in MongoDB, return spider list
      package.json
      tsconfig.json

    merge-results/
      handler.ts           Load spider S3 outputs, deduplicate, batch, write to S3
      package.json
      tsconfig.json

    find-by-path/
      handler.ts           Load batch from S3, query MongoDB by URL, return unmatched
      package.json
      tsconfig.json

    search-drinks/
      drinks-client.ts     HTTP client for Drinks API
      handler.ts           Filter complete products, search API, return matched pairs
      package.json
      tsconfig.json

    sync-product/
      utils.ts             generateProductName, generateProductSlug (pure functions)
      image-uploader.ts    Download image, convert to WebP, upload to S3
      handler.ts           Create/update products in MongoDB
      package.json
      tsconfig.json

    mark-out-of-stock/
      handler.ts           Mark websites not updated in this run as out of stock
      package.json
      tsconfig.json

    send-report/
      handler.ts           Generate Excel report, send via Resend
      package.json
      tsconfig.json

scripts/
  init-db.ts               Initialize MongoDB collections and indexes
  seed-dynamo.ts           Seed DynamoDB from seed/spider_configs.json

package.json               Workspace root (devDeps only)
pnpm-workspace.yaml
tsconfig.base.json
vitest.config.ts
template.yaml              Updated for Node.js 24.x + esbuild
```

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Delete: `pyproject.toml`, `uv.lock`, `.python-version`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "rdc-scraper",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "init-db": "tsx scripts/init-db.ts",
    "seed-dynamo": "tsx scripts/seed-dynamo.ts"
  },
  "devDependencies": {
    "@types/node": "25.6.0",
    "tsx": "4.21.0",
    "typescript": "6.0.3",
    "vitest": "4.1.5"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "src/spiders/*"
  - "src/pipeline/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Delete Python artifacts**

```bash
git rm pyproject.toml uv.lock .python-version
```

- [ ] **Step 6: Install root devDependencies**

```bash
pnpm install
```

Expected: `node_modules` created at root with typescript, vitest, tsx, @types/node.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts
git commit -m "chore: setup pnpm workspace + TypeScript 6 scaffolding"
```

---

## Task 2: `@rdc/spider` — standard-format and path-resolver

**Files:**
- Create: `packages/spider/package.json`
- Create: `packages/spider/tsconfig.json`
- Create: `packages/spider/src/standard-format.ts`
- Create: `packages/spider/src/path-resolver.ts`
- Create: `packages/spider/src/__tests__/standard-format.test.ts`
- Create: `packages/spider/src/__tests__/path-resolver.test.ts`

- [ ] **Step 1: Create `packages/spider/package.json`**

```json
{
  "name": "@rdc/spider",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [ ] **Step 2: Create `packages/spider/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  }
}
```

- [ ] **Step 3: Write failing tests for standard-format**

Create `packages/spider/src/__tests__/standard-format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isComplete } from '../standard-format'

describe('isComplete', () => {
  it('returns true when all required fields are present', () => {
    expect(isComplete({
      name: 'Cerveza Jumbo', brand: 'Jumbo', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo',
      volumeMl: 500, abv: 5.0, packaging: 'Lata',
    })).toBe(true)
  })

  it('returns false when brand is missing', () => {
    expect(isComplete({
      name: 'Cerveza', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo',
    })).toBe(false)
  })

  it('returns false when volumeMl is missing', () => {
    expect(isComplete({
      name: 'Cerveza', brand: 'Jumbo', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo', abv: 5.0, packaging: 'Lata',
    })).toBe(false)
  })

  it('returns false when abv is missing', () => {
    expect(isComplete({
      name: 'Cerveza', brand: 'Jumbo', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo', volumeMl: 500, packaging: 'Lata',
    })).toBe(false)
  })

  it('returns false when packaging is missing', () => {
    expect(isComplete({
      name: 'Cerveza', brand: 'Jumbo', price: 1000, bestPrice: 900,
      url: 'https://jumbo.cl/p', source: 'jumbo', volumeMl: 500, abv: 5.0,
    })).toBe(false)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — `standard-format` module not found.

- [ ] **Step 5: Implement `packages/spider/src/standard-format.ts`**

```typescript
export interface ScrapedProduct {
  name: string
  price: number
  bestPrice: number
  url: string
  source: string
  brand?: string
  imageUrl?: string
  volumeMl?: number
  abv?: number
  category?: string
  sku?: string
  quantity?: number
  packaging?: string
}

export function isComplete(product: ScrapedProduct): boolean {
  return !!(product.brand && product.volumeMl && product.abv && product.packaging)
}
```

- [ ] **Step 6: Write failing tests for path-resolver**

Create `packages/spider/src/__tests__/path-resolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolvePath, resolvePaths, extractField } from '../path-resolver'

describe('resolvePath', () => {
  it('resolves a simple key', () => {
    expect(resolvePath({ a: 1 }, 'a')).toBe(1)
  })

  it('resolves nested keys with dot notation', () => {
    expect(resolvePath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
  })

  it('resolves array index', () => {
    expect(resolvePath({ items: ['x', 'y', 'z'] }, 'items.1')).toBe('y')
  })

  it('returns undefined for missing key', () => {
    expect(resolvePath({ a: 1 }, 'b')).toBeUndefined()
  })

  it('returns undefined when intermediate key is null', () => {
    expect(resolvePath({ a: null }, 'a.b')).toBeUndefined()
  })
})

describe('resolvePaths', () => {
  it('returns first non-null result', () => {
    expect(resolvePaths({ b: 99 }, ['a', 'b'])).toBe(99)
  })

  it('returns undefined when no path resolves', () => {
    expect(resolvePaths({ c: 1 }, ['a', 'b'])).toBeUndefined()
  })
})

describe('extractField', () => {
  it('coerces to number', () => {
    expect(extractField({ v: '3.5' }, { paths: ['v'], type: 'number' })).toBe(3.5)
  })

  it('coerces to int', () => {
    expect(extractField({ v: '7.9' }, { paths: ['v'], type: 'int' })).toBe(7)
  })

  it('returns undefined when path not found', () => {
    expect(extractField({}, { paths: ['x'], type: 'string' })).toBeUndefined()
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — `path-resolver` module not found.

- [ ] **Step 8: Implement `packages/spider/src/path-resolver.ts`**

```typescript
export interface FieldConfig {
  paths: string[]
  type?: 'string' | 'number' | 'int' | 'float'
}

export function resolvePath(data: unknown, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = data
  for (const key of keys) {
    if (current == null) return undefined
    if (Array.isArray(current)) {
      current = current[Number(key)]
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

export function resolvePaths(data: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = resolvePath(data, path)
    if (value != null) return value
  }
  return undefined
}

export function extractField(data: unknown, config: FieldConfig): unknown {
  const value = resolvePaths(data, config.paths)
  if (value == null) return undefined

  if (config.type === 'number' || config.type === 'float') return parseFloat(String(value))
  if (config.type === 'int') return parseInt(String(value), 10)
  if (config.type === 'string') return String(value)
  return value
}
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/spider/
git commit -m "feat: add @rdc/spider standard-format and path-resolver"
```

---

## Task 3: `@rdc/spider` — fetchers and BaseSpider

**Files:**
- Create: `packages/spider/src/fetchers.ts`
- Create: `packages/spider/src/base-spider.ts`
- Create: `packages/spider/src/index.ts`

- [ ] **Step 1: Implement `packages/spider/src/fetchers.ts`**

```typescript
export interface IFetcher {
  get(url: string, options?: RequestInit): Promise<unknown>
}

export class JsonFetcher implements IFetcher {
  constructor(private headers: Record<string, string> = {}) {}

  async get(url: string, options?: RequestInit): Promise<unknown> {
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options?.headers },
    })
    if (!response.ok) return null
    return response.json()
  }

  async post(url: string, body: unknown, options?: RequestInit): Promise<unknown> {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
        ...(options?.headers as Record<string, string> | undefined),
      },
    })
    if (!response.ok) return null
    return response.json()
  }
}

export class HtmlFetcher implements IFetcher {
  constructor(private headers: Record<string, string> = {}) {}

  async get(url: string, options?: RequestInit): Promise<unknown> {
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options?.headers },
    })
    if (!response.ok) return null
    return response.text()
  }
}
```

- [ ] **Step 2: Implement `packages/spider/src/base-spider.ts`**

```typescript
import type { ScrapedProduct } from './standard-format'
import type { IFetcher } from './fetchers'

export abstract class BaseSpider {
  protected config: Record<string, unknown>
  protected fetchers: Map<string, IFetcher> = new Map()

  constructor(config: Record<string, unknown>) {
    this.config = config
    this._setupFetchers()
  }

  async run(): Promise<ScrapedProduct[]> {
    const categoryUrls = this.config['category_urls'] as string[]
    const allPages = await Promise.all(categoryUrls.map(url => this._getPagesForCategory(url)))
    const products = await Promise.all(
      allPages.flat().map(({ page, categoryUrl }) => this._getProductsFromPage(page, categoryUrl))
    )
    return this._deduplicate(products.flat())
  }

  protected fetch(name: string): IFetcher {
    const fetcher = this.fetchers.get(name)
    if (!fetcher) throw new Error(`Fetcher "${name}" not registered`)
    return fetcher
  }

  protected _deduplicate(products: ScrapedProduct[]): ScrapedProduct[] {
    const seen = new Set<string>()
    return products.filter(p => {
      if (seen.has(p.url)) return false
      seen.add(p.url)
      return true
    })
  }

  protected abstract _setupFetchers(): void
  protected abstract _getPagesForCategory(categoryUrl: string): Promise<Array<{ page: unknown; categoryUrl: string }>>
  protected abstract _getProductsFromPage(page: unknown, categoryUrl: string): Promise<ScrapedProduct[]>
  protected abstract _formatProduct(raw: unknown, ...args: unknown[]): ScrapedProduct
}
```

- [ ] **Step 3: Create `packages/spider/src/index.ts`**

```typescript
export type { ScrapedProduct } from './standard-format'
export { isComplete } from './standard-format'
export { BaseSpider } from './base-spider'
export type { IFetcher } from './fetchers'
export { JsonFetcher, HtmlFetcher } from './fetchers'
export type { FieldConfig } from './path-resolver'
export { resolvePath, resolvePaths, extractField } from './path-resolver'
```

- [ ] **Step 4: Verify types compile**

```bash
cd packages/spider && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/spider/src/fetchers.ts packages/spider/src/base-spider.ts packages/spider/src/index.ts
git commit -m "feat: add @rdc/spider fetchers and BaseSpider"
```

---

## Task 4: `@rdc/database` — models

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/models/info.model.ts`
- Create: `packages/database/src/models/product.model.ts`
- Create: `packages/database/src/models/price-log.model.ts`

- [ ] **Step 1: Create `packages/database/package.json`**

```json
{
  "name": "@rdc/database",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@rdc/spider": "workspace:*",
    "mongoose": "9.5.0"
  }
}
```

- [ ] **Step 2: Create `packages/database/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  }
}
```

- [ ] **Step 3: Install database dependencies**

```bash
cd packages/database && pnpm install
```

- [ ] **Step 4: Implement `packages/database/src/client.ts`**

```typescript
import mongoose from 'mongoose'

let connection: typeof mongoose | null = null

export async function getConnection(): Promise<typeof mongoose> {
  if (connection && mongoose.connection.readyState === 1) return connection
  connection = await mongoose.connect(process.env['MONGODB_URI']!, {
    dbName: process.env['MONGODB_DB'],
  })
  return connection
}
```

- [ ] **Step 5: Implement `packages/database/src/models/info.model.ts`**

```typescript
import { Schema, model } from 'mongoose'

const infoSchema = new Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  logo: { type: String, required: true },
  url:  { type: String, required: true, unique: true },
})

export type IInfo = {
  code: string
  name: string
  logo: string
  url: string
}

export const Info = model('Info', infoSchema, 'infos')
```

- [ ] **Step 6: Implement `packages/database/src/models/product.model.ts`**

```typescript
import { Schema, model, type Types } from 'mongoose'

const drinkSchema = new Schema(
  {
    id:      { type: String, required: true },
    name:    { type: String, required: true },
    brand:   { type: String, required: true },
    abv:     { type: Number, required: true },
    packaging: { type: String, required: true },
    volume:  { type: Number, required: true },
    // optional — all categories:
    country: String,
    region:  String,
    // beer-specific:
    style:   String,
    ibu:     Number,
    servingTempMinC: Number,
    servingTempMaxC: Number,
    // spirit-specific:
    type:              String,
    agingContainer:    String,
    agingTimeMonths:   Number,
  },
  { _id: false },
)

const websiteSchema = new Schema(
  {
    info:        { type: Schema.Types.ObjectId, ref: 'Info', required: true },
    path:        { type: String, required: true },
    price:       { type: Number, required: true },
    bestPrice:   { type: Number, required: true },
    lastUpdate:  { type: String, required: true },
    inStock:     { type: Boolean, required: true, default: true },
  },
  { _id: false },
)

const productSchema = new Schema({
  sku:      { type: String, required: true, unique: true },
  slug:     { type: String, required: true },
  name:     { type: String, required: true },
  quantity: { type: Number, required: true },
  category: { type: String, required: true, enum: ['Cervezas', 'Destilados', 'Vinos'] },
  drink:    { type: drinkSchema, required: true },
  images:   [String],
  websites: [websiteSchema],
})

productSchema.index(
  { 'drink.id': 1, 'drink.volume': 1, 'drink.packaging': 1, quantity: 1 },
  { unique: true },
)
productSchema.index({ 'websites.path': 1 }, { unique: true, sparse: true })
productSchema.index({ category: 1 })

export type IDrink = {
  id: string; name: string; brand: string; abv: number
  packaging: string; volume: number
  country?: string; region?: string
  style?: string; ibu?: number; servingTempMinC?: number; servingTempMaxC?: number
  type?: string; agingContainer?: string; agingTimeMonths?: number
}

export type IWebsite = {
  info: Types.ObjectId; path: string; price: number
  bestPrice: number; lastUpdate: string; inStock: boolean
}

export type IProduct = {
  _id: Types.ObjectId; sku: string; slug: string; name: string
  quantity: number; category: string; drink: IDrink
  images: string[]; websites: IWebsite[]
}

export const Product = model('Product', productSchema, 'products')
```

- [ ] **Step 7: Implement `packages/database/src/models/price-log.model.ts`**

```typescript
import { Schema, model, type Types } from 'mongoose'

const priceLogSchema = new Schema({
  productId:   { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  websitePath: { type: String, required: true },
  price:       { type: Number, required: true },
  bestPrice:   { type: Number, required: true },
  date:        { type: Date,   required: true },
})

priceLogSchema.index({ productId: 1, websitePath: 1, date: -1 }, { unique: true })
priceLogSchema.index({ date: 1 }, { expireAfterSeconds: 15552000 }) // 180 days

export type IPriceLog = {
  productId: Types.ObjectId; websitePath: string
  price: number; bestPrice: number; date: Date
}

export const PriceLog = model('PriceLog', priceLogSchema, 'priceLogs')
```

- [ ] **Step 8: Verify types compile**

```bash
cd packages/database && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add packages/database/
git commit -m "feat: add @rdc/database Mongoose models"
```

---

## Task 5: `@rdc/database` — operations

**Files:**
- Create: `packages/database/src/operations/find-by-path.ts`
- Create: `packages/database/src/operations/sync-product.ts`
- Create: `packages/database/src/operations/mark-out-of-stock.ts`
- Create: `packages/database/src/index.ts`

- [ ] **Step 1: Implement `packages/database/src/operations/find-by-path.ts`**

```typescript
import type { Types } from 'mongoose'
import { Product } from '../models/product.model'
import { PriceLog } from '../models/price-log.model'
import type { ScrapedProduct } from '@rdc/spider'

export async function findProductByUrl(url: string) {
  return Product.findOne({ 'websites.path': url })
}

export async function updatePriceIfChanged(
  product: NonNullable<Awaited<ReturnType<typeof findProductByUrl>>>,
  scraped: ScrapedProduct,
  syncToken: string,
): Promise<void> {
  await Product.updateOne(
    { _id: product._id, 'websites.path': scraped.url },
    {
      $set: {
        'websites.$.price':      scraped.price,
        'websites.$.bestPrice':  scraped.bestPrice,
        'websites.$.lastUpdate': syncToken,
        'websites.$.inStock':    true,
      },
    },
  )
  await upsertPriceLogToday(product._id, scraped.url, scraped.price, scraped.bestPrice)
}

async function upsertPriceLogToday(
  productId: Types.ObjectId,
  websitePath: string,
  price: number,
  bestPrice: number,
) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  await PriceLog.updateOne(
    { productId, websitePath, date: today },
    { $set: { price, bestPrice } },
    { upsert: true },
  )
}
```

- [ ] **Step 2: Implement `packages/database/src/operations/sync-product.ts`**

```typescript
import type { Types } from 'mongoose'
import { Product } from '../models/product.model'
import { PriceLog } from '../models/price-log.model'
import { Info } from '../models/info.model'
import type { IDrink } from '../models/product.model'
import type { ScrapedProduct } from '@rdc/spider'

// Module-level cache — survives Lambda container reuse
const infoCache = new Map<string, Types.ObjectId>()

export async function getInfoId(source: string): Promise<Types.ObjectId | null> {
  if (infoCache.has(source)) return infoCache.get(source)!
  const info = await Info.findOne({ code: source }, { _id: 1 })
  if (!info) return null
  infoCache.set(source, info._id as Types.ObjectId)
  return info._id as Types.ObjectId
}

export async function findProductByDrink(drink: IDrink, quantity: number) {
  return Product.findOne({
    'drink.id':        drink.id,
    'drink.volume':    drink.volume,
    'drink.packaging': drink.packaging,
    quantity,
  })
}

export async function uniqueSku(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  while (true) {
    const sku = Array.from(
      { length: 8 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('')
    const exists = await Product.exists({ sku })
    if (!exists) return sku
  }
}

export async function addWebsite(
  productId: Types.ObjectId,
  infoId: Types.ObjectId,
  scraped: ScrapedProduct,
  syncToken: string,
): Promise<void> {
  await Product.updateOne(
    { _id: productId },
    {
      $push: {
        websites: {
          info:        infoId,
          path:        scraped.url,
          price:       scraped.price,
          bestPrice:   scraped.bestPrice,
          lastUpdate:  syncToken,
          inStock:     true,
        },
      },
    },
  )
  await upsertPriceLogToday(productId, scraped.url, scraped.price, scraped.bestPrice)
}

export async function createProduct(params: {
  sku: string; name: string; slug: string; quantity: number
  category: string; drink: IDrink; imageUrl: string | null
  infoId: Types.ObjectId; scraped: ScrapedProduct; syncToken: string
}): Promise<void> {
  const { sku, name, slug, quantity, category, drink, imageUrl, infoId, scraped, syncToken } = params
  const product = await Product.create({
    sku, slug, name, quantity, category, drink,
    images: imageUrl ? [imageUrl] : [],
    websites: [{
      info:       infoId,
      path:       scraped.url,
      price:      scraped.price,
      bestPrice:  scraped.bestPrice,
      lastUpdate: syncToken,
      inStock:    true,
    }],
  })
  await upsertPriceLogToday(product._id as Types.ObjectId, scraped.url, scraped.price, scraped.bestPrice)
}

async function upsertPriceLogToday(
  productId: Types.ObjectId,
  websitePath: string,
  price: number,
  bestPrice: number,
) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  await PriceLog.updateOne(
    { productId, websitePath, date: today },
    { $set: { price, bestPrice } },
    { upsert: true },
  )
}
```

- [ ] **Step 3: Implement `packages/database/src/operations/mark-out-of-stock.ts`**

```typescript
import { Product } from '../models/product.model'

export async function markOutOfStock(syncToken: string): Promise<number> {
  const result = await Product.updateMany(
    { websites: { $elemMatch: { lastUpdate: { $ne: syncToken }, inStock: true } } },
    {
      $set: {
        'websites.$[elem].inStock':    false,
        'websites.$[elem].price':      0,
        'websites.$[elem].bestPrice':  0,
      },
    },
    { arrayFilters: [{ 'elem.lastUpdate': { $ne: syncToken }, 'elem.inStock': true }] },
  )
  return result.modifiedCount
}
```

- [ ] **Step 4: Create `packages/database/src/index.ts`**

```typescript
export { getConnection } from './client'
export { Info } from './models/info.model'
export type { IInfo } from './models/info.model'
export { Product } from './models/product.model'
export type { IDrink, IWebsite, IProduct } from './models/product.model'
export { PriceLog } from './models/price-log.model'
export type { IPriceLog } from './models/price-log.model'
export { findProductByUrl, updatePriceIfChanged } from './operations/find-by-path'
export { getInfoId, findProductByDrink, uniqueSku, addWebsite, createProduct } from './operations/sync-product'
export { markOutOfStock } from './operations/mark-out-of-stock'
```

- [ ] **Step 5: Install workspace deps from root and verify types**

```bash
pnpm install
cd packages/database && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/operations/ packages/database/src/index.ts
git commit -m "feat: add @rdc/database operations and exports"
```

---

## Task 6: Lambda — `spider-jumbo`

**Files:**
- Create: `src/spiders/jumbo/package.json`
- Create: `src/spiders/jumbo/tsconfig.json`
- Create: `src/spiders/jumbo/spider.ts`
- Create: `src/spiders/jumbo/handler.ts`

- [ ] **Step 1: Create `src/spiders/jumbo/package.json`**

```json
{
  "name": "@rdc/spider-jumbo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@rdc/spider": "workspace:*",
    "@aws-sdk/client-s3": "3.1037.0"
  }
}
```

- [ ] **Step 2: Create `src/spiders/jumbo/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "."
  }
}
```

- [ ] **Step 3: Implement `src/spiders/jumbo/spider.ts`**

```typescript
import { BaseSpider, JsonFetcher } from '@rdc/spider'
import type { ScrapedProduct } from '@rdc/spider'

type JumboConfig = {
  source: string
  product_list_url: string
  product_details_url: string
  product_url: { prefix: string; postfix: string }
  page_size: number
  store: string
  category_urls: string[]
  headers: Record<string, string>
}

type PageRange = { from: number; to: number; categoryUrl: string }
type LightweightItem = { slug: string; categoryUrl: string }
type Spec = { name: string; values: string[] }

export class JumboSpider extends BaseSpider {
  declare protected config: JumboConfig & Record<string, unknown>

  constructor(config: JumboConfig) {
    super(config as unknown as Record<string, unknown>)
  }

  protected _setupFetchers(): void {
    this.fetchers.set('json', new JsonFetcher(this.config.headers))
  }

  // Override full run() — JumboSpider needs an extra detail-fetch step
  override async run(): Promise<ScrapedProduct[]> {
    const ranges = await Promise.all(
      this.config.category_urls.map(url => this._getPageRanges(url))
    )

    const slugs = await Promise.all(ranges.flat().map(r => this._getSlugs(r)))

    const products = await Promise.all(slugs.flat().map(item => this._fetchDetail(item)))

    return this._deduplicate(products.filter((p): p is ScrapedProduct => p !== null))
  }

  // Required abstract implementations (used internally via run override)
  protected async _getPagesForCategory(categoryUrl: string): Promise<Array<{ page: unknown; categoryUrl: string }>> {
    const ranges = await this._getPageRanges(categoryUrl)
    return ranges.map(r => ({ page: r, categoryUrl }))
  }

  protected async _getProductsFromPage(page: unknown, _categoryUrl: string): Promise<ScrapedProduct[]> {
    const range = page as PageRange
    return (await this._getSlugs(range)).map(item => ({ ...item } as unknown as ScrapedProduct))
  }

  private async _getPageRanges(categoryUrl: string): Promise<PageRange[]> {
    const fetcher = this.fetchers.get('json') as JsonFetcher
    const body = { store: this.config.store, term: categoryUrl, from: 0, to: 0 }
    const response = await fetcher.post(this.config.product_list_url, body) as { total?: number } | null
    if (!response?.total) return []

    const ranges: PageRange[] = []
    for (let from = 0; from < response.total; from += this.config.page_size) {
      ranges.push({ from, to: from + this.config.page_size - 1, categoryUrl })
    }
    return ranges
  }

  private async _getSlugs(range: PageRange): Promise<LightweightItem[]> {
    const fetcher = this.fetchers.get('json') as JsonFetcher
    const body = { store: this.config.store, term: range.categoryUrl, from: range.from, to: range.to }
    const response = await fetcher.post(this.config.product_list_url, body) as {
      products?: Array<{ linkText?: string }>
    } | null
    return (response?.products ?? [])
      .filter(p => p.linkText)
      .map(p => ({ slug: p.linkText!, categoryUrl: range.categoryUrl }))
  }

  private async _fetchDetail(item: LightweightItem): Promise<ScrapedProduct | null> {
    const fetcher = this.fetchers.get('json') as JsonFetcher
    const url = `${this.config.product_details_url}?slug=${item.slug}&store=${this.config.store}`
    const response = await fetcher.get(url) as { product?: unknown } | null
    if (!response?.product) return null
    try {
      return this._formatProduct(response.product, item.slug)
    } catch {
      return null
    }
  }

  protected _formatProduct(raw: unknown, slug: string): ScrapedProduct {
    const p = raw as Record<string, unknown>
    const allSpecs = this._allSpecs(p)
    const name = String(p['productName'] ?? '')
    const brand = String(p['brand'] ?? '')

    const priceRange = p['priceRange'] as { sellingPrice?: { highPrice?: number; lowPrice?: number } } | null
    const price = priceRange?.sellingPrice?.highPrice ?? 0
    const bestPrice = priceRange?.sellingPrice?.lowPrice ?? price

    const categoryPath = ((p['categories'] as string[])?.[0] ?? '')
    const category = this._resolveCategory(categoryPath)

    return {
      name,
      brand,
      price,
      bestPrice,
      url:       `${this.config.product_url.prefix}${slug}${this.config.product_url.postfix}`,
      source:    this.config.source,
      imageUrl:  this._extractImageUrl(p),
      volumeMl:  this._extractVolume(name),
      abv:       this._extractAbv(allSpecs, name),
      category,
      sku:       String(p['productReference'] ?? ''),
      quantity:  this._extractQuantity(allSpecs, name),
      packaging: this._extractPackaging(allSpecs, name, category),
    }
  }

  private _allSpecs(p: Record<string, unknown>): Spec[] {
    const groups = p['specificationGroups'] as Array<{ specifications?: Spec[] }> | undefined
    return (groups ?? []).flatMap(g => g.specifications ?? [])
  }

  private _extractImageUrl(p: Record<string, unknown>): string | undefined {
    const items = p['items'] as Array<{ images?: Array<{ imageUrl?: string }> }> | undefined
    const url = items?.[0]?.images?.[0]?.imageUrl
    if (!url) return undefined
    return url.replace(/-\d+-\d+(\.\w+)$/, '$1') // strip dimension suffix
  }

  private _resolveCategory(path: string): string {
    const p = path.toLowerCase()
    if (p.includes('cervezas')) return 'Cervezas'
    if (p.includes('destilados')) return 'Destilados'
    if (p.includes('vinos')) return 'Vinos'
    return 'Otros'
  }

  private _normalize(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  private _specValue(specs: Spec[], ...keys: string[]): string | null {
    for (const key of keys) {
      const norm = this._normalize(key)
      const spec = specs.find(s => this._normalize(s.name).includes(norm))
      if (spec?.values?.[0]) return spec.values[0]
    }
    return null
  }

  private _extractAbv(specs: Spec[], name: string): number | undefined {
    const sv = this._specValue(specs, 'Graduacion Alcoholica', 'Grado')
    if (sv) {
      const m = sv.match(/(\d+(?:[.,]\d+)?)/)
      if (m) return parseFloat(m[1].replace(',', '.'))
    }
    const m = name.match(/(\d+(?:[.,]\d+)?)\s*°/)
    if (m) return parseFloat(m[1].replace(',', '.'))
    return undefined
  }

  private _extractVolume(name: string): number | undefined {
    const m = name.match(/(\d+(?:\.\d+)?)\s*(cc|ml|l)\b/i)
    if (!m) return undefined
    const value = parseFloat(m[1])
    const unit = m[2].toLowerCase()
    if (unit === 'l') return Math.round(value * 1000)
    return Math.round(value)
  }

  private _extractQuantity(specs: Spec[], name: string): number {
    const sv = this._specValue(specs, 'Pack', 'Bipack', 'Cantidad')
    if (sv) {
      const m = sv.match(/(\d+)/)
      if (m) return parseInt(m[1], 10)
    }
    const m = name.match(/pack\s*(\d+)/i)
    if (m) return parseInt(m[1], 10)
    return 1
  }

  private _extractPackaging(specs: Spec[], name: string, _category: string): string | undefined {
    const sv = this._specValue(specs, 'Envase')
    if (sv) {
      const v = this._normalize(sv)
      if (v.includes('botella')) return 'Botella'
      if (v.includes('lata')) return 'Lata'
      if (v.includes('barril') || v.includes('keg')) return 'Barril'
      if (v.includes('tetra')) return 'Tetrapack'
    }
    const n = this._normalize(name)
    if (n.includes('lata')) return 'Lata'
    if (n.includes('barril') || n.includes('keg')) return 'Barril'
    if (n.includes('tetra')) return 'Tetrapack'
    if (n.includes('botella')) return 'Botella'
    return 'Botella'
  }
}
```

- [ ] **Step 4: Implement `src/spiders/jumbo/handler.ts`**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { JumboSpider } from './spider'

const s3 = new S3Client({ region: 'sa-east-1' })
const BUCKET = process.env['S3_BUCKET']!

type JumboConfig = Record<string, unknown>

export const handler = async (event: { config: JumboConfig; execution_id: string }) => {
  const { config, execution_id } = event

  const spider = new JumboSpider(config as Parameters<typeof JumboSpider>[0])
  const products = await spider.run()

  const key = `pipeline/runs/jumbo/${execution_id}.json`
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(products),
    ContentType: 'application/json',
  }))

  return { s3_key: key, count: products.length }
}
```

- [ ] **Step 5: Install and type-check**

```bash
pnpm install
cd src/spiders/jumbo && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/spiders/jumbo/
git commit -m "feat: add JumboSpider and handler in TypeScript"
```

---

## Task 7: Lambda — `load-configs`

**Files:**
- Create: `src/pipeline/load-configs/package.json`
- Create: `src/pipeline/load-configs/tsconfig.json`
- Create: `src/pipeline/load-configs/handler.ts`

- [ ] **Step 1: Create `src/pipeline/load-configs/package.json`**

```json
{
  "name": "@rdc/pipeline-load-configs",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@rdc/database": "workspace:*",
    "@aws-sdk/client-dynamodb": "3.1037.0",
    "@aws-sdk/util-dynamodb": "3.996.2"
  }
}
```

- [ ] **Step 2: Create `src/pipeline/load-configs/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." }
}
```

- [ ] **Step 3: Implement `src/pipeline/load-configs/handler.ts`**

```typescript
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { getConnection, Info } from '@rdc/database'

const dynamo = new DynamoDBClient({ region: 'sa-east-1' })

type SpiderItem = {
  lambda_name: string
  config: Record<string, unknown>
}

export const handler = async () => {
  await getConnection()

  const result = await dynamo.send(new ScanCommand({
    TableName: process.env['SPIDER_CONFIGS_TABLE']!,
    FilterExpression: 'enabled = :enabled',
    ExpressionAttributeValues: { ':enabled': { BOOL: true } },
  }))

  const spiders: SpiderItem[] = []

  for (const item of result.Items ?? []) {
    const config = unmarshall(item) as {
      lambda_name: string
      config: Record<string, unknown>
      info: { code: string; name: string; logo: string; url: string }
    }

    await Info.updateOne(
      { code: config.info.code },
      { $set: config.info },
      { upsert: true },
    )

    spiders.push({ lambda_name: config.lambda_name, config: config.config })
  }

  return { spiders }
}
```

- [ ] **Step 4: Install and type-check**

```bash
pnpm install
cd src/pipeline/load-configs && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/load-configs/
git commit -m "feat: add load-configs Lambda in TypeScript"
```

---

## Task 8: Lambda — `merge-results`

**Files:**
- Create: `src/pipeline/merge-results/package.json`
- Create: `src/pipeline/merge-results/tsconfig.json`
- Create: `src/pipeline/merge-results/handler.ts`

- [ ] **Step 1: Create `src/pipeline/merge-results/package.json`**

```json
{
  "name": "@rdc/pipeline-merge-results",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@rdc/spider": "workspace:*",
    "@aws-sdk/client-s3": "3.1037.0"
  }
}
```

- [ ] **Step 2: Create `src/pipeline/merge-results/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." }
}
```

- [ ] **Step 3: Implement `src/pipeline/merge-results/handler.ts`**

```typescript
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { ScrapedProduct } from '@rdc/spider'

const s3 = new S3Client({ region: 'sa-east-1' })
const BUCKET = process.env['S3_BUCKET']!
const BATCH_SIZE = 250

type BatchResult = { s3_key: string; category: string; count: number }

export const handler = async (event: { s3_keys: string[]; execution_id: string }): Promise<BatchResult[]> => {
  const { s3_keys, execution_id } = event

  const allProducts: ScrapedProduct[] = []
  await Promise.all(s3_keys.map(async key => {
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const body = await response.Body!.transformToString()
    allProducts.push(...(JSON.parse(body) as ScrapedProduct[]))
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  }))

  // Deduplicate by URL
  const seen = new Set<string>()
  const unique = allProducts.filter(p => {
    if (seen.has(p.url)) return false
    seen.add(p.url)
    return true
  })

  // Group by category
  const byCategory = new Map<string, ScrapedProduct[]>()
  for (const product of unique) {
    const cat = product.category ?? 'Uncategorized'
    const arr = byCategory.get(cat) ?? []
    arr.push(product)
    byCategory.set(cat, arr)
  }

  // Write 250-item batches to S3
  const batches: BatchResult[] = []
  let index = 0
  for (const [category, products] of byCategory) {
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      const key = `pipeline/batches/${execution_id}/${index}.json`
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(batch),
        ContentType: 'application/json',
      }))
      batches.push({ s3_key: key, category, count: batch.length })
      index++
    }
  }

  return batches
}
```

- [ ] **Step 4: Install and type-check**

```bash
pnpm install
cd src/pipeline/merge-results && pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/merge-results/
git commit -m "feat: add merge-results Lambda in TypeScript"
```

---

## Task 9: Lambda — `find-by-path`

**Files:**
- Create: `src/pipeline/find-by-path/package.json`
- Create: `src/pipeline/find-by-path/tsconfig.json`
- Create: `src/pipeline/find-by-path/handler.ts`

- [ ] **Step 1: Create `src/pipeline/find-by-path/package.json`**

```json
{
  "name": "@rdc/pipeline-find-by-path",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@rdc/database": "workspace:*",
    "@rdc/spider": "workspace:*",
    "@aws-sdk/client-s3": "3.1037.0"
  }
}
```

- [ ] **Step 2: Create `src/pipeline/find-by-path/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." }
}
```

- [ ] **Step 3: Implement `src/pipeline/find-by-path/handler.ts`**

```typescript
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getConnection, findProductByUrl, updatePriceIfChanged } from '@rdc/database'
import type { ScrapedProduct } from '@rdc/spider'

const s3 = new S3Client({ region: 'sa-east-1' })
const BUCKET = process.env['S3_BUCKET']!

export const handler = async (event: {
  s3_key: string
  category: string
  sync_token: string
}) => {
  const { s3_key, category, sync_token } = event

  await getConnection()

  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3_key }))
  const body = await response.Body!.transformToString()
  const products = JSON.parse(body) as ScrapedProduct[]
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3_key }))

  const remaining: ScrapedProduct[] = []

  for (const product of products) {
    const existing = await findProductByUrl(product.url)
    if (existing) {
      await updatePriceIfChanged(existing, product, sync_token)
    } else {
      remaining.push(product)
    }
  }

  return { remaining, sync_token, category }
}
```

- [ ] **Step 4: Install and type-check**

```bash
pnpm install
cd src/pipeline/find-by-path && pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/find-by-path/
git commit -m "feat: add find-by-path Lambda in TypeScript"
```

---

## Task 10: Lambda — `search-drinks`

**Files:**
- Create: `src/pipeline/search-drinks/package.json`
- Create: `src/pipeline/search-drinks/tsconfig.json`
- Create: `src/pipeline/search-drinks/drinks-client.ts`
- Create: `src/pipeline/search-drinks/handler.ts`

- [ ] **Step 1: Create `src/pipeline/search-drinks/package.json`**

```json
{
  "name": "@rdc/pipeline-search-drinks",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@rdc/spider": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `src/pipeline/search-drinks/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." }
}
```

- [ ] **Step 3: Implement `src/pipeline/search-drinks/drinks-client.ts`**

```typescript
const CATEGORY_MAP: Record<string, string> = {
  Cervezas:  'beers',
  Destilados: 'spirits',
  Vinos:     'wines',
}

const PACKAGING_MAP: Record<string, string> = {
  Botella:   'Bottle',
  Lata:      'Can',
  Barril:    'Keg',
  Tetrapack: 'Tetrapack',
}

export type DrinkResult = {
  id: string; name: string; brand: string
  abv: number; packaging: string; volume: number
  [key: string]: unknown
}

export async function searchDrinks(product: {
  brand: string; volumeMl: number; abv: number
  packaging: string; category: string
}): Promise<DrinkResult[]> {
  const apiCategory = CATEGORY_MAP[product.category]
  if (!apiCategory) return []

  const packaging = PACKAGING_MAP[product.packaging] ?? product.packaging
  const params = new URLSearchParams({
    brand:     product.brand,
    minAbv:    String(product.abv - 0.5),
    maxAbv:    String(product.abv + 0.5),
    packaging,
    minVolume: String(product.volumeMl - 10),
    maxVolume: String(product.volumeMl + 10),
  })

  const url = `${process.env['DRINKS_API_URL']}${apiCategory}?${params}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env['DRINKS_API_KEY']}` },
  })

  if (!response.ok) return []
  return response.json() as Promise<DrinkResult[]>
}
```

- [ ] **Step 4: Implement `src/pipeline/search-drinks/handler.ts`**

```typescript
import { isComplete } from '@rdc/spider'
import type { ScrapedProduct } from '@rdc/spider'
import { searchDrinks } from './drinks-client'
import type { DrinkResult } from './drinks-client'

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function bestMatch(drinks: DrinkResult[], productName: string): DrinkResult | null {
  const normalizedName = normalize(productName)
  const candidates = drinks.filter(drink =>
    normalize(drink.name).split(/\s+/).every(word => normalizedName.includes(word))
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, curr) => curr.name.length > best.name.length ? curr : best)
}

export const handler = async (event: {
  remaining: ScrapedProduct[]
  sync_token: string
  category: string
}) => {
  const { remaining, sync_token, category } = event

  const searchable = remaining.filter(isComplete)
  const unmatched: ScrapedProduct[] = remaining.filter(p => !isComplete(p))
  const matched: Array<{ product: ScrapedProduct; drink: DrinkResult }> = []

  await Promise.all(searchable.map(async product => {
    const drinks = await searchDrinks({
      brand:     product.brand!,
      volumeMl:  product.volumeMl!,
      abv:       product.abv!,
      packaging: product.packaging!,
      category,
    })
    const drink = bestMatch(drinks, product.name)
    if (drink) {
      matched.push({ product, drink })
    } else {
      unmatched.push(product)
    }
  }))

  return { matched, unmatched, sync_token, category }
}
```

- [ ] **Step 5: Install and type-check**

```bash
pnpm install
cd src/pipeline/search-drinks && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/search-drinks/
git commit -m "feat: add search-drinks Lambda in TypeScript"
```

---

## Task 11: Lambda — `sync-product`

**Files:**
- Create: `src/pipeline/sync-product/package.json`
- Create: `src/pipeline/sync-product/tsconfig.json`
- Create: `src/pipeline/sync-product/utils.ts`
- Create: `src/pipeline/sync-product/__tests__/utils.test.ts`
- Create: `src/pipeline/sync-product/image-uploader.ts`
- Create: `src/pipeline/sync-product/handler.ts`

- [ ] **Step 1: Create `src/pipeline/sync-product/package.json`**

```json
{
  "name": "@rdc/pipeline-sync-product",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@rdc/database": "workspace:*",
    "@rdc/spider": "workspace:*",
    "@aws-sdk/client-s3": "3.1037.0",
    "@img/sharp-linux-arm64": "0.34.5",
    "sharp": "0.34.5"
  }
}
```

- [ ] **Step 2: Create `src/pipeline/sync-product/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." }
}
```

- [ ] **Step 3: Write failing tests for utils**

Create `src/pipeline/sync-product/__tests__/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateProductName, generateProductSlug, formatVolume, formatAbv } from '../utils'

const baseDrink = { name: 'Lager', brand: 'Austral', abv: 5.0, packaging: 'Lata', volume: 500 }

describe('generateProductName', () => {
  it('generates singular name', () => {
    expect(generateProductName(baseDrink, 'Cervezas', 1))
      .toBe('Cerveza Austral Lager Lata 5° 500ml')
  })

  it('generates pack name when quantity > 1', () => {
    expect(generateProductName(baseDrink, 'Cervezas', 6))
      .toBe('Pack 6 un. Cerveza Austral Lager Lata 5° 500ml')
  })

  it('formats volume in litres when >= 1000ml and multiple of 1000', () => {
    expect(generateProductName({ ...baseDrink, volume: 1000 }, 'Cervezas', 1))
      .toBe('Cerveza Austral Lager Lata 5° 1L')
  })
})

describe('formatVolume', () => {
  it('returns ml for volumes under 1000', () => {
    expect(formatVolume(500)).toBe('500ml')
  })

  it('returns L for exact litre multiples >= 1000', () => {
    expect(formatVolume(1000)).toBe('1L')
    expect(formatVolume(2000)).toBe('2L')
  })

  it('returns ml for non-multiple-of-1000 volumes', () => {
    expect(formatVolume(750)).toBe('750ml')
  })
})

describe('formatAbv', () => {
  it('appends degree symbol', () => {
    expect(formatAbv(5.5)).toBe('5.5°')
  })
})

describe('generateProductSlug', () => {
  it('generates a kebab-case slug', () => {
    const slug = generateProductSlug('ABC123', 'Cerveza Austral Lager', 500)
    expect(slug).toMatch(/^abc123-cerveza-austral-lager-500$/)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — `utils` module not found.

- [ ] **Step 5: Implement `src/pipeline/sync-product/utils.ts`**

```typescript
const CATEGORY_MAP: Record<string, string> = {
  Cervezas:   'Cerveza',
  Destilados: 'Destilado',
  Vinos:      'Vino',
}

const PACKAGING_MAP_ES: Record<string, string> = {
  Bottle:    'Botella',
  Can:       'Lata',
  Keg:       'Barril',
  Tetrapack: 'Tetrapack',
  Botella:   'Botella',
  Lata:      'Lata',
  Barril:    'Barril',
}

type DrinkData = { name: string; brand: string; abv: number; packaging: string; volume: number }

export function generateProductName(drink: DrinkData, category: string, quantity: number): string {
  const cat = CATEGORY_MAP[category] ?? category
  const pkg = PACKAGING_MAP_ES[drink.packaging] ?? drink.packaging
  const base = `${cat} ${drink.brand} ${drink.name} ${pkg} ${formatAbv(drink.abv)} ${formatVolume(drink.volume)}`
  return quantity > 1 ? `Pack ${quantity} un. ${base}` : base
}

export function formatVolume(volumeMl: number): string {
  if (volumeMl >= 1000 && volumeMl % 1000 === 0) return `${volumeMl / 1000}L`
  return `${volumeMl}ml`
}

export function formatAbv(abv: number): string {
  return `${abv}°`
}

export function generateProductSlug(sku: string, name: string, volumeMl: number): string {
  return `${sku.toLowerCase()}-${slugify(name)}-${volumeMl}`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 7: Implement `src/pipeline/sync-product/image-uploader.ts`**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const s3 = new S3Client({ region: 'sa-east-1' })
const BUCKET = process.env['S3_BUCKET']!

export async function uploadImage(
  sku: string,
  category: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const webp = await sharp(buffer).toFormat('webp', { quality: 85 }).toBuffer()

    const key = `images/${category}/${sku}/${sku}.webp`
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: webp,
      ContentType: 'image/webp',
    }))

    return `https://${BUCKET}.s3.amazonaws.com/${key}`
  } catch {
    return null
  }
}
```

- [ ] **Step 8: Implement `src/pipeline/sync-product/handler.ts`**

```typescript
import { getConnection, findProductByDrink, getInfoId, uniqueSku, addWebsite, createProduct } from '@rdc/database'
import type { IDrink } from '@rdc/database'
import type { ScrapedProduct } from '@rdc/spider'
import { generateProductName, generateProductSlug } from './utils'
import { uploadImage } from './image-uploader'

type DrinkResult = IDrink & { [key: string]: unknown }

export const handler = async (event: {
  matched: Array<{ product: ScrapedProduct; drink: DrinkResult }>
  sync_token: string
  category: string
}) => {
  const { matched, sync_token, category } = event

  await getConnection()

  let added = 0
  let created = 0

  await Promise.all(matched.map(async ({ product, drink }) => {
    const quantity = product.quantity ?? 1
    const infoId = await getInfoId(product.source)
    if (!infoId) return

    const existing = await findProductByDrink(drink, quantity)

    if (existing) {
      await addWebsite(existing._id, infoId, product, sync_token)
      added++
    } else {
      const sku = await uniqueSku()
      const name = generateProductName(drink, category, quantity)
      const slug = generateProductSlug(sku, name, drink.volume)
      const imageUrl = product.imageUrl ? await uploadImage(sku, category, product.imageUrl) : null

      await createProduct({
        sku, name, slug, quantity, category,
        drink: drink as IDrink,
        imageUrl, infoId, scraped: product, syncToken: sync_token,
      })
      created++
    }
  }))

  return { sync_token, added, created }
}
```

- [ ] **Step 9: Install and type-check**

```bash
pnpm install
cd src/pipeline/sync-product && pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add src/pipeline/sync-product/
git commit -m "feat: add sync-product Lambda in TypeScript"
```

---

## Task 12: Lambda — `mark-out-of-stock`

**Files:**
- Create: `src/pipeline/mark-out-of-stock/package.json`
- Create: `src/pipeline/mark-out-of-stock/tsconfig.json`
- Create: `src/pipeline/mark-out-of-stock/handler.ts`

- [ ] **Step 1: Create `src/pipeline/mark-out-of-stock/package.json`**

```json
{
  "name": "@rdc/pipeline-mark-out-of-stock",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@rdc/database": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `src/pipeline/mark-out-of-stock/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." }
}
```

- [ ] **Step 3: Implement `src/pipeline/mark-out-of-stock/handler.ts`**

```typescript
import { getConnection, markOutOfStock } from '@rdc/database'

export const handler = async (event: { sync_token: string }) => {
  await getConnection()
  const count = await markOutOfStock(event.sync_token)
  return { marked_out_of_stock: count }
}
```

- [ ] **Step 4: Install and type-check**

```bash
pnpm install
cd src/pipeline/mark-out-of-stock && pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/mark-out-of-stock/
git commit -m "feat: add mark-out-of-stock Lambda in TypeScript"
```

---

## Task 13: Lambda — `send-report`

**Files:**
- Create: `src/pipeline/send-report/package.json`
- Create: `src/pipeline/send-report/tsconfig.json`
- Create: `src/pipeline/send-report/handler.ts`

- [ ] **Step 1: Create `src/pipeline/send-report/package.json`**

```json
{
  "name": "@rdc/pipeline-send-report",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@rdc/spider": "workspace:*",
    "exceljs": "4.4.0",
    "resend": "6.12.2"
  }
}
```

- [ ] **Step 2: Create `src/pipeline/send-report/tsconfig.json`**

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." }
}
```

- [ ] **Step 3: Implement `src/pipeline/send-report/handler.ts`**

```typescript
import ExcelJS from 'exceljs'
import { Resend } from 'resend'
import type { ScrapedProduct } from '@rdc/spider'

const resend = new Resend(process.env['RESEND_API_KEY'])

export const handler = async (event: {
  results?: Array<{ unmatched?: ScrapedProduct[] }>
  unmatched?: ScrapedProduct[]
}) => {
  const unmatched: ScrapedProduct[] = event.results
    ? event.results.flatMap(r => r.unmatched ?? [])
    : (event.unmatched ?? [])

  if (unmatched.length === 0) return { sent: false, count: 0 }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Unmatched Products')

  sheet.columns = [
    { header: 'Name',          key: 'name',      width: 40 },
    { header: 'Brand',         key: 'brand',     width: 20 },
    { header: 'Price',         key: 'price',     width: 12 },
    { header: 'Original Price',key: 'bestPrice', width: 14 },
    { header: 'URL',           key: 'url',       width: 60 },
    { header: 'Source',        key: 'source',    width: 12 },
    { header: 'Category',      key: 'category',  width: 14 },
    { header: 'Volume (ml)',   key: 'volumeMl',  width: 12 },
    { header: 'ABV (%)',       key: 'abv',       width: 10 },
    { header: 'Scraped Date',  key: 'date',      width: 14 },
  ]

  const today = new Date().toISOString().split('T')[0]
  for (const p of unmatched) {
    sheet.addRow({ ...p, date: today })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  await resend.emails.send({
    from: process.env['EMAIL_SENDER']!,
    to:   process.env['EMAIL_RECIPIENT']!,
    subject: `RDC Scraper — ${unmatched.length} productos sin match`,
    html: `<p>${unmatched.length} productos no pudieron ser asociados a una bebida.</p>`,
    attachments: [{
      filename: 'unmatched.xlsx',
      content: Buffer.from(buffer).toString('base64'),
    }],
  })

  return { sent: true, count: unmatched.length }
}
```

- [ ] **Step 4: Install and type-check**

```bash
pnpm install
cd src/pipeline/send-report && pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/send-report/
git commit -m "feat: add send-report Lambda in TypeScript"
```

---

## Task 14: Scripts

**Files:**
- Create: `scripts/init-db.ts`
- Create: `scripts/seed-dynamo.ts`

- [ ] **Step 1: Implement `scripts/init-db.ts`**

```typescript
import mongoose from 'mongoose'
import { Info, Product, PriceLog } from '@rdc/database'

const MONGODB_URI = process.env['MONGODB_URI']
const MONGODB_DB  = process.env['MONGODB_DB']

if (!MONGODB_URI || !MONGODB_DB) {
  console.error('MONGODB_URI and MONGODB_DB env vars are required')
  process.exit(1)
}

await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB })

await Info.createIndexes()
await Product.createIndexes()
await PriceLog.createIndexes()

console.log('Database initialized successfully')
await mongoose.disconnect()
```

- [ ] **Step 2: Implement `scripts/seed-dynamo.ts`**

```typescript
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TABLE  = process.argv[2] ?? 'RDCScraper-SpiderConfigsTable'
const REGION = process.argv[3] ?? 'sa-east-1'

const dynamo = new DynamoDBClient({ region: REGION })

type SpiderConfig = {
  spider_id: string; lambda_name: string; enabled: boolean
  info: Record<string, string>; config: Record<string, unknown>
}

const configs: SpiderConfig[] = JSON.parse(
  readFileSync(join(__dirname, '../seed/spider_configs.json'), 'utf-8'),
)

for (const config of configs) {
  await dynamo.send(new PutItemCommand({
    TableName: TABLE,
    Item: marshall({
      id:          config.spider_id,
      lambda_name: config.lambda_name,
      enabled:     config.enabled,
      info:        config.info,
      config:      config.config,
    }),
  }))
  console.log(`Seeded: ${config.spider_id}`)
}
```

- [ ] **Step 3: Add `@aws-sdk/client-dynamodb` and `@aws-sdk/util-dynamodb` as root devDeps**

Add to root `package.json` `devDependencies`:
```json
"@aws-sdk/client-dynamodb": "3.1037.0",
"@aws-sdk/util-dynamodb": "3.996.2",
"mongoose": "9.5.0"
```

Then run:
```bash
pnpm install
```

- [ ] **Step 4: Type-check scripts**

```bash
pnpm exec tsc --noEmit --moduleResolution bundler --module esnext scripts/init-db.ts scripts/seed-dynamo.ts
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "feat: add init-db and seed-dynamo scripts in TypeScript"
```

---

## Task 15: Update `template.yaml`

**Files:**
- Modify: `template.yaml`

Full content of the updated `template.yaml`:

- [ ] **Step 1: Replace `template.yaml` with the Node.js 24.x version**

Replace the full `template.yaml` with:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31

Parameters:
  MongoDbUri:
    Type: String
    NoEcho: true
  MongoDbDatabase:
    Type: String
  S3ImagesBucket:
    Type: String
    Default: rincon-del-curao
  DrinksApiUrl:
    Type: String
    Default: ""
  DrinksApiKey:
    Type: String
    Default: ""
    NoEcho: true
  ProxyEndpoint:
    Type: String
    Default: ""
  ProxyApiKey:
    Type: String
    Default: ""
    NoEcho: true
  ResendApiKey:
    Type: String
    Default: ""
    NoEcho: true
  EmailSender:
    Type: String
    Default: ""
  EmailRecipient:
    Type: String
    Default: ""

Globals:
  Function:
    Runtime: nodejs24.x
    Architectures:
      - arm64

Resources:

  # ── DynamoDB ──────────────────────────────────────────────────────────────

  SpiderConfigsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: RDCScraper-SpiderConfigsTable
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      SSESpecification:
        SSEEnabled: true

  # ── S3 ────────────────────────────────────────────────────────────────────

  ProductImagesBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref S3ImagesBucket

  ProductImagesBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref ProductImagesBucket
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal: "*"
            Action: s3:GetObject
            Resource: !Sub "arn:aws:s3:::${S3ImagesBucket}/images/*"

  # ── Lambdas ───────────────────────────────────────────────────────────────

  PipelineLoadConfigsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: RDCScraper-PipelineLoadConfigsFunction
      CodeUri: src/pipeline/load-configs/
      Handler: handler.handler
      MemorySize: 256
      Timeout: 60
      Environment:
        Variables:
          MONGODB_URI: !Ref MongoDbUri
          MONGODB_DB: !Ref MongoDbDatabase
          SPIDER_CONFIGS_TABLE: !Ref SpiderConfigsTable
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref SpiderConfigsTable
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        EntryPoints:
          - handler.ts

  SpiderJumboFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: RDCScraper-SpiderJumboFunction
      CodeUri: src/spiders/jumbo/
      Handler: handler.handler
      MemorySize: 1024
      Timeout: 300
      Environment:
        Variables:
          S3_BUCKET: !Ref S3ImagesBucket
      Policies:
        - S3WritePolicy:
            BucketName: !Ref S3ImagesBucket
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        EntryPoints:
          - handler.ts

  PipelineMergeResultsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: RDCScraper-PipelineMergeResultsFunction
      CodeUri: src/pipeline/merge-results/
      Handler: handler.handler
      MemorySize: 512
      Timeout: 120
      Environment:
        Variables:
          S3_BUCKET: !Ref S3ImagesBucket
      Policies:
        - S3CrudPolicy:
            BucketName: !Ref S3ImagesBucket
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        EntryPoints:
          - handler.ts

  PipelineFindByPathFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: RDCScraper-PipelineFindByPathFunction
      CodeUri: src/pipeline/find-by-path/
      Handler: handler.handler
      MemorySize: 512
      Timeout: 300
      Environment:
        Variables:
          MONGODB_URI: !Ref MongoDbUri
          MONGODB_DB: !Ref MongoDbDatabase
          S3_BUCKET: !Ref S3ImagesBucket
      Policies:
        - S3CrudPolicy:
            BucketName: !Ref S3ImagesBucket
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        EntryPoints:
          - handler.ts

  PipelineSearchDrinksFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: RDCScraper-PipelineSearchDrinksFunction
      CodeUri: src/pipeline/search-drinks/
      Handler: handler.handler
      MemorySize: 512
      Timeout: 120
      Environment:
        Variables:
          DRINKS_API_URL: !Ref DrinksApiUrl
          DRINKS_API_KEY: !Ref DrinksApiKey
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        EntryPoints:
          - handler.ts

  PipelineSyncProductFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: RDCScraper-PipelineSyncProductFunction
      CodeUri: src/pipeline/sync-product/
      Handler: handler.handler
      MemorySize: 1024
      Timeout: 300
      Environment:
        Variables:
          MONGODB_URI: !Ref MongoDbUri
          MONGODB_DB: !Ref MongoDbDatabase
          S3_BUCKET: !Ref S3ImagesBucket
      Policies:
        - S3WritePolicy:
            BucketName: !Ref S3ImagesBucket
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        EntryPoints:
          - handler.ts
        External:
          - sharp

  PipelineMarkOutOfStockFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: RDCScraper-PipelineMarkOutOfStockFunction
      CodeUri: src/pipeline/mark-out-of-stock/
      Handler: handler.handler
      MemorySize: 256
      Timeout: 60
      Environment:
        Variables:
          MONGODB_URI: !Ref MongoDbUri
          MONGODB_DB: !Ref MongoDbDatabase
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        EntryPoints:
          - handler.ts

  # PipelineSendReportFunction:
  #   Type: AWS::Serverless::Function
  #   Properties:
  #     FunctionName: RDCScraper-PipelineSendReportFunction
  #     CodeUri: src/pipeline/send-report/
  #     Handler: handler.handler
  #     MemorySize: 256
  #     Timeout: 60
  #     Environment:
  #       Variables:
  #         RESEND_API_KEY: !Ref ResendApiKey
  #         EMAIL_SENDER: !Ref EmailSender
  #         EMAIL_RECIPIENT: !Ref EmailRecipient
  #   Metadata:
  #     BuildMethod: esbuild
  #     BuildProperties:
  #       Minify: true
  #       Target: es2022
  #       EntryPoints:
  #         - handler.ts

  # ── Step Functions ────────────────────────────────────────────────────────

  RDCScraperOrchestrator:
    Type: AWS::Serverless::StateMachine
    Properties:
      Name: RDCScraper-Orchestrator
      Definition:
        Comment: "load_configs -> scrape_parallel -> merge_results -> sync_pipeline -> mark_out_of_stock"
        StartAt: LoadConfigs
        States:
          LoadConfigs:
            Type: Task
            Resource: !GetAtt PipelineLoadConfigsFunction.Arn
            ResultPath: $
            Next: ScrapeParallel

          ScrapeParallel:
            Type: Map
            InputPath: $.spiders
            ItemsPath: $
            MaxConcurrency: 5
            Iterator:
              StartAt: RunSpider
              States:
                RunSpider:
                  Type: Task
                  Resource: arn:aws:states:::lambda:invoke
                  Parameters:
                    FunctionName.$: $.lambda_name
                    Payload:
                      config.$: $.config
                      execution_id.$: $$.Execution.Name
                  ResultSelector:
                    s3_key.$: $.Payload.s3_key
                  End: true
            ResultPath: $.spider_results
            Next: MergeResults

          MergeResults:
            Type: Task
            Resource: !GetAtt PipelineMergeResultsFunction.Arn
            Parameters:
              s3_keys.$: "$.spider_results[*].s3_key"
              execution_id.$: "$$.Execution.Name"
            ResultPath: $.batches
            Next: SyncPipeline

          SyncPipeline:
            Type: Map
            InputPath: $.batches
            ItemsPath: $
            MaxConcurrency: 10
            Iterator:
              StartAt: FindByPath
              States:
                FindByPath:
                  Type: Task
                  Resource: !GetAtt PipelineFindByPathFunction.Arn
                  Parameters:
                    s3_key.$: $.s3_key
                    category.$: $.category
                    sync_token.$: $$.Execution.StartTime
                  Next: SearchDrinks
                SearchDrinks:
                  Type: Task
                  Resource: !GetAtt PipelineSearchDrinksFunction.Arn
                  Next: SyncProduct
                SyncProduct:
                  Type: Task
                  Resource: !GetAtt PipelineSyncProductFunction.Arn
                  End: true
            ResultPath: $.sync_results
            Next: MarkOutOfStock

          MarkOutOfStock:
            Type: Task
            Resource: !GetAtt PipelineMarkOutOfStockFunction.Arn
            Parameters:
              sync_token.$: "$$.Execution.StartTime"
            End: true

      Policies:
        - LambdaInvokePolicy:
            FunctionName: !Ref PipelineLoadConfigsFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref SpiderJumboFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref PipelineMergeResultsFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref PipelineFindByPathFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref PipelineSearchDrinksFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref PipelineSyncProductFunction
        - LambdaInvokePolicy:
            FunctionName: !Ref PipelineMarkOutOfStockFunction
      Tracing:
        Enabled: true
      Logging:
        Level: ERROR
        IncludeExecutionData: false
```

- [ ] **Step 2: Commit**

```bash
git add template.yaml
git commit -m "feat: update SAM template for Node.js 24 + esbuild"
```

---

## Task 16: Remove Python source files

**Files:**
- Delete: all Python Lambda and shared source files

- [ ] **Step 1: Remove Python source files tracked by git**

```bash
git rm src/shared/python/base_spider.py \
       src/shared/python/fetchers.py \
       src/shared/python/standard_format.py \
       src/shared/python/path_resolver.py \
       src/shared/database/python/mongo.py \
       src/core/spiders/jumbo/spider.py \
       src/core/spiders/jumbo/handler.py \
       src/core/pipeline/load_configs/handler.py \
       src/core/pipeline/merge_results/handler.py \
       src/core/pipeline/find_by_path/handler.py \
       src/core/pipeline/search_drinks/handler.py \
       src/core/pipeline/search_drinks/drinks_client.py \
       src/core/pipeline/sync_product/handler.py \
       src/core/pipeline/sync_product/image_uploader.py \
       src/core/pipeline/sync_product/utils.py \
       src/core/pipeline/mark_out_of_stock/handler.py \
       src/core/pipeline/send_report/handler.py \
       scripts/init_db.py \
       scripts/seed_dynamo.py
```

Also remove any remaining `requirements.txt` files:

```bash
git rm $(git ls-files '*.txt' | grep requirements) 2>/dev/null || true
git rm $(git ls-files '*.toml' | grep -v samconfig) 2>/dev/null || true
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove all Python source files"
```

---

## Task 17: Build verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: All tests PASS (standard-format, path-resolver, sync-product utils).

- [ ] **Step 2: Type-check all workspace packages**

```bash
pnpm -r exec tsc --noEmit
```

Expected: No errors across all packages.

- [ ] **Step 3: Run `sam build`**

```bash
sam build
```

Expected: All 7 Lambda functions build successfully under `.aws-sam/build/`.

- [ ] **Step 4: Verify build output**

```bash
ls .aws-sam/build/
```

Expected output (all 7 functions present):
```
PipelineLoadConfigsFunction
SpiderJumboFunction
PipelineMergeResultsFunction
PipelineFindByPathFunction
PipelineSearchDrinksFunction
PipelineSyncProductFunction
PipelineMarkOutOfStockFunction
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: migration complete — Python → TypeScript 6"
```
