import type { CanteenMenu } from './menus.types.js';

export const CANTEEN_CATALOG = [
  { id: 'crasto', name: 'Crasto' },
  { id: 'santiago', name: 'Santiago' },
  { id: 'grelhados', name: 'Grelhados' },
  { id: 'estga', name: 'ESTGA' },
  { id: 'restaurante-vegetariano', name: 'Restaurante Vegetariano' },
  { id: 'tresde', name: 'TrêsDê' },
] as const;

const catalogById = new Map<string, (typeof CANTEEN_CATALOG)[number]>(
  CANTEEN_CATALOG.map((canteen) => [canteen.id, canteen]),
);

export function listKnownCanteens(canteens: CanteenMenu[]) {
  const discoveredCanteens = canteens
    .filter((canteen) => !catalogById.has(canteen.id))
    .map(({ id, name }) => ({ id, name }));

  return [...CANTEEN_CATALOG, ...discoveredCanteens];
}

export function isKnownCanteenId(canteenId: string, canteens: CanteenMenu[]): boolean {
  return catalogById.has(canteenId) || canteens.some((canteen) => canteen.id === canteenId);
}

export function selectCanteens(
  canteens: CanteenMenu[],
  requestedIds: string[] | undefined,
): CanteenMenu[] {
  if (!requestedIds) return canteens;

  const canteensById = new Map(canteens.map((canteen) => [canteen.id, canteen]));

  return [...new Set(requestedIds)].flatMap((canteenId) => {
    const availableCanteen = canteensById.get(canteenId);
    if (availableCanteen) return [availableCanteen];

    const catalogCanteen = catalogById.get(canteenId);
    return catalogCanteen ? [{ ...catalogCanteen, days: [] }] : [];
  });
}
