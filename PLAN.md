# RDC Scraper — Plan de proyecto (Python 3.14 · uv · AWS SAM)

> **Contexto:** se cancela la migración a TypeScript (`v3_ts`). Este documento describe cómo
> reconstruir el proyecto **desde cero en Python 3.14**, usando el código actual del branch
> como **prototipo de referencia** (`src/core/**` y `src/shared/python/**`).
>
> El objetivo es un scraper serverless de precios de bebidas para e-commerce chilenos,
> orquestado con AWS Step Functions y desplegado con AWS SAM.

---

## 0. Cambios de enfoque respecto al prototipo

1. **Gestión de dependencias con `uv`** (workspace + `pyproject.toml` + `uv.lock`). No se usa
   `pip` ni `requirements.txt` a mano; para empaquetar en Lambda se **exporta** un
   `requirements.txt` por función desde `uv` en el paso de build.
2. **Spiders sin abstracción rígida.** Se elimina `BaseSpider`. Cada spider es una **Lambda
   independiente** con su propia lógica de scraping y su **config en código** (constantes del
   propio módulo). Lo único que se mantiene **consolidado y obligatorio** para todos:
   - **La misma estructura de salida** → `ScrapedProduct` (contrato común).
   - **Los fetchers** → lógica de fetch (JSON / HTML / Proxy) compartida en la Layer.
3. **Sin DynamoDB.** Al no haber configuración dinámica de spiders, se elimina la tabla
   `SpiderConfigsTable` y la etapa `LoadConfigs`. La lista de spiders es **estática** (una rama
   por spider en el pipeline).
4. **Arranque en paralelo.** El pipeline lanza todos los spiders **en paralelo al inicio**
   (Step Functions `Parallel`, una rama por spider Lambda).
5. **`infos` sembrados en Mongo.** La metadata de tienda (`code, name, logo, url`), que antes
   insertaba `LoadConfigs` desde DynamoDB, se **siembra una sola vez** en la colección `infos`
   con un script (`scripts/seed_infos.py`).

---

## 1. Decisiones de arquitectura

| Decisión | Elección | Motivo |
|---|---|---|
| Lenguaje / runtime | **Python 3.14**, arquitectura **arm64** | Menor costo, runtime más reciente |
| Dependencias | **uv** (workspace, `pyproject.toml`, `uv.lock`) | Resolución rápida y reproducible |
| IaC / deploy | **AWS SAM** (`template.yaml` + `samconfig.toml`) | Estándar del prototipo |
| Orquestación | **Step Functions** (Standard) | `Parallel` al inicio + `Map` con timeouts largos |
| Spiders | **1 Lambda independiente por spider**, config en código | Cada sitio es distinto; sin abstracción forzada |
| Contrato común | **`ScrapedProduct`** (salida) + **fetchers** (Layer) | Consolida lo único que debe ser homogéneo |
| Datos de productos | **MongoDB Atlas** — driver **`pymongo==4.17`** (async nativo, `AsyncMongoClient`) | `motor` está deprecado; pymongo async integrado |
| Imágenes + datos intermedios | **S3** (`rincon-del-curao`) | Público solo `images/*` |
| Código compartido | **Lambda Layer** (`rdc_shared`) | Fetchers, formato, mongo, naming/mappings |
| Concurrencia | **asyncio + aiohttp** dentro de cada Lambda | Scraping y I/O masivo |
| Notificaciones | **Resend** (email con Excel adjunto) | Reporte de productos sin match |
| Bypass anti-bot | **Proxy HTTP externo** (opcional por spider) | Fallback cuando el fetch directo falla |

---

## 2. Prerrequisitos (instalación de herramientas)

```bash
# 1. uv  (gestiona Python + venv + dependencias)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Python 3.14  (uv lo instala y lo fija por proyecto)
uv python install 3.14
uv python pin 3.14           # crea .python-version

# 3. AWS CLI v2
sudo pacman -S aws-cli-v2
aws configure                # access key, secret, region = sa-east-1

# 4. AWS SAM CLI
uv tool install aws-sam-cli
sam --version

# 5. Docker  (sam build --use-container: compila deps nativas arm64/Lambda)
sudo pacman -S docker && sudo systemctl enable --now docker

# 6. Tooling de dev (declarado en pyproject como dev-deps, se usa vía uv run)
uv sync                      # instala todo el workspace + dev tools (ruff, pytest)
```

> **Por qué Docker:** `Pillow` y otras dependencias con binarios nativos deben compilarse para
> el entorno de Lambda (Amazon Linux, arm64). `sam build --use-container` lo garantiza.

