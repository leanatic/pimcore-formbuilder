import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Spin, Tabs } from 'antd'
import { getForm } from '../api/endpoints'
import { ConfigurationTab } from './configuration/configuration-tab'
import { OutputWorkflowTab } from './output-workflows/output-workflow-tab'
import { useUi } from './common/ui-context'

interface Props {
  formId: number
  forbiddenNames: string[]
  onDirtyChange: (dirty: boolean) => void
  /** form was saved / imported: the tree needs a refresh (name / group may have changed) */
  onFormChanged: () => void
}

export const FormEditor = ({ formId, forbiddenNames, onDirtyChange, onFormChanged }: Props): React.JSX.Element => {
  const { notifyError } = useUi()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>(null)
  const [revision, setRevision] = useState(0)
  const [activeTab, setActiveTab] = useState('configuration')
  const [configDirty, setConfigDirty] = useState(false)
  const [workflowDirty, setWorkflowDirty] = useState(false)

  const load = useCallback(async (silent: boolean): Promise<void> => {
    if (!silent) {
      setLoading(true)
    }
    setError(null)

    try {
      const data = await getForm(formId)
      setFormData(data)
      setRevision((current) => current + 1)
    } catch (e: any) {
      setError(e?.message ?? 'Could not load form')
      notifyError(e)
    } finally {
      setLoading(false)
    }
  }, [formId])

  useEffect(() => {
    setConfigDirty(false)
    setWorkflowDirty(false)
    void load(false)
  }, [formId])

  useEffect(() => {
    onDirtyChange(configDirty || workflowDirty)
  }, [configDirty, workflowDirty])

  if (loading) {
    return <Spin style={{ margin: 24 }} />
  }

  if (error !== null || formData === null) {
    return <Alert type='error' showIcon message={error ?? 'Could not load form'} style={{ margin: 16 }} />
  }

  return (
    <Tabs
      style={{ height: '100%' }}
      activeKey={activeTab}
      onChange={setActiveTab}
      items={[
        {
          key: 'configuration',
          label: 'Configuration',
          forceRender: true,
          children: (
            <ConfigurationTab
              key={`${formId}-${revision}`}
              formId={formId}
              formData={formData}
              forbiddenNames={forbiddenNames}
              active={activeTab === 'configuration'}
              onDirtyChange={setConfigDirty}
              onReload={() => {
                void load(true)
                onFormChanged()
              }}
            />
          )
        },
        {
          key: 'output-workflows',
          label: 'Output workflows',
          children: (
            <OutputWorkflowTab
              formId={formId}
              funnelEnabled={formData.funnel?.enabled === true}
              onDirtyChange={setWorkflowDirty}
            />
          )
        }
      ]}
    />
  )
}
