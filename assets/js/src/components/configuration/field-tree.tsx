import React, { useMemo, useState } from 'react'
import { Button, Dropdown, Tree, Typography } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { MenuProps } from 'antd'
import { FbIcon } from '../../utils/icons'
import { useUi } from '../common/ui-context'
import { uid } from '../../utils/object'
import {
  ROOT_KEY,
  cloneNodeDeep,
  findConstraint,
  findContainerType,
  findFieldType,
  findNode,
  findParent,
  initConstraintData,
  initContainerData,
  initFieldData,
  insertChild,
  removeNode,
  walkNodes,
  type FieldTypeStructure,
  type ModelNode
} from './model'
import type { ConfigurationContext } from './node-editors'

interface Props {
  formName: string
  nodes: ModelNode[]
  ctx: ConfigurationContext
  selectedKey: string
  invalid: Record<string, string>
  onSelect: (key: string) => void
  onNodesChange: (nodes: ModelNode[]) => void
}

const ALLOWED_CHILDREN: Record<string, string[]> = {
  root: ['field', 'container'],
  field: ['constraint'],
  container: ['field'],
  constraint: []
}

export const FieldTree = ({ formName, nodes, ctx, selectedKey, invalid, onSelect, onNodesChange }: Props): React.JSX.Element => {
  const { modal, message } = useUi()
  const [clipboard, setClipboard] = useState<ModelNode | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<string[]>(() => {
    const keys: string[] = [ROOT_KEY]
    walkNodes(nodes, (node) => { if (node.kind === 'container') keys.push(node.key) })
    return keys
  })

  const defaultTemplate = useMemo(() => {
    const template = ctx.templates.find((entry) => entry.default === true) ?? ctx.templates[0]
    return template?.value
  }, [ctx.templates])

  const kindOf = (key: string): 'root' | 'field' | 'container' | 'constraint' =>
    key === ROOT_KEY ? 'root' : (findNode(nodes, key)?.kind ?? 'root')

  const addNode = (parentKey: string, node: ModelNode): void => {
    onNodesChange(insertChild(nodes, parentKey, node))
    setExpandedKeys((keys) => Array.from(new Set([...keys, parentKey])))
    onSelect(node.key)
  }

  const createFieldNode = (structure: FieldTypeStructure): ModelNode => ({
    key: uid('f'),
    kind: 'field',
    data: initFieldData(structure, defaultTemplate),
    children: []
  })

  const buildAddFieldMenu = (): MenuProps['items'] =>
    ctx.groups
      .filter((group) => group.fields.length > 0)
      .map((group) => ({
        key: `group:${group.id}`,
        label: group.label,
        children: group.fields.map((field) => ({
          key: `add-field:${field.type}`,
          label: field.label,
          icon: <FbIcon name={field.icon_class} />
        }))
      }))

  const buildAddContainerMenu = (): MenuProps['items'] =>
    ctx.containerTypes.map((container) => ({
      key: `add-container:${container.id}`,
      label: container.label,
      icon: <FbIcon name={container.icon_class} />
    }))

  const buildAddConstraintMenu = (fieldNode: ModelNode): MenuProps['items'] => {
    const structure = findFieldType(ctx.groups, fieldNode.data.type)
    const allowed: string[] = structure?.constraints ?? []
    const used = fieldNode.children.map((child) => child.data.type)

    return ctx.validationConstraints
      .filter((constraint) => allowed.includes(constraint.id) && !used.includes(constraint.id))
      .map((constraint) => ({
        key: `add-constraint:${constraint.id}`,
        label: constraint.label,
        icon: <FbIcon name={constraint.icon_class} />
      }))
  }

  const buildMenu = (key: string): MenuProps['items'] => {
    const kind = kindOf(key)
    const items: NonNullable<MenuProps['items']> = []

    if (kind === 'root') {
      items.push({ key: 'add-field', label: 'Add field', children: buildAddFieldMenu() })
      items.push({ key: 'add-container', label: 'Add container', children: buildAddContainerMenu() })
    }

    if (kind === 'container') {
      items.push({ key: 'add-field', label: 'Add field', children: buildAddFieldMenu() })
    }

    if (kind === 'field') {
      const constraintMenu = buildAddConstraintMenu(findNode(nodes, key)!)
      items.push({ key: 'add-constraint', label: 'Add constraint', disabled: (constraintMenu ?? []).length === 0, children: constraintMenu })
    }

    if (kind === 'field' || kind === 'container') {
      items.push({ type: 'divider' })
      items.push({ key: 'copy', label: 'Copy' })
    }

    if (kind === 'root' || kind === 'container') {
      const pasteAllowed = clipboard !== null && ALLOWED_CHILDREN[kind].includes(clipboard.kind)
      items.push({ key: 'paste', label: 'Paste', disabled: !pasteAllowed })
    }

    if (kind !== 'root') {
      items.push({ type: 'divider' })
      items.push({ key: 'delete', label: 'Delete', danger: true })
    }

    return items
  }

  const handleMenuClick = (targetKey: string, actionKey: string): void => {
    const [action, argument] = actionKey.split(':')
    const target = targetKey === ROOT_KEY ? null : findNode(nodes, targetKey)

    switch (action) {
      case 'add-field': {
        const structure = ctx.groups.flatMap((group) => group.fields).find((field) => field.type === argument)
        if (structure !== undefined) {
          addNode(targetKey, createFieldNode(structure))
        }
        break
      }

      case 'add-container': {
        const container = findContainerType(ctx.containerTypes, argument)
        if (container !== null) {
          addNode(targetKey, {
            key: uid('c'),
            kind: 'container',
            data: initContainerData(container, defaultTemplate),
            children: []
          })
        }
        break
      }

      case 'add-constraint': {
        const constraint = findConstraint(ctx.validationConstraints, argument)
        if (constraint !== null) {
          addNode(targetKey, { key: uid('v'), kind: 'constraint', data: initConstraintData(constraint), children: [] })
        }
        break
      }

      case 'copy':
        if (target !== null) {
          setClipboard(cloneNodeDeep(target, false))
          void message.success('Copied')
        }
        break

      case 'paste':
        if (clipboard !== null) {
          addNode(targetKey, cloneNodeDeep(clipboard, true))
        }
        break

      case 'delete':
        if (target !== null) {
          deleteNode(target)
        }
        break
    }
  }

  const deleteNode = (target: ModelNode): void => {
    const lockedUsed: string[] = []

    walkNodes([target], (node) => {
      if (node.kind !== 'constraint' && ctx.lockedFieldNames.includes(node.data.name)) {
        lockedUsed.push(node.data.name)
      }
    })

    if (lockedUsed.length > 0) {
      void message.error(`"${lockedUsed.join(', ')}" is used in an output workflow and cannot be deleted. Remove it from the workflow first.`)
      return
    }

    modal.confirm({
      title: 'Delete',
      content: `Do you really want to delete "${String(target.data.display_name ?? target.data.type)}"?`,
      okButtonProps: { danger: true },
      onOk: () => {
        onNodesChange(removeNode(nodes, target.key))
        if (selectedKey === target.key) {
          onSelect(ROOT_KEY)
        }
      }
    })
  }

  const renderTitle = (key: string, icon: React.ReactNode, text: string, secondary?: string): React.ReactNode => {
    const error = invalid[key]

    return (
      <Dropdown
        trigger={['contextMenu']}
        menu={{ items: buildMenu(key), onClick: ({ key: actionKey }) => { handleMenuClick(key, actionKey) } }}
      >
        <span style={{ color: error !== undefined ? '#ff4d4f' : undefined }} title={error}>
          {icon}
          <span style={{ marginLeft: 6 }}>{text}</span>
          {secondary !== undefined && <Typography.Text type='secondary' style={{ marginLeft: 6, fontSize: 12 }}>{secondary}</Typography.Text>}
        </span>
      </Dropdown>
    )
  }

  const toTreeData = (list: ModelNode[]): DataNode[] =>
    list.map((node) => {
      let icon: React.ReactNode = null
      let text = ''
      let secondary: string | undefined

      if (node.kind === 'field') {
        const structure = findFieldType(ctx.groups, node.data.type)
        icon = <FbIcon name={structure?.icon_class} />
        text = node.data.display_name ?? node.data.name
        secondary = node.data.name
      } else if (node.kind === 'container') {
        const container = findContainerType(ctx.containerTypes, node.data.sub_type)
        icon = <FbIcon name={container?.icon_class} />
        text = node.data.display_name ?? node.data.name
      } else {
        const constraint = findConstraint(ctx.validationConstraints, node.data.type)
        icon = <FbIcon name={constraint?.icon_class} />
        text = constraint?.label ?? node.data.type
      }

      return {
        key: node.key,
        title: renderTitle(node.key, icon, text, secondary),
        children: toTreeData(node.children),
        isLeaf: node.kind === 'constraint'
      }
    })

  const treeData: DataNode[] = [{
    key: ROOT_KEY,
    title: renderTitle(ROOT_KEY, <FbIcon name='form_builder_icon_container' />, formName),
    children: toTreeData(nodes)
  }]

  const onDrop = (info: any): void => {
    const dragKey = String(info.dragNode.key)
    const targetKey = String(info.node.key)

    if (dragKey === ROOT_KEY) {
      return
    }

    const dragged = findNode(nodes, dragKey)
    if (dragged === null) {
      return
    }

    let parentKey: string
    let siblingKey: string | null = null
    let after = false

    if (!info.dropToGap) {
      parentKey = targetKey
    } else {
      if (targetKey === ROOT_KEY) {
        return
      }

      const parentInfo = findParent(nodes, targetKey)
      parentKey = parentInfo?.parent?.key ?? ROOT_KEY
      siblingKey = targetKey
      after = info.dropPosition - Number(String(info.node.pos).split('-').pop()) > 0
    }

    const parentKind = kindOf(parentKey)

    if (!ALLOWED_CHILDREN[parentKind].includes(dragged.kind)) {
      void message.warning('This element cannot be placed here.')
      return
    }

    if (parentKey !== ROOT_KEY && findNode([dragged], parentKey) !== null) {
      return
    }

    // constraints must be unique per field
    if (dragged.kind === 'constraint') {
      const parent = findNode(nodes, parentKey)
      const alreadyThere = parent?.children.some((child) => child.key !== dragged.key && child.data.type === dragged.data.type)
      if (alreadyThere === true) {
        void message.warning('This constraint already exists on the target field.')
        return
      }
    }

    const without = removeNode(nodes, dragKey)
    const siblings = parentKey === ROOT_KEY ? without : (findNode(without, parentKey)?.children ?? [])
    let index = siblings.length

    if (siblingKey !== null) {
      const siblingIndex = siblings.findIndex((entry) => entry.key === siblingKey)
      index = siblingIndex === -1 ? siblings.length : siblingIndex + (after ? 1 : 0)
    }

    onNodesChange(insertChild(without, parentKey, dragged, index))
    setExpandedKeys((keys) => Array.from(new Set([...keys, parentKey])))
  }

  const selectedKind = kindOf(selectedKey)
  const toolbarKey = selectedKind === 'constraint' ? ROOT_KEY : selectedKey

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {(toolbarKey === ROOT_KEY || selectedKind === 'container') && (
          <Dropdown
            trigger={['click']}
            menu={{ items: buildAddFieldMenu(), onClick: ({ key }) => { handleMenuClick(toolbarKey, key) } }}
          >
            <Button size='small'>Add field</Button>
          </Dropdown>
        )}
        {toolbarKey === ROOT_KEY && (
          <Dropdown
            trigger={['click']}
            menu={{ items: buildAddContainerMenu(), onClick: ({ key }) => { handleMenuClick(toolbarKey, key) } }}
          >
            <Button size='small'>Add container</Button>
          </Dropdown>
        )}
        {selectedKind === 'field' && (
          <Dropdown
            trigger={['click']}
            menu={{ items: buildAddConstraintMenu(findNode(nodes, selectedKey)!), onClick: ({ key }) => { handleMenuClick(selectedKey, key) } }}
          >
            <Button size='small'>Add constraint</Button>
          </Dropdown>
        )}
      </div>
      <Tree
        showLine
        blockNode
        draggable={{ icon: false, nodeDraggable: (node) => node.key !== ROOT_KEY }}
        selectedKeys={[selectedKey]}
        expandedKeys={expandedKeys}
        onExpand={(keys) => { setExpandedKeys(keys.map(String)) }}
        treeData={treeData}
        onSelect={(keys) => { if (keys.length > 0) onSelect(String(keys[0])) }}
        onDrop={onDrop}
      />
    </div>
  )
}
