import React, { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Select, Tag, Typography } from 'antd'
import {
  getDynamicObjectResolvers,
  getObjectClasses,
  getObjectClassFields,
  getObjectFormData
} from '../../../api/endpoints'
import { ElementReferenceInput } from '../../common/element-reference-input'
import { JsonEditor } from '../../common/json-editor'
import { useUi } from '../../common/ui-context'
import type { ChannelEditorProps } from './types'

const walkFormFields = (definitions: any[], prefix = ''): string[] => {
  const names: string[] = []

  ;(definitions ?? []).forEach((definition) => {
    const data = definition?.data
    if (data === undefined || data === null) {
      return
    }

    const name = `${prefix}${String(data.name)}`
    names.push(`${name} (${String(data.type === 'container' ? `container:${String(data.sub_type)}` : data.type)})`)

    if (Array.isArray(data.fields)) {
      names.push(...walkFormFields(data.fields, `${name}.`))
    }
  })

  return names
}

export const ObjectChannelEditor = ({ formId, channel, onChange }: ChannelEditorProps): React.JSX.Element => {
  const { notifyError } = useUi()
  const config: Record<string, any> = channel.configuration !== null && typeof channel.configuration === 'object' && !Array.isArray(channel.configuration)
    ? channel.configuration
    : { resolveStrategy: 'newObject', objectMappingData: [] }

  const strategy: string = config.resolveStrategy ?? 'newObject'
  const dynamic = config.dynamicObjectResolver !== undefined && config.dynamicObjectResolver !== null && config.dynamicObjectResolver !== ''

  const [classes, setClasses] = useState<Array<{ key: string, label: string }>>([])
  const [resolvers, setResolvers] = useState<Array<{ key: string, label: string }>>([])
  const [helper, setHelper] = useState<{ className: string, classId: string, formFields: string[], classFields: string[] } | null>(null)
  const [helperLoading, setHelperLoading] = useState(false)

  useEffect(() => {
    getObjectClasses().then(setClasses).catch((error) => { notifyError(error) })
  }, [])

  useEffect(() => {
    getDynamicObjectResolvers(strategy).then(setResolvers).catch(() => { setResolvers([]) })
  }, [strategy])

  const set = (patch: Record<string, any>): void => {
    onChange({ ...config, ...patch })
  }

  const setStrategy = (resolveStrategy: string): void => {
    onChange({
      resolveStrategy,
      objectMappingData: config.objectMappingData ?? []
    })
  }

  const loadHelper = async (): Promise<void> => {
    setHelperLoading(true)
    try {
      const response = await getObjectFormData(formId, config)
      const configuration = response.configuration
      const fields = await getObjectClassFields('dataClass', String(configuration.classId))

      setHelper({
        className: configuration.className,
        classId: String(configuration.classId),
        formFields: walkFormFields(configuration.formFieldDefinitions),
        classFields: fields.map((field) => `${field.key}${field.label !== field.key ? ` (${field.label})` : ''}`)
      })
    } catch (error) {
      notifyError(error)
    } finally {
      setHelperLoading(false)
    }
  }

  const classOptions = classes.map((entry) => ({ value: entry.key, label: entry.label }))

  return (
    <Form layout='vertical'>
      <Form.Item label='Resolve strategy' style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 280 }}
          value={strategy}
          onChange={setStrategy}
          options={[
            { value: 'newObject', label: 'Create new object' },
            { value: 'existingObject', label: 'Use existing object' }
          ]}
        />
      </Form.Item>

      {resolvers.length > 0 && (
        <Form.Item style={{ marginBottom: 12 }}>
          <Checkbox
            checked={dynamic}
            onChange={(event) => {
              if (event.target.checked) {
                onChange({ resolveStrategy: strategy, dynamicObjectResolver: resolvers[0].key, dynamicObjectResolverClass: '', objectMappingData: config.objectMappingData ?? [] })
              } else {
                onChange({ resolveStrategy: strategy, objectMappingData: config.objectMappingData ?? [] })
              }
            }}
          >
            Use dynamic object resolver
          </Checkbox>
        </Form.Item>
      )}

      {dynamic
        ? (
          <>
            <Form.Item label='Dynamic object resolver' style={{ marginBottom: 12 }}>
              <Select
                style={{ width: 360 }}
                value={config.dynamicObjectResolver}
                options={resolvers.map((entry) => ({ value: entry.key, label: entry.label }))}
                onChange={(dynamicObjectResolver) => { set({ dynamicObjectResolver }) }}
              />
            </Form.Item>
            <Form.Item label='Object class' style={{ marginBottom: 12 }}>
              <Select
                showSearch
                style={{ width: 360 }}
                value={config.dynamicObjectResolverClass || undefined}
                options={classOptions}
                onChange={(dynamicObjectResolverClass) => { set({ dynamicObjectResolverClass }) }}
              />
            </Form.Item>
          </>
          )
        : strategy === 'existingObject'
          ? (
            <Form.Item label='Object' style={{ marginBottom: 12 }}>
              <ElementReferenceInput
                elementType='object'
                value={config.resolvingObject ?? null}
                onChange={(resolvingObject) => { set({ resolvingObject }) }}
              />
            </Form.Item>
            )
          : (
            <>
              <Form.Item label='Storage path' required style={{ marginBottom: 12 }}>
                <ElementReferenceInput
                  elementType='object'
                  subtype='folder'
                  value={config.storagePath ?? null}
                  onChange={(storagePath) => { set({ storagePath }) }}
                />
              </Form.Item>
              <Form.Item label='Object class' required style={{ marginBottom: 12 }}>
                <Select
                  showSearch
                  style={{ width: 360 }}
                  value={config.resolvingObjectClass || undefined}
                  options={classOptions}
                  onChange={(resolvingObjectClass) => { set({ resolvingObjectClass }) }}
                />
              </Form.Item>
            </>
            )}

      <Form.Item
        label='Object mapping data'
        extra='Mapping tree (form field -> data object field, including relation / field collection workers) as JSON. Use the helper below to look up field names.'
        style={{ marginBottom: 12 }}
      >
        <JsonEditor
          value={config.objectMappingData ?? []}
          rows={12}
          onChange={(objectMappingData) => { set({ objectMappingData }) }}
        />
      </Form.Item>

      <Button loading={helperLoading} onClick={() => { void loadHelper() }}>Load form fields &amp; class fields</Button>
      {helper !== null && (
        <Alert
          style={{ marginTop: 12 }}
          type='info'
          message={`Class ${helper.className}`}
          description={(
            <div>
              <Typography.Text strong>Form fields</Typography.Text>
              <div style={{ marginBottom: 8 }}>{helper.formFields.map((name) => <Tag key={name}>{name}</Tag>)}</div>
              <Typography.Text strong>Class fields</Typography.Text>
              <div>{helper.classFields.map((name) => <Tag key={name}>{name}</Tag>)}</div>
            </div>
          )}
        />
      )}
    </Form>
  )
}
