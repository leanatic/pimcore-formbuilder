import React from 'react'
import { Form, Input, Select } from 'antd'
import { LocalizedHref } from '../common/localized-href'

interface Props {
  value: Record<string, any> | null | undefined
  onChange: (value: Record<string, any>) => void
}

const TYPES = [
  { value: 'string', label: 'String' },
  { value: 'snippet', label: 'Snippet' },
  { value: 'redirect', label: 'Redirect (document)' },
  { value: 'redirect_external', label: 'Redirect (external URL)' }
]

export const SuccessManagementEditor = ({ value, onChange }: Props): React.JSX.Element => {
  const data = (value !== null && value !== undefined && !Array.isArray(value) ? value : {}) as Record<string, any>
  const identifier: string = data.identifier ?? 'string'
  const localized = identifier === 'snippet' || identifier === 'redirect'

  const emit = (patch: Record<string, any>): void => {
    onChange({ type: 'successManagement', ...data, identifier, ...patch })
  }

  return (
    <Form layout='vertical'>
      <Form.Item label='Success message type' style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 280 }}
          value={identifier}
          options={TYPES}
          onChange={(next) => {
            const isLocalized = next === 'snippet' || next === 'redirect'
            const nextData: Record<string, any> = { type: 'successManagement', identifier: next, value: isLocalized ? {} : '' }
            onChange(nextData)
          }}
        />
      </Form.Item>
      {localized
        ? (
          <Form.Item label={identifier === 'snippet' ? 'Snippet' : 'Redirect document'} style={{ marginBottom: 12 }}>
            <LocalizedHref
              includeDefault
              elementType='document'
              subtype={identifier === 'snippet' ? 'snippet' : undefined}
              value={typeof data.value === 'object' && data.value !== null ? data.value : {}}
              onChange={(next) => { emit({ value: next }) }}
            />
          </Form.Item>
          )
        : (
          <Form.Item label={identifier === 'string' ? 'Message (translatable)' : 'URL'} style={{ marginBottom: 12 }}>
            <Input value={typeof data.value === 'string' ? data.value : ''} onChange={(event) => { emit({ value: event.target.value }) }} />
          </Form.Item>
          )}
      {(identifier === 'redirect' || identifier === 'redirect_external') && (
        <Form.Item label='Flash message (translatable)' style={{ marginBottom: 12 }}>
          <Input value={data.flashMessage ?? ''} onChange={(event) => { emit({ flashMessage: event.target.value }) }} />
        </Form.Item>
      )}
    </Form>
  )
}
