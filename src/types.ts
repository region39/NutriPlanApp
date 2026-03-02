export interface Product {
  id: number;
  name: string;
  proteins: number;
  fats: number;
  carbs: number;
  kcal: number;
  portion: number;
  is_custom?: number;
  is_ready_meal?: number;
  image?: string | null;
}

export interface Dish {
  id: number;
  name: string;
  proteins: number;
  fats: number;
  carbs: number;
  kcal: number;
  portion: number;
  image?: string | null;
  ingredients?: { productId: number; weight: number }[];
}

export interface MealItem {
  id: string;
  name: string;
  weight: number; // in grams
  proteins: number; // calculated
  fats: number; // calculated
  carbs: number; // calculated
  kcal: number; // calculated
  productId?: number;
  dishId?: number;
}

export interface Meal {
  type: string;
  items: MealItem[];
}

export interface DayPlan {
  meals: Meal[];
}

export interface DietPlan {
  id: string;
  clientName: string;
  targetKcal: number;
  targetProteins?: number;
  targetFats?: number;
  targetCarbs?: number;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  data: {
    [day: string]: DayPlan;
  };
}

export interface Settings {
  deviation: number;
  calculationMethod: 'proportional' | 'fixed' | 'manual';
  mealTypes: { id: string; label: string }[];
  mealCategories: string[];
}
