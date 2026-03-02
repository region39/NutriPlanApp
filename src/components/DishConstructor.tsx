import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { Plus, Trash2, Save, Utensils, Edit3, X, Download, Upload, Search } from 'lucide-react';

export const DishConstructor: React.FC = () => {
  const { products, dishes, loadDishes, loadProducts, showNotification } = useApp();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingType, setEditingType] = useState<'dish' | 'ready_meal' | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<{ productId: number | null; weight: number }[]>([]);
  const [portion, setPortion] = useState<number>(0);
  const [isManualPortion, setIsManualPortion] = useState(false);
  const [fixedMacros, setFixedMacros] = useState({ p: 0, f: 0, c: 0, kcal: 0 });

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
    const product = products.find(p => p.id === ing.productId);
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

  const handleSave = async () => {
    if (!name) return;
    
    if (editingType === 'ready_meal') {
      const payload = {
        name,
        proteins: Number(totals.p.toFixed(1)),
        fats: Number(totals.f.toFixed(1)),
        carbs: Number(totals.c.toFixed(1)),
        kcal: Number(totals.kcal.toFixed(1)),
        portion: portion || 100,
        is_ready_meal: 1,
        image
      };
      await fetch(`/api/products/${editingId}`, {
        method: 'PUT',
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
        image
      };

      const url = editingId ? `/api/dishes/${editingId}` : '/api/dishes';
      const method = editingId ? 'PUT' : 'POST';

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

  const resetForm = () => {
    setEditingId(null);
    setEditingType(null);
    setName('');
    setImage(null);
    setIngredients([]);
    setPortion(0);
    setIsManualPortion(false);
    setFixedMacros({ p: 0, f: 0, c: 0, kcal: 0 });
  };

  const startEditing = async (dish: any) => {
    setEditingId(dish.id);
    setEditingType(dish.type || 'dish');
    setName(dish.name);
    setImage(dish.image || null);
    
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
    reader.onloadend = async () => {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: reader.result })
      });
      const data = await res.json();
      if (data.url) {
        setImage(data.url);
      }
    };
    reader.readAsDataURL(file);
  };

  const allDishes = [
    ...dishes.map(d => ({ ...d, type: 'dish' })),
    ...products.filter(p => p.is_ready_meal === 1).map(p => ({ ...p, type: 'ready_meal' }))
  ].filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
   .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Конструктор блюд</h2>
          <p className="text-gray-500">Создавайте и редактируйте сложные блюда</p>
        </div>
        <div className="flex gap-2">
          <label className="px-6 py-3 border border-black/10 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer">
            <Upload size={20} />
            <span>Импорт</span>
            <input type="file" accept=".json" className="hidden" onChange={handleImportDishes} />
          </label>
          <button 
            onClick={handleExportDishes}
            className="px-6 py-3 border border-black/10 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download size={20} />
            <span>Экспорт</span>
          </button>
          {editingId && (
            <button 
              onClick={resetForm}
              className="px-6 py-3 border border-black/10 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X size={20} />
              <span>Отмена</span>
            </button>
          )}
          <button 
            onClick={handleSave}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Save size={20} />
            <span>{editingId ? 'Обновить блюдо' : 'Сохранить блюдо'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Dish List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-black/5 bg-gray-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Поиск блюд..." 
                  className="w-full pl-9 pr-4 py-2 bg-white border border-black/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-[600px] overflow-auto divide-y divide-black/5">
              {allDishes.map(dish => (
                <div key={`${dish.type}-${dish.id}`} className="p-4 hover:bg-gray-50 transition-colors group flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {dish.image ? (
                      <img src={dish.image} className="w-10 h-10 rounded-lg object-cover border border-black/5" alt={dish.name} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                        <Utensils size={16} />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm flex items-center gap-1">
                        {dish.name}
                        {dish.type === 'ready_meal' && <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1 rounded">ГОТОВОЕ</span>}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                        {Math.round(dish.kcal)} ккал / {dish.portion} г/мл
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleExportSingleDish(dish)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Экспорт"
                    >
                      <Download size={16} />
                    </button>
                    <button 
                      onClick={() => startEditing(dish)}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      title="Редактировать"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(dish.id, dish.type as any)}
                      className={`p-2 rounded-lg transition-all ${confirmDeleteId === dish.id ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                      title={confirmDeleteId === dish.id ? "Нажмите еще раз для удаления" : "Удалить"}
                    >
                      {confirmDeleteId === dish.id ? <span className="text-[10px] font-bold">УДАЛИТЬ?</span> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              {allDishes.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Список блюд пуст
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Editor */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Название блюда</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-lg font-medium"
                  placeholder="Напр. Салат Цезарь"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="shrink-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">Фото</label>
                <div className="relative group/img">
                  {image ? (
                    <img src={image} className="w-[100px] h-[100px] rounded-xl object-cover border border-black/10" alt="Dish" />
                  ) : (
                    <div className="w-[100px] h-[100px] rounded-xl bg-gray-50 border border-dashed border-black/20 flex items-center justify-center text-gray-400">
                      <Plus size={24} />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleImageUpload}
                  />
                  {image && (
                    <button 
                      onClick={() => setImage(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/img:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-black/5 bg-gray-50/50 flex justify-between items-center">
              <h3 className="font-bold text-gray-700">Ингредиенты</h3>
              {editingType !== 'ready_meal' && (
                <button 
                  onClick={addIngredient}
                  className="text-emerald-600 hover:text-emerald-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1"
                >
                  <Plus size={14} />
                  Добавить
                </button>
              )}
            </div>
            <div className="divide-y divide-black/5">
              {editingType === 'ready_meal' ? (
                <div className="p-6 space-y-4">
                  <p className="text-xs text-amber-600 font-medium bg-amber-50 p-3 rounded-xl border border-amber-100">
                    Это готовое блюдо с фиксированным составом. Вы можете изменить его КБЖУ напрямую.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Белки</label>
                      <input 
                        type="number" 
                        className="w-full px-3 py-2 bg-gray-50 border border-black/10 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        value={fixedMacros.p}
                        onChange={(e) => setFixedMacros({ ...fixedMacros, p: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Жиры</label>
                      <input 
                        type="number" 
                        className="w-full px-3 py-2 bg-gray-50 border border-black/10 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        value={fixedMacros.f}
                        onChange={(e) => setFixedMacros({ ...fixedMacros, f: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Углеводы</label>
                      <input 
                        type="number" 
                        className="w-full px-3 py-2 bg-gray-50 border border-black/10 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        value={fixedMacros.c}
                        onChange={(e) => setFixedMacros({ ...fixedMacros, c: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ккал</label>
                      <input 
                        type="number" 
                        className="w-full px-3 py-2 bg-gray-50 border border-black/10 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        value={fixedMacros.kcal}
                        onChange={(e) => setFixedMacros({ ...fixedMacros, kcal: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingType('dish');
                      setIngredients([]);
                    }}
                    className="w-full py-2 text-emerald-600 text-xs font-bold uppercase tracking-wider border border-dashed border-emerald-200 rounded-xl hover:bg-emerald-50 transition-colors"
                  >
                    Перевести в составное блюдо
                  </button>
                </div>
              ) : (
                <>
                  {ingredients.map((ing, index) => {
                    const product = products.find(p => p.id === ing.productId);
                    const ratio = ing.weight / 100;
                    return (
                      <div key={index} className="p-4 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <select 
                              className="w-full bg-transparent border-none focus:ring-0 font-medium text-sm truncate"
                              value={ing.productId || ''}
                              onChange={(e) => updateIngredient(index, e.target.value ? Number(e.target.value) : null, ing.weight)}
                            >
                              <option value="">Выберите продукт...</option>
                              {products.filter(p => p.is_ready_meal !== 1).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 bg-gray-50 px-2 py-1 rounded-lg border border-black/5">
                            <input 
                              type="number" 
                              className="w-16 text-center bg-transparent border-none focus:ring-0 text-sm font-bold"
                              value={ing.weight}
                              onChange={(e) => updateIngredient(index, ing.productId, Number(e.target.value))}
                            />
                            <span className="text-gray-400 text-[10px] font-bold uppercase">г</span>
                          </div>
                          <button 
                            onClick={() => removeIngredient(index)}
                            className="text-red-400 hover:text-red-600 p-1 shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        {product && (
                          <div className="flex gap-3 px-1 text-[10px] font-medium text-gray-400">
                            <span>Б: {(product.proteins * ratio).toFixed(1)}</span>
                            <span>Ж: {(product.fats * ratio).toFixed(1)}</span>
                            <span>У: {(product.carbs * ratio).toFixed(1)}</span>
                            <span className="text-emerald-600 font-bold">{(product.kcal * ratio).toFixed(1)} ккал</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {ingredients.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                      Добавьте ингредиенты для расчета КБЖУ
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm sticky top-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-6 flex items-center gap-2">
              <Utensils size={16} />
              Итого на выход
            </h3>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Вес ингредиентов</span>
                  <span className="font-medium text-gray-400 text-xs">{Math.round(ingredientsWeight)} г</span>
                </div>
                <div className={`flex justify-between items-center p-2 rounded-lg border mt-1 transition-all ${Math.abs(portion - ingredientsWeight) > 0.1 ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-emerald-50 border-emerald-100'}`}>
                  <span className={`${Math.abs(portion - ingredientsWeight) > 0.1 ? 'text-amber-900' : 'text-emerald-900'} text-xs font-bold`}>Выход блюда</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      className={`w-16 bg-white border rounded px-1 py-0.5 text-right font-black text-sm focus:ring-1 outline-none ${Math.abs(portion - ingredientsWeight) > 0.1 ? 'border-amber-300 text-amber-700 focus:ring-amber-500' : 'border-emerald-200 text-emerald-700 focus:ring-emerald-500'}`}
                      value={portion}
                      onChange={(e) => {
                        setPortion(Number(e.target.value));
                        setIsManualPortion(true);
                      }}
                    />
                    <span className={`${Math.abs(portion - ingredientsWeight) > 0.1 ? 'text-amber-600' : 'text-emerald-600'} text-[10px] font-bold`}>г/мл</span>
                  </div>
                </div>
                {isManualPortion && (
                  <button 
                    onClick={() => setIsManualPortion(false)}
                    className={`text-[9px] mt-1 text-right font-bold transition-colors ${Math.abs(portion - ingredientsWeight) > 0.1 ? 'text-amber-600 hover:text-amber-700 underline decoration-amber-300 underline-offset-2' : 'text-emerald-600 hover:underline'}`}
                  >
                    {Math.abs(portion - ingredientsWeight) > 0.1 ? '⚠️ Вес не совпадает! Сбросить?' : 'Сбросить к весу ингредиентов'}
                  </button>
                )}
              </div>
              <div className="h-px bg-black/5"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Белки</span>
                <span className="font-bold text-emerald-600">{totals.p.toFixed(1)} г</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Жиры</span>
                <span className="font-bold text-amber-600">{totals.f.toFixed(1)} г</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Углеводы</span>
                <span className="font-bold text-blue-600">{totals.c.toFixed(1)} г</span>
              </div>
              <div className="h-px bg-black/5"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-bold">Калорийность</span>
                <span className="text-xl font-black text-emerald-700">{Math.round(totals.kcal)} ккал</span>
              </div>
            </div>

            <div className="mt-8 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">На 100 грамм</p>
              <p className="text-sm font-medium text-emerald-900">
                {portion > 0 ? Math.round((totals.kcal / portion) * 100) : 0} ккал
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
