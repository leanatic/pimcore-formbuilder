import React from 'react'
import { LocalizedTabs } from './localized-tabs'
import { ElementReferenceInput, type ElementReference } from './element-reference-input'

interface Props {
  /** { locale: ElementReference } */
  value: Record<string, ElementReference | null> | null | undefined
  onChange: (value: Record<string, ElementReference | null>) => void
  elementType: 'document' | 'asset' | 'object'
  subtype?: string
  includeDefault?: boolean
}

/**
 * One element reference per locale (Classic: localizedField + href).
 */
export const LocalizedHref = ({ value, onChange, elementType, subtype, includeDefault = false }: Props): React.JSX.Element => {
  const current = value ?? {}

  return (
    <LocalizedTabs
      includeDefault={includeDefault}
      usedLocales={Object.keys(current)}
      render={(locale) => (
        <ElementReferenceInput
          elementType={elementType}
          subtype={subtype}
          value={current[locale] ?? null}
          onChange={(reference) => {
            const next = { ...current }
            if (reference === null) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete next[locale]
            } else {
              next[locale] = reference
            }
            onChange(next)
          }}
        />
      )}
    />
  )
}
