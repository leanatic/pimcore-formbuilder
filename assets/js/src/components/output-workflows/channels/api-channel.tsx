import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Input, Select, Table, Typography } from 'antd'
import { getApiFormData, getApiProviders } from '../../../api/endpoints'
import { normalizeLabelValueStore } from '../../../utils/object'
import { useUi } from '../../common/ui-context'
import type { ChannelEditorProps } from './types'

interface MappingRow {
  apiMapping: string[]
  fieldTransformer: string | null
}

interface FieldDefinition {
  path: string
  name: string
  label: string
  isContainer: boolean
  depth: number
  parentPath: string | null
}

const flattenDefinitions = (definitions: any[], parentPath: string | null = null, depth = 0): FieldDefinition[] => {
  const rows: FieldDefinition[] = []

  ;(definitions ?? []).forEach((definition) => {
    const data = definition?.data
    if (data === undefined || data === null) {
      return
    }

    const path = parentPath === null ? String(data.name) : `${parentPath}/${String(data.name)}`
    const isContainer = data.type === 'container'

    rows.push({ path, name: String(data.name), label: String(data.display_name ?? data.name), isContainer, depth, parentPath })

    if (isContainer && Array.isArray(data.fields)) {
      rows.push(...flattenDefinitions(data.fields, path, depth + 1))
    }
  })

  return rows
}

const flattenMapping = (data: any[], parentPath: string | null = null, target: Record<string, MappingRow> = {}): Record<string, MappingRow> => {
  ;(Array.isArray(data) ? data : []).forEach((entry) => {
    const path = parentPath === null ? String(entry.name) : `${parentPath}/${String(entry.name)}`
    target[path] = {
      apiMapping: Array.isArray(entry.config?.apiMapping) ? entry.config.apiMapping : [],
      fieldTransformer: entry.config?.fieldTransformer ?? null
    }

    if (Array.isArray(entry.children)) {
      flattenMapping(entry.children, path, target)
    }
  })

  return target
}

const buildMapping = (definitions: FieldDefinition[], rows: Record<string, MappingRow>, parentPath: string | null = null): any[] =>
  definitions
    .filter((definition) => definition.parentPath === parentPath)
    .map((definition) => {
      const row = rows[definition.path] ?? { apiMapping: [], fieldTransformer: null }
      const entry: Record<string, any> = {
        name: definition.name,
        config: { apiMapping: row.apiMapping, fieldTransformer: row.fieldTransformer }
      }

      if (definition.isContainer) {
        const children = buildMapping(definitions, rows, definition.path)
        if (children.length > 0) {
          entry.children = children
        }
      }

      return entry
    })

