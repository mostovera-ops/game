/**
 * ui/street/format.ts — презентационные хелперы панели стрита и профиля соседа
 * (11-town §3.2/§3.3, 19-ui-ux §3.6 W2/F8). Только форматирование готовых данных —
 * ноль подсчёта лимитов/наград (те — серверная истина/будущий SocialSystem).
 */

/** Компактные инициалы для аватар-медальона соседа, когда портрета нет. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase()
}
