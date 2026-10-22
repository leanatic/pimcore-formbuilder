import React, { useState } from 'react'
import { Button, Input, Select, Space, Tooltip } from 'antd'
import type { SelectOption } from '../../utils/object'

/**
 * Value shapes (ChoicesTransformer / options transformer reverse output):
 *   default: [{option, value, choice_meta?}, ...]
 *   grouped: [[{option, value, name, choice_meta?}, ...], ...]
 */

interface Props {
  value: any
  onChange: (value: any) => void
  /** when set, the option is selected from this store instead of free text */
  optionStore?: SelectOption[] | null
  allowGroup?: boolean
  allowChoiceMeta?: boolean
  allowSort?: boolean
}

type Item = { option: any, value: any, choice_meta?: any, [key: string]: any }

const isGrouped = (value: any): boolean => Array.isArray(value) && value.length > 0 && Array.isArray(value[0])

const getTooltip = (meta: any): string => {
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta)?.tooltip ?? ''
    } catch (e) {
      return ''
    }
  }

  return meta?.tooltip ?? ''
}

const setTooltip = (meta: any, tooltip: string): any => {
  let parsed: Record<string, any> = {}

  if (typeof meta === 'string') {
    try {
      parsed = JSON.parse(meta) ?? {}
    } catch (e) {
      parsed = {}
    }
  } else if (meta !== null && typeof meta === 'object') {
    parsed = { ...meta }
  }

  if (tooltip === '') {
    delete parsed.tooltip
  } else {
    parsed.tooltip = tooltip
  }

  // the server expects the choice meta as JSON string
  return Object.keys(parsed).length === 0 ? undefined : JSON.stringify(parsed)
}

export const KeyValueRepeater = ({ value, onChange, optionStore = null, allowGroup = true, allowChoiceMeta = true, allowSort = true }: Props): React.JSX.Element => {
  const list: any[] = Array.isArray(value) ? value : []
  const [pendingMode, setPendingMode] = useState<'default' | 'grouped'>('default')
  const mode: 'default' | 'grouped' = list.length > 0 ? (isGrouped(list) ? 'grouped' : 'default') : pendingMode

  const renderItem = (item: Item, update: (item: Item) => void, remove: () => void, move: (direction: -1 | 1) => void, key: string): React.JSX.Element => (
    <Space key={key} align='start' style={{ display: 'flex', marginBottom: 6 }} wrap>
      {optionStore !== null
        ? (
          <Select
            style={{ width: 200 }}
            placeholder='Option'
            value={item.option === '' ? undefined : item.option}
            options={optionStore}
            showSearch
            onChange={(option) => { update({ ...item, option }) }}
          />
          )
        : (
          <Input
            style={{ width: 200 }}
            placeholder='Option'
            value={item.option ?? ''}
            onChange={(event) => { update({ ...item, option: event.target.value }) }}
          />
          )}
      <Input
        style={{ width: 240 }}
        placeholder='Value'
        value={item.value ?? ''}
        onChange={(event) => { update({ ...item, value: event.target.value }) }}
      />
      {allowChoiceMeta && (
        <Tooltip title='Tooltip shown for this choice (translatable)'>
          <Input
            style={{ width: 180 }}
            placeholder='Tooltip'
            value={getTooltip(item.choice_meta)}
            onChange={(event) => {
              const meta = setTooltip(item.choice_meta, event.target.value)
              const next = { ...item }
              if (meta === undefined) {
                delete next.choice_meta
              } else {
                next.choice_meta = meta
              }
              update(next)
            }}
          />
        </Tooltip>
      )}
      {allowSort && (
        <>
          <Button size='small' onClick={() => { move(-1) }}>↑</Button>
          <Button size='small' onClick={() => { move(1) }}>↓</Button>
        </>
      )}
      <Button size='small' danger onClick={remove}>×</Button>
    </Space>
  )

  const moveInList = <T, >(items: T[], index: number, direction: -1 | 1): T[] => {
    const target = index + direction
    if (target < 0 || target >= items.length) {
      return items
    }
    const copy = [...items]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    return copy
  }

  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, padding: 8 }}>
      <Space style={{ marginBottom: 8 }} wrap>
        {allowGroup && (
          <Select
            style={{ width: 160 }}
            value={mode}
            disabled={list.length > 0}
            onChange={setPendingMode}
            options={[{ label: 'Default', value: 'default' }, { label: 'Grouped', value: 'grouped' }]}
          />
        )}
        {mode === 'default'
          ? (
            <Button size='small' onClick={() => { onChange([...list, { option: '', value: '' }]) }}>Add entry</Button>
            )
          : (
            <Button size='small' onClick={() => { onChange([...list, [{ option: '', value: '', name: `group_${list.length + 1}` }]]) }}>Add group</Button>
            )}
      </Space>

      {mode === 'default' && list.map((item, index) =>
        renderItem(
          item,
          (next) => { onChange(list.map((entry, i) => (i === index ? next : entry))) },
          () => { onChange(list.filter((_, i) => i !== index)) },
          (direction) => { onChange(moveInList(list, index, direction)) },
          `item-${index}`
        )
      )}

      {mode === 'grouped' && list.map((group: Item[], groupIndex) => {
        const groupName = group[0]?.name ?? ''
        const updateGroup = (items: Item[], name: string = groupName): void => {
          onChange(list.map((entry, i) => (i === groupIndex ? items.map((item) => ({ ...item, name })) : entry)))
        }

        return (
          <div key={`group-${groupIndex}`} style={{ border: '1px dashed #d9d9d9', borderRadius: 4, padding: 8, marginBottom: 8 }}>
            <Space style={{ marginBottom: 8 }} wrap>
              <Input
                style={{ width: 240 }}
                placeholder='Group name'
                value={groupName}
                onChange={(event) => { updateGroup(group, event.target.value) }}
              />
              <Button size='small' onClick={() => { updateGroup([...group, { option: '', value: '', name: groupName }]) }}>Add entry</Button>
              <Button size='small' danger onClick={() => { onChange(list.filter((_, i) => i !== groupIndex)) }}>Delete group</Button>
            </Space>
            {group.map((item, index) =>
              renderItem(
                item,
                (next) => { updateGroup(group.map((entry, i) => (i === index ? next : entry))) },
                () => {
                  const remaining = group.filter((_, i) => i !== index)
                  if (remaining.length === 0) {
                    onChange(list.filter((_, i) => i !== groupIndex))
                  } else {
                    updateGroup(remaining)
                  }
                },
                (direction) => { updateGroup(moveInList(group, index, direction)) },
                `group-${groupIndex}-item-${index}`
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
