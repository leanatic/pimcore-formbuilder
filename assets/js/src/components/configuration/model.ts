import { clone, getIn, isPlainObject, setIn, uid, generateFieldName, unsetIn } from '../../utils/object'

export type NodeKind = 'field' | 'container' | 'constraint'

export interface ModelNode {
  key: string
  kind: NodeKind
  /** Same shape as the stored data (type, name, display_name, options, optional, configuration, sub_type, config ...) */
  data: Record<string, any>
  children: ModelNode[]
}

export interface FormState {
  name: string
  group: string
  config: Record<string, any>
  nodes: ModelNode[]
  conditionalLogic: any[]
}

export const ROOT_KEY = '__root__'

// ---- structure helpers (fields_structure from API)

export interface FieldTypeStructure {
  type: string
  label: string
  icon_class: string
  constraints: string[]
  output_workflow: any
  configuration_layout: Array<{ id: string, label: string, fields: Array<{ id: string, label: string, collapsed?: boolean, fields: any[] }> }>
}

export interface FieldGroupStructure {
  id: string
  label: string
  icon_class?: string
  fields: FieldTypeStructure[]
}

export const findFieldType = (groups: FieldGroupStructure[], type: string): FieldTypeStructure | null => {
  for (const group of groups ?? []) {
    for (const field of group.fields ?? []) {
      if (field.type === type) {
        return field
      }
    }
  }

  return null
}

export const findContainerType = (containers: any[], subType: string): any | null =>
  (containers ?? []).find((container) => container.id === subType) ?? null

export const findConstraint = (constraints: any[], id: string): any | null =>
  (constraints ?? []).find((constraint) => constraint.id === id) ?? null

// ---- conversion API <=> model

export const buildNodes = (fields: any[]): ModelNode[] => {
  return (fields ?? []).map((field) => {
    if (field.type === 'container') {
      const { fields: subFields, ...data } = field

      return {
        key: uid('c'),
        kind: 'container' as NodeKind,
        data,
        children: (subFields ?? []).map((subField: any) => buildFieldNode(subField))
      }
    }

    return buildFieldNode(field)
  })
}

const buildFieldNode = (field: any): ModelNode => {
  const { constraints, ...data } = field

  return {
    key: uid('f'),
    kind: 'field',
    data,
    children: (Array.isArray(constraints) ? constraints : []).map((constraint: any) => ({
      key: uid('v'),
      kind: 'constraint' as NodeKind,
      data: constraint,
      children: []
    }))
  }
}

export const serializeNodes = (nodes: ModelNode[]): any[] =>
  nodes.map((node) => {
    if (node.kind === 'container') {
      return {
        ...node.data,
        fields: node.children.map((child) => serializeNode(child))
      }
    }

    return serializeNode(node)
  })

const serializeNode = (node: ModelNode): any => {
  if (node.kind === 'container') {
    return { ...node.data, fields: node.children.map((child) => serializeNode(child)) }
  }

  const data: Record<string, any> = { ...node.data }
  const constraints = node.children.filter((child) => child.kind === 'constraint').map((child) => child.data)

  if (constraints.length > 0) {
    data.constraints = constraints
  }

  return data
}

// ---- tree helpers

export const findNode = (nodes: ModelNode[], key: string): ModelNode | null => {
  for (const node of nodes) {
    if (node.key === key) {
      return node
    }

    const found = findNode(node.children, key)

    if (found !== null) {
      return found
    }
  }

  return null
}

export const findParent = (nodes: ModelNode[], key: string, parent: ModelNode | null = null): { parent: ModelNode | null, list: ModelNode[] } | null => {
  for (const node of nodes) {
    if (node.key === key) {
      return { parent, list: nodes }
    }

    const found = findParent(node.children, key, node)

    if (found !== null) {
      return found
    }
  }

  return null
}

export const mapNode = (nodes: ModelNode[], key: string, mapper: (node: ModelNode) => ModelNode): ModelNode[] =>
  nodes.map((node) => {
    if (node.key === key) {
      return mapper(node)
    }

    if (node.children.length === 0) {
      return node
    }

    return { ...node, children: mapNode(node.children, key, mapper) }
  })

export const removeNode = (nodes: ModelNode[], key: string): ModelNode[] =>
  nodes
    .filter((node) => node.key !== key)
    .map((node) => ({ ...node, children: removeNode(node.children, key) }))

