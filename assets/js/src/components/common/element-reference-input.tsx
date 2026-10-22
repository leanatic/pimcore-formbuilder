import React from 'react'
import { Button, Input, InputNumber, Space } from 'antd'

export interface ElementReference {
  id: number | null
  path?: string | null
  type?: string | null
  subtype?: string | null
}

interface ElementReferenceInputProps {
  value?: ElementReference | null
  onChange: (value: ElementReference | null) => void
  /** document | asset | object */
  elementType: 'document' | 'asset' | 'object'
  subtype?: string
  placeholder?: string
}

/**
 * Reference to a Pimcore element (document, object, ...) by id + path.
 * The server resolves & validates the reference on save (Classic: drop target).
 */
export const ElementReferenceInput = ({ value, onChange, elementType, subtype, placeholder }: ElementReferenceInputProps): React.JSX.Element => {
  const current = value ?? { id: null, path: '' }

  const update = (patch: Partial<ElementReference>): void => {
    const next = { ...current, ...patch, type: elementType, subtype: subtype ?? current.subtype ?? null }

    if ((next.id === null || next.id === undefined) && (next.path === undefined || next.path === null || next.path === '')) {
      onChange(null)
      return
    }

    onChange(next)
  }

  return (
    <Space.Compact style={{ width: '100%' }}>
      <InputNumber
        style={{ width: 110 }}
        min={1}
        placeholder='ID'
        value={current.id ?? undefined}
        onChange={(id) => { update({ id: id === null ? null : Number(id) }) }}
      />
      <Input
        placeholder={placeholder ?? `${elementType} path (e.g. /path/to/element)`}
        value={current.path ?? ''}
        onChange={(event) => { update({ path: event.target.value }) }}
      />
      <Button onClick={() => { onChange(null) }} disabled={value === null || value === undefined}>×</Button>
    </Space.Compact>
  )
}
