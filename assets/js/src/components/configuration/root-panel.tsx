import React, { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Collapse, Descriptions, Form, Input, Modal, Select, Space, Table } from 'antd'
import { deleteDoubleOptInSession, exportMailCsv, getDoubleOptInSessions, getFormDependencies } from '../../api/endpoints'
import { normalizeLabelValueStore } from '../../utils/object'
import { LocalizedHref } from '../common/localized-href'
import { useUi } from '../common/ui-context'
import { ConditionalLogicEditor } from './conditional-logic-editor'
import { KeyValueRepeater } from './key-value-repeater'
import type { FormState } from './model'

interface Props {
  formId: number
  state: FormState
  error?: string
  meta: Record<string, any> | null
  formData: any
  workflows: Array<{ id: number, name: string }>
  onChange: (state: FormState) => void
}

const formatDate = (value: any): string => {
  if (value === null || value === undefined || value === '' || value === 0) {
    return '-'
  }

  const numeric = Number(value)
  const date = Number.isNaN(numeric) ? new Date(String(value)) : new Date(numeric * 1000)

  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

const SessionsModal = ({ formId, open, onClose }: { formId: number, open: boolean, onClose: () => void }): React.JSX.Element => {
  const { notifyError, modal } = useUi()
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [sessions, setSessions] = useState<any[]>([])

  const load = (targetPage: number): void => {
    setLoading(true)
    getDoubleOptInSessions(formId, (targetPage - 1) * pageSize, pageSize)
      .then((response) => {
        setSessions(response.sessions)
        setTotal(response.total)
        setPage(targetPage)
      })
      .catch((error) => { notifyError(error) })
      .finally(() => { setLoading(false) })
  }

  useEffect(() => {
    if (open) {
      load(1)
    }
  }, [open])

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={960} title='Double Opt-In sessions'>
      <Table
        size='small'
        rowKey='token'
        loading={loading}
        dataSource={sessions}
        pagination={{ current: page, pageSize, total, onChange: load, showSizeChanger: false }}
        columns={[
          { title: 'Token', dataIndex: 'token', ellipsis: true },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Applied', dataIndex: 'applied', render: (applied: boolean) => (applied ? 'Yes' : 'No'), width: 80 },
          { title: 'Created', dataIndex: 'creationDate', render: formatDate, width: 170 },
          { title: 'Dispatch location', dataIndex: 'dispatchLocation', ellipsis: true },
          {
            title: '',
            key: 'delete',
            width: 80,
            render: (_: unknown, record: any) => (
              <Button
                size='small'
                danger
                onClick={() => {
                  modal.confirm({
                    title: 'Delete session',
                    content: 'Do you really want to delete this session?',
                    okButtonProps: { danger: true },
                    onOk: async () => {
                      try {
                        await deleteDoubleOptInSession(record.token)
                        load(page)
                      } catch (error) {
                        notifyError(error)
                      }
                    }
                  })
                }}
              >
                Delete
              </Button>
            )
          }
        ]}
        expandable={{
          expandedRowRender: (record: any) => (
            <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(record.additionalData ?? {}, null, 2)}</pre>
          ),
          rowExpandable: (record: any) => record.additionalData !== undefined && record.additionalData !== null
        }}
      />
    </Modal>
  )
}

const DependenciesModal = ({ formId, open, onClose }: { formId: number, open: boolean, onClose: () => void }): React.JSX.Element => {
  const { notifyError } = useUi()
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [documents, setDocuments] = useState<any[]>([])
  const pageSize = 25

  const load = (targetPage: number): void => {
    setLoading(true)
    getFormDependencies(formId, (targetPage - 1) * pageSize, pageSize)
      .then((response) => {
        setDocuments(response.documents)
        setTotal(response.total)
        setPage(targetPage)
      })
      .catch((error) => { notifyError(error) })
      .finally(() => { setLoading(false) })
  }

  useEffect(() => {
    if (open) {
      load(1)
    }
  }, [open])

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={760} title='Dependencies'>
      <Table
        size='small'
        rowKey={(record) => `${String(record.type)}-${String(record.id)}`}
        loading={loading}
        dataSource={documents}
        pagination={{ current: page, pageSize, total, onChange: load, showSizeChanger: false }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Type', dataIndex: 'type', width: 120 },
          { title: 'Path', dataIndex: 'path' }
        ]}
      />
    </Modal>
  )
}