export const walkNodes = (nodes: ModelNode[], visitor: (node: ModelNode, parent: ModelNode | null) => void, parent: ModelNode | null = null): void => {
  nodes.forEach((node) => {
    visitor(node, parent)
    walkNodes(node.children, visitor, node)
  })
}

export const cloneNodeDeep = (node: ModelNode, renameFields: boolean): ModelNode => {
  const data = clone(node.data)

  if (renameFields && node.kind !== 'constraint') {
    data.name = generateFieldName(node.kind === 'container' ? 'container' : 'field')
  }

  return {
    key: uid(node.kind === 'container' ? 'c' : node.kind === 'field' ? 'f' : 'v'),
    kind: node.kind,
    data,
    children: node.children.map((child) => cloneNodeDeep(child, renameFields))
  }
}

export const insertChild = (nodes: ModelNode[], parentKey: string | null, child: ModelNode, index?: number): ModelNode[] => {
  if (parentKey === null || parentKey === ROOT_KEY) {
    const copy = [...nodes]
    copy.splice(index ?? copy.length, 0, child)
    return copy
  }

  return mapNode(nodes, parentKey, (node) => {
    const children = [...node.children]
    children.splice(index ?? children.length, 0, child)
    return { ...node, children }
  })
}

/**
 * Fields which may be referenced in conditional logic: fields on root level or in a fieldset (like Classic).
 */
export const getReferencableFields = (nodes: ModelNode[], kinds: Array<'field' | 'container'> = ['field']): Array<{ name: string, display_name: string }> => {
  const result: Array<{ name: string, display_name: string }> = []

  const addNode = (node: ModelNode): void => {
    if (kinds.includes(node.kind as any) && typeof node.data.name === 'string' && node.data.name !== '') {
      result.push({ name: node.data.name, display_name: node.data.display_name ?? node.data.name })
    }
  }

  nodes.forEach((node) => {
    addNode(node)

    if (node.kind === 'container' && node.data.sub_type === 'fieldset') {
      node.children.forEach((child) => { addNode(child) })
    }
  })

  return result
}

// ---- default data for new nodes

export const initFieldData = (structure: FieldTypeStructure, defaultTemplate: string | undefined): Record<string, any> => {
  let data: Record<string, any> = {
    type: structure.type,
    name: generateFieldName('field'),
    display_name: structure.label
  }

  if (defaultTemplate !== undefined) {
    data = setIn(data, 'optional.template', defaultTemplate)
  }

  structure.configuration_layout.forEach((tab) => {
    tab.fields.forEach((displayGroup) => {
      displayGroup.fields.forEach((configField: any) => {
        if (configField.type === 'checkbox') {
          data = setIn(data, configField.id, configField.config?.checked === true)
        }

        if (configField.type === 'textfield' && configField.config?.data !== undefined && configField.config?.data !== null) {
          data = setIn(data, configField.id, configField.config.data)
        }
      })
    })
  })

  return data
}

export const initContainerData = (container: any, defaultTemplate: string | undefined): Record<string, any> => {
  const name = generateFieldName('container')
  const data: Record<string, any> = {
    type: 'container',
    sub_type: container.id,
    name,
    display_name: containerDisplayName(container.id, name),
    configuration: {}
  }

  if (defaultTemplate !== undefined) {
    data.configuration.template = defaultTemplate
  }

  return data
}

export const containerDisplayName = (subType: string, name: string): string =>
  `${subType.charAt(0).toUpperCase()}${subType.slice(1)} (${name})`

export const initConstraintData = (constraint: any): Record<string, any> => ({ type: constraint.id })

// ---- initial form state

export const createFormState = (formData: any): FormState => {
  const config: Record<string, any> = Array.isArray(formData.config) ? {} : clone(formData.config ?? {})

  if (config.action === undefined || config.action === null || config.action === '') {
    config.action = '/'
  }
  if (config.method === undefined || config.method === null || config.method === '') {
    config.method = 'post'
  }
  if (config.enctype === undefined || config.enctype === null || config.enctype === '') {
    config.enctype = 'multipart/form-data'
  }
  if (config.noValidate === undefined) {
    config.noValidate = false
  }
  if (config.useAjax === undefined) {
    config.useAjax = true
  }

  config.name = formData.name
  config.group = formData.group ?? ''

  if (!Array.isArray(config.attributes)) {
    config.attributes = isPlainObject(config.attributes) ? Object.values(config.attributes) : []
  }

  let conditionalLogic = formData.conditional_logic
  if (isPlainObject(conditionalLogic) && Array.isArray((conditionalLogic as any).cl)) {
    conditionalLogic = (conditionalLogic as any).cl
  }

  return {
    name: formData.name,
    group: formData.group ?? '',
    config,
    nodes: buildNodes(clone(formData.fields ?? [])),
    conditionalLogic: Array.isArray(conditionalLogic) ? clone(conditionalLogic) : []
  }
}