---

## 3. Recursos AWS y cuentas externas a provisionar

### AWS (creados por el `template.yaml`)
- **S3** `rincon-del-curao` — imágenes públicas (`images/*`) + datos intermedios (`pipeline/*`, privados).
- **Lambdas**: una por spider + una por etapa de pipeline, más la **Lambda Layer** compartida.
- **Step Functions** `RDCScraper-Orchestrator`.
- **IAM Roles** para Step Functions y EventBridge.
- **EventBridge Rule** (cron) para disparo programado.

> Ya **no** se crea `SpiderConfigsTable` (DynamoDB eliminado).

### AWS (una sola vez, manual)
- Bucket de despliegue de SAM → auto con `resolve_s3 = true` en `samconfig.toml`.
- Usuario/rol IAM con permisos de deploy (CloudFormation, Lambda, IAM, S3, States, Events).

> **Estado actual del deploy user (`RDC-DeveloperUser`, cuenta `536697241925`):** la policy vigente
> cubre `cloudformation:* · s3:* · lambda:* · ecr:*` + IAM (`CreateRole/PassRole/…`). Suficiente
> hasta la Fase 3 (bucket, Layer, Lambdas). **Antes de la Fase 3+/6 hay que añadir** `states:*`
> (Step Functions) y `events:*` o `scheduler:*` (EventBridge cron); opcionalmente `logs:*` y
> `iam:GetRolePolicy`/`ListRolePolicies`/`ListAttachedRolePolicies` para updates/deletes robustos
> del stack.

### Externos
- **MongoDB Atlas**: cluster + usuario + IP allowlist → `MONGODB_URI`.
- **Resend**: API key + remitente verificado → `RESEND_API_KEY`, `EMAIL_SENDER`.
- **RDC Drinks API**: URL base + API key → `DRINKS_API_URL`, `DRINKS_API_KEY`.
- **Proxy anti-bot** (opcional): endpoint + API key → `PROXY_ENDPOINT`, `PROXY_API_KEY`.

---

## 4. Arquitectura de carpetas (proyecto nuevo)

```
rdc-scraper/
├── README.md
├── PLAN.md                          # este documento
├── template.yaml                    # SAM: recursos + state machine
├── samconfig.toml                   # (gitignored) parámetros reales de deploy
├── samconfig.example.toml           # plantilla versionada
├── pyproject.toml                   # workspace uv + dev-deps (ruff, pytest)
├── uv.lock                          # lockfile reproducible
├── .python-version                  # 3.14 (uv pin)
├── Makefile                         # atajos: build, deploy, seed, test, lint
├── .gitignore
│
├── seed/
│   └── infos.json                   # metadata de tiendas → colección `infos` de Mongo
│
├── scripts/
│   ├── seed_infos.py                # siembra seed/infos.json en Mongo (una vez)
│   └── run_spider_local.py          # ejecuta un spider en local (sin AWS)
│
└── src/                             # ── código: layer compartido + una carpeta por Lambda ──
    ├── shared/                      # ── Lambda Layer: código compartido (ContentUri) ──
    │   ├── pyproject.toml           # deps: aiohttp, beautifulsoup4, pymongo==4.17
    │   └── python/                  # SAM monta esta carpeta en sys.path
    │       └── rdc_shared/
    │           ├── __init__.py
    │           ├── fetchers.py          # IFetcher, JsonFetcher, HtmlFetcher, ProxyFetcher  ← obligatorio
    │           ├── standard_format.py   # ScrapedProduct + create_product                  ← contrato de salida
    │           ├── path_resolver.py     # resolve_path / extract_field (opcional por spider)
    │           ├── mappings.py          # CATEGORY_MAP, PACKAGING_MAP(_ES), SPIRIT_TYPE_MAP_ES
    │           ├── naming.py            # generate_sku / product_name / product_slug / slugify
    │           └── mongo/
    │               ├── __init__.py
    │               ├── client.py        # AsyncMongoClient + event loop persistente
    │               ├── info_cache.py    # cache de infos {code: _id}
    │               ├── products.py      # find_by_path, add_website, create_product, price logs
    │               └── stock.py         # mark_out_of_stock
    │
    ├── spiders/                     # cada spider: independiente, config propia en código
    │   └── jumbo/
    │       ├── pyproject.toml       # deps propias (p.ej. solo aiohttp vía Layer)
    │       ├── handler.py           # lambda_handler → corre spider, sube a S3
    │       ├── spider.py            # lógica libre de Jumbo (usa fetchers + ScrapedProduct)
    │       └── config.py            # constantes del spider (urls, headers, categorías, store)
    │   # └── <otro_spider>/ …       # se agrega una carpeta + una rama en el Parallel
    │
    └── pipeline/
        ├── merge_results/
        │   ├── pyproject.toml
        │   └── handler.py
        ├── find_by_path/
        │   ├── pyproject.toml
        │   └── handler.py
        ├── search_drinks/
        │   ├── pyproject.toml
        │   ├── handler.py
        │   └── drinks_client.py
        ├── sync_product/
        │   ├── pyproject.toml       # Pillow
        │   ├── handler.py
        │   └── image_uploader.py    # descarga → WebP → S3
        ├── mark_out_of_stock/
        │   ├── pyproject.toml
        │   └── handler.py
        └── send_report/
            ├── pyproject.toml       # openpyxl, resend
            └── handler.py           # Excel → email (Resend)
```

