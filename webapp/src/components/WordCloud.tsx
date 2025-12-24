'use client'

import type { TagFrequency } from '@/services/dashboard.service'

interface WordCloudProps {
  tagFrequencies: TagFrequency[]
  maxItems?: number
}

export function WordCloud({ tagFrequencies, maxItems = 10 }: WordCloudProps) {
  if (tagFrequencies.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        No data yet
      </div>
    )
  }

  // Take top N items
  const displayTags = tagFrequencies.slice(0, maxItems)

  // Calculate font size based on frequency
  const maxCount = Math.max(...displayTags.map((t) => t.count))
  const minCount = Math.min(...displayTags.map((t) => t.count))
  const countRange = maxCount - minCount || 1

  const getFontSize = (count: number): number => {
    // Map count to font size between 0.75rem and 2rem
    const minSize = 0.75
    const maxSize = 2
    const normalized = (count - minCount) / countRange
    return minSize + normalized * (maxSize - minSize)
  }

  const getOpacity = (count: number): number => {
    // Map count to opacity between 0.6 and 1
    const normalized = (count - minCount) / countRange
    return 0.6 + normalized * 0.4
  }

  return (
    <div className="flex flex-wrap gap-3 items-center justify-center py-4 px-2 min-h-32">
      {displayTags.map((tag) => {
        const fontSize = getFontSize(tag.count)
        const opacity = getOpacity(tag.count)

        return (
          <div
            key={tag.key}
            className="transition-transform hover:scale-110 cursor-default"
            style={{
              fontSize: `${fontSize}rem`,
              opacity,
            }}
            title={`${tag.label}: ${tag.count} time${tag.count !== 1 ? 's' : ''}`}
          >
            <span className="font-semibold text-blue-400">{tag.label}</span>
          </div>
        )
      })}
    </div>
  )
}
