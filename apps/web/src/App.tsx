import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type CanteenMenu,
  type MealMenu,
  type MenuItemCategory,
  getCanteens,
  getMenus,
} from '@/api'
import {
  compactDate,
  longDate,
  shortWeekday,
  toIsoDate,
} from '@/date-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CanteenMultiSelect } from '@/components/canteen-multi-select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const CATEGORY_LABELS: Record<MenuItemCategory, string> = {
  soup: 'Sopa',
  meat: 'Carne',
  fish: 'Peixe',
  diet: 'Dieta',
  vegetarian: 'Vegetariano',
  other: 'Outro',
}

const SERVICE_LABELS: Record<MealMenu['service'], string> = {
  lunch: 'Almoço',
  dinner: 'Jantar',
  unknown: 'Serviço',
}

const STATUS_LABELS: Record<MealMenu['status'], string> = {
  available: 'Disponível',
  closed: 'Encerrado',
  empty: 'Sem ementa',
}

const DEFAULT_CANTEEN_IDS = ['crasto', 'santiago', 'grelhados']

function dayKey() {
  return toIsoDate(new Date())
}

function App() {
  const queryClient = useQueryClient()
  const today = useMemo(() => dayKey(), [])
  const [activeDay, setActiveDay] = useState(today)
  const [selectedCanteenIds, setSelectedCanteenIds] =
    useState(DEFAULT_CANTEEN_IDS)
  const normalizedCanteenIds = useMemo(
    () => [...selectedCanteenIds].sort(),
    [selectedCanteenIds],
  )
  const [dateRailScroll, setDateRailScroll] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  })
  const dateRailRef = useRef<HTMLDivElement | null>(null)
  const selectedDateRef = useRef<HTMLButtonElement | null>(null)

  const canteensQuery = useQuery({
    queryKey: ['canteens'],
    queryFn: getCanteens,
  })

  const menusQuery = useQuery({
    queryKey: ['menus', normalizedCanteenIds],
    queryFn: async () => {
      const initialMenus = await getMenus({ canteenIds: normalizedCanteenIds })
      const availableRange = initialMenus.meta.availableRange

      if (!availableRange.from || !availableRange.to) {
        return initialMenus
      }

      const requestedRange = initialMenus.meta.requestedRange

      if (
        requestedRange.from === availableRange.from &&
        requestedRange.to === availableRange.to
      ) {
        return initialMenus
      }

      return getMenus({
        from: availableRange.from,
        to: availableRange.to,
        canteenIds: normalizedCanteenIds,
      })
    },
    placeholderData: keepPreviousData,
  })

  const canteens = canteensQuery.data?.canteens ?? []
  const menus = menusQuery.data ?? null
  const hasMenus = menus !== null
  const isInitialLoading =
    (canteensQuery.isLoading || menusQuery.isLoading) && !hasMenus
  const isRefreshing = canteensQuery.isFetching || menusQuery.isFetching
  const error =
    menusQuery.error instanceof Error
      ? menusQuery.error.message
      : canteensQuery.error instanceof Error
        ? canteensQuery.error.message
        : null

  const availableDates = useMemo(() => {
    const dates = new Set<string>()

    menus?.canteens.forEach((canteen) => {
      canteen.days.forEach((day) => dates.add(day.date))
    })

    return Array.from(dates).sort()
  }, [menus])

  const selectedDay = availableDates.includes(activeDay)
    ? activeDay
    : (availableDates[0] ?? activeDay)
  const displayFrom = availableDates[0] ?? menus?.meta.availableRange.from ?? today
  const displayTo =
    availableDates[availableDates.length - 1] ?? menus?.meta.availableRange.to ?? today

  const activeMenus = useMemo(() => {
    if (!menus) return undefined

    return menus.canteens.reduce<CanteenMenu[]>((selectedMenus, canteen) => {
      const days = canteen.days.filter((day) => day.date === selectedDay)

      if (days.length > 0) {
        selectedMenus.push({ ...canteen, days })
      }

      return selectedMenus
    }, [])
  }, [menus, selectedDay])

  useEffect(() => {
    selectedDateRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [availableDates.length, selectedDay])

  useEffect(() => {
    const rail = dateRailRef.current
    if (!rail) return

    const dateRail = rail

    function updateScrollState() {
      const maxScrollLeft = dateRail.scrollWidth - dateRail.clientWidth

      setDateRailScroll({
        canScrollLeft: dateRail.scrollLeft > 1,
        canScrollRight: dateRail.scrollLeft < maxScrollLeft - 1,
      })
    }

    updateScrollState()
    dateRail.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      dateRail.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [availableDates.length])

  return (
    <main className="min-h-svh bg-[#fbfaf6] text-[#20201c]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 border-b border-[#dedbd0] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#6d6b61]">
              Universidade de Aveiro
            </p>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="text-4xl font-semibold tracking-normal text-[#161611] sm:text-5xl">
                Ementas
              </h1>
              <span className="text-sm text-[#6d6b61]">
                {compactDate(displayFrom)} - {compactDate(displayTo)}
              </span>
            </div>
          </div>

          <CanteenMultiSelect
            canteens={canteens}
            selectedIds={selectedCanteenIds}
            onSelectedIdsChange={setSelectedCanteenIds}
          />
        </header>

        <section className="border-b border-[#dedbd0] py-3">
          <div className="relative">
            <div
              aria-hidden="true"
              className={
                dateRailScroll.canScrollLeft
                  ? 'pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#fbfaf6] to-transparent'
                  : 'hidden'
              }
            />
            <div
              aria-hidden="true"
              className={
                dateRailScroll.canScrollRight
                  ? 'pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#fbfaf6] to-transparent'
                  : 'hidden'
              }
            />
          <div
            aria-label="Selecionar dia"
            className="scrollbar-none flex w-full snap-x gap-1 overflow-x-auto"
            ref={dateRailRef}
            role="tablist"
          >
            {availableDates.length === 0 && isInitialLoading
              ? Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="h-11 min-w-24 rounded-sm" />
                ))
              : null}
            {availableDates.map((date) => {
              const isSelected = date === selectedDay

              return (
                <button
                  key={date}
                  aria-selected={isSelected}
                  className="group flex h-11 min-w-24 snap-center flex-col items-center justify-center border-b-2 border-transparent px-2 text-center transition-colors hover:border-[#b8b2a2] aria-selected:border-[#1f342f]"
                  onClick={() => setActiveDay(date)}
                  ref={isSelected ? selectedDateRef : null}
                  role="tab"
                  type="button"
                >
                  <span className="text-xs capitalize leading-4 text-[#6d6b61] group-aria-selected:text-[#1f342f]">
                    {shortWeekday(date)}
                  </span>
                  <span className="text-sm font-semibold leading-5 text-[#6d6b61] group-aria-selected:text-[#1f342f]">
                    {compactDate(date)}
                  </span>
                </button>
              )
            })}
          </div>
          </div>
        </section>

        <section className="py-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold capitalize tracking-normal">
                {longDate(selectedDay)}
              </h2>
              {menus ? (
                <p className="text-sm text-[#6d6b61]">
                  Atualizado {new Date(menus.meta.fetchedAt).toLocaleString('pt-PT')}
                </p>
              ) : null}
            </div>

            <Button
              variant="ghost"
              className="w-fit gap-2 text-[#42574f]"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['canteens'] })
                queryClient.invalidateQueries({ queryKey: ['menus'] })
              }}
              disabled={isInitialLoading}
            >
              <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Atualizar
            </Button>
          </div>

          {error && !hasMenus ? <ErrorState message={error} /> : null}
          {error && hasMenus ? <InlineError message={error} /> : null}
          {!error && isInitialLoading ? <LoadingState /> : null}
          {!error && !isInitialLoading && activeMenus?.length === 0 ? <EmptyState /> : null}
          {hasMenus && activeMenus ? (
            <MenuList canteens={activeMenus} />
          ) : null}
        </section>
      </div>
    </main>
  )
}

