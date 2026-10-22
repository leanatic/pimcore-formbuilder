import React, { useEffect, useState } from 'react'
import { Button, Checkbox, Select, Space, Typography } from 'antd'
import { getFunnelActions } from '../../../api/endpoints'
import { JsonEditor } from '../../common/json-editor'
import type { ChannelModel } from './types'

export interface FunnelActionDefinition {
  name: string
  label: string
}

interface Props {
  definitions: FunnelActionDefinition[]
  /** dynamic layers allow to add / remove actions */
  dynamic: boolean
  value: any[] | null
  onChange: (value: any[]) => void
  channels: ChannelModel[]
  currentChannelName: string
  channelLabels: Record<string, string>
  title: string
}

const toSaveName = (label: string): string => label.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')

export const FunnelActionsEditor = ({ definitions, dynamic, value, onChange, channels, currentChannelName, channelLabels, title }: Props): React.JSX.Element => {
  const [actionTypes, setActionTypes] = useState<Array<{ key: string, label: string }>>([])
  const actions: any[] = Array.isArray(value) ? value : []

  useEffect(() => {
    getFunnelActions().then(setActionTypes).catch(() => { setActionTypes([]) })
  }, [])

  const rows: FunnelActionDefinition[] = dynamic
    ? actions.map((action) => ({ name: action.triggerName, label: action.label ?? action.triggerName }))
    : definitions

  const updateAction = (name: string, label: string, patch: Record<string, any>): void => {
    const existing = actions.find((action) => action.triggerName === name)
    const base = existing ?? { triggerName: name, label, type: null, coreConfiguration: { ignoreInvalidFormSubmission: false }, configuration: null }
    const next = { ...base, ...patch }

    onChange(existing !== undefined ? actions.map((action) => (action.triggerName === name ? next : action)) : [...actions, next])
  }

  const addDynamic = (): void => {
    const label = window.prompt('Funnel action label')

    if (label === null || label === '') {
      return
    }

    const name = toSaveName(label)

    if (name === '' || actions.some((action) => action.triggerName === name)) {
      window.alert('Funnel action name is invalid or already in use.')
      return
    }

    onChange([...actions, { triggerName: name, label, type: null, coreConfiguration: { ignoreInvalidFormSubmission: false }, configuration: null }])
  }

  const otherChannels = channels.filter((channel) => channel.name !== currentChannelName)

  return (
    <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text strong>{title}</Typography.Text>
        {dynamic && <Button size='small' onClick={addDynamic}>Add action</Button>}
      </div>
      {rows.length === 0 && <Typography.Text type='secondary'>No actions available.</Typography.Text>}
      {rows.map((row) => {
        const action = actions.find((entry) => entry.triggerName === row.name) ?? null
        const type: string | null = action?.type ?? null

        return (
          <div key={row.name} style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
            <Space align='start' wrap>
              <Typography.Text style={{ display: 'inline-block', minWidth: 140 }}>{row.label}</Typography.Text>
              <Select
                style={{ width: 220 }}
                placeholder='Action'
                value={type ?? undefined}
                options={actionTypes.map((entry) => ({ value: entry.key, label: entry.label }))}
                onChange={(nextType) => { updateAction(row.name, row.label, { type: nextType, configuration: nextType === 'returnToFormAction' ? { populateForm: false } : null }) }}
              />
              <Checkbox
                checked={action?.coreConfiguration?.ignoreInvalidFormSubmission === true}
                onChange={(event) => {
                  updateAction(row.name, row.label, { coreConfiguration: { ...(action?.coreConfiguration ?? {}), ignoreInvalidFormSubmission: event.target.checked } })
                }}
              >
                Ignore invalid form submission
              </Checkbox>
              {dynamic && (
                <Button
                  size='small'
                  danger
                  onClick={() => { onChange(actions.filter((entry) => entry.triggerName !== row.name)) }}
                >
                  Remove
                </Button>
              )}
            </Space>

            {type === 'channelAction' && (
              <div style={{ marginTop: 8 }}>
                <Select
                  style={{ width: 360 }}
                  placeholder='Channel'
                  value={action?.configuration?.channelName ?? undefined}
                  options={otherChannels.map((channel) => ({ value: channel.name, label: channelLabels[channel.name] ?? channel.name }))}
                  onChange={(channelName) => { updateAction(row.name, row.label, { configuration: { channelName } }) }}
                />
              </div>
            )}

            {type === 'returnToFormAction' && (
              <div style={{ marginTop: 8 }}>
                <Checkbox
                  checked={action?.configuration?.populateForm === true}
                  onChange={(event) => { updateAction(row.name, row.label, { configuration: { populateForm: event.target.checked } }) }}
                >
                  Populate form with submitted data
                </Checkbox>
              </div>
            )}

            {type !== null && type !== 'channelAction' && type !== 'returnToFormAction' && (
              <div style={{ marginTop: 8 }}>
                <JsonEditor
                  value={action?.configuration ?? {}}
                  rows={4}
                  onChange={(configuration) => { updateAction(row.name, row.label, { configuration }) }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
