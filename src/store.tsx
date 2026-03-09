import React, { createContext, useContext, useState, useEffect } from 'react';
import { DietPlan, Product, Settings, Dish } from './types';
import { DAYS, MEAL_TYPES, DEFAULT_SUB_ROWS } from './constants';

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  plans: any[];
  currentPlan: DietPlan | null;
  products: Product[];
  dishes: Dish[];
  settings: Settings;
  notification: Notification | null;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  loadPlans: () => Promise<void>;
  loadPlan: (id: string) => Promise<void>;
  savePlan: (plan: DietPlan) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  duplicatePlan: (id: string) => Promise<void>;
  createNewPlan: (clientName: string, targetKcal: number, startDate?: string, endDate?: string) => void;
  updatePlan: (plan: DietPlan) => void;
  updatePlanSettings: (mealTypes: { id: string; label: string }[], mealCategories: string[]) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  loadProducts: () => Promise<void>;
  loadDishes: () => Promise<void>;
  isDishConstructorDirty: boolean;
  setIsDishConstructorDirty: (dirty: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<DietPlan | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isDishConstructorDirty, setIsDishConstructorDirty] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    deviation: 5,
    calculationMethod: 'proportional',
    mealTypes: MEAL_TYPES,
    mealCategories: DEFAULT_SUB_ROWS
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadPlans = async () => {
    try {
      const res = await fetch('/api/plans', { credentials: 'include' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlans(data);
      } else {
        console.error('API returned non-array for plans:', data);
        setPlans([]);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
      setPlans([]);
    }
  };

  const loadPlan = async (id: string) => {
    try {
      const res = await fetch(`/api/plans/${id}`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const data = await res.json();
      
      // Normalize data to only include current DAYS
      const normalizedData: any = {};
      DAYS.forEach(day => {
        normalizedData[day.id] = data.data[day.id] || { meals: [] };
      });
      
      setCurrentPlan({ 
        ...data, 
        data: normalizedData,
        mealTypes: data.mealTypes || settings.mealTypes,
        mealCategories: data.mealCategories || settings.mealCategories
      });
    } catch (err) {
      console.error('Failed to load plan:', err);
    }
  };

  const savePlan = async (plan: DietPlan) => {
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
        credentials: 'include'
      });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      if (res.ok) {
        showNotification('Рацион успешно сохранен!', 'success');
        await loadPlans();
      } else {
        showNotification('Ошибка при сохранении', 'error');
      }
    } catch (e) {
      showNotification('Ошибка сети при сохранении', 'error');
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const res = await fetch(`/api/plans/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      await loadPlans();
      if (currentPlan?.id === id) setCurrentPlan(null);
      showNotification('Рацион удален', 'success');
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  const duplicatePlan = async (id: string) => {
    try {
      const res = await fetch(`/api/plans/${id}`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const plan = await res.json();
      const newPlan = {
        ...plan,
        id: Math.random().toString(36).substr(2, 9),
        clientName: `${plan.clientName} (Копия)`,
        createdAt: new Date().toISOString()
      };
      await savePlan(newPlan);
    } catch (err) {
      console.error('Failed to duplicate plan:', err);
    }
  };

  const createNewPlan = (clientName: string, targetKcal: number, startDate?: string, endDate?: string) => {
    const emptyData: any = {};
    DAYS.forEach(day => {
      emptyData[day.id] = {
        meals: settings.mealTypes.map(type => {
          const categories = type.id === 'dinner' ? settings.mealCategories : [settings.mealCategories[0]];
          return {
            type: type.id,
            items: categories.map(cat => ({
              id: Math.random().toString(36).substr(2, 9),
              name: cat,
              weight: 0,
              proteins: 0,
              fats: 0,
              carbs: 0,
              kcal: 0
            }))
          };
        })
      };
    });
    
    const newPlan: DietPlan = {
      id: Math.random().toString(36).substr(2, 9),
      clientName,
      targetKcal,
      targetProteins: 150,
      targetFats: 70,
      targetCarbs: 250,
      createdAt: new Date().toISOString(),
      startDate,
      endDate,
      mealTypes: [...settings.mealTypes],
      mealCategories: [...settings.mealCategories],
      data: emptyData
    };
    setCurrentPlan(newPlan);
  };

  const updatePlan = (plan: DietPlan) => {
    console.log('Updating plan state:', plan.clientName);
    setCurrentPlan({ ...plan });
  };

  const updatePlanSettings = async (mealTypes: { id: string; label: string }[], mealCategories: string[]) => {
    if (!currentPlan) return;
    
    // Clean up data for removed meal types
    const validMealTypeIds = new Set(mealTypes.map(m => m.id));
    const newData = { ...currentPlan.data };
    
    Object.keys(newData).forEach(dayId => {
      if (newData[dayId] && newData[dayId].meals) {
        newData[dayId].meals = newData[dayId].meals.filter((meal: any) => validMealTypeIds.has(meal.type));
      }
    });

    const updatedPlan = {
      ...currentPlan,
      mealTypes,
      mealCategories,
      data: newData
    };
    setCurrentPlan(updatedPlan);
    await savePlan(updatedPlan);
  };

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/products', { credentials: 'include' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadDishes = async () => {
    try {
      const res = await fetch(`/api/dishes?full=true&t=${Date.now()}`, { credentials: 'include' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const data = await res.json();
      console.log('Loaded dishes:', data.length);
      setDishes(data);
    } catch (err) {
      console.error('Failed to load dishes:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const data = await res.json();
      if (Object.keys(data).length > 0) {
        setSettings({
          deviation: Number(data.deviation) || 5,
          calculationMethod: data.calculationMethod as any || 'proportional',
          mealTypes: data.mealTypes ? JSON.parse(data.mealTypes) : MEAL_TYPES,
          mealCategories: data.mealCategories ? JSON.parse(data.mealCategories) : DEFAULT_SUB_ROWS
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const updateSettings = async (newSettings: Settings) => {
    try {
      setSettings(newSettings);
      const payload = {
        ...newSettings,
        mealTypes: JSON.stringify(newSettings.mealTypes),
        mealCategories: JSON.stringify(newSettings.mealCategories)
      };
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
        credentials: 'include'
      });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  useEffect(() => {
    loadPlans();
    loadProducts();
    loadDishes();
    loadSettings();
  }, []);

  return (
    <AppContext.Provider value={{
      plans, currentPlan, products, dishes, settings, notification, showNotification,
      loadPlans, loadPlan, savePlan, deletePlan, duplicatePlan,
      createNewPlan, updatePlan, updatePlanSettings, updateSettings, loadProducts, loadDishes,
      isDishConstructorDirty, setIsDishConstructorDirty
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
