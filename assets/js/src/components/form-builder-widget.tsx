import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Empty } from 'antd'
import { getSettings } from '../api/endpoints'
import { UiProvider, useUi } from './common/ui-context'
import { FormEditor } from './form-editor'
import { FormTree, type FormTreeHandle } from './form-tree'

const STYLES = `
.fb-root { height: 100%; display: flex; gap: 16px; padding: 12px; box-sizing: border-box; background: #fff; }
.fb-root .fb-sidebar { width: 280px; flex-shrink: 0; border-right: 1px solid #f0f0f0; padding-right: 12px; min-height: 0; }
.fb-root .fb-main { flex: 1; min-width: 0; min-height: 0; }
.fb-root .fb-main > .ant-tabs { height: 100%; }
.fb-root .fb-main > .ant-tabs > .ant-tabs-content-holder { min-height: 0; flex: 1; }
.fb-root .fb-main > .ant-tabs > .ant-tabs-content-holder > .ant-tabs-content { height: 100%; }
.fb-root .fb-main > .ant-tabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane { height: 100%; overflow: hidden; }
`

const Inner = (): React.JSX.Element => {
  const { modal } = useUi()
  const treeRef = useRef<FormTreeHandle>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [forbiddenNames, setForbiddenNames] = useState<string[]>([])
  const dirtyRef = useRef(false)

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setForbiddenNames((settings?.forbidden_form_field_names ?? []).map((name: string) => String(name).toLowerCase()))
      })
      .catch(() => { setForbiddenNames([]) })
  }, [])

  const confirmLeave = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) {
      return true
    }

    return await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: 'Unsaved changes',
        content: 'There are unsaved changes. Do you want to discard them?',
        okText: 'Discard',
        onOk: () => {
          dirtyRef.current = false
          resolve(true)
        },
        onCancel: () => { resolve(false) }
      })
    })
  }, [modal])

  return (
    <div className='fb-root'>
      <style>{STYLES}</style>
      <div className='fb-sidebar'>
        <FormTree
          ref={treeRef}
          selectedId={selectedId}
          onBeforeChange={confirmLeave}
          onSelect={(id) => {
            dirtyRef.current = false
            setSelectedId(id)
          }}
          onDeleted={(id) => {
            if (id === selectedId) {
              dirtyRef.current = false
              setSelectedId(null)
            }
          }}
        />
      </div>
      <div className='fb-main'>
        {selectedId === null
          ? <Empty style={{ marginTop: 80 }} description='Select a form or create a new one' />
          : (
            <FormEditor
              key={selectedId}
              formId={selectedId}
              forbiddenNames={forbiddenNames}
              onDirtyChange={(dirty) => { dirtyRef.current = dirty }}
              onFormChanged={() => { void treeRef.current?.reload() }}
            />
            )}
      </div>
    </div>
  )
}

export const FormBuilderWidget = (): React.JSX.Element => (
  <UiProvider>
    <Inner />
  </UiProvider>
)

export default FormBuilderWidget
