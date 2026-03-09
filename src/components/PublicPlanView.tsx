import React, { useEffect, useState } from 'react';
import { Utensils, Calendar, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { DietPlan } from '../types';
import { DAYS } from '../constants';

interface PublicPlanViewProps {
  planId: string;
}

export const PublicPlanView: React.FC<PublicPlanViewProps> = ({ planId }) => {
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const response = await fetch(`/api/public/plans/${planId}`);
        if (!response.ok) {
          throw new Error('Рацион не найден или доступ закрыт');
        }
        const data = await response.json();
        setPlan(data);
        
        // Expand the first day by default
        const firstDay = DAYS[0].id;
        setExpandedDays({ [firstDay]: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Произошла ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId]);

  const toggleDay = (dayId: string) => {
    setExpandedDays(prev => ({ ...prev, [dayId]: !prev[dayId] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-emerald-700 font-medium">Загрузка рациона...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-500">{error || 'Рацион не найден'}</p>
        </div>
      </div>
    );
  }

  const mealTypes = plan.mealTypes || [];

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-50 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-emerald-600 flex items-center gap-2 mb-1">
            <Utensils size={20} />
            NutriPlan+
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Индивидуальный рацион для: <span className="text-gray-900 font-bold">{plan.clientName}</span>
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 mt-6">
        {/* Summary Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5 mb-6">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Цели на день</h2>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Ккал</p>
              <p className="text-lg font-black text-emerald-600">{plan.targetKcal}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Белки</p>
              <p className="text-lg font-black text-gray-900">{plan.targetProteins}<span className="text-xs font-medium text-gray-400 ml-0.5">г</span></p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Жиры</p>
              <p className="text-lg font-black text-gray-900">{plan.targetFats}<span className="text-xs font-medium text-gray-400 ml-0.5">г</span></p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Углеводы</p>
              <p className="text-lg font-black text-gray-900">{plan.targetCarbs}<span className="text-xs font-medium text-gray-400 ml-0.5">г</span></p>
            </div>
          </div>
        </div>

        {/* Days List */}
        <div className="space-y-4">
          {DAYS.map(day => {
            const dayData = plan.data[day.id];
            if (!dayData || !dayData.meals || dayData.meals.length === 0) return null;

            // Check if day has any actual food items
            const hasFood = dayData.meals.some(m => m.items && m.items.length > 0);
            if (!hasFood) return null;

            const isExpanded = expandedDays[day.id];

            return (
              <div key={day.id} className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
                <button 
                  onClick={() => toggleDay(day.id)}
                  className="w-full px-5 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Calendar size={18} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900 text-lg">{day.label}</h3>
                      <p className="text-xs text-gray-500 font-medium">
                        {Math.round(dayData.totalKcal || 0)} ккал • Б: {Math.round(dayData.totalProteins || 0)} Ж: {Math.round(dayData.totalFats || 0)} У: {Math.round(dayData.totalCarbs || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-black/5">
                    <div className="space-y-6 mt-4">
                      {mealTypes.map(mealType => {
                        const meal = dayData.meals.find(m => m.type === mealType.id);
                        if (!meal || !meal.items || meal.items.length === 0) return null;

                        return (
                          <div key={mealType.id} className="relative pl-4 border-l-2 border-emerald-100">
                            <h4 className="font-bold text-gray-900 mb-3 flex items-center justify-between">
                              <span>{mealType.label}</span>
                              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                {Math.round(meal.totalKcal || 0)} ккал
                              </span>
                            </h4>
                            <div className="space-y-3">
                              {meal.items.map((item, idx) => (
                                <div key={idx} className="bg-gray-50 rounded-xl p-3 flex items-start gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-white border border-black/5 flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.productId ? (
                                      <img 
                                        src={`/api/images/product/${item.productId}`} 
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        className="w-full h-full object-cover" 
                                        alt={item.name} 
                                      />
                                    ) : item.dishId ? (
                                      <img 
                                        src={`/api/images/dish/${item.dishId}`} 
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        className="w-full h-full object-cover" 
                                        alt={item.name} 
                                      />
                                    ) : (
                                      <Utensils size={16} className="text-gray-300" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-900 mb-1">{item.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <span className="font-medium text-gray-700 bg-white px-1.5 py-0.5 rounded border border-black/5">
                                        {item.weight} г
                                      </span>
                                      <span>•</span>
                                      <span>{Math.round(item.kcal || 0)} ккал</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