### Notas
- **Contrato entre spiders:** cada `spider.py` es libre en su flujo, pero **debe** (a) usar los
  fetchers de `rdc_shared.fetchers` y (b) devolver dicts con la forma de `ScrapedProduct`
  (`rdc_shared.standard_format.create_product`). Nada más se comparte ni se impone.
- **Config por spider:** vive en `src/spiders/<name>/config.py` como constantes; se elimina
  `seed/spider_configs.json` y la tabla DynamoDB.
- **uv workspace:** el `pyproject.toml` raíz declara los miembros (`src/shared`,
  `src/spiders/*`, `src/pipeline/*`); un único `uv.lock` fija todo.
- `boto3` viene en el runtime de Lambda → **no** se declara como dependencia.

---

## 5. Arquitectura del pipeline (Step Functions)

```
                         ┌────────────────────┐
   EventBridge (cron) ──▶│  RDCScraper-        │
   0 10,18 * * ? *       │  Orchestrator       │
                         └─────────┬──────────┘
                                   ▼
                          ① ScrapeParallel             (Parallel — una rama por spider)
                          ├─ InvokeSpiderJumbo   → s3://.../pipeline/runs/jumbo/<exec>.json
                          ├─ InvokeSpider<...>   → { s3_key, count }
                          └─ …
                          → [ {s3_key,count}, {s3_key,count}, … ]
                                   ▼
                          ② MergeResults               (Lambda)
                          carga todos los S3, dedup por url,
                          agrupa por categoría, escribe batches (250)
                          → [{ s3_key, category, count }]
                                   ▼
                          ③ SyncPipeline               (Map, maxConcurrency 10)
                          por batch:
                            ③a FindByPath   → match por websites.path; actualiza precio;
                                              → { remaining, sync_token, category }
                            ③b SearchDrinks → busca en Drinks API los remaining;
                                              → { matched, unmatched, ... }
                            ③c SyncProduct  → matched: add_website | create_product (+imagen WebP a S3)
                                              → { sync_token }  (unmatched se propaga)
                                   ▼
                          ④ MarkOutOfStock             (Lambda)
                          websites con lastUpdate ≠ sync_token → inStock:false, precios 0
                                   ▼
                          ⑤ SendReport                 (Lambda)
                          junta unmatched de todos los batches → Excel → email (Resend)
```

**Añadir un spider nuevo** = crear `src/spiders/<name>/` + agregar una rama al estado `Parallel`
(y su `AWS::Serverless::Function` en el template). Sin tocar DynamoDB ni ninguna config externa.

**Tokens clave**
- `execution_id` = `$$.Execution.Name` → namespacing de archivos S3 intermedios.
- `sync_token` = `$$.Execution.StartTime` → marca de "visto en esta corrida"; lo que no se toca
  queda out-of-stock en ④.

---

## 6. Modelo de datos

### `ScrapedProduct` (contrato de salida de **todo** spider — `standard_format.py`)
```
name, price (int, sin descuento), best_price (int, final), url, source, scraped_at,
brand?, image_url?, volume_ml?, abv?, category?, sku?, quantity? (pack, default 1),
packaging? (Botella|Lata|Barril|Tetrapack)
```

### MongoDB (colecciones)
- **`infos`** — tiendas (sembrado con `scripts/seed_infos.py`): `{ _id, code, name, logo, url }`.
- **`products`** — producto de dominio:
  ```
  { _id, sku, name, slug, quantity, category,
    drink: { id, brand, name, abv, volume, packaging(ES), type?(ES) },
    images: [url],
    websites: [ { info, path, price, bestPrice, lastUpdate, inStock } ] }
  ```