export const serializeFormState = (state: FormState): { config: any, fields: { fields: any[] }, conditionalLogic: any[] } => {
  const config = clone(state.config)

  config.name = state.name
  config.group = state.group

  if (config.doubleOptIn !== undefined && config.doubleOptIn?.enabled === false) {
    config.doubleOptIn = { enabled: false }
  }

  return {
    config,
    fields: { fields: serializeNodes(state.nodes) },
    conditionalLogic: state.conditionalLogic
  }
}

// ---- validation

export interface ValidationResult {
  /** keys of invalid nodes (+ ROOT_KEY) */
  invalid: Record<string, string>
}

const FIELD_NAME_REGEX = /^[A-Za-z0-9?_]+$/
/** Matches Classic FormBuilder getSaveName() allowed characters (letters, numbers, spaces, hyphens). */
const FORM_NAME_REGEX = /^[A-Za-z0-9äöüÄÖÜß \-]+$/

export const validateFieldName = (name: string, forbidden: string[], isContainer: boolean): string | null => {
  if (name === undefined || name === null || name === '') {
    return 'Name must not be empty.'
  }

  if (!FIELD_NAME_REGEX.test(name)) {
    return 'Only letters, numbers and underscores are allowed in field names.'
  }

  if (forbidden.includes(name.toLowerCase())) {
    return `"${name}" is a reserved name and cannot be used.`
  }

  if (isContainer && name.toLowerCase() === 'group') {
    return '"group" is a reserved name and cannot be used.'
  }

  return null
}

export const validateFormName = (name: string): string | null => {
  if (name === undefined || name === null || name.trim() === '') {
    return 'Name must not be empty.'
  }

  if (!FORM_NAME_REGEX.test(name)) {
    return 'Only letters, numbers, spaces and hyphens are allowed in form names.'
  }

  return null
}

export const validateState = (state: FormState, forbidden: string[], structure: { groups: FieldGroupStructure[], doubleOptInEnabled: boolean }): ValidationResult => {
  const invalid: Record<string, string> = {}

  const rootNameError = validateFormName(state.name)

  if (rootNameError !== null) {
    invalid[ROOT_KEY] = `Form name: ${rootNameError}`
  } else if (state.config.action === undefined || state.config.action === '') {
    invalid[ROOT_KEY] = 'Form action must not be empty.'
  } else if (structure.doubleOptInEnabled && state.config.doubleOptIn?.enabled === true && !state.config.doubleOptIn?.confirmationMessage) {
    invalid[ROOT_KEY] = 'Double opt-in: a confirmation message is required.'
  }

  const usedNames: Record<string, number> = {}

  walkNodes(state.nodes, (node) => {
    if (node.kind === 'constraint') {
      return
    }

    const name = node.data.name as string
    usedNames[name] = (usedNames[name] ?? 0) + 1
  })

  walkNodes(state.nodes, (node) => {
    if (node.kind === 'constraint') {
      return
    }

    const name = node.data.name as string
    const nameError = validateFieldName(name, forbidden, node.kind === 'container')

    if (nameError !== null) {
      invalid[node.key] = nameError
      return
    }

    if (usedNames[name] > 1) {
      invalid[node.key] = `Field name "${name}" is already in use.`
      return
    }

    if (node.kind === 'field') {
      if (node.data.display_name === undefined || node.data.display_name === '') {
        invalid[node.key] = 'Display name must not be empty.'
        return
      }

      const typeStructure = findFieldType(structure.groups, node.data.type)

      if (typeStructure !== null) {
        for (const tab of typeStructure.configuration_layout) {
          for (const displayGroup of tab.fields) {
            for (const configField of displayGroup.fields) {
              if (configField.type === 'select') {
                const value = getIn(node.data, configField.id)

                if (value === undefined || value === null || value === '') {
                  invalid[node.key] = `"${configField.label}" is required.`
                  return
                }
              }
            }
          }
        }
      }
    }
  })

  return { invalid }
}

export const removeEmptyValue = (data: Record<string, any>, path: string): Record<string, any> => unsetIn(data, path)
