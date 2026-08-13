'use client';

import { useCallback, useEffect, useState } from 'react';

import { FoodSearchSheet } from '@/components/food/FoodSearchSheet';
import { useDay } from '@/context/DayContext';

/**
 * Mounts the food sheet once, at the shell level, and registers its opener with
 * DayContext. That is what lets the bottom nav's "+" and any meal-slot card open
 * the same sheet without each screen owning a copy.
 */
export function FoodSheetHost() {
  const { registerFoodSheetOpener } = useDay();
  const [open, setOpen] = useState(false);
  const [slotId, setSlotId] = useState<string | undefined>(undefined);

  const openSheet = useCallback((mealSlotId?: string) => {
    setSlotId(mealSlotId);
    setOpen(true);
  }, []);

  useEffect(() => {
    registerFoodSheetOpener(openSheet);
  }, [registerFoodSheetOpener, openSheet]);

  return (
    <FoodSearchSheet
      open={open}
      onClose={() => setOpen(false)}
      initialSlotId={slotId}
    />
  );
}