- **`priceLogs`** — histórico diario: `{ productId, websitePath, price, bestPrice, date(00:00 UTC) }`. Índice TTL sobre `date` → retención acotada del histórico.

> La config de cada spider (urls, headers, categorías, store, page_size) ya **no** es un dato:
> vive en `src/spiders/<name>/config.py`.

### 6.1 Rol de la seed y bloqueo por tienda no cargada

La seed de `infos` deja de ser un simple "poblar datos" y pasa a ser el **allowlist de tiendas
válidas**: la colección `infos` es la **única fuente de verdad** de qué `source` puede escribir
en Mongo.

**`scripts/seed_infos.py` (+ `seed/infos.json`) — responsabilidades**
1. **Upsert idempotente** de la metadata de cada tienda en `infos`, con clave `code`
   (`{ code, name, logo, url }`). Reejecutarlo no duplica ni pisa `_id` existentes.
2. Definir el conjunto de tiendas habilitadas. Una tienda **no** sembrada aquí no existe para
   el pipeline, aunque su spider corra y scrapee.

**Bloqueo en el momento de guardar (gate de escritura)**
- El módulo compartido `rdc_shared/mongo/info_cache.py` carga en memoria el mapa
  `{ code → _id }` desde `infos` al inicio de la invocación (cacheado entre invocaciones por
  reutilización de contenedor).
- En `find_by_path` y `sync_product`, **antes de escribir nada** para un producto se resuelve
  `info_id = info_cache.get(product["source"])`.
- Si el `source` **no tiene `info`** (tienda no sembrada), se **bloquea la escritura**: el
  producto **no** se inserta ni actualiza en Mongo (ni en `products` ni en `priceLogs`) y se
  enruta a `unmatched` con motivo `unknown_source`, para que aparezca en el reporte final.

> **Consecuencia operativa:** habilitar un spider nuevo requiere **dos** pasos, no uno:
> (a) crear `src/spiders/<name>/` y su rama en el `Parallel`, y (b) **sembrar su `info`** con
> `seed_infos.py`. Sin el paso (b), su data se descarta por diseño — nunca entra a Mongo con
> una tienda desconocida o `info` nula.

### 6.2 Relaciones entre colecciones (FK) y llaves

MongoDB no tiene FKs reales; estas son las referencias **lógicas** y las llaves de negocio que
usa el pipeline (derivadas de los `find_one`/`update` del prototipo). Definen los índices a crear.

**Referencias (FK lógicas)**

| Origen | Campo | Destino | Cardinalidad |
|---|---|---|---|
| `products` | `websites[].info` | `infos._id` | N websites → 1 info |
| `priceLogs` | `productId` | `products._id` | N logs → 1 product |
| `priceLogs` | `websitePath` | `products.websites[].path` | log ligado a un website concreto |
| `products` | `drink.id` | **externo** → RDC Drinks API | 1 product → 1 drink (no es colección Mongo) |

**Índices actuales (fuente de verdad — estado en Atlas)**

| Colección | Índice | Campos (orden) | Único | Notas |
|---|---|---|---|---|
| `infos` | `code` | `code ↑` | ✅ | = `source` del spider; llave del info-cache |
| `products` | `unique_sku` | `sku ↑` | ✅ | SKU generado |
| `products` | `unique_slug` | `slug ↑` | ✅ | slug público, único por definición |
| `products` | `unique_website_path` | `websites.path ↑` | ✅ | una URL → un solo producto; llave de `find_by_path` |
| `products` | `unique_drink_variant` | `drink.id ↑, drink.volume ↑, drink.packaging ↑, quantity ↑` | ✅ | identifica la variante; `sync_product` decide `add_website` vs `create_product` |
| `products` | `category` | `category ↑` | ❌ | filtrado / agrupación por categoría |
| `products` | `websites_last_update` | `websites.lastUpdate ↑` | ❌ | acelera `mark_out_of_stock` |
| `priceLogs` | `product_website_date` | `productId ↑, websitePath ↑, date ↓` | ✅ | un log por producto-website-día; `date ↓` favorece consultas recientes primero |
| `priceLogs` | `ttl_date` | `date ↑` (TTL, 6 meses) | ❌ | expira logs > 6 meses automáticamente |

> `drink.packaging` en `unique_drink_variant` es la versión **en español** (`PACKAGING_MAP_ES`),
> consistente con cómo se guarda. El índice único en `websites.path` garantiza a nivel de DB que
> una URL de tienda no se asocie a dos productos distintos; complementa el gate de `info` de §6.1.

**Comandos equivalentes**

