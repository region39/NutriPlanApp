import React, { useState } from 'react';
import { useApp } from '../store';
import { Plus, Search, Trash2, Edit3, X, Save, Download, Upload } from 'lucide-react';
import { Product } from '../types';

export const Database: React.FC = () => {
  const { products, loadProducts, showNotification } = useApp();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    proteins: 0,
    fats: 0,
    carbs: 0,
    kcal: 0,
    portion: 100,
    is_ready_meal: 0,
    image: null as string | null
  });

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
        setFormData(prev => ({ ...prev, image: data.url }));
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) && 
    p.is_ready_meal !== 1
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        proteins: product.proteins,
        fats: product.fats,
        carbs: product.carbs,
        kcal: product.kcal,
        portion: product.portion,
        is_ready_meal: product.is_ready_meal || 0,
        image: product.image || null
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', proteins: 0, fats: 0, carbs: 0, kcal: 0, portion: 100, is_ready_meal: 0, image: null });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    const method = editingProduct ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    await loadProducts();
    setShowModal(false);
    showNotification(editingProduct ? 'Продукт обновлен!' : 'Продукт добавлен!', 'success');
  };

  const handleDelete = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadProducts();
        showNotification('Продукт удален', 'success');
        setConfirmDeleteId(null);
      } else {
        showNotification('Ошибка при удалении продукта', 'error');
      }
    } catch (err) {
      showNotification('Ошибка сети при удалении', 'error');
    }
  };

  const handleExportProducts = () => {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NutriPlan_Products.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProducts = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          
          const productsToImport = Array.isArray(content) ? content : [content];
          
          for (const product of productsToImport) {
            if (!product.name) continue;
            await fetch('/api/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(product)
            });
          }
          resolve();
        } catch (err) {
          console.error('Failed to import products:', err);
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });

    try {
      await importPromise;
      await loadProducts();
      showNotification('Импорт продуктов завершен', 'success');
    } catch (err) {
      showNotification('Ошибка при импорте', 'error');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">База продуктов</h2>
          <p className="text-gray-500">Справочник КБЖУ на 100г продукта</p>
        </div>
        <div className="flex gap-2">
          <label className="px-6 py-3 border border-black/10 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer">
            <Upload size={20} />
            <span>Импорт</span>
            <input type="file" accept=".json" className="hidden" onChange={handleImportProducts} />
          </label>
          <button 
            onClick={handleExportProducts}
            className="px-6 py-3 border border-black/10 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download size={20} />
            <span>Экспорт</span>
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Plus size={20} />
            <span>Добавить продукт</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-black/5 bg-gray-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Поиск по названию..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-black/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wider font-bold text-gray-400">
              <tr>
                <th className="p-4">Название</th>
                <th className="p-4 text-center">Белки</th>
                <th className="p-4 text-center">Жиры</th>
                <th className="p-4 text-center">Углеводы</th>
                <th className="p-4 text-center">Ккал</th>
                <th className="p-4 text-center">Порция (г)</th>
                <th className="p-4 text-center">Готовое</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filteredProducts.map((product) => (
                <tr key={product.id} className={`hover:bg-gray-50 transition-colors group ${product.is_ready_meal === 1 ? 'bg-emerald-50/30' : ''}`}>
                  <td className="p-4 font-medium">{product.name}</td>
                  <td className="p-4 text-center text-gray-500">{product.proteins}</td>
                  <td className="p-4 text-center text-gray-500">{product.fats}</td>
                  <td className="p-4 text-center text-gray-500">{product.carbs}</td>
                  <td className="p-4 text-center font-bold text-emerald-600">{product.kcal}</td>
                  <td className="p-4 text-center text-gray-500">{product.portion}</td>
                  <td className="p-4 text-center">
                    {product.is_ready_meal === 1 && (
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full" title="Готовое блюдо">
                        <Save size={12} />
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg"
                        title="Редактировать"
                      >
                        <Edit3 size={16} />
                      </button>
                      {product.is_custom === 1 && (
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className={`p-2 rounded-lg transition-all ${confirmDeleteId === product.id ? 'bg-red-600 text-white' : 'text-red-400 hover:bg-red-50'}`}
                          title={confirmDeleteId === product.id ? "Нажмите еще раз для удаления" : "Удалить"}
                        >
                          {confirmDeleteId === product.id ? <span className="text-[10px] font-bold">УДАЛИТЬ?</span> : <Trash2 size={16} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="text-xl font-bold">{editingProduct ? 'Редактировать продукт' : 'Новый продукт'}</h3>
              <p className="text-xs text-gray-400">Укажите данные на 100г продукта</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Белки</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={formData.proteins}
                    onChange={(e) => setFormData({ ...formData, proteins: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Жиры</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={formData.fats}
                    onChange={(e) => setFormData({ ...formData, fats: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Углеводы</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={formData.carbs}
                    onChange={(e) => setFormData({ ...formData, carbs: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ккал</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={formData.kcal}
                    onChange={(e) => setFormData({ ...formData, kcal: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Порция (г)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={formData.portion}
                    onChange={(e) => setFormData({ ...formData, portion: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Изображение (100x100)</label>
                  <div className="flex items-center gap-4">
                    {formData.image && (
                      <img src={formData.image} className="w-[100px] h-[100px] rounded-xl object-cover border border-black/5" alt="Preview" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-emerald-600 border-black/10 rounded-lg focus:ring-emerald-500/20"
                      checked={formData.is_ready_meal === 1}
                      onChange={(e) => setFormData({ ...formData, is_ready_meal: e.target.checked ? 1 : 0 })}
                    />
                    <span className="text-sm font-medium text-gray-700">Это готовое блюдо (попадает в конструктор)</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-black/10 rounded-xl font-medium hover:bg-white transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={18} />
                <span>{editingProduct ? 'Обновить' : 'Добавить'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
