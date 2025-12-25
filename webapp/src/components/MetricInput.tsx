'use client'

import type { Metric } from '@/lib/supabase/types'

interface MetricInputProps {
  metric: Metric
  value: MetricValue
  onChange: (value: MetricValue) => void
}

export type MetricValue = {
  bool_value?: boolean
  int_value?: number
  float_value?: number
  text_value?: string
  select_key?: string
  tag_keys?: string[]
}

/**
 * Type-specific metric input component
 * Renders different UI based on metric.type
 */
export function MetricInput({ metric, value, onChange }: MetricInputProps) {
  const config = metric.config as Record<string, unknown>

  switch (metric.type) {
    case 'boolean':
      return <BooleanInput metric={metric} value={value} onChange={onChange} />

    case 'rating':
      return <RatingInput metric={metric} value={value} onChange={onChange} config={config} />

    case 'number':
      return <NumberInput metric={metric} value={value} onChange={onChange} config={config} />

    case 'select':
      return <SelectInput metric={metric} value={value} onChange={onChange} config={config} />

    case 'tags':
      return <TagsInput metric={metric} value={value} onChange={onChange} config={config} />

    case 'notes':
      return <NotesInput metric={metric} value={value} onChange={onChange} />

    default:
      return <div className="text-red-500">Unknown metric type: {metric.type}</div>
  }
}

function BooleanInput({ value, onChange }: MetricInputProps) {
  const checked = value.bool_value ?? false

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange({ bool_value: !checked })}
        className={`
          relative inline-flex items-center h-8 w-14 rounded-full transition-colors flex-shrink-0
          ${checked ? 'bg-blue-600' : 'bg-gray-600'}
        `}
      >
        <span
          className={`
            inline-block h-6 w-6 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-7' : 'translate-x-1'}
          `}
        />
      </button>
      <span className="text-gray-300">{checked ? 'Yes' : 'No'}</span>
    </div>
  )
}

function RatingInput({ value, onChange, config }: MetricInputProps & { config: Record<string, unknown> }) {
  const scaleMin = (config.scaleMin as number) || 1
  const scaleMax = (config.scaleMax as number) || 10
  const labels = config.labels as string[] | undefined
  const selected = value.int_value

  const ratings = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i)

  // If labels exist, use vertical layout with labels; otherwise use compact numeric grid
  if (labels && labels.length === ratings.length) {
    return (
      <div className="flex flex-col gap-2">
        {ratings.map((rating, index) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange({ int_value: rating })}
            className={`
              px-4 py-3 rounded-lg text-left transition-all
              ${
                selected === rating
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }
            `}
          >
            {labels[index]}
          </button>
        ))}
      </div>
    )
  }

  // Default numeric display
  return (
    <div className="flex flex-wrap gap-2">
      {ratings.map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange({ int_value: rating })}
          className={`
            w-12 h-12 rounded-lg font-semibold transition-all
            ${
              selected === rating
                ? 'bg-blue-600 text-white scale-110'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }
          `}
        >
          {rating}
        </button>
      ))}
    </div>
  )
}

function NumberInput({ value, onChange, config }: MetricInputProps & { config: Record<string, unknown> }) {
  const unit = (config.unit as string) || ''
  const min = (config.min as number) || undefined
  const max = (config.max as number) || undefined
  const current = value.float_value ?? ''

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={current}
        onChange={(e) => {
          const val = e.target.value === '' ? undefined : parseFloat(e.target.value)
          onChange({ float_value: val })
        }}
        min={min}
        max={max}
        step="0.1"
        className="w-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="0"
      />
      {unit && <span className="text-gray-400">{unit}</span>}
    </div>
  )
}

function SelectInput({ value, onChange, config }: MetricInputProps & { config: Record<string, unknown> }) {
  const options = (config.options as Array<{ key: string; label: string; order: number }>) || []
  const sortedOptions = [...options].sort((a, b) => a.order - b.order)
  const selected = value.select_key

  return (
    <div className="flex flex-col gap-2">
      {sortedOptions.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange({ select_key: option.key })}
          className={`
            px-4 py-3 rounded-lg text-left transition-all
            ${
              selected === option.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function TagsInput({ value, onChange, config }: MetricInputProps & { config: Record<string, unknown> }) {
  const options = (config.options as Array<{ key: string; label: string }>) || []
  const selected = value.tag_keys || []

  const toggleTag = (key: string) => {
    const newTags = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key]
    onChange({ tag_keys: newTags.length > 0 ? newTags : undefined })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => toggleTag(option.key)}
          className={`
            px-4 py-2 rounded-lg transition-all
            ${
              selected.includes(option.key)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function NotesInput({ value, onChange }: MetricInputProps) {
  const text = value.text_value ?? ''

  return (
    <textarea
      value={text}
      onChange={(e) => onChange({ text_value: e.target.value || undefined })}
      maxLength={2000}
      rows={4}
      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      placeholder="Write your thoughts..."
    />
  )
}
