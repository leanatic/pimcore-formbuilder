import React from 'react'
import { Button, Card, Checkbox, Dropdown, Empty, Input, Select, Space, Typography } from 'antd'
import { JsonEditor } from '../common/json-editor'
import { LocalizedHref } from '../common/localized-href'
import { getReferencableFields, type ModelNode } from './model'

interface StoreEntry {
  identifier: string
  name: string
  icon?: string
}

interface Props {
  value: any[]
  onChange: (value: any[]) => void
  store: { conditions: StoreEntry[], actions: StoreEntry[] }
  nodes: ModelNode[]
  validationConstraints: Array<{ id: string, label: string }>
  workflows: Array<{ id: number, name: string }>
}

const humanize = (value: string): string =>
  value
    .replace(/^.*\./, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase())

const COMPARATORS = [
  { value: 'contains', label: 'Contains' },
  { value: 'is_checked', label: 'Is checked' },
  { value: 'is_not_checked', label: 'Is not checked' },
  { value: 'is_greater', label: 'Is greater than' },
  { value: 'is_less', label: 'Is less than' },
  { value: 'is_value', label: 'Is value' },
  { value: 'is_not_value', label: 'Is not value' },
  { value: 'is_empty_value', label: 'Is empty' }
]

const NO_VALUE_COMPARATORS = ['is_checked', 'is_not_checked', 'is_empty_value']

const SUCCESS_MESSAGE_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'snippet', label: 'Snippet' },
  { value: 'redirect', label: 'Redirect (document)' },
  { value: 'redirect_external', label: 'Redirect (external)' }
]

interface ItemProps {
  item: Record<string, any>
  onChange: (item: Record<string, any>) => void
  nodes: ModelNode[]
  validationConstraints: Array<{ id: string, label: string }>
  workflows: Array<{ id: number, name: string }>
}

const FieldSelect = ({ item, onChange, nodes, kinds, mode = 'multiple' }: Pick<ItemProps, 'item' | 'onChange' | 'nodes'> & { kinds: Array<'field' | 'container'>, mode?: 'multiple' }): React.JSX.Element => {
  const fields = getReferencableFields(nodes, kinds)
  const selected: string[] = Array.isArray(item.fields) ? item.fields : []
  const options = [...fields.map((field) => ({ value: field.name, label: `${field.display_name} (${field.name})` }))]

  // keep references to fields which do not exist anymore visible
  selected.forEach((name) => {
    if (!options.some((option) => option.value === name)) {
      options.push({ value: name, label: `${name} (missing)` })
    }
  })

  return (
    <Select
      mode={mode}
      style={{ minWidth: 280 }}
      placeholder='Fields'
      value={selected}
      options={options}
      onChange={(next) => { onChange({ ...item, fields: next }) }}
    />
  )
}

const ConditionItem = ({ item, onChange, nodes, workflows }: ItemProps): React.JSX.Element => {
  switch (item.type) {
    case 'elementValue':
      return (
        <Space wrap>
          <FieldSelect item={item} onChange={onChange} nodes={nodes} kinds={['field']} />
          <Select
            style={{ width: 180 }}
            placeholder='Comparator'
            value={item.comparator}
            options={COMPARATORS}
            onChange={(comparator) => {
              const next: Record<string, any> = { ...item, comparator }
              if (NO_VALUE_COMPARATORS.includes(comparator)) {
                next.value = ''
              }
              onChange(next)
            }}
          />
          <Input
            style={{ width: 200 }}
            placeholder='Value'
            disabled={NO_VALUE_COMPARATORS.includes(item.comparator)}
            value={item.value ?? ''}
            onChange={(event) => { onChange({ ...item, value: event.target.value }) }}
          />
        </Space>
      )

    case 'outputWorkflow': {
      const selected: string[] = Array.isArray(item.outputWorkflows) ? item.outputWorkflows : []

      return (
        <Select
          mode='multiple'
          style={{ minWidth: 320 }}
          placeholder='Output workflows'
          value={selected}
          options={workflows.map((workflow) => ({ value: workflow.name, label: workflow.name }))}
          onChange={(next) => { onChange({ ...item, outputWorkflows: next }) }}
        />
      )
    }

    default:
      return <JsonEditor value={item} rows={4} onChange={(next) => { onChange(next) }} />
  }
}