```js
db.infos.createIndex({ code: 1 }, { name: "code", unique: true })

db.products.createIndex({ sku: 1 }, { name: "unique_sku", unique: true })
db.products.createIndex({ slug: 1 }, { name: "unique_slug", unique: true })
db.products.createIndex({ "websites.path": 1 }, { name: "unique_website_path", unique: true })
db.products.createIndex(
  { "drink.id": 1, "drink.volume": 1, "drink.packaging": 1, quantity: 1 },
  { name: "unique_drink_variant", unique: true }
)
db.products.createIndex({ category: 1 }, { name: "category" })
db.products.createIndex({ "websites.lastUpdate": 1 }, { name: "websites_last_update" })

db.priceLogs.createIndex(
  { productId: 1, websitePath: 1, date: -1 },
  { name: "product_website_date", unique: true }
)
// TTL 6 meses = 180 días
db.priceLogs.createIndex({ date: 1 }, { name: "ttl_date", expireAfterSeconds: 15552000 })
```

### 6.3 Propósito de cada índice y su repercusión en el pipeline

Lectura *índice → consulta del código → etapa donde impacta*.

**`infos`**
- **`code` (único):** una tienda por `code`; llave del *info-cache* (`infos.find({},{code:1})`) y del
  upsert idempotente del seed (`find_one({code})`). Sostiene el **gate de §6.1** (`source → info_id`).
  La colección es minúscula: su valor es la **integridad del allowlist**, no la velocidad.

**`products`**
- **`unique_website_path` (`websites.path`, único) — el más caliente:** consulta central de
  **FindByPath** (`find_one({"websites.path": url})`), que corre **por cada producto de cada batch**.
  Sin él, esa etapa sería collection scan por producto. Su unicidad impide colgar una URL en dos productos.
- **`unique_drink_variant` (`drink.id, drink.volume, drink.packaging, quantity`, único):**
  **SyncProduct** decide `add_website` vs `create_product` con este `find_one`. Da dedup de dominio y
  **seguridad ante concurrencia** (Map `maxConcurrency 10`): un insert duplicado simultáneo falla y
  cae a `unmatched` en vez de duplicar.
- **`unique_sku` (`sku`, único):** `unique_sku()` reintenta hasta hallar SKU libre antes de subir imagen.
  El SKU es la carpeta en S3 (`images/{category}/{sku}/`) → unicidad = **sin colisión de imágenes**.
- **`unique_slug` (`slug`, único):** slug público de la app; el pipeline no lo consulta pero un slug
  duplicado haría fallar el insert → producto a `unmatched`.
- **`category` (no único):** lo usan las **consultas de la app** (navegar por categoría), no la escritura
  del scraper. Único índice ajeno al flujo del pipeline.
- **`websites_last_update` (`websites.lastUpdate`, no único):** acelera **MarkOutOfStock**
  (`update_many` con `lastUpdate ≠ sync_token`). Sin él, escanea toda `products` cada corrida.
  Es multikey y el `$ne` no es muy selectivo, pero acota candidatos.

**`priceLogs`**
- **`product_website_date` (`productId ↑, websitePath ↑, date ↓`, único):** FindByPath y SyncProduct
  llaman `_upsert_price_log_today` (`find_one({productId, websitePath, date})`). Hace **idempotente** el
  log diario (correr 2×/día actualiza el del día, no duplica). `date ↓` favorece histórico reciente-primero.
- **`ttl_date` (`date`, TTL 6 meses):** nadie lo consulta; el deleter de Mongo borra logs > 6 meses.
  Acota costo sin limpieza manual (cada log muere ~6 meses tras su fecha a medianoche UTC).

**Dos patrones transversales**
1. **Los índices únicos son también red de integridad y ruteo de errores:** en SyncProduct un
   `DuplicateKeyError` (variant/sku/slug/path) se atrapa → el producto sale como `error`/`unmatched` →
   termina en el reporte de **SendReport**. Los índices definen **qué se descarta y por qué**.
2. **El costo del SyncPipeline se concentra en 3 índices:** `unique_website_path` (FindByPath, por
   producto) y `unique_drink_variant` + `unique_sku` (SyncProduct, por creación). Son los a vigilar si
   crece el volumen.

---

## 7. Implementación paso a paso (por fases)

Cada fase es desplegable y verificable de forma independiente.

### Paso previo — Archivar el prototipo actual
Antes de escribir una sola línea del proyecto nuevo, **conservar el prototipo como referencia
local sin que ensucie el repo**:
1. Mover **todo** el contenido actual del proyecto (`src/`, `template.yaml`, `esbuild.config.ts`,
   `package.json`, `seed/`, `samconfig.example.toml`, `tsconfig*`, etc.) a una carpeta **`.deprecated/`**
   en la raíz. Excepciones: `.git/` y `PLAN.md` se quedan fuera.
