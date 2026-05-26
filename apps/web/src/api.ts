export type MealService = 'lunch' | 'dinner' | 'unknown'
export type MealStatus = 'available' | 'closed' | 'empty'
export type MenuItemCategory =
  | 'soup'
  | 'meat'
  | 'fish'
  | 'diet'
  | 'vegetarian'
  | 'other'
export type MenuItemTier = 'normal' | 'option' | null

export interface MenuItem {
  category: MenuItemCategory
  tier: MenuItemTier
  sourceLabel: string | null
  text: string
}

export interface MealMenu {
  service: MealService
  status: MealStatus
  items: MenuItem[]
}

export interface MenuDay {
  date: string
  weekday: string
  meals: MealMenu[]
}

export interface CanteenMenu {
  id: string
  name: string
  days: MenuDay[]
}

export interface MenusResponse {
  meta: {
    sourceUrl: string
    fetchedAt: string
    requestedRange: {
      from: string
      to: string
    }
    availableRange: {
      from: string | null
      to: string | null
    }
    timezone: string
    cached: boolean
    stale: boolean
    anomalyCount: number
  }
  canteens: CanteenMenu[]
}

export interface CanteenOption {
  id: string
  name: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getCanteens() {
  return getJson<{ canteens: CanteenOption[] }>('/api/v1/canteens')
}

export function getMenus(params?: {
  from?: string
  to?: string
  canteenIds?: string[]
}) {
  const search = new URLSearchParams()

  if (params?.from && params.to) {
    search.set('from', params.from)
    search.set('to', params.to)
  }

  if (params?.canteenIds && params.canteenIds.length > 0) {
    search.set('canteens', params.canteenIds.join(','))
  }

  const query = search.toString()

  return getJson<MenusResponse>(`/api/v1/menus${query ? `?${query}` : ''}`)
}