const ActionItem = ({ item, onChange, nodes, validationConstraints, workflows }: ItemProps): React.JSX.Element => {
  switch (item.type) {
    case 'toggleElement':
      return (
        <Space wrap>
          <FieldSelect item={item} onChange={onChange} nodes={nodes} kinds={['field', 'container']} />
          <Select
            style={{ width: 140 }}
            value={item.state}
            options={[{ value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' }]}
            onChange={(state) => { onChange({ ...item, state }) }}
          />
        </Space>
      )

    case 'toggleAvailability':
      return (
        <Space wrap>
          <FieldSelect item={item} onChange={onChange} nodes={nodes} kinds={['field']} />
          <Select
            style={{ width: 140 }}
            value={item.state}
            options={[{ value: 'enable', label: 'Enable' }, { value: 'disable', label: 'Disable' }]}
            onChange={(state) => { onChange({ ...item, state }) }}
          />
        </Space>
      )

    case 'toggleClass':
      return (
        <Space wrap>
          <FieldSelect item={item} onChange={onChange} nodes={nodes} kinds={['field', 'container']} />
          <Input style={{ width: 200 }} placeholder='CSS class' value={item.class ?? ''} onChange={(event) => { onChange({ ...item, class: event.target.value }) }} />
        </Space>
      )

    case 'changeValue':
      return (
        <Space wrap>
          <FieldSelect item={item} onChange={onChange} nodes={nodes} kinds={['field']} />
          <Input style={{ width: 200 }} placeholder='Value' value={item.value ?? ''} onChange={(event) => { onChange({ ...item, value: event.target.value }) }} />
        </Space>
      )

    case 'triggerEvent':
      return (
        <Space wrap>
          <FieldSelect item={item} onChange={onChange} nodes={nodes} kinds={['field']} />
          <Input style={{ width: 200 }} placeholder='Event name' value={item.event ?? ''} onChange={(event) => { onChange({ ...item, event: event.target.value }) }} />
        </Space>
      )

    case 'constraintsAdd':
    case 'constraintsRemove': {
      const removeAll = item.type === 'constraintsRemove' && item.removeAllValidations === true

      return (
        <Space wrap>
          <FieldSelect item={item} onChange={onChange} nodes={nodes} kinds={['field']} />
          <Select
            mode='multiple'
            style={{ minWidth: 260 }}
            placeholder='Validations'
            disabled={removeAll}
            value={Array.isArray(item.validation) ? item.validation : []}
            options={validationConstraints.map((constraint) => ({ value: constraint.id, label: constraint.label }))}
            onChange={(validation) => { onChange({ ...item, validation }) }}
          />
          {item.type === 'constraintsRemove' && (
            <Checkbox
              checked={item.removeAllValidations === true}
              onChange={(event) => {
                onChange({ ...item, removeAllValidations: event.target.checked, validation: event.target.checked ? [] : item.validation })
              }}
            >
              Remove all validations
            </Checkbox>
          )}
        </Space>
      )
    }

    case 'switchOutputWorkflow':
      return (
        <Select
          style={{ minWidth: 280 }}
          placeholder='Output workflow'
          value={item.workflowName}
          options={workflows.map((workflow) => ({ value: workflow.name, label: workflow.name }))}
          onChange={(workflowName) => { onChange({ ...item, workflowName }) }}
        />
      )

    case 'successMessage': {
      const identifier: string = item.identifier ?? 'string'
      const isLocalized = identifier === 'snippet' || identifier === 'redirect'

      return (
        <Space direction='vertical' style={{ width: '100%' }}>
          <Select
            style={{ width: 240 }}
            value={identifier}
            options={SUCCESS_MESSAGE_TYPES}
            onChange={(next) => { onChange({ ...item, identifier: next, value: (next === 'snippet' || next === 'redirect') ? {} : '' }) }}
          />
          {isLocalized
            ? (
              <LocalizedHref
                value={typeof item.value === 'object' ? item.value : {}}
                elementType='document'
                subtype={identifier === 'snippet' ? 'snippet' : undefined}
                onChange={(value) => { onChange({ ...item, value }) }}
              />
              )
            : (
              <Input
                placeholder={identifier === 'string' ? 'Success message' : 'https://...'}
                value={typeof item.value === 'string' ? item.value : ''}
                onChange={(event) => { onChange({ ...item, value: event.target.value }) }}
              />
              )}
          {(identifier === 'redirect' || identifier === 'redirect_external') && (
            <Input
              placeholder='Flash message (optional)'
              value={item.flashMessage ?? ''}
              onChange={(event) => { onChange({ ...item, flashMessage: event.target.value }) }}
            />
          )}
        </Space>
      )
    }

    default:
      return <JsonEditor value={item} rows={4} onChange={(next) => { onChange(next) }} />
  }
}

export const ConditionalLogicEditor = ({ value, onChange, store, nodes, validationConstraints, workflows }: Props): React.JSX.Element => {
  const sections = value

  const updateSection = (index: number, section: any): void => {
    onChange(sections.map((entry, i) => (i === index ? section : entry)))
  }

  const labelFor = (entries: StoreEntry[], identifier: string): string => {
    const entry = entries.find((candidate) => candidate.identifier === identifier)
    return entry !== undefined ? humanize(entry.identifier) : humanize(identifier)
  }

  const renderItems = (section: any, index: number, kind: 'condition' | 'action'): React.JSX.Element => {
    const items: any[] = Array.isArray(section[kind]) ? section[kind] : []
    const entries = kind === 'condition' ? store.conditions : store.actions

    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Typography.Text strong>{kind === 'condition' ? 'Conditions' : 'Actions'}</Typography.Text>
          <Dropdown
            menu={{
              items: entries.map((entry) => ({ key: entry.identifier, label: humanize(entry.identifier) })),
              onClick: ({ key }) => {
                updateSection(index, { ...section, [kind]: [...items, { type: key }] })
              }
            }}
          >
            <Button size='small'>{kind === 'condition' ? 'Add condition' : 'Add action'}</Button>
          </Dropdown>
        </div>
        {items.length === 0 && <Typography.Text type='secondary'>None</Typography.Text>}
        {items.map((item, itemIndex) => (
          <div key={itemIndex} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid #f5f5f5' }}>
            <div style={{ width: 170, paddingTop: 4 }}>
              <Typography.Text>{labelFor(entries, item.type)}</Typography.Text>
            </div>
            <div style={{ flex: 1 }}>
              {React.createElement(kind === 'condition' ? ConditionItem : ActionItem, {
                item,
                nodes,
                validationConstraints,
                workflows,
                onChange: (next: Record<string, any>) => {
                  updateSection(index, { ...section, [kind]: items.map((entry, i) => (i === itemIndex ? next : entry)) })
                }
              })}
            </div>
            <Button
              size='small'
              danger
              onClick={() => { updateSection(index, { ...section, [kind]: items.filter((_, i) => i !== itemIndex) }) }}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button onClick={() => { onChange([...sections, { condition: [], action: [] }]) }}>Add conditional logic section</Button>
      </div>
      {sections.length === 0 && <Empty description='No conditional logic defined' image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      {sections.map((section, index) => (
        <Card
          key={index}
          size='small'
          style={{ marginBottom: 12 }}
          title={`Section ${index + 1}`}
          extra={(
            <Space>
              <Button size='small' disabled={index === 0} onClick={() => { const copy = [...sections]; [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]; onChange(copy) }}>↑</Button>
              <Button size='small' disabled={index === sections.length - 1} onClick={() => { const copy = [...sections]; [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]]; onChange(copy) }}>↓</Button>
              <Button size='small' danger onClick={() => { onChange(sections.filter((_, i) => i !== index)) }}>Delete</Button>
            </Space>
          )}
        >
          {renderItems(section, index, 'condition')}
          {renderItems(section, index, 'action')}
        </Card>
      ))}
    </div>
  )
}
