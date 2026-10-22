export interface ChannelModel {
  /** client side key (not persisted) */
  key: string
  id?: number | null
  type: string
  /** uuid, generated client side */
  name: string
  configuration: any
  funnelActions: any[] | null
}

export interface ChannelEditorProps {
  formId: number
  workflowId: number
  channel: ChannelModel
  /** all channels of the workflow (e.g. for funnel channel actions) */
  channels: ChannelModel[]
  onChange: (configuration: any) => void
}
