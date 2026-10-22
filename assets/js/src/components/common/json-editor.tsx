import React, { useEffect, useRef, useState } from 'react'
import { Input, Typography } from 'antd'
import { safeJsonParse } from '../../utils/object'

interface JsonEditorProps {
  value: any
  onChange: (value: any) => void
  rows?: number
  placeholder?: string
}

/**
 * Plain JSON editor. Only valid JSON is propagated to the parent.
 */
export const JsonEditor = ({ value, onChange, rows = 10, placeholder }: JsonEditorProps): React.JSX.Element => {
  const [text, setText] = useState<string>(() => JSON.stringify(value ?? null, null, 2))
  const [error, setError] = useState<string | null>(null)
  const lastEmitted = useRef<string>(JSON.stringify(value ?? null))

  useEffect(() => {
    const incoming = JSON.stringify(value ?? null)

    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming
      setText(JSON.stringify(value ?? null, null, 2))
      setError(null)
    }
  }, [value])

  return (
    <div>
      <Input.TextArea
        value={text}
        rows={rows}
        placeholder={placeholder}
        spellCheck={false}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
        status={error !== null ? 'error' : undefined}
        onChange={(event) => {
          const next = event.target.value
          setText(next)

          if (next.trim() === '') {
            setError(null)
            lastEmitted.current = JSON.stringify(null)
            onChange(null)
            return
          }

          const parsed = safeJsonParse(next)

          if (parsed.ok) {
            setError(null)
            lastEmitted.current = JSON.stringify(parsed.value ?? null)
            onChange(parsed.value)
          } else {
            setError(parsed.error)
          }
        }}
      />
      {error !== null && <Typography.Text type='danger'>{error}</Typography.Text>}
    </div>
  )
}
