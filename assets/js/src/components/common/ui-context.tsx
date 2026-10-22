import React, { createContext, useContext, useMemo } from 'react'
import { message, Modal } from 'antd'
import { ApiError } from '../../api/client'

interface UiContextValue {
  message: ReturnType<typeof message.useMessage>[0]
  modal: ReturnType<typeof Modal.useModal>[0]
  /** Shows an error notification (handles 401/403 gracefully). */
  notifyError: (error: unknown, fallback?: string) => void
  notifySuccess: (text: string) => void
}

const UiContext = createContext<UiContextValue | null>(null)

export const UiProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  const [messageApi, messageHolder] = message.useMessage()
  const [modalApi, modalHolder] = Modal.useModal()

  const value = useMemo<UiContextValue>(() => ({
    message: messageApi,
    modal: modalApi,
    notifyError: (error: unknown, fallback = 'An error occurred') => {
      if (error instanceof ApiError) {
        void messageApi.error({ content: error.message, duration: error.isAuthError ? 8 : 5 })
        return
      }

      void messageApi.error((error as Error)?.message ?? fallback)
    },
    notifySuccess: (text: string) => {
      void messageApi.success(text)
    }
  }), [messageApi, modalApi])

  return (
    <UiContext.Provider value={value}>
      {messageHolder}
      {modalHolder}
      {children}
    </UiContext.Provider>
  )
}

export const useUi = (): UiContextValue => {
  const ctx = useContext(UiContext)

  if (ctx === null) {
    throw new Error('useUi must be used within UiProvider')
  }

  return ctx
}