export const ApiChannelEditor = ({ formId, channel, onChange }: ChannelEditorProps): React.JSX.Element => {
  const { notifyError } = useUi()
  const config: Record<string, any> = channel.configuration !== null && typeof channel.configuration === 'object' && !Array.isArray(channel.configuration)
    ? channel.configuration
    : {}

  const [providers, setProviders] = useState<Array<{ key: string, label: string, configurationFields: any[] }>>([])
  const [formDataLoading, setFormDataLoading] = useState(false)
  const [formData, setFormData] = useState<any>(null)

  useEffect(() => {
    getApiProviders(formId).then(setProviders).catch((error) => { notifyError(error) })
  }, [formId])

  const provider = providers.find((entry) => entry.key === config.apiProvider)
  const apiConfiguration: Record<string, any> = config.apiConfiguration !== null && typeof config.apiConfiguration === 'object' && !Array.isArray(config.apiConfiguration) ? config.apiConfiguration : {}

  const loadMappingData = async (): Promise<void> => {
    setFormDataLoading(true)
    try {
      const response = await getApiFormData(formId, { apiProvider: config.apiProvider, apiConfiguration })
      setFormData(response.configuration)
    } catch (error) {
      notifyError(error)
    } finally {
      setFormDataLoading(false)
    }
  }

  useEffect(() => {
    setFormData(null)
    if (config.apiProvider) {
      void loadMappingData()
    }
  }, [config.apiProvider])

  const definitions = useMemo(() => flattenDefinitions(formData?.formFieldDefinitions ?? []), [formData])
  const rows = useMemo(() => flattenMapping(config.apiMappingData ?? []), [config.apiMappingData])
  const predefinedFields = normalizeLabelValueStore(formData?.apiProvider?.predefinedApiFields)
  const transformers: Array<{ value: string, label: string }> = Array.isArray(formData?.fieldTransformer) ? formData.fieldTransformer : []

  const set = (patch: Record<string, any>): void => {
    onChange({ ...config, ...patch })
  }

  const updateRow = (definition: FieldDefinition, patch: Partial<MappingRow>): void => {
    const next = { ...rows, [definition.path]: { ...(rows[definition.path] ?? { apiMapping: [], fieldTransformer: null }), ...patch } }
    set({ apiMappingData: buildMapping(definitions, next) })
  }

  return (
    <Form layout='vertical'>
      <Form.Item label='API provider' style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 360 }}
          value={config.apiProvider || undefined}
          options={providers.map((entry) => ({ value: entry.key, label: entry.label }))}
          onChange={(apiProvider) => { onChange({ apiProvider, apiConfiguration: {}, apiMappingData: [] }) }}
        />
      </Form.Item>

      {provider !== undefined && (provider.configurationFields ?? []).map((field) => (
        <Form.Item key={field.name} label={field.label} required={field.required === true} style={{ marginBottom: 12 }}>
          {field.type === 'select'
            ? (
              <Select
                style={{ width: 360 }}
                value={apiConfiguration[field.name]}
                options={normalizeLabelValueStore(field.store)}
                onChange={(value) => { set({ apiConfiguration: { ...apiConfiguration, [field.name]: value } }) }}
              />
              )
            : (
              <Input
                style={{ maxWidth: 480 }}
                value={apiConfiguration[field.name] ?? ''}
                onChange={(event) => { set({ apiConfiguration: { ...apiConfiguration, [field.name]: event.target.value } }) }}
              />
              )}
        </Form.Item>
      ))}

      {config.apiProvider && (
        <>
          <Typography.Title level={5}>Field mapping</Typography.Title>
          <Button size='small' loading={formDataLoading} onClick={() => { void loadMappingData() }} style={{ marginBottom: 8 }}>
            Reload (applies provider configuration)
          </Button>
          {formData === null && !formDataLoading && <Alert type='info' message='Mapping data is not available yet.' />}
          {formData !== null && (
            <Table
              size='small'
              pagination={false}
              rowKey='path'
              loading={formDataLoading}
              dataSource={definitions}
              columns={[
                {
                  title: 'Form field',
                  dataIndex: 'label',
                  render: (_: unknown, record: FieldDefinition) => (
                    <span style={{ paddingLeft: record.depth * 20, fontWeight: record.isContainer ? 600 : undefined }}>
                      {record.label} <Typography.Text type='secondary'>({record.name})</Typography.Text>
                    </span>
                  )
                },
                {
                  title: 'API field(s)',
                  render: (_: unknown, record: FieldDefinition) => {
                    if (record.isContainer) {
                      return null
                    }

                    const row = rows[record.path]

                    return (
                      <Select
                        mode={predefinedFields.length > 0 ? 'multiple' : 'tags'}
                        style={{ width: '100%', minWidth: 260 }}
                        value={row?.apiMapping ?? []}
                        options={predefinedFields.length > 0 ? predefinedFields : undefined}
                        open={predefinedFields.length > 0 ? undefined : false}
                        onChange={(apiMapping) => { updateRow(record, { apiMapping }) }}
                      />
                    )
                  }
                },
                ...(transformers.length > 0
                  ? [{
                      title: 'Transformer',
                      width: 240,
                      render: (_: unknown, record: FieldDefinition) => record.isContainer
                        ? null
                        : (
                          <Select
                            allowClear
                            style={{ width: '100%' }}
                            value={rows[record.path]?.fieldTransformer ?? undefined}
                            options={transformers.map((entry) => ({ value: entry.value, label: entry.label }))}
                            onChange={(fieldTransformer) => { updateRow(record, { fieldTransformer: fieldTransformer ?? null }) }}
                          />
                          )
                    }]
                  : [])
              ]}
            />
          )}
        </>
      )}
    </Form>
  )
}
