import type { RouteLocationRaw } from 'vue-router'

export interface NavItem {
  label: string
  to: RouteLocationRaw
  /** Префиксы путей, на которых пункт подсвечен как активный */
  sections: readonly string[]
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Играть', to: { name: 'library' }, sections: ['/library', '/play', '/results'] },
  { label: 'Тюнер', to: { name: 'tuner' }, sections: ['/tuner'] },
  { label: 'Теория', to: { name: 'theory-circle' }, sections: ['/theory'] },
]

export function isSectionActive(path: string, sections: readonly string[]): boolean {
  return sections.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}
