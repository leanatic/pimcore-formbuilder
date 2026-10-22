import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Modal, Space, Typography, Upload } from 'antd'
import { exportForm, getOutputWorkflowList, importForm, saveForm } from '../../api/endpoints'
import { useUi } from '../common/ui-context'
import { FieldTree } from './field-tree'
import { ConstraintEditor, ContainerEditor, FieldEditor, type ConfigurationContext } from './node-editors'
import { RootPanel } from './root-panel'
import {
  ROOT_KEY,
  createFormState,
  findNode,
  mapNode,
  serializeFormState,
  validateState,
  walkNodes,
  type FormState
} from './model'

interface Props {
  formId: number
  formData: any
  forbiddenNames: string[]
  /** true while the tab is visible */
  active: boolean
  onDirtyChange: (dirty: boolean) => void
  /** called after a successful save / import so the parent can reload the form */
  onReload: () => void
}

export const ConfigurationTab = ({ formId, formData, forbiddenNames, active, onDirtyChange, onReload }: Props): React.JSX.Element => {
  const { notifyError, notifySuccess, message } = useUi()
  const [state, setState] = useState<FormState>(() => createFormState(formData))
  const [selectedKey, setSelectedKey] = useState<string>(ROOT_KEY)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [invalid, setInvalid] = useState<Record<string, string>>({})
  const [workflows, setWorkflows] = useState<Array<{ id: number, name: string }>>([])
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importWorkflows, setImportWorkflows] = useState(false)
  const [importConditionalLogic, setImportConditionalLogic] = useState(false)
  const [importing, setImporting] = useState(false)

  const ctx = useMemo<ConfigurationContext>(() => ({
    groups: formData.fields_structure ?? [],
    templates: formData.fields_template ?? [],
    containerTypes: formData.container_types ?? [],
    validationConstraints: formData.validation_constraints ?? [],
    lockedFieldNames: Object.values(formData.sensitive_field_names ?? {}).flat() as string[]
  }), [formData])

  useEffect(() => {
    if (!active) {
      return
    }

    getOutputWorkflowList(formId).then(setWorkflows).catch(() => { setWorkflows([]) })
  }, [active, formId])

  const update = (next: FormState): void => {
    setState(next)
    setDirty(true)
    onDirtyChange(true)
  }

  const save = async (): Promise<void> => {
    const result = validateState(state, forbiddenNames, { groups: ctx.groups, doubleOptInEnabled: formData.double_opt_in?.enabled === true })
    setInvalid(result.invalid)

    const firstInvalid = Object.keys(result.invalid)[0]
    if (firstInvalid !== undefined) {
      setSelectedKey(firstInvalid)
      void message.error(result.invalid[firstInvalid])
      return
    }

    setSaving(true)
    try {
      await saveForm(formId, serializeFormState(state))
      setDirty(false)
      onDirtyChange(false)
      notifySuccess('Form saved')
      onReload()
    } catch (error) {
      notifyError(error)
    } finally {
      setSaving(false)
    }
  }

  const doImport = async (): Promise<void> => {
    if (importFile === null) {
      return
    }

    setImporting(true)
    try {
      await importForm(formId, importFile, importWorkflows, importConditionalLogic)
      setImportOpen(false)
      setImportFile(null)
      notifySuccess('Form imported')
      setDirty(false)
      onDirtyChange(false)
      onReload()
    } catch (error) {
      notifyError(error)
    } finally {
      setImporting(false)
    }
  }

  const selectedNode = selectedKey === ROOT_KEY ? null : findNode(state.nodes, selectedKey)

  // names that must be unique are re-validated on the fly once a validation failed
  useEffect(() => {
    if (Object.keys(invalid).length === 0) {
      return
    }
    const result = validateState(state, forbiddenNames, { groups: ctx.groups, doubleOptInEnabled: formData.double_opt_in?.enabled === true })
    setInvalid(result.invalid)
  }, [state])

  useEffect(() => {
    // fall back to root when the selected node vanished
    if (selectedKey !== ROOT_KEY) {
      let found = false
      walkNodes(state.nodes, (node) => { if (node.key === selectedKey) found = true })
      if (!found) {
        setSelectedKey(ROOT_KEY)
      }
    }
  }, [state.nodes])

  const renderEditor = (): React.ReactNode => {
    if (selectedNode === null) {
      return (
        <RootPanel
          formId={formId}
          state={state}
          error={invalid[ROOT_KEY]}
          meta={formData.meta ?? null}
          formData={formData}
          workflows={workflows}
          onChange={update}
        />
      )
    }

    const editorProps = {
      key: selectedNode.key,
      node: selectedNode,
      ctx,
      error: invalid[selectedNode.key],
      onChange: (data: Record<string, any>) => {
        update({ ...state, nodes: mapNode(state.nodes, selectedNode.key, (node) => ({ ...node, data })) })
      }
    }

    if (selectedNode.kind === 'container') {
      return <ContainerEditor {...editorProps} />
    }

    if (selectedNode.kind === 'constraint') {
      return <ConstraintEditor {...editorProps} />
    }

    return <FieldEditor {...editorProps} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        <Space>
          <Button type='primary' loading={saving} onClick={() => { void save() }}>Save</Button>
          {dirty && <Typography.Text type='warning'>Unsaved changes</Typography.Text>}
        </Space>
        <Space>
          <Button onClick={() => { setImportOpen(true) }}>Import</Button>
          <Button onClick={() => { exportForm(formId, state.name).catch((error) => { notifyError(error) }) }}>Export</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ width: 340, flexShrink: 0, overflow: 'auto', borderRight: '1px solid #f0f0f0', paddingRight: 12 }}>
          <FieldTree
            formName={state.name}
            nodes={state.nodes}
            ctx={ctx}
            selectedKey={selectedKey}
            invalid={invalid}
            onSelect={setSelectedKey}
            onNodesChange={(nodes) => { update({ ...state, nodes }) }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', paddingRight: 8 }}>
          {renderEditor()}
        </div>
      </div>

      <Modal
        open={importOpen}
        title='Import form'
        okText='Import'
        confirmLoading={importing}
        okButtonProps={{ disabled: importFile === null }}
        onOk={() => { void doImport() }}
        onCancel={() => { setImportOpen(false) }}
        destroyOnClose
      >
        <Alert type='warning' showIcon message='Importing replaces the current form configuration.' style={{ marginBottom: 12 }} />
        <Upload
          accept='.json'
          maxCount={1}
          beforeUpload={(file) => { setImportFile(file); return false }}
          onRemove={() => { setImportFile(null) }}
        >
          <Button>Select form JSON file</Button>
        </Upload>
        <div style={{ marginTop: 12 }}>
          <Checkbox checked={importWorkflows} onChange={(event) => { setImportWorkflows(event.target.checked) }}>Import output workflows</Checkbox>
        </div>
        <div>
          <Checkbox checked={importConditionalLogic} onChange={(event) => { setImportConditionalLogic(event.target.checked) }}>Import conditional logic</Checkbox>
        </div>
      </Modal>
    </div>
  )
}
