import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react'
import { Alert, AutoComplete, Button, Dropdown, Form, Input, Modal, Spin, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { ApiError } from '../api/client'
import { createForm, deleteForm, getForm, getFormsTree, saveForm, type TreeItem } from '../api/endpoints'
import { useUi } from './common/ui-context'
import { createFormState, serializeFormState } from './configuration/model'

interface Props {
  selectedId: number | null
  onSelect: (id: number | null) => void
  /** confirms (or not) leaving the current form; resolves with true when navigation is allowed */
  onBeforeChange: () => Promise<boolean>
  onDeleted: (id: number) => void
}

export interface FormTreeHandle {
  reload: () => Promise<void>
}

const FORM_PREFIX = 'form:'
const GROUP_PREFIX = 'group:'

export const FormTree = forwardRef<FormTreeHandle, Props>(({ selectedId, onSelect, onBeforeChange, onDeleted }, ref): React.JSX.Element => {
  const { notifyError, notifySuccess, modal } = useUi()
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [items, setItems] = useState<TreeItem[]>([])
  const [filter, setFilter] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  const [addOpen, setAddOpen] = useState(false)
  const [addGroup, setAddGroup] = useState('')
  const [addName, setAddName] = useState('')
  const [adding, setAdding] = useState(false)

  const [renameTarget, setRenameTarget] = useState<{ id: number, name: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const tree = await getFormsTree()
      setItems(tree)
      setAuthError(null)
    } catch (error) {
      if (error instanceof ApiError && error.isAuthError) {
        setAuthError(error.message)
      } else {
        notifyError(error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useImperativeHandle(ref, () => ({ reload }), [reload])

  useEffect(() => {
    void reload()
  }, [reload])

  const groups = useMemo(() => items.filter((item) => item.type === 'group').map((item) => String(item.name)), [items])

  const matches = (name: string): boolean => filter === '' || name.toLowerCase().includes(filter.toLowerCase())

  const treeData = useMemo<DataNode[]>(() => {
    const toNode = (item: TreeItem): DataNode | null => {
      if (item.type === 'group') {
        const children = (item.children ?? []).map(toNode).filter((node): node is DataNode => node !== null)

        if (children.length === 0 && filter !== '' && !matches(item.name)) {
          return null
        }

        return {
          key: `${GROUP_PREFIX}${String(item.id)}`,
          title: renderTitle(`${GROUP_PREFIX}${String(item.id)}`, item.name),
          children: filter !== '' && matches(item.name) ? (item.children ?? []).map(toNode).filter((node): node is DataNode => node !== null) : children,
          selectable: false
        }
      }

      if (!matches(item.name)) {
        return null
      }

      return { key: `${FORM_PREFIX}${String(item.id)}`, title: renderTitle(`${FORM_PREFIX}${String(item.id)}`, item.name), isLeaf: true }
    }

    return items.map(toNode).filter((node): node is DataNode => node !== null)
  }, [items, filter, selectedId])

  useEffect(() => {
    // groups are expanded initially
    setExpandedKeys((current) => (current.length === 0 ? groups.map((group) => `${GROUP_PREFIX}${group}`) : current))
  }, [groups.join('|')])

  function renderTitle (key: string, name: string): React.ReactNode {
    const isGroup = key.startsWith(GROUP_PREFIX)
    const menu = isGroup
      ? [{ key: 'add', label: 'Add form to group' }]
      : [{ key: 'rename', label: 'Rename' }, { key: 'delete', label: 'Delete', danger: true }]

    return (
      <Dropdown
        trigger={['contextMenu']}
        menu={{
          items: menu,
          onClick: ({ key: action }) => {
            if (isGroup) {
              openAdd(key.slice(GROUP_PREFIX.length))
              return
            }

            const id = Number(key.slice(FORM_PREFIX.length))

            if (action === 'rename') {
              setRenameTarget({ id, name })
              setRenameValue(name)
            } else {
              confirmDelete(id, name)
            }
          }
        }}
      >
        <span>{name}</span>
      </Dropdown>
    )
  }

  const openAdd = (group = ''): void => {
    setAddGroup(group)
    setAddName('')
    setAddOpen(true)
  }

  const confirmDelete = (id: number, name: string): void => {
    modal.confirm({
      title: 'Delete form',
      content: `Do you really want to delete "${name}"? This cannot be undone.`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteForm(id)
          notifySuccess('Form deleted')
          onDeleted(id)
          await reload()
        } catch (error) {
          notifyError(error)
        }
      }
    })
  }

  const add = async (): Promise<void> => {
    if (addName.trim() === '') {
      return
    }

    if (!(await onBeforeChange())) {
      return
    }

    setAdding(true)
    try {
      const created = await createForm(addName.trim())

      if (addGroup.trim() !== '') {
        const data = await getForm(created.id)
        const state = createFormState(data)
        state.group = addGroup.trim()
        await saveForm(created.id, serializeFormState(state))
      }

      setAddOpen(false)
      await reload()
      onSelect(created.id)
    } catch (error) {
      notifyError(error)
    } finally {
      setAdding(false)
    }
  }

  const rename = async (): Promise<void> => {
    if (renameTarget === null || renameValue.trim() === '') {
      return
    }

    if (renameTarget.id === selectedId && !(await onBeforeChange())) {
      return
    }

    setRenaming(true)
    try {
      const data = await getForm(renameTarget.id)
      const state = createFormState(data)
      state.name = renameValue.trim()
      await saveForm(renameTarget.id, serializeFormState(state))
      setRenameTarget(null)
      await reload()

      if (renameTarget.id === selectedId) {
        // reload editor
        onSelect(null)
        setTimeout(() => { onSelect(renameTarget.id) }, 0)
      }
    } catch (error) {
      notifyError(error)
    } finally {
      setRenaming(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Button type='primary' onClick={() => { openAdd('') }}>Add form</Button>
        <Button onClick={() => { void reload() }}>Refresh</Button>
      </div>
      <Input.Search
        allowClear
        placeholder='Filter forms'
        style={{ marginBottom: 8 }}
        onChange={(event) => { setFilter(event.target.value) }}
      />
      {authError !== null && <Alert type='error' showIcon message={authError} style={{ marginBottom: 8 }} />}
      {loading && <Spin />}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Tree
          blockNode
          showLine
          treeData={treeData}
          expandedKeys={filter !== '' ? undefined : expandedKeys}
          defaultExpandAll={filter !== ''}
          onExpand={(keys) => { setExpandedKeys(keys.map(String)) }}
          selectedKeys={selectedId !== null ? [`${FORM_PREFIX}${selectedId}`] : []}
          onSelect={(keys) => {
            const key = keys[0]

            if (key === undefined || !String(key).startsWith(FORM_PREFIX)) {
              return
            }

            const id = Number(String(key).slice(FORM_PREFIX.length))

            if (id === selectedId) {
              return
            }

            void onBeforeChange().then((allowed) => {
              if (allowed) {
                onSelect(id)
              }
            })
          }}
        />
      </div>

      <Modal
        open={addOpen}
        title='Add form'
        okText='Create'
        confirmLoading={adding}
        okButtonProps={{ disabled: addName.trim() === '' }}
        onOk={() => { void add() }}
        onCancel={() => { setAddOpen(false) }}
        destroyOnClose
      >
        <Form layout='vertical'>
          <Form.Item label='Name' required extra='Allowed characters: letters, numbers, spaces and hyphens.'>
            <Input autoFocus value={addName} onChange={(event) => { setAddName(event.target.value) }} onPressEnter={() => { void add() }} />
          </Form.Item>
          <Form.Item label='Group (optional)'>
            <AutoComplete
              style={{ width: '100%' }}
              value={addGroup}
              options={groups.map((group) => ({ value: group }))}
              onChange={setAddGroup}
              placeholder='Select or enter a group'
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={renameTarget !== null}
        title='Rename form'
        okText='Rename'
        confirmLoading={renaming}
        okButtonProps={{ disabled: renameValue.trim() === '' }}
        onOk={() => { void rename() }}
        onCancel={() => { setRenameTarget(null) }}
        destroyOnClose
      >
        <Input autoFocus value={renameValue} onChange={(event) => { setRenameValue(event.target.value) }} onPressEnter={() => { void rename() }} />
      </Modal>
    </div>
  )
})

FormTree.displayName = 'FormTree'
