import React from 'react'
import { Alert, Button, Checkbox, Collapse, Form, Input, InputNumber, Select, Space, Tabs, Typography } from 'antd'
import { FbIcon } from '../../utils/icons'
import { getIn, normalizeLabelValueStore, setIn, unsetIn } from '../../utils/object'
import { ConfigField } from './config-fields'
import { KeyValueRepeater } from './key-value-repeater'
import {
  containerDisplayName,
  findConstraint,
  findContainerType,
  findFieldType,
  type FieldGroupStructure,
  type ModelNode
} from './model'

export interface ConfigurationContext {
  groups: FieldGroupStructure[]
  templates: Array<{ value: string, label: string, default?: boolean }>
  containerTypes: any[]
  validationConstraints: any[]
  lockedFieldNames: string[]
}

interface EditorProps {
  node: ModelNode
  ctx: ConfigurationContext
  error?: string
  onChange: (data: Record<string, any>) => void
}

const BaseFields = ({ node, ctx, error, onChange }: EditorProps): React.JSX.Element => {
  const data = node.data
  const locked = ctx.lockedFieldNames.includes(data.name)

  return (
    <>
      {error !== undefined && <Alert type='error' showIcon message={error} style={{ marginBottom: 12 }} />}
      <Form.Item label='Display name' required style={{ marginBottom: 12 }}>
        <Input
          value={data.display_name ?? ''}
          onChange={(event) => { onChange({ ...data, display_name: event.target.value }) }}
        />
      </Form.Item>
      <Form.Item
        label='Name'
        required
        style={{ marginBottom: 12 }}
        extra={locked ? 'This field is used in an output workflow and cannot be renamed.' : undefined}
      >
        <Input
          value={data.name ?? ''}
          disabled={locked}
          onChange={(event) => { onChange({ ...data, name: event.target.value }) }}
        />
      </Form.Item>
      {ctx.templates.length > 0 && (
        <Form.Item label='Template' style={{ marginBottom: 12 }}>
          <Select
            style={{ width: '100%' }}
            value={getIn(data, 'optional.template')}
            options={ctx.templates.map((template) => ({ label: template.label, value: template.value }))}
            onChange={(template) => { onChange(setIn(data, 'optional.template', template)) }}
          />
        </Form.Item>
      )}
    </>
  )
}

export const FieldEditor = (props: EditorProps): React.JSX.Element => {
  const { node, ctx, onChange } = props
  const structure = findFieldType(ctx.groups, node.data.type)

  if (structure === null) {
    return (
      <Alert
        type='warning'
        showIcon
        message={`Unknown field type "${String(node.data.type)}"`}
        description='The field type is not available in the current configuration. Data is preserved on save.'
      />
    )
  }

  return (
    <Form layout='vertical'>
      <Space style={{ marginBottom: 12 }}>
        <FbIcon name={structure.icon_class} size={20} />
        <Typography.Title level={5} style={{ margin: 0 }}>{structure.label}</Typography.Title>
      </Space>
      <BaseFields {...props} />
      <Tabs
        size='small'
        items={structure.configuration_layout.map((tab) => ({
          key: tab.id,
          label: tab.label,
          forceRender: true,
          children: (
            <Collapse
              ghost
              defaultActiveKey={tab.fields.filter((group) => group.collapsed !== true).map((group) => group.id)}
              items={tab.fields.map((displayGroup) => ({
                key: displayGroup.id,
                label: displayGroup.label,
                children: displayGroup.fields.map((configField: any) => (
                  <ConfigField
                    key={configField.id}
                    field={configField}
                    data={node.data}
                    onChange={onChange}
                  />
                ))
              }))}
            />
          )
        }))}
      />
    </Form>
  )
}

