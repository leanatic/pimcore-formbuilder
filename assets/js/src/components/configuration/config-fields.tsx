import React, { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, Tooltip } from 'antd'
import { getDataInjectionStore, getStoreUrl } from '../../api/endpoints'
import { getIn, normalizeLabelValueStore, normalizeTagStore, safeJsonParse, setIn, unsetIn, type SelectOption } from '../../utils/object'
import { LocalizedHref } from '../common/localized-href'
import { KeyValueRepeater } from './key-value-repeater'
export interface ConfigFieldDefinition {
  id: string
  label: string
  type: string
  config?: Record<string, any> | null
  [key: string]: any
}

interface Props {
  field: ConfigFieldDefinition
  /** whole field data (type, name, options, optional ...) */
  data: Record<string, any>
  onChange: (data: Record<string, any>) => void
}

const hasConfig = (field: ConfigFieldDefinition): boolean => field.config !== null && field.config !== undefined && typeof field.config === 'object'

const SelectConfigField = ({ field, data, onChange }: Props): React.JSX.Element => {
  const [remote, setRemote] = useState<SelectOption[] | null>(null)
  const storeUrl: string | undefined = field.config?.store_url

  useEffect(() => {
    if (storeUrl === undefined || storeUrl === null) {
      return
    }

    let active = true
    getStoreUrl(storeUrl).then((items) => {
      if (active) {
        setRemote(normalizeLabelValueStore(items))
      }
    }).catch(() => {
      if (active) {
        setRemote([])
      }
    })

    return () => { active = false }
  }, [storeUrl])

  const options = remote ?? normalizeLabelValueStore(field.config?.options)
  const value = getIn(data, field.id)

  return (
    <Select
      style={{ width: '100%' }}
      value={value === null ? undefined : value}
      options={options}
      loading={storeUrl !== undefined && remote === null}
      status={value === undefined || value === null || value === '' ? 'error' : undefined}
      onChange={(next) => { onChange(setIn(data, field.id, next)) }}
    />
  )
}