2. Añadir **`.deprecated/`** al `.gitignore` → queda disponible en local como consulta, pero **no
   se versiona ni se despliega**.
3. A partir de aquí, todas las rutas “del prototipo” que menciona este plan (p. ej.
   `src/core/**`, `src/shared/python/**`) se leen desde `.deprecated/…`.

> Objetivo: la raíz queda limpia para el árbol de §4, pero el código Python de referencia sigue
> a mano para portarlo (§12) sin depender de checkout del branch `v3_ts`.

### Fase 0 — Andamiaje del repo (uv)
1. **Herramientas instaladas y configuradas** según §2: `uv` + Python 3.14 (`uv python pin 3.14`),
   AWS CLI v2 (`aws configure`, region `sa-east-1`), SAM CLI, Docker activo. Verificar
   (`uv --version`, `aws sts get-caller-identity`, `sam --version`, `docker info`) antes de seguir.
2. `uv init` + estructura de carpetas de §4.
3. `pyproject.toml` raíz como **workspace** con los miembros (`src/shared`, `src/spiders/*`, `src/pipeline/*`) y dev-deps (`ruff`, `pytest`).
4. `Makefile` (`build`, `deploy`, `seed`, `test`, `lint`) y `.gitignore` (`.deprecated/`, `.aws-sam/`, `samconfig.toml`, `__pycache__/`, `.venv/`).
5. `template.yaml` mínimo: `ProductImagesBucket` + `LayerVersion` (vacía).
6. `uv sync` + `sam validate` verdes.

### Fase 1 — Layer compartida (`rdc_shared`)
Portar desde el prototipo `src/shared/python/**`, re-empaquetado como `rdc_shared`:
- `fetchers.py`, `standard_format.py`, `path_resolver.py` → tal cual, imports a `rdc_shared.*`.
- Añadir `mappings.py` y `naming.py` (extraídos de `sync_product/utils.py`).
- `mongo/` — consolidar `find_by_path/db.py` + `sync_product/db.py` + `mark_out_of_stock/db.py` en un módulo con **un solo** `AsyncMongoClient` y event loop persistente reutilizado entre invocaciones.
- Declarar `LayerVersion` (runtime `python3.14`, arm64) y adjuntarla a todas las funciones.
- **No** se porta `base_spider.py` (abstracción eliminada).

### Fase 2 — Spider Jumbo + ScrapeParallel
- `spiders/jumbo/config.py`: constantes (antes en el item de DynamoDB).
- `spiders/jumbo/spider.py`: portar la lógica de `JumboSpider` (PLP paginado → slugs → PDP → format con extractores de abv/volumen/cantidad/packaging), **sin heredar de BaseSpider**; usa `rdc_shared.fetchers` y `create_product`.
- `spiders/jumbo/handler.py`: corre el spider, sube JSON a `pipeline/runs/jumbo/<exec>.json`, devuelve `{s3_key, count}`.
- State machine: estado `Parallel` con la rama `InvokeSpiderJumbo`.
- Verificar en local con `scripts/run_spider_local.py jumbo`.

### Fase 3 — MergeResults
- Portar `merge_results/handler.py`: carga los S3 de las ramas del `Parallel`, dedup por url, agrupa por categoría, batches de 250.
- State machine: `ScrapeParallel → MergeResults`.

### Fase 4 — Seed de `infos` + SyncPipeline (Map: FindByPath → SearchDrinks → SyncProduct)
- `seed/infos.json` + `scripts/seed_infos.py`: sembrar tiendas en Mongo (upsert idempotente por `code`). Es el **allowlist** de `source` válidos (ver §6.1).
- `rdc_shared/mongo/info_cache.py`: mapa `{code → _id}`; **si `source` no está sembrado, bloquea la escritura** y enruta el producto a `unmatched` (`unknown_source`).
- `find_by_path`: match por `websites.path`, `update_price_if_changed`, upsert `priceLogs` (solo si el `source` tiene `info`).
- `search_drinks` + `drinks_client`: filtra por campos requeridos, consulta Drinks API, `_best_match` por subconjunto de palabras.
- `sync_product` + `image_uploader`: gate de `info_id` → `add_website` o `create_product`; SKU único **antes** de subir imagen (evita huérfanos en S3); descarga → WebP (Pillow) → S3.
- State machine: `MergeResults → SyncPipeline(Map, maxConcurrency 10)`.

