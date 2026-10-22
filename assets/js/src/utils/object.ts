let uidCounter = 0

export const uid = (prefix = 'n'): string => {
  uidCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`
}

/**
 * Generates a technical field name like the Classic UI does (Ext.id(null, 'field_')).
 */
export const generateFieldName = (prefix = 'field'): string => {
  uidCounter += 1
  return `${prefix}_${Math.floor(Math.random() * 90000 + 10000)}${uidCounter}`
}

export const clone = <T>(value: T): T => {
  if (value === undefined) {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

export const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Reads a value from a dotted path ("options.label").
 */
export const getIn = (obj: any, path: string): any => {
  const parts = path.split('.')
  let current = obj

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined
    }
    current = current[part]
  }

  return current
}

/**
 * Immutable set by dotted path. Empty containers created on the way are objects.
 */
export const setIn = (obj: any, path: string, value: any): any => {
  const parts = path.split('.')

  const apply = (current: any, index: number): any => {
    const key = parts[index]
    const base = isPlainObject(current) ? { ...current } : (Array.isArray(current) ? [...current] : {})

    if (index === parts.length - 1) {
      base[key] = value
    } else {
      base[key] = apply(base[key], index + 1)
    }

    return base
  }

  return apply(obj ?? {}, 0)
}

/**
 * Immutable unset by dotted path.
 */
export const unsetIn = (obj: any, path: string): any => {
  const parts = path.split('.')

  const apply = (current: any, index: number): any => {
    if (!isPlainObject(current)) {
      return current
    }

    const base = { ...current }
    const key = parts[index]

    if (index === parts.length - 1) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete base[key]
    } else if (key in base) {
      base[key] = apply(base[key], index + 1)
    }

    return base
  }

  return apply(obj ?? {}, 0)
}

export interface SelectOption {
  label: string
  value: string | number
}

/**
 * Normalizes the different store notations of the (ExtJs) configuration:
 *  - [[label, value], ...] (ArrayStore with fields [label, value])
 *  - [{label, value}, ...]
 */
export const normalizeLabelValueStore = (store: any): SelectOption[] => {
  if (!Array.isArray(store)) {
    return []
  }

  return store.map((entry: any) => {
    if (Array.isArray(entry)) {
      return { label: String(entry[0]), value: entry[1] }
    }

    if (isPlainObject(entry)) {
      return { label: String(entry.label ?? entry.name ?? entry.value), value: entry.value ?? entry.key ?? entry.index }
    }

    return { label: String(entry), value: entry }
  })
}

/**
 * Tag-field stores are [[index, name], ...].
 */
export const normalizeTagStore = (store: any): SelectOption[] => {
  if (!Array.isArray(store)) {
    return []
  }

  return store.map((entry: any) => {
    if (Array.isArray(entry)) {
      return { label: String(entry[1] ?? entry[0]), value: entry[0] }
    }

    if (isPlainObject(entry)) {
      return { label: String(entry.name ?? entry.label ?? entry.value), value: entry.index ?? entry.value }
    }

    return { label: String(entry), value: entry }
  })
}

export const safeJsonParse = (value: string): { ok: true, value: any } | { ok: false, error: string } => {
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Invalid JSON' }
  }
}