const DataInjectorModal = ({ open, value, onClose, onSave }: { open: boolean, value: string | null, onClose: () => void, onSave: (value: string | null) => void }): React.JSX.Element => {
  const [store, setStore] = useState<Array<{ value: string, label: string, description: string | null }>>([])
  const [injector, setInjector] = useState<string | null>(null)
  const [expression, setExpression] = useState<string>('')

  useEffect(() => {
    if (!open) {
      return
    }

    const parsed = typeof value === 'string' && value !== '' ? safeJsonParse(value) : null
    const current = parsed !== null && parsed.ok ? parsed.value : null
    setInjector(current?.injector ?? null)
    setExpression(current?.config?.expression ?? '')

    getDataInjectionStore().then(setStore).catch(() => { setStore([]) })
  }, [open])

  const description = store.find((entry) => entry.value === injector)?.description

  return (
    <Modal
      open={open}
      title='Data Injector'
      onCancel={onClose}
      onOk={() => {
        onSave(injector === null ? null : JSON.stringify({ injector, config: { expression } }))
      }}
      okButtonProps={{ disabled: injector !== null && expression === '' }}
      destroyOnClose
    >
      <Form layout='vertical'>
        <Form.Item label='Data Injector'>
          <Select
            allowClear
            placeholder='No data injector'
            value={injector ?? undefined}
            options={store.map((entry) => ({ label: entry.label, value: entry.value }))}
            onChange={(next) => { setInjector(next ?? null) }}
          />
        </Form.Item>
        {injector !== null && description !== null && description !== undefined && (
          <Alert type='info' showIcon message={description} style={{ marginBottom: 12 }} />
        )}
        {injector !== null && (
          <Form.Item label='Expression' required>
            <Input value={expression} onChange={(event) => { setExpression(event.target.value) }} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

const TextConfigField = ({ field, data, onChange }: Props): React.JSX.Element => {
  const config = hasConfig(field) ? field.config! : {}
  const [injectorOpen, setInjectorOpen] = useState(false)
  const value = getIn(data, field.id)
  const injectionPath = `${field.id}Injection`
  const injection = getIn(data, injectionPath)
  const injectionActive = injection !== undefined && injection !== null && injection !== ''
  const forcedValue = config.data !== undefined && config.data !== null

  const input = (
    <Input
      value={forcedValue ? config.data : (value ?? '')}
      maxLength={config.maxLength}
      disabled={config.disabled === true}
      readOnly={injectionActive}
      placeholder={injectionActive ? 'Data injector active' : undefined}
      onChange={(event) => { onChange(setIn(data, field.id, event.target.value)) }}
      suffix={config.translatable === true
        ? <Tooltip title='This field is translatable: you can use a translation key.'><span style={{ opacity: 0.5 }}>🌐</span></Tooltip>
        : undefined}
    />
  )

  if (config.allowDataInjector !== true) {
    return input
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>{input}</div>
        <Tooltip title='Data injector'>
          <Button type={injectionActive ? 'primary' : 'default'} onClick={() => { setInjectorOpen(true) }}>fx</Button>
        </Tooltip>
      </div>
      <DataInjectorModal
        open={injectorOpen}
        value={injection ?? null}
        onClose={() => { setInjectorOpen(false) }}
        onSave={(next) => {
          let updated = data
          if (next === null) {
            updated = unsetIn(updated, injectionPath)
          } else {
            updated = setIn(updated, injectionPath, next)
            updated = setIn(updated, field.id, null)
          }
          onChange(updated)
          setInjectorOpen(false)
        }}
      />
    </>
  )
}

const ConfigFieldInput = (props: Props): React.JSX.Element => {
  const { field, data, onChange } = props
  const config = hasConfig(field) ? field.config! : {}
  const value = getIn(data, field.id)

  switch (field.type) {
    case 'textfield':
      return <TextConfigField {...props} />

    case 'numberfield':
      return (
        <InputNumber
          style={{ width: '100%' }}
          precision={0}
          value={value ?? undefined}
          onChange={(next) => {
            onChange(next === null ? unsetIn(data, field.id) : setIn(data, field.id, next))
          }}
        />
      )

    case 'checkbox':
      return (
        <Checkbox
          checked={value === true}
          onChange={(event) => { onChange(setIn(data, field.id, event.target.checked)) }}
        />
      )

    case 'select':
      return <SelectConfigField {...props} />

    case 'tagfield': {
      const store = Array.isArray(config.store) ? normalizeTagStore(config.store) : null

      return (
        <Select
          mode={store === null ? 'tags' : 'multiple'}
          style={{ width: '100%' }}
          tokenSeparators={store === null ? [','] : undefined}
          value={Array.isArray(value) ? value : []}
          options={store ?? undefined}
          open={store === null ? false : undefined}
          onChange={(next) => {
            onChange(next.length === 0 ? unsetIn(data, field.id) : setIn(data, field.id, next))
          }}
        />
      )
    }

    case 'href': {
      const type = (Array.isArray(config.types) ? config.types[0] : 'document') as 'document' | 'asset' | 'object'
      const subtype = config.subtypes?.[type]?.[0]

      return (
        <LocalizedHref
          value={value}
          elementType={type}
          subtype={subtype}
          onChange={(next) => {
            onChange(Object.keys(next).length === 0 ? unsetIn(data, field.id) : setIn(data, field.id, next))
          }}
        />
      )
    }

    case 'key_value_repeater':
      return (
        <KeyValueRepeater
          value={value}
          allowGroup
          allowChoiceMeta
          allowSort
          onChange={(next) => { onChange(setIn(data, field.id, next)) }}
        />
      )

    case 'options_repeater':
      return (
        <KeyValueRepeater
          value={value}
          optionStore={normalizeLabelValueStore(config.options)}
          allowGroup={false}
          allowChoiceMeta={false}
          allowSort={false}
          onChange={(next) => { onChange(setIn(data, field.id, next)) }}
        />
      )

    default:
      return (
        <Alert
          type='warning'
          showIcon
          message={`Unsupported config field type "${field.type}"`}
        />
      )
  }
}

export const ConfigField = (props: Props): React.JSX.Element => {
  const { field } = props

  if (field.type === 'label') {
    return (
      <Alert type='info' style={{ marginBottom: 16 }} message={field.label} />
    )
  }

  return (
    <Form.Item
      label={field.label}
      style={{ marginBottom: 12 }}
    >
      <ConfigFieldInput {...props} />
    </Form.Item>
  )
}