export const RootPanel = ({ formId, state, error, meta, formData, workflows, onChange }: Props): React.JSX.Element => {
  const { notifyError } = useUi()
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [dependenciesOpen, setDependenciesOpen] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const [csvType, setCsvType] = useState<string>('all')

  const config = state.config
  const doubleOptInAvailable = formData.double_opt_in?.enabled === true
  const doubleOptIn = config.doubleOptIn ?? {}

  const setConfig = (patch: Record<string, any>): void => {
    onChange({ ...state, config: { ...config, ...patch } })
  }

  const setDoubleOptIn = (patch: Record<string, any>): void => {
    setConfig({ doubleOptIn: { ...doubleOptIn, ...patch } })
  }

  return (
    <div>
      {error !== undefined && <Alert type='error' showIcon message={error} style={{ marginBottom: 12 }} />}

      <Space style={{ marginBottom: 12 }} wrap>
        <Button onClick={() => { setMetaOpen(true) }}>Meta information</Button>
        <Button onClick={() => { setDependenciesOpen(true) }}>Dependencies</Button>
      </Space>

      <Form layout='vertical'>
        <Collapse
          defaultActiveKey={['base', 'conditional']}
          items={[
            {
              key: 'base',
              label: 'Form settings',
              children: (
                <>
                  <Form.Item label='Name' required style={{ marginBottom: 12 }}>
                    <Input value={state.name} onChange={(event) => { onChange({ ...state, name: event.target.value }) }} />
                  </Form.Item>
                  <Form.Item label='Group' style={{ marginBottom: 12 }}>
                    <Input value={state.group} onChange={(event) => { onChange({ ...state, group: event.target.value }) }} />
                  </Form.Item>
                  <Form.Item label='Action' required style={{ marginBottom: 12 }}>
                    <Input value={config.action ?? ''} onChange={(event) => { setConfig({ action: event.target.value }) }} />
                  </Form.Item>
                  <Form.Item label='Method' style={{ marginBottom: 12 }}>
                    <Select
                      value={config.method}
                      options={[{ value: 'post', label: 'POST' }, { value: 'get', label: 'GET' }]}
                      onChange={(method) => { setConfig({ method }) }}
                    />
                  </Form.Item>
                  <Form.Item label='Enctype' style={{ marginBottom: 12 }}>
                    <Select
                      value={config.enctype}
                      options={[
                        { value: 'text/plain', label: 'text/plain' },
                        { value: 'application/x-www-form-urlencoded', label: 'application/x-www-form-urlencoded' },
                        { value: 'multipart/form-data', label: 'multipart/form-data' }
                      ]}
                      onChange={(enctype) => { setConfig({ enctype }) }}
                    />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 4 }}>
                    <Checkbox checked={config.noValidate === true} onChange={(event) => { setConfig({ noValidate: event.target.checked }) }}>
                      Disable HTML5 validation (novalidate)
                    </Checkbox>
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 12 }}>
                    <Checkbox checked={config.useAjax === true} onChange={(event) => { setConfig({ useAjax: event.target.checked }) }}>
                      Submit via AJAX
                    </Checkbox>
                  </Form.Item>
                  <Form.Item label='HTML attributes' style={{ marginBottom: 0 }}>
                    <KeyValueRepeater
                      value={config.attributes}
                      optionStore={normalizeLabelValueStore(formData.config_store?.attributes)}
                      allowGroup={false}
                      allowChoiceMeta={false}
                      allowSort={false}
                      onChange={(attributes) => { setConfig({ attributes }) }}
                    />
                  </Form.Item>
                </>
              )
            },
            ...(doubleOptInAvailable
              ? [{
                  key: 'double-opt-in',
                  label: 'Double Opt-In',
                  children: (
                    <>
                      <Form.Item style={{ marginBottom: 12 }}>
                        <Checkbox
                          checked={doubleOptIn.enabled === true}
                          onChange={(event) => { setDoubleOptIn({ enabled: event.target.checked }) }}
                        >
                          Enable Double Opt-In
                        </Checkbox>
                      </Form.Item>
                      {doubleOptIn.enabled === true && (
                        <>
                          <Form.Item style={{ marginBottom: 12 }}>
                            <Checkbox
                              checked={doubleOptIn.allowMultipleUserSessions !== false}
                              onChange={(event) => { setDoubleOptIn({ allowMultipleUserSessions: event.target.checked }) }}
                            >
                              Allow multiple user sessions
                            </Checkbox>
                          </Form.Item>
                          <Form.Item label='Instruction note (translatable)' style={{ marginBottom: 12 }}>
                            <Input value={doubleOptIn.instructionNote ?? ''} onChange={(event) => { setDoubleOptIn({ instructionNote: event.target.value }) }} />
                          </Form.Item>
                          <Form.Item label='Confirmation message (translatable)' required style={{ marginBottom: 12 }}>
                            <Input
                              status={doubleOptIn.confirmationMessage ? undefined : 'error'}
                              value={doubleOptIn.confirmationMessage ?? ''}
                              onChange={(event) => { setDoubleOptIn({ confirmationMessage: event.target.value }) }}
                            />
                          </Form.Item>
                          <Form.Item label='Mail template' style={{ marginBottom: 12 }}>
                            <LocalizedHref
                              includeDefault
                              elementType='document'
                              subtype='email'
                              value={doubleOptIn.mailTemplate}
                              onChange={(mailTemplate) => { setDoubleOptIn({ mailTemplate }) }}
                            />
                          </Form.Item>
                          <Button onClick={() => { setSessionsOpen(true) }}>Show sessions</Button>
                        </>
                      )}
                    </>
                  )
                }]
              : []),
            {
              key: 'conditional',
              label: 'Conditional logic',
              children: (
                <ConditionalLogicEditor
                  value={state.conditionalLogic}
                  onChange={(conditionalLogic) => { onChange({ ...state, conditionalLogic }) }}
                  store={formData.conditional_logic_store ?? { conditions: [], actions: [] }}
                  nodes={state.nodes}
                  validationConstraints={formData.validation_constraints ?? []}
                  workflows={workflows}
                />
              )
            },
            ...(workflows.length > 0
              ? [{
                  key: 'csv',
                  label: 'Email CSV export',
                  children: (
                    <Space.Compact>
                      <Select
                        style={{ width: 280 }}
                        value={csvType}
                        onChange={setCsvType}
                        options={[{ value: 'all', label: 'All mails' }, ...workflows.map((workflow) => ({ value: String(workflow.id), label: workflow.name }))]}
                      />
                      <Button
                        onClick={() => {
                          exportMailCsv(formId, csvType).catch((exportError) => { notifyError(exportError) })
                        }}
                      >
                        Export CSV
                      </Button>
                    </Space.Compact>
                  )
                }]
              : [])
          ]}
        />
      </Form>

      <Modal open={metaOpen} onCancel={() => { setMetaOpen(false) }} footer={null} title='Meta information'>
        <Descriptions column={1} size='small' bordered>
          <Descriptions.Item label='ID'>{formId}</Descriptions.Item>
          <Descriptions.Item label='Creation date'>{formatDate(meta?.creation_date)}</Descriptions.Item>
          <Descriptions.Item label='Modification date'>{formatDate(meta?.modification_date)}</Descriptions.Item>
          <Descriptions.Item label='Created by'>{meta?.created_by ?? '-'}</Descriptions.Item>
          <Descriptions.Item label='Modified by'>{meta?.modified_by ?? '-'}</Descriptions.Item>
        </Descriptions>
      </Modal>
      <DependenciesModal formId={formId} open={dependenciesOpen} onClose={() => { setDependenciesOpen(false) }} />
      <SessionsModal formId={formId} open={sessionsOpen} onClose={() => { setSessionsOpen(false) }} />
    </div>
  )
}