### Fase 5 — MarkOutOfStock + SendReport
- `mark_out_of_stock`: `update_many` con `array_filters` sobre `lastUpdate ≠ sync_token`.
- `send_report`: junta `unmatched`, genera Excel (openpyxl), envía email con adjunto (Resend).
- State machine: `SyncPipeline → MarkOutOfStock → SendReport (End)`.

### Fase 6 — Scheduling + hardening
- EventBridge Rule `cron(0 10,18 * * ? *)` → `StartExecution`.
- Revisar timeouts/memoria por Lambda, políticas IAM mínimas, `NoEcho` en secretos.
- Alarmas CloudWatch sobre fallos de la state machine.

---

## 8. Configuración (parámetros SAM y variables de entorno)

Parámetros de `template.yaml` (valores reales en `samconfig.toml`, **nunca** commiteados):

| Parámetro | Uso | Lambdas |
|---|---|---|
| `MongoDbUri` (NoEcho) | Conexión Atlas | find_by_path, sync_product, mark_out_of_stock (+ seed script) |
| `MongoDbDatabase` | `dev` \| `prod` | idem |
| `S3ImagesBucket` | Bucket imágenes/pipeline | spiders, merge, find_by_path, sync_product |
| `DrinksApiUrl` / `DrinksApiKey` | RDC Drinks API | search_drinks |
| `ProxyEndpoint` / `ProxyApiKey` | Bypass anti-bot | spiders |
| `ResendApiKey` / `EmailSender` / `EmailRecipient` | Reporte | send_report |

Env vars por Lambda: `MONGODB_URI`, `MONGODB_DB`, `S3_PIPELINE_BUCKET`, `S3_IMAGES_BUCKET`,
`DRINKS_API_URL`, `DRINKS_API_KEY`, `PROXY_ENDPOINT`, `PROXY_API_KEY`, `RESEND_API_KEY`,
`EMAIL_SENDER`, `EMAIL_RECIPIENT`.  *(Ya no existe `CONFIG_TABLE`.)*

### 8.1 Convención de nombres de recursos AWS

Se comparte la cuenta AWS con **otros proyectos**, por lo que **todo** recurso creado por este
stack debe llevar el prefijo **`RDCScraper-`** en su nombre físico, con el `[Nombre]` en
**PascalCase**:

```
RDCScraper-[Nombre]
```

Aplica a la propiedad de nombre físico del recurso (`FunctionName`, `Name`, `RoleName`,
`LayerName`, `RuleName`…), **no** al *logical ID* del `template.yaml`. El *logical ID* puede ir
sin prefijo (ya está namespaced por el stack); el prefijo importa donde el nombre aparece en la
consola/CLI global de la cuenta.

| Componente | Nombre físico |
|---|---|
| Stack CloudFormation | `rdc-scraper` (kebab, en `samconfig.toml`) |
| Lambda Layer compartida | `RDCScraper-SharedLayer` |
| Lambda spider (por sitio) | `RDCScraper-SpiderJumboFunction`, `RDCScraper-Spider<Sitio>Function` |
| Lambda merge | `RDCScraper-PipelineMergeResultsFunction` |
| Lambda find by path | `RDCScraper-PipelineFindByPathFunction` |
| Lambda search drinks | `RDCScraper-PipelineSearchDrinksFunction` |
| Lambda sync product | `RDCScraper-PipelineSyncProductFunction` |
| Lambda mark out of stock | `RDCScraper-PipelineMarkOutOfStockFunction` |
| Lambda send report | `RDCScraper-PipelineSendReportFunction` |
| Step Functions | `RDCScraper-Orchestrator` |
| IAM Role (orquestador) | `RDCScraper-OrchestratorRole` |
| IAM Role (EventBridge) | `RDCScraper-EventBridgeRole` |
| EventBridge Rule (cron) | `RDCScraper-ScheduleTrigger` |
| Log group (por Lambda) | `/aws/lambda/RDCScraper-…` (deriva del `FunctionName`) |

**Excepción:** el bucket S3 de imágenes conserva su nombre de dominio **`rincon-del-curao`**
(recurso público de negocio, no un componente interno del stack). El resto de nombres físicos
sí llevan el prefijo.

> Recomendación adicional: aplicar también un **tag** común `Project = RDCScraper` a todos los
> recursos (vía `Tags` en `template.yaml`) para filtrado y control de costos en Cost Explorer.

---

## 9. Build, deploy y seed

`uv` gestiona las dependencias; SAM necesita un `requirements.txt` por artefacto, que se
**exporta desde uv** en el build (integrado en el `Makefile`).

