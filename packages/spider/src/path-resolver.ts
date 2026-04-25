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
