import React, { useState } from 'react';
import { useApp } from '../store';
import { Plus, Search, Trash2, Copy, ExternalLink, Download, Upload, Info, Edit2, Calendar, ArrowUpDown, Filter } from 'lucide-react';

export const Dashboard: React.FC<{ onSelectPlan: () => void }> = ({ onSelectPlan }) => {
  const { plans, createNewPlan, loadPlan, deletePlan, duplicatePlan, loadPlans, showNotification } = useApp();
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newKcal, setNewKcal] = useState(2000);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const filteredPlans = plans
    .filter(p => {
      const name = p.clientName || p.client_name || '';
      return name.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = (a.clientName || a.client_name || '').toLowerCase();
        const nameB = (b.clientName || b.client_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      const dateA = new Date(a.createdAt || a.created_at).getTime();
      const dateB = new Date(b.createdAt || b.created_at).getTime();
      return dateB - dateA;
    });

  const handleCreate = () => {
    if (!newName) return;
    createNewPlan(newName, newKcal, newStartDate, newEndDate);
    setShowNewModal(false);
    onSelectPlan();
  };

  const handleRename = async (plan: any) => {
    if (!editingName.trim()) return;
    const updatedPlan = {
      id: plan.id,
      clientName: editingName,
      targetKcal: plan.targetKcal || plan.target_kcal,
      targetProteins: plan.targetProteins || plan.target_proteins,
      targetFats: plan.targetFats || plan.target_fats,
      targetCarbs: plan.targetCarbs || plan.target_carbs,
      startDate: plan.startDate || plan.start_date,
      endDate: plan.endDate || plan.end_date,
      data: typeof plan.data === 'string' ? JSON.parse(plan.data) : plan.data
    };
    await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPlan)
    });
    setEditingId(null);
    await loadPlans();
    showNotification('Название обновлено', 'success');
  };

  const getPlanStats = (plan: any) => {
    try {
      const data = typeof plan.data === 'string' ? JSON.parse(plan.data) : plan.data;
      if (!data) return { dishes: 0, meals: 0 };
      
      let dishCount = 0;
      let mealCount = 0;
      
      Object.values(data).forEach((day: any) => {
        if (day.meals) {
          mealCount += day.meals.length;
          day.meals.forEach((meal: any) => {
            meal.items.forEach((item: any) => {
              if (item.dishId || item.productId) dishCount++;
            });
          });
        }
      });
      
      return { dishes: dishCount, meals: mealCount };
    } catch (e) {
      return { dishes: 0, meals: 0 };
    }
  };

  const handleExportPlan = async (planId: string) => {
    const res = await fetch(`/api/plans/${planId}`);
    const plan = await res.json();
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NutriPlan_${plan.clientName || plan.client_name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPlans = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const importPromises = Array.from(files as FileList).map((file: File) => {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            let result = event.target?.result;
            if (typeof result !== 'string') return resolve();
            
            // Clean up common malformed JSON issues like "key": ,
            result = result.replace(/:\s*,/g, ': null,');
            
            const content = JSON.parse(result);
            if (content.data && (content.clientName || content.client_name)) {
              await fetch('/api/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(content)
              });
            }
            resolve();
          } catch (err) {
            console.error('Failed to import plan:', err);
            resolve(); // Still resolve to let others continue
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    });

    await Promise.all(importPromises);
    await loadPlans();
    showNotification('Импорт завершен', 'success');
  };

  const handleDeletePlan = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    await deletePlan(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Журнал рационов</h2>
          <p className="text-gray-500">Управляйте рационами ваших клиентов</p>
        </div>
        <div className="flex gap-3">
          <label className="bg-white border border-black/10 text-gray-700 px-6 py-3 rounded-none font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer shadow-sm">
            <Upload size={20} />
            <span>Импорт</span>
            <input type="file" multiple accept=".json" className="hidden" onChange={handleImportPlans} />
          </label>
          <button 
            onClick={() => setShowNewModal(true)}
            className="bg-emerald-600 text-white px-6 py-3 rounded-none font-medium flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Plus size={20} />
            <span>Новый рацион</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-none border border-black/5 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-black/5 bg-gray-50/50 flex flex-wrap gap-4 items-center justify-between">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Поиск по имени клиента..." 
                  className="w-full pl-10 pr-4 py-2 bg-white border border-black/5 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSortBy(sortBy === 'date' ? 'name' : 'date')}
                  className="px-3 py-2 bg-white border border-black/5 rounded-none text-xs font-bold flex items-center gap-2 hover:bg-gray-100 transition-colors"
                >
                  <ArrowUpDown size={14} />
                  {sortBy === 'date' ? 'Сначала новые' : 'По алфавиту'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-black/5">
              {filteredPlans.length > 0 ? filteredPlans.map((plan) => {
                const stats = getPlanStats(plan);
                return (
                <div key={plan.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                      {(plan.clientName || plan.client_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {editingId === plan.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text"
                              className="px-2 py-1 border border-emerald-500 rounded focus:outline-none text-lg font-semibold"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleRename(plan)}
                            />
                            <button onClick={() => handleRename(plan)} className="text-emerald-600 font-bold text-xs uppercase">Ок</button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 font-bold text-xs uppercase">Отмена</button>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-semibold text-lg">{plan.clientName || plan.client_name}</h4>
                            <button 
                              onClick={() => { setEditingId(plan.id); setEditingName(plan.clientName || plan.client_name); }}
                              className="p-1 text-gray-400 hover:text-emerald-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Edit2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                        <span className="font-bold text-emerald-700">{plan.targetKcal || plan.target_kcal} ккал</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <span className="text-[10px] uppercase">Б: {plan.targetProteins || plan.target_proteins || 150} Ж: {plan.targetFats || plan.target_fats || 70} У: {plan.targetCarbs || plan.target_carbs || 250}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <div className="flex items-center gap-1 text-[10px] uppercase text-blue-600 font-bold">
                          <span>{stats.meals} приемов</span>
                          <span>•</span>
                          <span>{stats.dishes} блюд</span>
                        </div>
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Calendar size={10} />
                          <span>{new Date(plan.createdAt || plan.created_at).toLocaleDateString()}</span>
                          {(plan.startDate || plan.start_date) && (
                            <span className="ml-1 text-emerald-600 font-bold">
                              ({new Date(plan.startDate || plan.start_date).toLocaleDateString()} - {new Date(plan.endDate || plan.end_date).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-100 transition-opacity">
                    <button 
                      onClick={() => { loadPlan(plan.id); onSelectPlan(); }}
                      className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-none transition-colors"
                      title="Открыть"
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button 
                      onClick={() => handleExportPlan(plan.id)}
                      className="p-2 hover:bg-blue-100 text-blue-600 rounded-none transition-colors"
                      title="Экспорт"
                    >
                      <Download size={18} />
                    </button>
                    <button 
                      onClick={() => duplicatePlan(plan.id)}
                      className="p-2 hover:bg-blue-100 text-blue-600 rounded-none transition-colors"
                      title="Дублировать"
                    >
                      <Copy size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeletePlan(plan.id)}
                      className={`p-2 rounded-none transition-all ${confirmDeleteId === plan.id ? 'bg-red-600 text-white opacity-100' : 'hover:bg-red-100 text-red-600 opacity-100'}`}
                      title={confirmDeleteId === plan.id ? "Нажмите еще раз" : "Удалить"}
                    >
                      {confirmDeleteId === plan.id ? <span className="text-[10px] font-bold">УДАЛИТЬ?</span> : <Trash2 size={18} />}
                    </button>
                  </div>
                </div>
                );
              }) : (
                <div className="p-12 text-center text-gray-400">
                  Проектов не найдено
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rules Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-none border border-black/5 shadow-sm sticky top-8">
            <div className="flex items-center gap-2 mb-4 text-emerald-600">
              <Info size={20} />
              <h3 className="font-bold uppercase tracking-wider text-xs">Правила импорта</h3>
            </div>
            <div className="space-y-4 text-sm text-gray-600">
              <p>
                <strong className="text-gray-900 block mb-1">Формат файлов:</strong>
                Используйте только файлы <code className="bg-gray-100 px-1 rounded-none">.json</code>, экспортированные из NutriPlan Pro.
              </p>
              <p>
                <strong className="text-gray-900 block mb-1">Массовая загрузка:</strong>
                Вы можете выбрать несколько файлов одновременно при импорте.
              </p>
              <p>
                <strong className="text-gray-900 block mb-1">Дубликаты:</strong>
                При импорте проекта с существующим ID, он будет обновлен.
              </p>
              <div className="p-4 bg-blue-50 rounded-none border border-blue-100 text-blue-700 text-xs">
                Экспортируйте важные рационы для создания резервных копий или передачи коллегам.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Plan Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-none shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="text-xl font-bold">Создать новый рацион</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя клиента</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Напр. Иван Иванов"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Целевой калораж (ккал)</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={newKcal}
                  onChange={(e) => setNewKcal(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 border border-black/10 rounded-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button 
                onClick={() => setShowNewModal(false)}
                className="flex-1 px-4 py-2 border border-black/10 rounded-none font-medium hover:bg-white transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-none font-medium hover:bg-emerald-700 transition-colors"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