```bash
# Exportar requirements.txt por función/layer desde el lockfile de uv
#   (un target del Makefile recorre cada miembro del workspace)
make export            # p.ej.: uv export --package <miembro> --no-hashes -o <dir>/requirements.txt

# Build (contenedor para compilar Pillow y deps nativas arm64)
make build             # == make export && sam build --use-container

# Primer deploy (interactivo → genera samconfig.toml)
sam deploy --guided

# Deploys posteriores
make deploy

# Sembrar la metadata de tiendas en Mongo (una sola vez / al agregar tiendas)
uv run scripts/seed_infos.py --uri "$MONGODB_URI" --db "$MONGODB_DB" --file seed/infos.json

# Ejecutar el pipeline manualmente
aws stepfunctions start-execution --state-machine-arn <arn-orchestrator>
```

---

## 10. Testing y ejecución local

```bash
# Spider aislado, sin AWS (usa su config.py)
uv run scripts/run_spider_local.py jumbo

# Invocar una Lambda con evento de ejemplo
sam local invoke PipelineMergeResultsFunction -e events/merge_results.json

# Unit tests (extractores del spider, path_resolver, naming, best_match)
uv run pytest

# Lint + format
uv run ruff check . && uv run ruff format --check .
```

Priorizar tests de lógica pura (sin red): extractores de abv/volumen/cantidad/packaging,
`path_resolver`, `generate_product_name/slug`, `_best_match`.

---

## 11. Checklist de puesta en marcha

- [ ] Herramientas instaladas (uv, Python 3.14, AWS CLI, SAM, Docker).
- [ ] `uv sync` OK; workspace con todos los miembros.
- [ ] MongoDB Atlas: cluster + usuario + allowlist.
- [ ] Cuentas externas: Resend (remitente verificado), Drinks API, Proxy.
- [ ] Estructura de carpetas creada (§4).
- [ ] Layer `rdc_shared` portada (fetchers + standard_format + mongo + naming/mappings) y `sam validate` verde.
- [ ] `ProductImagesBucket` desplegado.
- [ ] Spider Jumbo probado en local (contrato `ScrapedProduct`).
- [ ] `infos` sembrados en Mongo.
- [ ] Pipeline completo (①–⑤) en la state machine.
- [ ] Ejecución manual end-to-end correcta.
- [ ] EventBridge cron activado.
- [ ] Alarmas CloudWatch configuradas.

---

## 12. Reutilización directa del prototipo

Estos archivos del branch actual se portan casi 1:1 (ajustando imports a `rdc_shared.*`):

| Prototipo | Destino nuevo |
|---|---|
| `src/shared/python/fetchers.py` (prototipo) | `src/shared/python/rdc_shared/fetchers.py` |
| `src/shared/python/standard_format.py` (prototipo) | `src/shared/python/rdc_shared/standard_format.py` |
| `src/shared/python/path_resolver.py` (prototipo) | `src/shared/python/rdc_shared/path_resolver.py` |
| `src/core/spiders/jumbo/spider.py` | `src/spiders/jumbo/spider.py` (**sin** herencia de BaseSpider) |
| `src/core/spiders/jumbo/handler.py` | `src/spiders/jumbo/handler.py` |
| `src/core/pipeline/{merge_results,find_by_path,search_drinks,sync_product,mark_out_of_stock,send_report}/handler.py` | `src/pipeline/*/handler.py` |
| `src/core/pipeline/sync_product/{utils,image_uploader,drinks_client}.py` | `rdc_shared/{naming,mappings}.py` + `sync_product/image_uploader.py` + `search_drinks/drinks_client.py` |
| `src/core/pipeline/*/db.py` | consolidado en `rdc_shared/mongo/` |
| `template.yaml` (secciones comentadas) | referencia para las Lambdas del SyncPipeline |
| `samconfig.example.toml` | tal cual |

**Se descarta del prototipo** (por los cambios de enfoque):

| Prototipo | Motivo |
|---|---|
| `src/shared/python/base_spider.py` | Abstracción eliminada — cada spider es libre |
| `src/core/pipeline/load_configs/**` | Sin DynamoDB; el pipeline arranca en `Parallel` |
| `seed/spider_configs.json` + `SpiderConfigsTable` | Config ahora vive en `src/spiders/<name>/config.py` |

> El código Python del prototipo sigue siendo la base funcional; el trabajo es **reorganizarlo**
> (uv + Layer `rdc_shared` + spiders independientes), no reescribir la lógica de scraping ni de dominio.
