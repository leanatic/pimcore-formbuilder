import React, { useCallback, useEffect, useState } from 'react'
import { Button, Checkbox, Dropdown, Empty, Form, Input, Modal, Spin, Typography } from 'antd'
import { addOutputWorkflow, deleteOutputWorkflow, getOutputWorkflowTree, type OutputWorkflowTreeItem } from '../../api/endpoints'
import { useUi } from '../common/ui-context'
import { WorkflowEditor } from './workflow-editor'

interface Props {
  formId: number
  funnelEnabled: boolean
  onDirtyChange: (dirty: boolean) => void
}

export const OutputWorkflowTab = ({ formId, funnelEnabled, onDirtyChange }: Props): React.JSX.Element => {
  const { notifyError, notifySuccess, modal } = useUi()
  const [loading, setLoading] = useState(true)
  const [workflows, setWorkflows] = useState<OutputWorkflowTreeItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFunnel, setNewFunnel] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async (): Promise<OutputWorkflowTreeItem[]> => {
    setLoading(true)
    try {
      const items = await getOutputWorkflowTree(formId)
      setWorkflows(items)
      return items
    } catch (error) {
      notifyError(error)
      return []
    } finally {
      setLoading(false)
    }
  }, [formId])

  useEffect(() => {
    void load()
  }, [load])

  const handleDirty = (value: boolean): void => {
    setDirty(value)
    onDirtyChange(value)
  }

  const select = (id: number): void => {
    if (id === selectedId) {
      return
    }

    if (dirty) {
      modal.confirm({
        title: 'Unsaved changes',
        content: 'The current output workflow has unsaved changes. Discard them?',
        okText: 'Discard',
        onOk: () => {
          handleDirty(false)
          setSelectedId(id)
        }
      })
      return
    }

    setSelectedId(id)
  }

  const add = async (): Promise<void> => {
    if (newName.trim() === '') {
      return
    }

    setAdding(true)
    try {
      const result = await addOutputWorkflow(formId, newName.trim(), newFunnel)
      await load()
      setAddOpen(false)
      setNewName('')
      setNewFunnel(false)
      handleDirty(false)
      setSelectedId(result.id)
      notifySuccess('Output workflow created')
    } catch (error) {
      notifyError(error)
    } finally {
      setAdding(false)
    }
  }

  const remove = (item: OutputWorkflowTreeItem): void => {
    modal.confirm({
      title: 'Delete output workflow',
      content: `Do you really want to delete "${item.name}"?`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteOutputWorkflow(Number(item.id))
          if (selectedId === Number(item.id)) {
            setSelectedId(null)
            handleDirty(false)
          }
          await load()
        } catch (error) {
          notifyError(error)
        }
      }
    })
  }

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #f0f0f0', paddingRight: 12, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text strong>Output workflows</Typography.Text>
          <Button size='small' onClick={() => { setAddOpen(true) }}>Add</Button>
        </div>
        {loading && <Spin />}
        {!loading && workflows.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='No output workflows' />}
        {workflows.map((item) => {
          const id = Number(item.id)
          const active = id === selectedId

          return (
            <Dropdown
              key={id}
              trigger={['contextMenu']}
              menu={{ items: [{ key: 'delete', label: 'Delete', danger: true }], onClick: () => { remove(item) } }}
            >
              <div
                onClick={() => { select(id) }}
                style={{
                  padding: '6px 10px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  marginBottom: 2,
                  background: active ? 'rgba(114, 46, 209, 0.1)' : undefined,
                  fontWeight: active ? 600 : undefined
                }}
              >
                {item.name}
                {item.funnelAware === true && <Typography.Text type='secondary' style={{ marginLeft: 6, fontSize: 12 }}>(funnel)</Typography.Text>}
              </div>
            </Dropdown>
          )
        })}
      </div>

      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', paddingRight: 8 }}>
        {selectedId === null
          ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='Select or create an output workflow' />
          : (
            <WorkflowEditor
              key={selectedId}
              formId={formId}
              workflowId={selectedId}
              onDirtyChange={handleDirty}
              onSaved={() => { void load() }}
            />
            )}
      </div>

      <Modal
        open={addOpen}
        title='Add output workflow'
        okText='Create'
        confirmLoading={adding}
        okButtonProps={{ disabled: newName.trim() === '' }}
        onOk={() => { void add() }}
        onCancel={() => { setAddOpen(false) }}
        destroyOnClose
      >
        <Form layout='vertical'>
          <Form.Item label='Name' required>
            <Input autoFocus value={newName} onChange={(event) => { setNewName(event.target.value) }} onPressEnter={() => { void add() }} />
          </Form.Item>
          {funnelEnabled && (
            <Form.Item>
              <Checkbox checked={newFunnel} onChange={(event) => { setNewFunnel(event.target.checked) }}>Funnel aware workflow</Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