export const ContainerEditor = (props: EditorProps): React.JSX.Element => {
  const { node, ctx, onChange } = props
  const container = findContainerType(ctx.containerTypes, node.data.sub_type)
  const data = node.data

  if (container === null) {
    return <Alert type='warning' showIcon message={`Unknown container type "${String(data.sub_type)}"`} />
  }

  const setName = (name: string): void => {
    onChange({ ...data, name, display_name: containerDisplayName(data.sub_type, name) })
  }

  const locked = ctx.lockedFieldNames.includes(data.name)

  return (
    <Form layout='vertical'>
      <Space style={{ marginBottom: 12 }}>
        <FbIcon name={container.icon_class} size={20} />
        <Typography.Title level={5} style={{ margin: 0 }}>{container.label}</Typography.Title>
      </Space>
      {props.error !== undefined && <Alert type='error' showIcon message={props.error} style={{ marginBottom: 12 }} />}
      <Form.Item
        label='Name'
        required
        style={{ marginBottom: 12 }}
        extra={locked ? 'This container is used in an output workflow and cannot be renamed.' : undefined}
      >
        <Input value={data.name ?? ''} disabled={locked} onChange={(event) => { setName(event.target.value) }} />
      </Form.Item>
      {ctx.templates.length > 0 && (
        <Form.Item label='Template' style={{ marginBottom: 12 }}>
          <Select
            style={{ width: '100%' }}
            value={getIn(data, 'configuration.template')}
            options={ctx.templates.map((template) => ({ label: template.label, value: template.value }))}
            onChange={(template) => { onChange(setIn(data, 'configuration.template', template)) }}
          />
        </Form.Item>
      )}
      {(container.configuration ?? []).map((configNode: any) => {
        const path = `configuration.${String(configNode.name)}`
        const value = getIn(data, path)

        let input: React.ReactNode

        switch (configNode.type) {
          case 'boolean':
            input = <Checkbox checked={value === true} onChange={(event) => { onChange(setIn(data, path, event.target.checked)) }} />
            break
          case 'integer':
            input = (
              <InputNumber
                style={{ width: '100%' }}
                precision={0}
                value={value ?? undefined}
                onChange={(next) => { onChange(next === null ? unsetIn(data, path) : setIn(data, path, next)) }}
              />
            )
            break
          case 'options_repeater':
            input = (
              <KeyValueRepeater
                value={value}
                optionStore={normalizeLabelValueStore(configNode.config?.options)}
                allowGroup={false}
                allowChoiceMeta={false}
                allowSort={false}
                onChange={(next) => { onChange(setIn(data, path, next)) }}
              />
            )
            break
          default:
            input = <Input value={value ?? ''} onChange={(event) => { onChange(setIn(data, path, event.target.value)) }} />
        }

        return (
          <Form.Item key={configNode.name} label={configNode.label} style={{ marginBottom: 12 }}>
            {input}
          </Form.Item>
        )
      })}
    </Form>
  )
}

export const ConstraintEditor = ({ node, ctx, onChange }: EditorProps): React.JSX.Element => {
  const constraint = findConstraint(ctx.validationConstraints, node.data.type)
  const data = node.data

  if (constraint === null) {
    return <Alert type='warning' showIcon message={`Unknown constraint "${String(data.type)}"`} />
  }

  const configItems: any[] = Array.isArray(constraint.config) ? constraint.config : []

  const setValue = (name: string, defaultValue: any, value: any): void => {
    const path = `config.${name}`
    const isDefault = value === defaultValue || (value === '' && (defaultValue === null || defaultValue === undefined))
    onChange(isDefault ? unsetIn(data, path) : setIn(data, path, value))
  }

  return (
    <Form layout='vertical'>
      <Space style={{ marginBottom: 12 }}>
        <FbIcon name={constraint.icon_class} size={20} />
        <Typography.Title level={5} style={{ margin: 0 }}>{constraint.label}</Typography.Title>
      </Space>
      {configItems.length === 0 && <Typography.Paragraph type='secondary'>This constraint has no options.</Typography.Paragraph>}
      {configItems.map((item) => {
        const current = getIn(data, `config.${String(item.name)}`)
        const value = current === undefined ? item.defaultValue : current
        let input: React.ReactNode

        switch (item.type) {
          case 'bool':
          case 'boolean':
            input = <Checkbox checked={value === true} onChange={(event) => { setValue(item.name, item.defaultValue, event.target.checked) }} />
            break
          case 'int':
          case 'integer':
            input = (
              <InputNumber
                style={{ width: '100%' }}
                precision={0}
                value={value ?? undefined}
                onChange={(next) => { setValue(item.name, item.defaultValue, next ?? item.defaultValue) }}
              />
            )
            break
          case 'array':
            input = (
              <Select
                mode='tags'
                style={{ width: '100%' }}
                open={false}
                tokenSeparators={[',']}
                value={Array.isArray(value) ? value : []}
                onChange={(next) => { setValue(item.name, item.defaultValue, next) }}
              />
            )
            break
          case 'string':
          case 'mixed':
          default:
            input = (
              <Input
                value={value === null || value === undefined ? '' : String(value)}
                onChange={(event) => { setValue(item.name, item.defaultValue, event.target.value) }}
              />
            )
        }

        return (
          <Form.Item
            key={item.name}
            label={item.name}
            style={{ marginBottom: 12 }}
            extra={item.defaultValue !== undefined && item.defaultValue !== null ? `Default: ${JSON.stringify(item.defaultValue)}` : undefined}
          >
            <Space.Compact style={{ width: '100%' }}>
              <div style={{ flex: 1 }}>{input}</div>
              <Button onClick={() => { onChange(unsetIn(data, `config.${String(item.name)}`)) }}>Reset</Button>
            </Space.Compact>
          </Form.Item>
        )
      })}
    </Form>
  )
}
