import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { Plus, Trash2, Save, Utensils, Edit3, X, Download, Upload, Search, ChevronDown, Info, ArrowRight, RefreshCw } from 'lucide-react';
import { SearchableItemSelect } from './SearchableItemSelect';

export const DishConstructor: React.FC = () => {
  const { products, dishes, loadDishes, loadProducts, showNotification, settings, setIsDishConstructorDirty } = useApp();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingType, setEditingType] = useState<'dish' | 'ready_meal' | null>(null);
  const [originalType, setOriginalType] = useState<'dish' | 'ready_meal' | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);
  const [quickAddProduct, setQuickAddProduct] = useState<{ index: number, name: string } | null>(null);
  const [quickAddFormData, setQuickAddFormData] = useState({ p: 0, f: 0, c: 0, kcal: 0, portion: 100 });
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<{ productId: number | null; weight: number }[]>([]);
  const [portion, setPortion] = useState<number>(0);
  const [isManualPortion, setIsManualPortion] = useState(false);
  const [fixedMacros, setFixedMacros] = useState({ p: 0, f: 0, c: 0, kcal: 0 });
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  useEffect(() => {
    loadProducts();
    loadDishes();
  }, []);

  const ingredientsWeight = ingredients.reduce((acc, ing) => acc + ing.weight, 0);

  useEffect(() => {
    if (!isManualPortion) {
      setPortion(ingredientsWeight);
    }
  }, [ingredientsWeight, isManualPortion]);

  const totals = ingredients.length > 0 ? ingredients.reduce((acc, ing) => {
    if (ing.productId === null) return acc;
    const product = (products || []).find(p => p.id === ing.productId);
    if (!product) return acc;
    const ratio = ing.weight / 100;
    return {
      p: acc.p + product.proteins * ratio,
      f: acc.f + product.fats * ratio,
      c: acc.c + product.carbs * ratio,
      kcal: acc.kcal + product.kcal * ratio,
      weight: acc.weight + ing.weight
    };
  }, { p: 0, f: 0, c: 0, kcal: 0, weight: 0 }) : { 
    p: fixedMacros.p, 
    f: fixedMacros.f, 
    c: fixedMacros.c, 
    kcal: fixedMacros.kcal, 
    weight: portion || 100 
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { productId: null, weight: 100 }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, productId: number | null, weight: number) => {
    const newIngs = [...ingredients];
    newIngs[index] = { productId, weight };
    setIngredients(newIngs);
  };

  const handleQuickAddProduct = async (index: number, name: string) => {
    setQuickAddProduct({ index, name });
    setQuickAddFormData({ p: 0, f: 0, c: 0, kcal: 0, portion: 100 });
  };

  const submitQuickAddProduct = async () => {
    if (!quickAddProduct) return;
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: quickAddProduct.name, 
          proteins: quickAddFormData.p, 
          fats: quickAddFormData.f, 
          carbs: quickAddFormData.c, 
          kcal: quickAddFormData.kcal, 
          portion: quickAddFormData.portion 
        })
      });
      if (res.ok) {
        const data = await res.json();
        await loadProducts();
        updateIngredient(quickAddProduct.index, data.id, 100);
        showNotification(`Продукт "${quickAddProduct.name}" добавлен в базу`, 'success');
        setQuickAddProduct(null);
      }
    } catch (err) {
      showNotification('Ошибка при создании продукта', 'error');
    }
  };

  const handleSave = async () => {
    if (!name) return;
    
    // Category reminder
    if (selectedCategories.length === 0) {
      const confirmSave = window.confirm("Вы не выбрали категорию для этого блюда. Продолжить сохранение без категории?");
      if (!confirmSave) return;
    }

    let currentId = editingId;
    let currentType = editingType;

    // Handle conversion: if type changed, delete from old table and set currentId to null to create in new table
    if (editingId && originalType && originalType !== editingType) {
      try {
        const deleteUrl = originalType === 'ready_meal' ? `/api/products/${editingId}` : `/api/dishes/${editingId}`;
        await fetch(deleteUrl, { method: 'DELETE' });
        currentId = null; // Reset ID so it's created in the new table
      } catch (err) {
        console.error('Error during conversion:', err);
      }
    }

    if (currentType === 'ready_meal') {
      const payload = {
        name,
        proteins: Number(totals.p.toFixed(1)),
        fats: Number(totals.f.toFixed(1)),
        carbs: Number(totals.c.toFixed(1)),
        kcal: Number(totals.kcal.toFixed(1)),
        portion: portion || 100,
        is_ready_meal: 1,
        imageBase64,
        categories: selectedCategories
      };
      
      const url = currentId ? `/api/products/${currentId}` : '/api/products';
      const method = currentId ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await loadProducts();
    } else {
      const payload = {
        name,
        proteins: Number(totals.p.toFixed(1)),
        fats: Number(totals.f.toFixed(1)),
        carbs: Number(totals.c.toFixed(1)),
        kcal: Number(totals.kcal.toFixed(1)),
        portion: portion || totals.weight,
        ingredients: ingredients.filter(i => i.productId !== null),
        imageBase64,
        categories: selectedCategories
      };

      const url = currentId ? `/api/dishes/${currentId}` : '/api/dishes';
      const method = currentId ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await loadDishes();
    }
    
    resetForm();
    showNotification(editingId ? 'Обновлено!' : 'Сохранено!', 'success');
  };

  const handleDelete = async (id: number | string, type: 'dish' | 'ready_meal' = 'dish') => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }

    try {
      const url = type === 'ready_meal' ? `/api/products/${id}` : `/api/dishes/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        if (type === 'ready_meal') await loadProducts();
        else await loadDishes();
        showNotification('Удалено', 'success');
        setConfirmDeleteId(null);
      }
    } catch (err) {
      showNotification('Ошибка при удалении', 'error');
    }
  };

  const handleExportDishes = async () => {
    const res = await fetch('/api/dishes?full=true');
    const fullDishes = await res.json();
    const blob = new Blob([JSON.stringify(fullDishes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NutriPlan_Dishes_All.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingleDish = async (dish: any) => {
    // Fetch full dish with ingredients
    const res = await fetch(`/api/dishes/${dish.id}`);
    const fullDish = await res.json();
    const blob = new Blob([JSON.stringify(fullDish, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Dish_${dish.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDishes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const importPromise = new Promise<void>((resolve, reject) => {
      reader.onload = async (event) => {
        try {
          let result = event.target?.result;
          if (typeof result !== 'string') return resolve();
          
          // Clean up common malformed JSON issues like "key": ,
          result = result.replace(/:\s*,/g, ': null,');
          
          const content = JSON.parse(result);
          
          const dishesToImport = Array.isArray(content) ? content : [content];
          
          for (const dish of dishesToImport) {
            if (!dish.name) continue;
            await fetch('/api/dishes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(dish)
            });
          }
          resolve();
        } catch (err) {
          console.error('Failed to import dishes:', err);
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });

    try {
      await importPromise;
      await loadDishes();
      alert('Импорт завершен');
    } catch (err) {
      alert('Ошибка при импорте');
    }
  };

  useEffect(() => {
    if (name || ingredients.length > 0 || selectedCategories.length > 0 || (editingType === 'ready_meal' && (fixedMacros.p > 0 || fixedMacros.f > 0 || fixedMacros.c > 0 || fixedMacros.kcal > 0))) {
      setIsDishConstructorDirty(true);
    } else {
      setIsDishConstructorDirty(false);
    }
  }, [name, ingredients, selectedCategories, fixedMacros, editingType]);

  const resetForm = () => {
    setEditingId(null);
    setEditingType(null);
    setOriginalType(null);
    setName('');
    setPreviewImage(null);
    setImageBase64(undefined);
    setSelectedCategories([]);
    setIngredients([]);
    setPortion(0);
    setIsManualPortion(false);
    setFixedMacros({ p: 0, f: 0, c: 0, kcal: 0 });
    setIsDishConstructorDirty(false);
  };

  const startEditing = async (dish: any) => {
    setEditingId(dish.id);
    setEditingType(dish.type || 'dish');
    setOriginalType(dish.type || 'dish');
    setName(dish.name);
    setPreviewImage(`/api/images/${dish.type === 'ready_meal' ? 'product' : 'dish'}/${dish.id}?t=${Date.now()}`);
    setImageBase64(undefined);
    setSelectedCategories(dish.categories || []);
    
    if (dish.type === 'ready_meal') {
      setIngredients([]);
      setPortion(dish.portion);
      setFixedMacros({ p: dish.proteins, f: dish.fats, c: dish.carbs, kcal: dish.kcal });
      setIsManualPortion(true);
    } else {
      // Fetch ingredients for this dish
      const res = await fetch(`/api/dishes/${dish.id}`);
      const data = await res.json();
      const loadedIngredients = data.ingredients.map((i: any) => ({
        productId: i.productId,
        weight: i.weight
      }));
      
      setIngredients(loadedIngredients);
      
      // Calculate if we should be in manual mode: 
      // only if the saved portion differs from the sum of ingredients
      const sumWeight = loadedIngredients.reduce((acc: number, i: any) => acc + i.weight, 0);
      const isManual = Math.abs(dish.portion - sumWeight) > 0.1;
      
      setPortion(dish.portion);
      setIsManualPortion(isManual);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewImage(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const allDishes = [
    ...(dishes || []).map(d => ({ ...d, type: 'dish' })),
    ...(products || []).filter(p => p.is_ready_meal === 1).map(p => ({ ...p, type: 'ready_meal' }))
  ].filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
   .sort((a, b) => a.name.localeCompare(b.name));

  const groupedDishes = settings.mealCategories.reduce((acc, cat) => {
    acc[cat] = allDishes.filter(d => d.categories?.includes(cat));
    return acc;
  }, {} as Record<string, any[]>);

  const uncategorizedDishes = allDishes.filter(d => !d.categories || d.categories.length === 0);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  return (
    <div className="h-[calc(100vh-40px)] flex flex-col overflow-hidden bg-gray-50/30">
      {/* Top Header */}
      <div className="bg-white border-b border-black/5 px-8 py-4 shrink-0">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Конструктор блюд</h2>
            <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Создание и редактирование</p>
          </div>
          <div className="flex gap-2">
            <label className="px-3 py-1.5 border border-black/10 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer text-xs">
              <Upload size={14} />
              <span>Импорт</span>
              <input type="file" accept=".json" className="hidden" onChange={handleImportDishes} />
            </label>
            <button 
              onClick={handleExportDishes}
              className="px-3 py-1.5 border border-black/10 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs"
            >
              <Download size={14} />
              <span>Экспорт</span>
            </button>
            {editingId && (
              <button 
                onClick={resetForm}
                className="px-3 py-1.5 border border-black/10 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs"
              >
                <X size={14} />
                <span>Отмена</span>
              </button>
            )}
            <button 
              onClick={handleSave}
              className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 text-xs"
            >
              <Save size={14} />
              <span>{editingId ? 'ОБНОВИТЬ' : 'СОХРАНИТЬ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="max-w-[1600px] mx-auto h-full grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Column 1: Dish List */}
          <div className="lg:col-span-3 flex flex-col min-h-0 bg-white rounded-none border border-black/5 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-black/5 bg-gray-50/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Поиск блюд..." 
                  className="w-full pl-9 pr-4 py-2 bg-white border border-black/10 rounded-none text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-black/5">
              {settings.mealCategories.map(cat => (
                <div key={cat}>
                  <button 
                    onClick={() => toggleCategoryCollapse(cat)}
                    className="w-full bg-gray-50/50 px-4 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest border-y border-black/5 flex items-center justify-between hover:bg-gray-100/50 transition-colors"
                  >
                    <span>{cat} ({groupedDishes[cat].length})</span>
                    <ChevronDown size={12} className={`transition-transform ${collapsedCategories[cat] ? '-rotate-90' : ''}`} />
                  </button>
                  {!collapsedCategories[cat] && groupedDishes[cat].map(dish => (
                    <div key={`${dish.type}-${dish.id}`} className="p-3 hover:bg-gray-50 transition-colors group flex items-center justify-between cursor-pointer" onClick={() => startEditing(dish)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 overflow-hidden border border-black/5">
                          {dish.hasImage ? (
                            <img 
                              src={`/api/images/${dish.type === 'ready_meal' ? 'product' : 'dish'}/${dish.id}`} 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              className="w-full h-full object-cover" 
                              alt={dish.name} 
                            />
                          ) : (
                            <Utensils size={14} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate text-gray-700 group-hover:text-emerald-600 transition-colors">
                            {dish.name}
                          </p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                            {Math.round(dish.kcal)} ккал
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(dish.id, dish.type as any); }}
                          className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {uncategorizedDishes.length > 0 && (
                <div>
                  <button 
                    onClick={() => toggleCategoryCollapse('uncategorized')}
                    className="w-full bg-gray-50/50 px-4 py-2 text-[9px] font-black text-gray-400 uppercase tracking-widest border-y border-black/5 flex items-center justify-between hover:bg-gray-100/50 transition-colors"
                  >
                    <span>Без категории ({uncategorizedDishes.length})</span>
                    <ChevronDown size={12} className={`transition-transform ${collapsedCategories['uncategorized'] ? '-rotate-90' : ''}`} />
                  </button>
                  {!collapsedCategories['uncategorized'] && uncategorizedDishes.map(dish => (
                    <div key={`${dish.type}-${dish.id}`} className="p-3 hover:bg-gray-50 transition-colors group flex items-center justify-between cursor-pointer" onClick={() => startEditing(dish)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 overflow-hidden border border-black/5">
                          {dish.hasImage ? (
                            <img 
                              src={`/api/images/${dish.type === 'ready_meal' ? 'product' : 'dish'}/${dish.id}`} 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              className="w-full h-full object-cover" 
                              alt={dish.name} 
                            />
                          ) : (
                            <Utensils size={14} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate text-gray-700 group-hover:text-emerald-600 transition-colors">
                            {dish.name}
                          </p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                            {Math.round(dish.kcal)} ккал
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(dish.id, dish.type as any); }}
                          className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Ingredient List (Main Work Area) */}
          <div className="lg:col-span-6 flex flex-col min-h-0 bg-white rounded-none border border-black/5 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-black/5 bg-gray-50/30 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Utensils size={16} className="text-emerald-600" />
                <h3 className="font-bold text-gray-700 text-sm tracking-tight">Состав блюда</h3>
              </div>
              {editingType !== 'ready_meal' && (
                <button 
                  onClick={addIngredient}
                  className="bg-emerald-600 text-white px-4 py-1.5 rounded-none font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/10"
                >
                  <Plus size={14} />
                  Добавить продукт
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {editingType === 'ready_meal' ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-6">
                  <div className="w-20 h-20 bg-amber-50 rounded-none flex items-center justify-center text-amber-500">
                    <Info size={40} />
                  </div>
                  <div className="max-w-xs">
                    <h4 className="font-bold text-gray-800 mb-2">Готовое блюдо</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Это блюдо имеет фиксированный состав. Вы можете редактировать его КБЖУ в панели справа или конвертировать в составное.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingType('dish');
                      setIngredients([]);
                    }}
                    className="px-6 py-2.5 text-emerald-600 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-emerald-200 rounded-none hover:bg-emerald-50 hover:border-emerald-300 transition-all"
                  >
                    Перевести в составное блюдо
                  </button>
                </div>
              ) : (
                <>
                  {ingredients.map((ing, index) => {
                    const product = (products || []).find(p => p.id === ing.productId);
                    const ratio = ing.weight / 100;
                    return (
                      <div key={index} className="bg-white border border-black/5 rounded-none p-3 hover:border-emerald-500/30 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <SearchableItemSelect 
                              options={(products || []).filter(p => p.is_ready_meal !== 1)}
                              value={ing.productId}
                              onChange={(id) => updateIngredient(index, id, ing.weight)}
                              onQuickAdd={(name) => handleQuickAddProduct(index, name)}
                              placeholder="Поиск продукта..."
                            />
                          </div>
                          <div className="w-28 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-none border border-black/5">
                            <input 
                              type="number" 
                              className="w-full text-center bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700"
                              value={ing.weight}
                              onChange={(e) => updateIngredient(index, ing.productId, Number(e.target.value))}
                            />
                            <span className="text-gray-400 text-[9px] font-black uppercase">г</span>
                          </div>
                          <button 
                            onClick={() => removeIngredient(index)}
                            className="text-gray-300 hover:text-red-500 p-2 transition-colors shrink-0"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        {product && (
                          <div className="mt-2 flex items-center gap-4 px-1">
                            <div className="flex gap-3 text-[10px] font-bold uppercase tracking-tighter text-gray-400">
                              <span className="bg-gray-50 px-2 py-0.5 rounded border border-black/5">Б: <span className="text-emerald-600">{(product.proteins * ratio).toFixed(1)}</span></span>
                              <span className="bg-gray-50 px-2 py-0.5 rounded border border-black/5">Ж: <span className="text-amber-600">{(product.fats * ratio).toFixed(1)}</span></span>
                              <span className="bg-gray-50 px-2 py-0.5 rounded border border-black/5">У: <span className="text-blue-600">{(product.carbs * ratio).toFixed(1)}</span></span>
                            </div>
                            <div className="ml-auto text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              {(product.kcal * ratio).toFixed(0)} ккал
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {ingredients.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-40">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <Utensils size={40} className="text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Список ингредиентов пуст</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Column 3: Dish Properties & Summary */}
          <div className="lg:col-span-3 flex flex-col min-h-0 space-y-6 overflow-y-auto pr-1">
            {/* Dish Info Card */}
            <div className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm space-y-5 shrink-0">
              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Название блюда</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold"
                  placeholder="Напр. Салат Цезарь"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Фото блюда</label>
                  <div className="relative group/img aspect-square w-full max-w-[120px]">
                    {previewImage ? (
                      <>
                        <img src={previewImage} onError={(e) => { e.currentTarget.style.display = 'none'; }} className="w-full h-full rounded-none object-cover border border-black/10 shadow-sm" alt="Dish" />
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewImage(null); setImageBase64(null); }}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity z-10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full rounded-none bg-gray-50 border-2 border-dashed border-black/10 flex flex-col items-center justify-center text-gray-300 group-hover/img:border-emerald-500/30 transition-colors">
                        <Plus size={24} />
                        <span className="text-[8px] font-bold mt-1 uppercase">Загрузить</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>
                <div className="flex-1">
                   <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Категории</label>
                   <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {settings.mealCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-2 py-1 rounded-none text-[8px] font-black transition-all border ${
                          selectedCategories.includes(cat)
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white text-gray-400 border-black/5 hover:border-emerald-600/50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-white p-5 rounded-none border border-black/5 shadow-sm space-y-6 shrink-0">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Итоговые показатели</h4>
                <div className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-none text-[9px] font-black">
                  {Math.round(totals.kcal)} ккал
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50/50 p-2 rounded-none border border-emerald-100/50 text-center">
                  <p className="text-[8px] font-black text-emerald-600 uppercase mb-0.5">Белки</p>
                  <p className="text-xs font-black text-emerald-700">{totals.p.toFixed(1)}г</p>
                </div>
                <div className="bg-amber-50/50 p-2 rounded-none border border-amber-100/50 text-center">
                  <p className="text-[8px] font-black text-amber-600 uppercase mb-0.5">Жиры</p>
                  <p className="text-xs font-black text-amber-700">{totals.f.toFixed(1)}г</p>
                </div>
                <div className="bg-blue-50/50 p-2 rounded-none border border-blue-100/50 text-center">
                  <p className="text-[8px] font-black text-blue-600 uppercase mb-0.5">Углеводы</p>
                  <p className="text-xs font-black text-blue-700">{totals.c.toFixed(1)}г</p>
                </div>
              </div>

              <div className="pt-4 border-t border-black/5 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Выход блюда</p>
                    <p className="text-[8px] text-gray-400 font-medium italic">Сумма: {Math.round(ingredientsWeight)}г</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1.5 rounded-none border border-black/10">
                      <input 
                        type="number" 
                        className={`w-14 bg-transparent border-none focus:ring-0 text-right font-black text-xs ${Math.abs(portion - ingredientsWeight) > 0.1 ? 'text-amber-600' : 'text-emerald-600'}`}
                        value={portion}
                        onChange={(e) => {
                          setPortion(Number(e.target.value));
                          setIsManualPortion(true);
                        }}
                      />
                      <span className="text-[9px] text-gray-400 font-black uppercase">г</span>
                    </div>
                    {isManualPortion && (
                      <button 
                        onClick={() => setIsManualPortion(false)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Сбросить к весу ингредиентов"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-emerald-600 p-4 rounded-none text-white shadow-lg shadow-emerald-600/20 flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black uppercase opacity-70 tracking-widest">На 100 грамм</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black">{portion > 0 ? Math.round((totals.kcal / portion) * 100) : 0}</span>
                      <span className="text-[10px] font-bold opacity-70 uppercase">ккал</span>
                    </div>
                  </div>
                  <ArrowRight className="opacity-30" size={24} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Quick Add Product Modal */}
      {quickAddProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-none shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="text-xl font-bold">Новый продукт</h3>
              <p className="text-xs text-gray-400">Укажите данные на 100г продукта</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={quickAddProduct.name}
                  onChange={(e) => setQuickAddProduct({ ...quickAddProduct, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Белки</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={quickAddFormData.p}
                    onChange={(e) => setQuickAddFormData({ ...quickAddFormData, p: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Жиры</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={quickAddFormData.f}
                    onChange={(e) => setQuickAddFormData({ ...quickAddFormData, f: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Углеводы</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={quickAddFormData.c}
                    onChange={(e) => setQuickAddFormData({ ...quickAddFormData, c: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ккал</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={quickAddFormData.kcal}
                    onChange={(e) => setQuickAddFormData({ ...quickAddFormData, kcal: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Порция (г)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={quickAddFormData.portion}
                    onChange={(e) => setQuickAddFormData({ ...quickAddFormData, portion: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-black/5 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setQuickAddProduct(null)}
                className="px-6 py-2 text-gray-500 font-medium hover:bg-gray-200 rounded-none transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={submitQuickAddProduct}
                className="px-6 py-2 bg-emerald-600 text-white font-medium hover:bg-emerald-700 rounded-none transition-colors shadow-lg shadow-emerald-600/20"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
