import React, { useState } from 'react';
import { useApp } from '../store';
import { Settings as SettingsIcon, Info, Plus, Trash2, Utensils } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const [newMealLabel, setNewMealLabel] = useState('');

  const addMealType = () => {
    if (!newMealLabel) return;
    const id = Math.random().toString(36).substr(2, 9);
    updateSettings({
      ...settings,
      mealTypes: [...settings.mealTypes, { id, label: newMealLabel }]
    });
    setNewMealLabel('');
  };

  const removeMealType = (id: string) => {
    updateSettings({
      ...settings,
      mealTypes: settings.mealTypes.filter(m => m.id !== id)
    });
  };

  const updateMealLabel = (id: string, label: string) => {
    updateSettings({
      ...settings,
      mealTypes: settings.mealTypes.map(m => m.id === id ? { ...m, label } : m)
    });
  };

  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  const addCategory = () => {
    if (!newCategoryLabel) return;
    updateSettings({
      ...settings,
      mealCategories: [...settings.mealCategories, newCategoryLabel]
    });
    setNewCategoryLabel('');
  };

  const removeCategory = (index: number) => {
    updateSettings({
      ...settings,
      mealCategories: settings.mealCategories.filter((_, i) => i !== index)
    });
  };

  const updateCategoryLabel = (index: number, label: string) => {
    const newCategories = [...settings.mealCategories];
    newCategories[index] = label;
    updateSettings({
      ...settings,
      mealCategories: newCategories
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Настройки</h2>
        <p className="text-gray-500">Конфигурация системы расчета и визуализации</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {/* Column 1: Core Configuration */}
        <div className="space-y-6">
          {/* Deviation Setting */}
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <SettingsIcon size={20} />
              </div>
              <h3 className="font-bold text-lg">Отклонение</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Допустимый % отклонения от цели.
            </p>
            <div className="flex items-center gap-4">
              <input 
                type="range" 
                min="1" 
                max="20" 
                step="1"
                className="flex-1 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                value={settings.deviation}
                onChange={(e) => updateSettings({ ...settings, deviation: Number(e.target.value) })}
              />
              <span className="w-12 text-center font-bold text-emerald-600 bg-emerald-50 py-1 rounded-lg border border-emerald-100 text-sm">
                {settings.deviation}%
              </span>
            </div>
          </div>

          {/* Calculation Method */}
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Info size={20} />
              </div>
              <h3 className="font-bold text-lg">Расчет</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-black/5 bg-gray-50">
                <input 
                  type="radio" 
                  id="proportional" 
                  name="calcMethod" 
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  checked={settings.calculationMethod === 'proportional'}
                  onChange={() => updateSettings({ ...settings, calculationMethod: 'proportional' })}
                />
                <label htmlFor="proportional" className="flex-1 cursor-pointer">
                  <span className="block font-medium text-sm">Пропорциональный</span>
                  <span className="block text-[10px] text-gray-400">
                    БЖУ пересчитываются пропорционально весу (база 100г).
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-black/5 bg-gray-50">
                <input 
                  type="radio" 
                  id="fixed" 
                  name="calcMethod" 
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  checked={settings.calculationMethod === 'fixed'}
                  onChange={() => updateSettings({ ...settings, calculationMethod: 'fixed' })}
                />
                <label htmlFor="fixed" className="flex-1 cursor-pointer">
                  <span className="block font-medium text-sm">Фиксированный (на порцию)</span>
                  <span className="block text-[10px] text-gray-400">
                    Расчет на 1 шт/порцию. Изменение веса не влияет на БЖУ.
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-black/5 bg-gray-50">
                <input 
                  type="radio" 
                  id="manual" 
                  name="calcMethod" 
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  checked={settings.calculationMethod === 'manual'}
                  onChange={() => updateSettings({ ...settings, calculationMethod: 'manual' })}
                />
                <label htmlFor="manual" className="flex-1 cursor-pointer">
                  <span className="block font-medium text-sm">Ручной ввод</span>
                  <span className="block text-[10px] text-gray-400">
                    Автоматический расчет отключен. Все данные вводятся вручную.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* AI Instructions */}
          <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
            <h4 className="font-bold mb-3 flex items-center gap-2">
              <Info size={18} />
              AI Prompt Guide (JSON)
            </h4>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-indigo-100 leading-relaxed mb-2 font-bold uppercase">
                  1. Генерация Рациона:
                </p>
                <div className="bg-black/20 p-3 rounded-xl text-[10px] font-mono break-all select-all cursor-pointer hover:bg-black/30 transition-colors">
                  {'Return ONLY a JSON object: { "clientName": string, "targetKcal": number, "targetProteins": number, "targetFats": number, "targetCarbs": number, "data": { "day1": { "meals": [ { "type": "meal_id_from_settings", "items": [ { "name": string, "weight": number, "proteins": number, "fats": number, "carbs": number, "kcal": number } ] } ] }, ... "day7": { ... } } }. Important: "type" must match IDs from settings.'}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-indigo-100 leading-relaxed mb-2 font-bold uppercase">
                  2. База Продуктов:
                </p>
                <div className="bg-black/20 p-3 rounded-xl text-[10px] font-mono break-all select-all cursor-pointer hover:bg-black/30 transition-colors">
                  {'Return ONLY a JSON ARRAY []. Each object MUST be flat: { "name": string, "proteins": number, "fats": number, "carbs": number, "kcal": number, "portion": 100 }. MANDATORY: All nutrient values (BJU/Kcal) MUST be strictly per 100g. Do NOT include "id" or "ingredients".'}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-indigo-100 leading-relaxed mb-2 font-bold uppercase">
                  3. Готовые Блюда:
                </p>
                <div className="bg-black/20 p-3 rounded-xl text-[10px] font-mono break-all select-all cursor-pointer hover:bg-black/30 transition-colors">
                  {'Return ONLY a JSON ARRAY []. Each object: { "name": string, "proteins": number, "fats": number, "carbs": number, "kcal": number, "portion": number, "ingredients": [ { "name": string, "weight": number, "proteins": number, "fats": number, "carbs": number, "kcal": number } ] }. Values are for the total "portion".'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Meal Types */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Utensils size={20} />
              </div>
              <h3 className="font-bold text-lg">Приемы пищи</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Список основных приемов пищи (Завтрак, Обед и т.д.)
            </p>
            
            <div className="space-y-2 mb-4 max-h-[400px] overflow-auto pr-2">
              {settings.mealTypes.map((meal) => (
                <div key={meal.id} className="flex items-center gap-2 group">
                  <input 
                    type="text" 
                    className="flex-1 px-3 py-2 border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    value={meal.label}
                    onChange={(e) => updateMealLabel(meal.id, e.target.value)}
                  />
                  <button 
                    onClick={() => removeMealType(meal.id)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Новый прием..." 
                className="flex-1 px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={newMealLabel}
                onChange={(e) => setNewMealLabel(e.target.value)}
              />
              <button 
                onClick={addMealType}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Categories */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Plus size={20} />
              </div>
              <h3 className="font-bold text-lg">Категории блюд</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Подстроки, создаваемые внутри каждого приема.
            </p>
            
            <div className="space-y-2 mb-4 max-h-[400px] overflow-auto pr-2">
              {settings.mealCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <input 
                    type="text" 
                    className="flex-1 px-3 py-2 border border-black/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={cat}
                    onChange={(e) => updateCategoryLabel(idx, e.target.value)}
                  />
                  <button 
                    onClick={() => removeCategory(idx)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Новая категория..." 
                className="flex-1 px-3 py-2 border border-black/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
              />
              <button 
                onClick={addCategory}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className="bg-emerald-600 p-6 rounded-2xl text-white shadow-lg shadow-emerald-600/20">
            <h4 className="font-bold mb-2">Совет</h4>
            <p className="text-[11px] text-emerald-50/80 leading-relaxed">
              Настройте приемы пищи один раз и используйте их как шаблон для всех новых клиентов.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
