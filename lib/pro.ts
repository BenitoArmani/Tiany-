export const FREE_PROJECT_LIMIT = 2

export function isPro(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('tiany_pro') === 'true'
}
