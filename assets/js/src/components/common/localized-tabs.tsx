import React from 'react'
import { Tabs } from 'antd'
import { useLocales } from './use-locales'

interface LocalizedTabsProps {
  /** Locales already used in the data (will be added even when not configured anymore). */
  usedLocales?: string[]
  includeDefault?: boolean
  render: (locale: string) => React.ReactNode
}

export const LocalizedTabs = ({ usedLocales = [], includeDefault = false, render }: LocalizedTabsProps): React.JSX.Element => {
  const locales = useLocales(usedLocales, includeDefault)

  return (
    <Tabs
      size='small'
      type='card'
      items={locales.map((locale) => ({
        key: locale,
        label: locale === 'default' ? 'Default' : locale,
        forceRender: true,
        children: <div style={{ paddingTop: 8 }}>{render(locale)}</div>
      }))}
    />
  )
}
