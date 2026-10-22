import React, { useEffect, useState } from 'react'
import { Form, Select } from 'antd'
import { getFunnelLayers } from '../../../api/endpoints'
import { JsonEditor } from '../../common/json-editor'
import { LocalizedHref } from '../../common/localized-href'
import { useUi } from '../../common/ui-context'
import { FunnelActionsEditor, type FunnelActionDefinition } from './funnel-actions'
import type { ChannelEditorProps } from './types'

interface FunnelChannelProps extends ChannelEditorProps {
  onActionsChange: (actions: any[]) => void
  channelLabels: Record<string, string>
}

export const FunnelChannelEditor = ({ channel, channels, onChange, onActionsChange, channelLabels }: FunnelChannelProps): React.JSX.Element => {
  const { notifyError } = useUi()
  const [layers, setLayers] = useState<Array<{ key: string, label: string, configuration: any }>>([])

  useEffect(() => {
    getFunnelLayers().then(setLayers).catch((error) => { notifyError(error) })
  }, [])

  const config: Record<string, any> = channel.configuration !== null && typeof channel.configuration === 'object' && !Array.isArray(channel.configuration) ? channel.configuration : {}
  const layer = layers.find((entry) => entry.key === config.type)
  const layerConfig = config.configuration ?? {}

  const definitions: FunnelActionDefinition[] = Array.isArray(layer?.configuration?.funnelActionDefinitions)
    ? layer!.configuration.funnelActionDefinitions.map((definition: any) => ({ name: definition.name, label: definition.label ?? definition.name }))
    : []

  const renderLayerConfig = (): React.ReactNode => {
    if (layer === undefined) {
      return null
    }

    if (layer.key === 'dynamicLayout') {
      const layouts: Record<string, any> = {}
      Object.keys(layerConfig).forEach((locale) => {
        if (layerConfig[locale]?.layout !== undefined) {
          layouts[locale] = layerConfig[locale].layout
        }
      })

      return (
        <Form.Item label='Layout (snippet)' style={{ marginBottom: 12 }}>
          <LocalizedHref
            includeDefault
            elementType='document'
            subtype='snippet'
            value={layouts}
            onChange={(next) => {
              const configuration: Record<string, any> = {}
              Object.keys(next).forEach((locale) => { configuration[locale] = { layout: next[locale] } })
              onChange({ ...config, configuration })
            }}
          />
        </Form.Item>
      )
    }

    return (
      <Form.Item label='Layer configuration' extra='No dedicated editor for this layer available: edit the configuration as JSON.' style={{ marginBottom: 12 }}>
        <JsonEditor
          value={layerConfig}
          rows={8}
          onChange={(configuration) => { onChange({ ...config, configuration }) }}
        />
      </Form.Item>
    )
  }

  return (
    <Form layout='vertical'>
      <Form.Item label='Funnel layer' style={{ marginBottom: 12 }}>
        <Select
          style={{ width: 320 }}
          value={config.type || undefined}
          options={layers.map((entry) => ({ value: entry.key, label: entry.label }))}
          onChange={(type) => {
            onChange({ type, configuration: {} })
            onActionsChange([])
          }}
        />
      </Form.Item>
      {renderLayerConfig()}
      {layer !== undefined && (
        <FunnelActionsEditor
          title='Funnel actions'
          definitions={definitions}
          dynamic={layer.configuration?.dynamicFunnelActionAware === true}
          value={channel.funnelActions}
          onChange={onActionsChange}
          channels={channels}
          currentChannelName={channel.name}
          channelLabels={channelLabels}
        />
      )}
    </Form>
  )
}
