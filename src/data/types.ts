/**
 * Shapes for the seeded reference data. Plain TypeScript (not JSON) so the
 * compiler checks every record and tests/seed-data.test.ts can import exactly
 * what the seeder inserts.
 */

export const FOOD_CATEGORIES = [
  'roti-bread',
  'rice-biryani',
  'dal-legume',
  'sabzi-curry-veg',
  'non-veg-curry',
  'south-indian',
  'breakfast-snack',
  'street-snack',
  'sweet-dessert',
  'dairy-curd',
  'beverage',
  'fruit-salad',
  'dry-nuts',
  'condiment-pickle',
  'protein-supplement',
  'other',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/** Display labels + ordering for the category chips in the food sheet. */
export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  'roti-bread': 'Roti & Bread',
  'rice-biryani': 'Rice & Biryani',
  'dal-legume': 'Dal & Legumes',
  'sabzi-curry-veg': 'Sabzi & Veg Curry',
  'non-veg-curry': 'Egg, Chicken & Fish',
  'south-indian': 'South Indian',
  'breakfast-snack': 'Breakfast',
  'street-snack': 'Street Food & Snacks',
  'sweet-dessert': 'Sweets & Desserts',
  'dairy-curd': 'Milk & Curd',
  beverage: 'Drinks',
  'fruit-salad': 'Fruit & Salad',
  'dry-nuts': 'Nuts & Dry Fruit',
  'condiment-pickle': 'Pickle & Sides',
  'protein-supplement': 'Protein & Supplements',
  other: 'Other',
};

export const CUISINES = ['indian', 'south-indian', 'north-indian', 'generic'] as const;
export type Cuisine = (typeof CUISINES)[number];

export interface FoodSeed {
  /** Display name. Include the qualifier that fixes the calories, e.g. "(fried)". */
  name: string;
  /** Regional and colloquial names — searched, so "chapati" finds "Roti". */
  aliases?: string[];
  category: FoodCategory;
  cuisine?: Cuisine;
  /**
   * The household unit people actually think in: "1 roti", "1 katori (150 ml)",
   * "1 idli". Never "100 g" for a cooked dish — nobody weighs their dal.
   */
  servingLabel: string;
  /** Reference weight for that serving. Display only. */
  servingGrams?: number;
  /** Per ONE serving. */
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fibreG: number;
  /** Defaults to true; set false for egg/meat/fish. */
  isVeg?: boolean;
}

export const EXERCISE_CATEGORIES = [
  'walking',
  'cardio',
  'strength',
  'sport',
  'flexibility',
  'other',
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  walking: 'Walking',
  cardio: 'Cardio',
  strength: 'Gym & Strength',
  sport: 'Sports',
  flexibility: 'Yoga & Stretching',
  other: 'Other',
};

export type Intensity = 'light' | 'moderate' | 'vigorous';

export interface ExerciseSeed {
  name: string;
  aliases?: string[];
  category: ExerciseCategory;
  /** MET value from the Ainsworth Compendium of Physical Activities. */
  met: number;
  intensity?: Intensity;
}

export interface MealSlotSeed {
  /** Stable slug — the seeder upserts on this, so never change an existing one. */
  key: string;
  name: string;
  sortOrder: number;
}
