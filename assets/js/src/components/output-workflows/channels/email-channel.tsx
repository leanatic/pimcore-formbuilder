import React, { useState } from 'react'
import { Button, Checkbox, Collapse, Form, Input, Modal, Select, Tag, Typography } from 'antd'
import { getMailEditorData } from '../../../api/endpoints'
import { ElementReferenceInput } from '../../common/element-reference-input'
import { LocalizedTabs } from '../../common/localized-tabs'
import { useUi } from '../../common/ui-context'
import type { ChannelEditorProps } from './types'

const WidgetCatalogue = ({ formId, open, onClose }: { formId: number, open: boolean, onClose: () => void }): React.JSX.Element => {
  const { notifyError } = useUi()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }

    setLoading(true)
    getMailEditorData(formId)
      .then(setData)
      .catch((error) => { notifyError(error) })
      .finally(() => { setLoading(false) })
  }, [open])

  const groups: any[] = data?.configuration?.widgetGroups !== undefined
    ? (Array.isArray(data.configuration.widgetGroups) ? data.configuration.widgetGroups : Object.values(data.configuration.widgetGroups))
    : []

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={720} title='Mail editor widgets' loading={loading}>
      {data?.configuration?.help !== undefined && (
        <Typography.Paragraph type='secondary'>
          <span dangerouslySetInnerHTML={{ __html: String(data.configuration.help) }} />
        </Typography.Paragraph>
      )}
      {groups.map((group, index) => (
        <div key={index} style={{ marginBottom: 12 }}>
          <Typography.Text strong>{group.label}</Typography.Text>
          <div style={{ marginTop: 6 }}>
            {(group.elements ?? []).map((element: any, elementIndex: number) => (
              <Tag key={elementIndex} style={{ marginBottom: 4 }}>{element.label}</Tag>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  )
}

export const EmailChannelEditor = ({ formId, channel, onChange }: ChannelEditorProps): React.JSX.Element => {
  const config: Record<string, any> = channel.configuration !== null && typeof channel.configuration === 'object' && !Array.isArray(channel.configuration) ? channel.configuration : {}
  const [widgetsOpen, setWidgetsOpen] = useState(false)

  const setLocale = (locale: string, patch: Record<string, any>): void => {
    onChange({ ...config, [locale]: { ...(config[locale] ?? {}), ...patch } })
  }

  return (
    <>
      <LocalizedTabs
        includeDefault
        usedLocales={Object.keys(config)}
        render={(locale) => {
          const localeData = config[locale] ?? {}
          const layout = localeData.mailLayoutData !== null && typeof localeData.mailLayoutData === 'object' ? localeData.mailLayoutData : {}
          const hasLayout = (layout.html ?? '') !== '' || (layout.text ?? '') !== ''

          return (
            <Form layout='vertical'>
              <Form.Item label='Mail template' style={{ marginBottom: 12 }}>
                <ElementReferenceInput
                  elementType='document'
                  subtype='email'
                  value={localeData.mailTemplate ?? null}
                  onChange={(mailTemplate) => { setLocale(locale, { mailTemplate }) }}
                />
              </Form.Item>
              <Form.Item label='Ignore fields' extra='Form fields which should not be included in the mail body.' style={{ marginBottom: 12 }}>
                <Select
                  mode='tags'
                  open={false}
                  style={{ width: '100%' }}
                  value={Array.isArray(localeData.ignoreFields) ? localeData.ignoreFields : []}
                  onChange={(ignoreFields) => { setLocale(locale, { ignoreFields }) }}
                />
              </Form.Item>
              {(['allowAttachments', 'forcePlainText', 'disableDefaultMailBody', 'disableMailLogging'] as const).map((flag) => (
                <Form.Item key={flag} style={{ marginBottom: 4 }}>
                  <Checkbox checked={localeData[flag] === true} onChange={(event) => { setLocale(locale, { [flag]: event.target.checked }) }}>
                    {{
                      allowAttachments: 'Allow attachments',
                      forcePlainText: 'Force plain text',
                      disableDefaultMailBody: 'Disable default mail body',
                      disableMailLogging: 'Disable mail logging'
                    }[flag]}
                  </Checkbox>
                </Form.Item>
              ))}
              <Collapse
                ghost
                style={{ marginTop: 8 }}
                items={[{
                  key: 'layout',
                  label: <span>Custom mail layout {hasLayout ? <Tag color='green'>enabled</Tag> : <Tag>disabled</Tag>}</span>,
                  children: (
                    <>
                      <Button size='small' style={{ marginBottom: 8 }} onClick={() => { setWidgetsOpen(true) }}>Show available widgets</Button>
                      <Form.Item label='HTML' style={{ marginBottom: 8 }}>
                        <Input.TextArea
                          rows={8}
                          value={layout.html ?? ''}
                          onChange={(event) => { setLocale(locale, { mailLayoutData: { ...layout, html: event.target.value } }) }}
                        />
                      </Form.Item>
                      <Form.Item label='Text' style={{ marginBottom: 8 }}>
                        <Input.TextArea
                          rows={6}
                          value={layout.text ?? ''}
                          onChange={(event) => { setLocale(locale, { mailLayoutData: { ...layout, text: event.target.value } }) }}
                        />
                      </Form.Item>
                      <Button
                        size='small'
                        danger
                        disabled={!hasLayout}
                        onClick={() => {
                          const { mailLayoutData, ...rest } = localeData
                          onChange({ ...config, [locale]: rest })
                        }}
                      >
                        Reset layout
                      </Button>
                    </>
                  )
                }]}
              />
            </Form>
          )
        }}
      />
      <WidgetCatalogue formId={formId} open={widgetsOpen} onClose={() => { setWidgetsOpen(false) }} />
    </>
  )
}
