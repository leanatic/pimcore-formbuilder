import { del, download, get, post, put, request } from './client'

export interface TreeItem {
  id: number | string
  name: string
  type: 'form' | 'group'
  children?: TreeItem[]
}

export const getFormsTree = async (): Promise<TreeItem[]> => await get<TreeItem[]>('/forms/tree')

export const getSettings = async (): Promise<any> => {
  const response = await get<{ settings: any }>('/settings')
  return response.settings
}

export const getForm = async (id: number): Promise<any> => {
  const response = await get<{ data: any }>(`/forms/${id}`)
  return response.data
}

export const createForm = async (name: string): Promise<{ id: number, name: string }> => await post('/forms', { name })

export interface SaveFormPayload {
  config: Record<string, any>
  fields: { fields: any[] }
  conditionalLogic: any
}

export const saveForm = async (id: number, payload: SaveFormPayload): Promise<{ id: number, name: string }> =>
  await put(`/forms/${id}`, payload)

export const deleteForm = async (id: number): Promise<void> => {
  await del(`/forms/${id}`)
}

export const getFormDependencies = async (id: number, offset: number, limit: number): Promise<{ documents: any[], total: number, limit: number }> =>
  await get(`/forms/${id}/dependencies`, { offset, limit })

export const getDoubleOptInSessions = async (id: number, offset: number, limit: number): Promise<{ sessions: any[], total: number }> =>
  await get(`/forms/${id}/double-opt-in/sessions`, { offset, limit })

export const deleteDoubleOptInSession = async (token: string): Promise<void> => {
  await del(`/double-opt-in/sessions/${encodeURIComponent(token)}`)
}

export const getDataInjectionStore = async (): Promise<Array<{ value: string, label: string, description: string | null }>> => {
  const response = await get<{ store: any[] }>('/data-injection-store')
  return response.store
}

export const getDynamicChoiceBuilder = async (): Promise<Array<{ label: string, value: string }>> =>
  await get('/dynamic-choice-builder')

export const getGroupTemplates = async (): Promise<Array<{ key: string | null, label: string }>> =>
  await get('/group-templates')

export const getPresetDescription = async (name: string): Promise<any> => await get(`/presets/${encodeURIComponent(name)}/description`)

export const exportForm = async (id: number, name: string): Promise<void> => {
  await download(`/forms/${id}/export`, undefined, `form_${name}.json`)
}

export const exportMailCsv = async (id: number, mailType: string): Promise<void> => {
  await download(`/forms/${id}/mail-csv-export`, { mailType }, `form_${id}_emails.csv`)
}

export const importForm = async (id: number, file: File, outputWorkflows: boolean, conditionalLogic: boolean): Promise<void> => {
  const formData = new FormData()
  formData.append('formData', file)
  formData.append('outputWorkflows', outputWorkflows ? 'true' : 'false')
  formData.append('conditionalLogic', conditionalLogic ? 'true' : 'false')
  await request('POST', `/forms/${id}/import`, { formData })
}

export const getMailEditorData = async (formId: number, query?: Record<string, any>): Promise<any> =>
  await get(`/forms/${formId}/mail-editor`, query)

// ---------- output workflows

export interface OutputWorkflowTreeItem {
  id: number
  name: string
  type: 'output_workflow'
  funnelAware: boolean
}

export const getOutputWorkflowTree = async (formId: number): Promise<OutputWorkflowTreeItem[]> =>
  await get(`/forms/${formId}/output-workflows/tree`)

export const getOutputWorkflowList = async (formId: number): Promise<Array<{ id: number, name: string }>> => {
  const response = await get<{ outputWorkflows: any[] }>(`/forms/${formId}/output-workflows`)
  return response.outputWorkflows
}

export const getOutputWorkflow = async (id: number): Promise<any> => {
  const response = await get<{ data: any }>(`/output-workflows/${id}`)
  return response.data
}

export const addOutputWorkflow = async (formId: number, name: string, funnelAware: boolean): Promise<{ id: number }> =>
  await post(`/forms/${formId}/output-workflows`, { name, funnelAware })

export const saveOutputWorkflow = async (id: number, data: any): Promise<{ id: number }> =>
  await put(`/output-workflows/${id}`, data)

export const deleteOutputWorkflow = async (id: number): Promise<void> => {
  await del(`/output-workflows/${id}`)
}

export const getObjectClasses = async (): Promise<Array<{ key: string, label: string }>> => {
  const response = await get<{ types: any[] }>('/output-workflows/object/classes')
  return response.types
}

export const getObjectClassFields = async (type: 'dataClass' | 'fieldCollection', id: string): Promise<Array<{ key: string, label: string }>> => {
  const response = await get<{ fields: any[] }>('/output-workflows/object/class-fields', { type, id })
  return response.fields
}

export const getDynamicObjectResolvers = async (mode?: string): Promise<Array<{ key: string, label: string, allowedObjectResolverModes: string[] }>> => {
  const response = await get<{ resolver: any[] }>('/output-workflows/object/dynamic-object-resolvers', { allowedObjectResolverMode: mode })
  return response.resolver
}

export const getObjectFormData = async (formId: number, baseConfiguration: any): Promise<any> =>
  await post('/output-workflows/object/form-data', { id: formId, baseConfiguration })

export const getApiProviders = async (formId: number): Promise<Array<{ key: string, label: string, configurationFields: any[] }>> => {
  const response = await get<{ types: any[] }>('/output-workflows/api/providers', { id: formId })
  return response.types
}

export const getApiFormData = async (formId: number, baseConfiguration: any): Promise<any> =>
  await post('/output-workflows/api/form-data', { id: formId, baseConfiguration })

export const getFunnelLayers = async (): Promise<Array<{ key: string, label: string, configuration: any }>> => {
  const response = await get<{ funnelLayers: any[] }>('/output-workflows/funnel/layers')
  return response.funnelLayers
}

export const getFunnelActions = async (): Promise<Array<{ key: string, label: string }>> => {
  const response = await get<{ funnelActions: any[] }>('/output-workflows/funnel/actions')
  return response.funnelActions
}

/**
 * Generic GET for (legacy) store urls provided by field configuration.
 * Known admin urls are mapped to their studio api counterpart.
 */
export const getStoreUrl = async (storeUrl: string): Promise<any[]> => {
  if (/get-dynamic-choice-builder$/.test(storeUrl)) {
    return await getDynamicChoiceBuilder()
  }

  const response = await fetch(storeUrl, { credentials: 'include' })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return await response.json()
}
