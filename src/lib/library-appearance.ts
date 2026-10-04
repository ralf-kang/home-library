import { z } from 'zod'
import type { CSSProperties } from 'react'

export const appearanceSchema = z.object({
  version: z.literal(1),
  theme: z.enum(['forest', 'clay', 'indigo']),
  cover: z.enum(['none', 'nook', 'family', 'sharing', 'journal', 'books', 'capture']),
  finish: z.enum(['oak', 'walnut', 'white']),
  density: z.enum(['comfortable', 'compact']),
  heading: z.string().trim().max(40),
  showTitles: z.boolean(),
}).strict()

export type LibraryAppearance = z.infer<typeof appearanceSchema>
export const DEFAULT_APPEARANCE: LibraryAppearance = {
  version: 1, theme: 'forest', cover: 'none', finish: 'oak',
  density: 'comfortable', heading: '', showTitles: true,
}
export const LIBRARY_THEMES = {
  forest: { label: '숲의 서재', brand: '#2f5d50', paper: '#faf8f3', soft: '#e3eee9', accent: '#96501d' },
  clay: { label: '따뜻한 흙빛', brand: '#8a4934', paper: '#fbf6ef', soft: '#f5e7df', accent: '#96501d' },
  indigo: { label: '차분한 남빛', brand: '#374d7b', paper: '#f6f8fc', soft: '#e4eaf5', accent: '#855217' },
} as const
export const SHELF_FINISHES = {
  oak: { label: '내추럴 오크', edge: '#b79a73', surface: '#eee3d3' },
  walnut: { label: '월넛', edge: '#785b45', surface: '#dfd1c3' },
  white: { label: '화이트', edge: '#c6cfca', surface: '#f0f4f1' },
} as const

/** Stored data is untrusted and may come from an earlier schema version. */
export function readLibraryAppearance(value: unknown): LibraryAppearance {
  const parsed = appearanceSchema.safeParse(value)
  return parsed.success ? parsed.data : { ...DEFAULT_APPEARANCE }
}
export function appearanceStyle(value: LibraryAppearance): CSSProperties {
  const theme = LIBRARY_THEMES[value.theme]
  const finish = SHELF_FINISHES[value.finish]
  return {
    '--color-brand': theme.brand, '--color-paper': theme.paper,
    '--color-brand-soft': theme.soft, '--color-accent': theme.accent,
    '--shelf-edge': finish.edge, '--shelf-surface': finish.surface,
  } as CSSProperties
}
