import { ChevronDown } from 'lucide-react'

import type { CanteenOption } from '@/api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CanteenMultiSelectProps {
  canteens: CanteenOption[]
  selectedIds: string[]
  onSelectedIdsChange: (selectedIds: string[]) => void
}

export function CanteenMultiSelect({
  canteens,
  selectedIds,
  onSelectedIdsChange,
}: CanteenMultiSelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-full justify-between rounded-md border-[#cfcbbd] bg-white/80 px-3 text-sm font-normal sm:w-[270px]"
        >
          <span className="truncate">{getCanteenLabel(canteens, selectedIds)}</span>
          <ChevronDown className="size-4 text-[#6d6b61]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[270px] rounded-md border-[#cfcbbd] bg-[#fbfaf6]"
      >
        {canteens.map((canteen) => {
          const isSelected = selectedIds.includes(canteen.id)
          const isLastSelected = isSelected && selectedIds.length === 1

          return (
            <DropdownMenuCheckboxItem
              key={canteen.id}
              checked={isSelected}
              className="cursor-pointer rounded-sm p-2"
              disabled={isLastSelected}
              onCheckedChange={() => {
                onSelectedIdsChange(
                  isSelected
                    ? selectedIds.filter((id) => id !== canteen.id)
                    : [...selectedIds, canteen.id],
                )
              }}
              onSelect={(event) => event.preventDefault()}
            >
              {canteen.name}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getCanteenLabel(canteens: CanteenOption[], selectedIds: string[]) {
  if (selectedIds.length === 0) return 'Selecionar cantinas'

  const names = selectedIds
    .map((id) => canteens.find((canteen) => canteen.id === id)?.name)
    .filter((name): name is string => Boolean(name))

  if (names.length === 0) return `${selectedIds.length} cantinas`
  if (names.length <= 2) return names.join(', ')

  return `${names.length} cantinas`
}
