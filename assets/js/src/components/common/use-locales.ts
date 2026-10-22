import { useMemo } from 'react'
import { useSettings } from '@pimcore/studio-ui-bundle/modules/app'

/**
 * Website languages as configured in Pimcore (Studio settings: validLanguages).
 * Optionally the locales already used in the data are merged in so nothing gets lost.
 */
export const useLocales = (extra: string[] = [], includeDefault = false): string[] => {
  const settings = useSettings() as Record<string, any>
  const valid: string[] = Array.isArray(settings?.validLanguages) ? settings.validLanguages : []
  const extraKey = extra.join('|')

  return useMemo(() => {
    const merged: string[] = []

    if (includeDefault) {
      merged.push('default')
    }

    ;[...valid, ...extra].forEach((locale) => {
      if (locale !== undefined && locale !== '' && !merged.includes(locale)) {
        merged.push(locale)
      }
    })

    return merged
  }, [valid.join('|'), extraKey, includeDefault])
}
