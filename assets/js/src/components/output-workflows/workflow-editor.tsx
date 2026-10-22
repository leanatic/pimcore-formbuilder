import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Collapse, Dropdown, Form, Input, Space, Spin, Typography } from 'antd'
import { getOutputWorkflow, saveOutputWorkflow } from '../../api/endpoints'
import { FbIcon } from '../../utils/icons'
import { clone, uid } from '../../utils/object'
import { JsonEditor } from '../common/json-editor'
import { useUi } from '../common/ui-context'
import { ApiChannelEditor } from './channels/api-channel'
import { EmailChannelEditor } from './channels/email-channel'
import { FunnelActionsEditor } from './channels/funnel-actions'
import { FunnelChannelEditor } from './channels/funnel-channel'
import { ObjectChannelEditor } from './channels/object-channel'
import type { ChannelModel } from './channels/types'
import { SuccessManagementEditor } from './success-management'

interface Props {
  formId: number
  workflowId: number
  onDirtyChange: (dirty: boolean) => void
  onSaved: (name: string) => void
}

const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${uid('c')}-${Math.random().toString(16).slice(2)}`
}

export const WorkflowEditor = ({ formId, workflowId, onDirtyChange, onSaved }: Props): React.JSX.Element => {
  const { notifyError, notifySuccess, message } = useUi()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [funnel, setFunnel] = useState(false)
  const [store, setStore] = useState<Array<{ identifier: string, label: string, icon_class?: string }>>([])
  const [virtualDefinitions, setVirtualDefinitions] = useState<Array<{ name: string, label: string }>>([])
  const [successManagement, setSuccessManagement] = useState<Record<string, any>>({})
  const [channels, setChannels] = useState<ChannelModel[]>([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setLoading(true)
    setLoadError(null)

    getOutputWorkflow(workflowId)
      .then((data) => {
        setName(data.name ?? '')
        setFunnel(data.funnel_workflow === true)
        setStore(data.output_workflow_channels_store ?? [])
        setVirtualDefinitions((data.output_workflow_channels_virtual_funnel_action_definitions ?? []).map((definition: any) => ({
          name: definition.name,
          label: definition.label ?? definition.name
        })))
        setSuccessManagement(Array.isArray(data.output_workflow_success_management) ? {} : (data.output_workflow_success_management ?? {}))
        setChannels((data.output_workflow_channels ?? []).map((channel: any): ChannelModel => ({
          key: uid('ch'),
          id: channel.id,
          type: channel.type,
          name: channel.name ?? generateUuid(),
          configuration: clone(channel.configuration ?? {}),
          funnelActions: Array.isArray(channel.funnelActions) ? clone(channel.funnelActions) : null
        })))
        setDirty(false)
        onDirtyChange(false)
      })
      .catch((error) => {
        setLoadError(error?.message ?? 'Could not load output workflow')
        notifyError(error)
      })
      .finally(() => { setLoading(false) })
  }, [workflowId])

  const markDirty = (): void => {
    setDirty(true)
    onDirtyChange(true)
  }

  const typeLabel = (type: string): string => store.find((entry) => entry.identifier === type)?.label ?? type

  const channelLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    const counters: Record<string, number> = {}

    channels.forEach((channel) => {
      counters[channel.type] = (counters[channel.type] ?? 0) + 1
      labels[channel.name] = `${typeLabel(channel.type)} #${counters[channel.type]}`
    })

    return labels
  }, [channels, store])

  const updateChannel = (key: string, patch: Partial<ChannelModel>): void => {
    setChannels((current) => current.map((channel) => (channel.key === key ? { ...channel, ...patch } : channel)))
    markDirty()
  }

  const addChannel = (type: string): void => {
    setChannels((current) => [...current, {
      key: uid('ch'),
      id: null,
      type,
      name: generateUuid(),
      configuration: type === 'object' ? { resolveStrategy: 'newObject', objectMappingData: [] } : {},
      funnelActions: null
    }])
    markDirty()
  }

  const save = async (): Promise<void> => {
    if (name.trim() === '') {
      void message.error('Please enter a name for the output workflow.')
      return
    }

    for (const channel of channels) {
      if (funnel && Array.isArray(channel.funnelActions) && channel.funnelActions.some((action) => action.type === null || action.type === undefined)) {
        void message.error(`Funnel actions of "${channelLabels[channel.name]}" are invalid: every action needs an action type.`)
        return
      }
    }

    setSaving(true)
    try {
      await saveOutputWorkflow(workflowId, {
        name: name.trim(),
        successManagement: funnel ? [] : successManagement,
        channels: channels.map((channel) => ({
          type: channel.type,
          name: channel.name,
          configuration: channel.configuration,
          funnelActions: funnel ? channel.funnelActions : null
        }))
      })
      setDirty(false)
      onDirtyChange(false)
      notifySuccess('Output workflow saved')
      onSaved(name.trim())
    } catch (error) {
      notifyError(error)
    } finally {
      setSaving(false)
    }
  }

  const renderChannelEditor = (channel: ChannelModel): React.ReactNode => {
    const common = {
      formId,
      workflowId,
      channel,
      channels,
      onChange: (configuration: any) => { updateChannel(channel.key, { configuration }) }
    }

    switch (channel.type) {
      case 'email':
        return <EmailChannelEditor {...common} />
      case 'object':
        return <ObjectChannelEditor {...common} />
      case 'api':
        return <ApiChannelEditor {...common} />
      case 'funnel':
        return (
          <FunnelChannelEditor
            {...common}
            channelLabels={channelLabels}
            onActionsChange={(funnelActions) => { updateChannel(channel.key, { funnelActions }) }}
          />
        )
      default:
        return (
          <div>
            <Typography.Paragraph type='secondary'>No dedicated editor for channel type "{channel.type}": edit the configuration as JSON.</Typography.Paragraph>
            <JsonEditor value={channel.configuration} rows={10} onChange={common.onChange} />
          </div>
        )
    }
  }

  if (loading) {
    return <Spin style={{ margin: 24 }} />
  }

  if (loadError !== null) {
    return <Alert type='error' showIcon message={loadError} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Button type='primary' loading={saving} onClick={() => { void save() }}>Save</Button>
          {dirty && <Typography.Text type='warning'>Unsaved changes</Typography.Text>}
        </Space>
        {funnel && <Typography.Text type='secondary'>Funnel workflow</Typography.Text>}
      </div>

      <Form layout='vertical'>
        <Form.Item label='Name' required style={{ marginBottom: 16 }}>
          <Input value={name} onChange={(event) => { setName(event.target.value); markDirty() }} />
        </Form.Item>
      </Form>

      {!funnel && (
        <Collapse
          style={{ marginBottom: 16 }}
          defaultActiveKey={['success']}
          items={[{
            key: 'success',
            label: 'Success management',
            children: (
              <SuccessManagementEditor
                value={successManagement}
                onChange={(value) => { setSuccessManagement(value); markDirty() }}
              />
            )
          }]}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>Channels</Typography.Title>
        <Dropdown
          menu={{
            items: store.map((entry) => ({ key: entry.identifier, label: entry.label, icon: <FbIcon name={entry.icon_class} /> })),
            onClick: ({ key }) => { addChannel(key) }
          }}
        >
          <Button>Add channel</Button>
        </Dropdown>
      </div>

      {channels.length === 0 && <Alert type='info' message='No channels configured yet.' />}

      <Collapse
        key={channels.map((channel) => channel.key).join('|')}
        defaultActiveKey={channels.map((channel) => channel.key)}
        items={channels.map((channel) => ({
          key: channel.key,
          label: (
            <Space>
              <FbIcon name={store.find((entry) => entry.identifier === channel.type)?.icon_class} />
              <span>{channelLabels[channel.name]}</span>
            </Space>
          ),
          extra: (
            <Button
              size='small'
              danger
              onClick={(event) => {
                event.stopPropagation()
                setChannels((current) => current.filter((entry) => entry.key !== channel.key))
                markDirty()
              }}
            >
              Remove
            </Button>
          ),
          children: (
            <>
              {renderChannelEditor(channel)}
              {funnel && channel.type !== 'funnel' && (
                <FunnelActionsEditor
                  title='Virtual funnel actions'
                  definitions={virtualDefinitions}
                  dynamic={false}
                  value={channel.funnelActions}
                  onChange={(funnelActions) => { updateChannel(channel.key, { funnelActions }) }}
                  channels={channels}
                  currentChannelName={channel.name}
                  channelLabels={channelLabels}
                />
              )}
            </>
          )
        }))}
      />
    </div>
  )
}
