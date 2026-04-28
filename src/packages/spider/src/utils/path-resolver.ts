import type { IFieldConfig } from '../types'

export function resolvePath(data: unknown, path: string): unknown {
    const parts = path.split('.')
    let current: unknown = data
    for (const part of parts) {
        if (current == null) return undefined
        if (Array.isArray(current)) {
            const idx = parseInt(part, 10)
            current = isNaN(idx) ? undefined : current[idx]
        } else if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part]
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

export function extractField(data: unknown, config: IFieldConfig): string | number | undefined {
    const raw = resolvePaths(data, config.paths)
    if (raw == null) return undefined

    if (config.type === 'int') {
        const n = parseInt(String(raw), 10)
        return isNaN(n) ? undefined : n
    }
    if (config.type === 'float') {
        const n = parseFloat(String(raw))
        return isNaN(n) ? undefined : n
    }

    let value = String(raw)
    if (config.prefix) value = config.prefix + value
    if (config.suffix) value = value + config.suffix
    return value
}

export function extractProductFields(data: unknown, mapping: Record<string, IFieldConfig>): Record<string, string | number> {
    const result: Record<string, string | number> = {}
    for (const [key, config] of Object.entries(mapping)) {
        const value = extractField(data, config)
        if (value !== undefined) result[key] = value
    }
    return result
}