function MenuList({ canteens }: { canteens: CanteenMenu[] }) {
  return (
    <div className="divide-y divide-[#dedbd0] border-y border-[#dedbd0]">
      {canteens.map((canteen) => (
        <section
          key={canteen.id}
          className="grid gap-4 py-5 lg:grid-cols-[180px_1fr]"
        >
          <div>
            <h3 className="text-lg font-semibold tracking-normal">{canteen.name}</h3>
          </div>

          <div className="space-y-4">
            {canteen.days[0].meals.map((meal) => (
              <MealBlock key={`${canteen.id}-${meal.service}`} meal={meal} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MealBlock({ meal }: { meal: MealMenu }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
      <div className="flex items-start gap-2">
        <Badge
          variant={meal.status === 'available' ? 'default' : 'secondary'}
          className="rounded-sm bg-[#1f342f] text-white"
        >
          {SERVICE_LABELS[meal.service]}
        </Badge>
      </div>

      {meal.status === 'available' && meal.items.length > 0 ? (
        <ul className="divide-y divide-[#e7e3d7] border-l border-[#d8d3c4]">
          {meal.items.map((item, index) => (
            <li
              key={`${item.category}-${item.text}-${index}`}
              className="grid gap-1 px-4 py-2 sm:grid-cols-[120px_1fr]"
            >
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#777466]">
                {CATEGORY_LABELS[item.category]}
              </span>
              <span className="text-sm leading-6 text-[#25251f]">{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-l border-[#d8d3c4] px-4 py-2 text-sm text-[#777466]">
          {STATUS_LABELS[meal.status]}
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6 border-y border-[#dedbd0] py-5">
      {[0, 1, 2].map((item) => (
        <div key={item} className="grid gap-4 lg:grid-cols-[180px_1fr]">
          <Skeleton className="h-7 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-11/12" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="border-y border-[#b94a48]/30 bg-[#fff6f4] px-4 py-5 text-sm text-[#8a2f2d]">
      Não consegui carregar a API: {message}
    </div>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="mb-4 border-y border-[#b94a48]/30 bg-[#fff6f4] px-4 py-3 text-sm text-[#8a2f2d]">
      Não consegui atualizar as ementas: {message}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border-y border-[#dedbd0] py-8 text-sm text-[#6d6b61]">
      Não há ementas publicadas para este dia.
      <Separator className="mt-8 bg-[#dedbd0]" />
    </div>
  )
}

export default App
