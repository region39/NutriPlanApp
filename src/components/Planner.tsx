import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../store';
import { DAYS } from '../constants';
import { Plus, Save, Download, FileText, PieChart as PieIcon, Activity, Printer, Target, Trash2, AlertCircle, CheckCircle, Info, Edit2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toPng, toCanvas } from 'html-to-image';
import { SearchableItemSelect } from './SearchableItemSelect';

export const Planner: React.FC = () => {
  const { currentPlan, updatePlan, savePlan, products, dishes, settings, loadProducts, loadDishes, showNotification } = useApp();
  const [isExporting, setIsExporting] = useState(false);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [confirmMealDeleteId, setConfirmMealDeleteId] = useState<string | null>(null);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProducts();
    loadDishes();
    if (currentPlan) {
      setEditName(currentPlan.clientName);
      setEditStartDate(currentPlan.startDate || '');
      setEditEndDate(currentPlan.endDate || '');
    }
  }, [currentPlan?.id]);

  useEffect(() => {
    if (currentPlan) {
      console.log('Planner: currentPlan state changed', {
        meals: Object.values(currentPlan.data).map((d: any) => d.meals?.length)
      });
    }
  }, [currentPlan]);

  const handleWeightChange = (dayId: string, mealType: string, itemId: string, weight: number) => {
    if (!currentPlan || !currentPlan.data || !currentPlan.data[dayId]) return;
    
    const newPlan = JSON.parse(JSON.stringify(currentPlan));
    const dayData = newPlan.data[dayId];
    if (!dayData || !dayData.meals) return;

    const meal = (dayData?.meals || []).find((m: any) => m.type === mealType);
    if (!meal || !meal.items) return;
    
    const item = (meal?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;

    item.weight = weight;
    
    if (settings.calculationMethod === 'manual') {
      updatePlan(newPlan);
      return;
    }

    if (item.productId) {
      const product = (products || []).find(p => p.id === item.productId);
      if (product) {
        if (settings.calculationMethod === 'fixed') {
          item.proteins = product.proteins;
          item.fats = product.fats;
          item.carbs = product.carbs;
          item.kcal = product.kcal;
        } else {
          const ratio = weight / 100;
          item.proteins = Number((product.proteins * ratio).toFixed(1));
          item.fats = Number((product.fats * ratio).toFixed(1));
          item.carbs = Number((product.carbs * ratio).toFixed(1));
          item.kcal = Number((product.kcal * ratio).toFixed(1));
        }
      }
    } else if (item.dishId) {
      const dish = (dishes || []).find(d => d.id === item.dishId);
      if (dish) {
        if (settings.calculationMethod === 'fixed') {
          item.proteins = dish.proteins;
          item.fats = dish.fats;
          item.carbs = dish.carbs;
          item.kcal = dish.kcal;
        } else {
          const dishPortion = dish.portion || 100;
          const ratio = weight / dishPortion;
          item.proteins = Number((dish.proteins * ratio).toFixed(1));
          item.fats = Number((dish.fats * ratio).toFixed(1));
          item.carbs = Number((dish.carbs * ratio).toFixed(1));
          item.kcal = Number((dish.kcal * ratio).toFixed(1));
        }
      }
    }
    
    updatePlan(newPlan);
  };

  const handleItemSelect = (dayId: string, mealType: string, itemId: string, value: string) => {
    if (!currentPlan || !currentPlan.data || !currentPlan.data[dayId]) return;
    const newPlan = JSON.parse(JSON.stringify(currentPlan));
    const dayData = newPlan.data[dayId];
    if (!dayData || !dayData.meals) return;

    const meal = (dayData?.meals || []).find((m: any) => m.type === mealType);
    if (!meal || !meal.items) return;
    
    const item = (meal?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;

    const [type, id] = value.split(':');
    const numericId = Number(id);

    if (type === 'product') {
      const product = (products || []).find(p => p.id === numericId);
      if (product) {
        item.productId = numericId;
        item.dishId = undefined;
        item.name = product.name;
        const defaultWeight = product.portion || 100;
        item.weight = defaultWeight;
        
        if (settings.calculationMethod === 'fixed') {
          item.proteins = product.proteins;
          item.fats = product.fats;
          item.carbs = product.carbs;
          item.kcal = product.kcal;
        } else {
          const ratio = defaultWeight / 100;
          item.proteins = Number((product.proteins * ratio).toFixed(1));
          item.fats = Number((product.fats * ratio).toFixed(1));
          item.carbs = Number((product.carbs * ratio).toFixed(1));
          item.kcal = Number((product.kcal * ratio).toFixed(1));
        }
      }
    } else if (type === 'dish') {
      const dish = (dishes || []).find(d => d.id === numericId);
      if (dish) {
        item.dishId = numericId;
        item.productId = undefined;
        item.name = dish.name;
        const defaultWeight = dish.portion || 100;
        item.weight = defaultWeight;
        
        if (settings.calculationMethod === 'fixed') {
          item.proteins = dish.proteins;
          item.fats = dish.fats;
          item.carbs = dish.carbs;
          item.kcal = dish.kcal;
        } else {
          // Since defaultWeight is dish.portion, ratio is 1
          item.proteins = dish.proteins;
          item.fats = dish.fats;
          item.carbs = dish.carbs;
          item.kcal = dish.kcal;
        }
      }
    }
    
    updatePlan(newPlan);
  };

  const removeItem = (dayId: string, mealType: string, itemId: string) => {
    if (!currentPlan || !currentPlan.data || !currentPlan.data[dayId]) return;
    const newPlan = JSON.parse(JSON.stringify(currentPlan));
    const dayData = newPlan.data[dayId];
    if (!dayData || !dayData.meals) return;

    const meal = (dayData?.meals || []).find((m: any) => m.type === mealType);
    if (!meal || !meal.items) return;
    meal.items = meal.items.filter((i: any) => i.id !== itemId);
    updatePlan(newPlan);
  };

  const addOtherRow = (dayId: string, mealType: string, name: string = 'Другое') => {
    if (!currentPlan || !currentPlan.data || !currentPlan.data[dayId]) return;
    const newPlan = JSON.parse(JSON.stringify(currentPlan));
    const dayData = newPlan.data[dayId];
    if (!dayData) return;
    
    if (!dayData.meals) dayData.meals = [];
    let meal = (dayData?.meals || []).find((m: any) => m.type === mealType);
    if (!meal) {
      meal = { type: mealType, items: [] };
      dayData.meals.push(meal);
    }

    meal.items.push({
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      categoryName: name,
      weight: 0,
      proteins: 0,
      fats: 0,
      carbs: 0,
      kcal: 0
    });
    
    updatePlan(newPlan);
  };

  const removeMealBlock = (mealTypeId: string) => {
    if (!currentPlan) return;
    
    if (confirmMealDeleteId !== mealTypeId) {
      setConfirmMealDeleteId(mealTypeId);
      setTimeout(() => setConfirmMealDeleteId(null), 3000);
      return;
    }
    
    const newPlan = JSON.parse(JSON.stringify(currentPlan));
    Object.keys(newPlan.data).forEach(dayId => {
      if (newPlan.data[dayId] && newPlan.data[dayId].meals) {
        newPlan.data[dayId].meals = newPlan.data[dayId].meals.filter((m: any) => m.type !== mealTypeId);
      }
    });
    updatePlan(newPlan);
    showNotification('Прием пищи удален', 'success');
    setConfirmMealDeleteId(null);
  };

  const addMealBlock = (mealTypeId: string) => {
    if (!currentPlan) return;
    console.log('Adding meal block:', mealTypeId);
    const newPlan = JSON.parse(JSON.stringify(currentPlan));
    if (!newPlan.data) newPlan.data = {};
    
    DAYS.forEach(day => {
      const dayId = day.id;
      if (!newPlan.data[dayId]) {
        newPlan.data[dayId] = { meals: [] };
      }
      if (!newPlan.data[dayId].meals) {
        newPlan.data[dayId].meals = [];
      }
      
      const exists = (newPlan.data[dayId].meals || []).find((m: any) => m.type === mealTypeId);
      if (!exists) {
        const categories = mealTypeId === 'dinner' ? planMealCategories : [planMealCategories[0]];
        newPlan.data[dayId].meals.push({
          type: mealTypeId,
          items: categories.map(cat => ({
            id: Math.random().toString(36).substr(2, 9),
            name: cat,
            categoryName: cat,
            weight: 0,
            proteins: 0,
            fats: 0,
            carbs: 0,
            kcal: 0
          }))
        });
      }
    });
    updatePlan(newPlan);
  };

  const getDayTotals = (dayId: string) => {
    if (!currentPlan) return { p: 0, f: 0, c: 0, kcal: 0 };
    const day = currentPlan.data[dayId];
    if (!day || !day.meals) return { p: 0, f: 0, c: 0, kcal: 0 };
    let p = 0, f = 0, c = 0, kcal = 0;
    day.meals.forEach(meal => {
      meal.items.forEach(item => {
        p += item.proteins;
        f += item.fats;
        c += item.carbs;
        kcal += item.kcal;
      });
    });
    return { p: Math.round(p), f: Math.round(f), c: Math.round(c), kcal: Math.round(kcal) };
  };

  const handleManualValueChange = (dayId: string, mealType: string, itemId: string, field: string, value: number) => {
    if (!currentPlan || !currentPlan.data || !currentPlan.data[dayId]) return;
    const newPlan = JSON.parse(JSON.stringify(currentPlan));
    const dayData = newPlan.data[dayId];
    if (!dayData || !dayData.meals) return;

    const meal = (dayData?.meals || []).find((m: any) => m.type === mealType);
    if (!meal || !meal.items) return;
    const item = (meal?.items || []).find((i: any) => i.id === itemId);
    if (!item) return;
    (item as any)[field] = value;
    updatePlan(newPlan);
  };

  const handleTargetChange = (field: string, value: number) => {
    if (!currentPlan) return;
    const newPlan = { ...currentPlan, [field]: value };
    updatePlan(newPlan);
  };

  const exportPDF = async () => {
    if (!tableRef.current || !currentPlan) return;
    setIsExporting(true);
    try {
      const element = tableRef.current;
      
      // Use a higher pixel ratio for better quality
      const dataUrl = await toPng(element, { 
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(dataUrl);
      // Calculate how many pages we need if it's too tall, or just scale to fit one page
      // For now, let's scale to fit width and allow multiple pages if needed, 
      // but usually a diet plan fits on one landscape page if scaled down.
      const ratio = Math.min((pdfWidth - 10) / imgProps.width, (pdfHeight - 10) / imgProps.height);
      const w = imgProps.width * ratio;
      const h = imgProps.height * ratio;
      
      pdf.addImage(dataUrl, 'PNG', 5, 5, w, h);
      pdf.save(`NutriPlan_${currentPlan.clientName}.pdf`);
      showNotification('PDF отчет успешно создан!', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Ошибка при генерации PDF', 'error');
    }
    setIsExporting(false);
  };

  const exportExcel = () => {
    if (!currentPlan) return;
    try {
      const wb = XLSX.utils.book_new();
      const wsData: any[] = [];

      // Header
      wsData.push([`Рацион: ${currentPlan.clientName}`]);
      wsData.push([`Цель: ${currentPlan.targetKcal} ккал`]);
      wsData.push([]);

      const headers = ['Прием', ...DAYS.map(d => d.label)];
      wsData.push(headers);

      activeMealTypes.forEach(mealType => {
        const row: any[] = [mealType.label];
        DAYS.forEach(day => {
          const meal = (currentPlan.data[day.id].meals || []).find(m => m.type === mealType.id);
          const itemsText = meal?.items
            .filter(i => i.weight > 0 || i.name.trim() !== '')
            .map(i => `${i.name}${i.weight > 0 ? ` (${i.weight}г)` : ''}`)
            .join(', ') || '-';
          row.push(itemsText);
        });
        wsData.push(row);
      });

      wsData.push([]);
      const totalsRow: (string | number)[] = ['ИТОГО (ккал)'];
      DAYS.forEach(day => {
        const totals = getDayTotals(day.id);
        totalsRow.push(totals.kcal);
      });
      wsData.push(totalsRow);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "План питания");

      // Sheet 2: Recipes
      const recipesData: any[] = [];
      recipesData.push(['РЕЦЕПТЫ БЛЮД']);
      recipesData.push([]);
      
      const usedDishIds = new Set<number>();
      (Object.values(currentPlan.data) as any[]).forEach(day => {
        day.meals.forEach((meal: any) => {
          meal.items.forEach((item: any) => {
            if (item.dishId) usedDishIds.add(item.dishId);
          });
        });
      });

      usedDishIds.forEach(id => {
        const dish = (dishes || []).find(d => d.id === id);
        if (dish) {
          recipesData.push([dish.name.toUpperCase()]);
          recipesData.push([`Выход: ${dish.portion} г/мл`]);
          recipesData.push(['Ингредиент', 'Вес (г)']);
          if (dish.ingredients) {
            dish.ingredients.forEach(ing => {
              const product = (products || []).find(p => p.id === ing.productId);
              recipesData.push([product?.name || '?', ing.weight]);
            });
          }
          recipesData.push([]); // Empty line between recipes
        }
      });

      if (usedDishIds.size > 0) {
        const wsRecipes = XLSX.utils.aoa_to_sheet(recipesData);
        XLSX.utils.book_append_sheet(wb, wsRecipes, "Рецепты");
      }

      XLSX.writeFile(wb, `NutriPlan_${currentPlan.clientName}.xlsx`);
      showNotification('Excel файл успешно создан!', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Ошибка при создании Excel', 'error');
    }
  };

  const exportMarkdown = () => {
    if (!currentPlan) return;
    try {
      let md = `# План питания: ${currentPlan.clientName}\n\n`;
      md += `**Цель:** ${currentPlan.targetKcal} ккал\n\n`;

      md += `| Прием | ${DAYS.map(d => d.label).join(' | ')} |\n`;
      md += `| :--- | ${DAYS.map(() => ':---').join(' | ')} |\n`;

      activeMealTypes.forEach(mealType => {
        let row = `| **${mealType.label}** | `;
        const dayCells = DAYS.map(day => {
          const meal = (currentPlan.data[day.id].meals || []).find(m => m.type === mealType.id);
          return meal?.items
            .filter(i => i.weight > 0 || i.name.trim() !== '')
            .map(i => `${i.name}${i.weight > 0 ? ` (${i.weight}г)` : ''}`)
            .join('<br>') || '-';
        });
        row += dayCells.join(' | ') + ' |\n';
        md += row;
      });

      md += `| **ИТОГО (ккал)** | ${DAYS.map(day => getDayTotals(day.id).kcal).join(' | ')} |\n\n`;

      // Recipes section
      const usedDishIdsMarkdown = new Set<number>();
      (Object.values(currentPlan.data) as any[]).forEach(day => {
        day.meals.forEach((meal: any) => {
          meal.items.forEach((item: any) => {
            if (item.dishId) usedDishIdsMarkdown.add(item.dishId);
          });
        });
      });

      if (usedDishIdsMarkdown.size > 0) {
        md += `## Рецепты\n\n`;
        usedDishIdsMarkdown.forEach(id => {
          const dish = (dishes || []).find(d => d.id === id);
          if (dish) {
            md += `### ${dish.name}\n`;
            md += `**Выход:** ${dish.portion} г/мл\n\n`;
            if (dish.ingredients && dish.ingredients.length > 0) {
              md += `**Ингредиенты:**\n\n`;
              dish.ingredients.forEach(ing => {
                const product = (products || []).find(p => p.id === ing.productId);
                md += `- ${product?.name || 'Неизвестный продукт'}: ${ing.weight}г\n`;
              });
            }
            md += `\n---\n\n`;
          }
        });
      }

      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NutriPlan_${currentPlan.clientName}.md`;
      link.click();
      URL.revokeObjectURL(url);
      showNotification('Markdown файл успешно создан!', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Ошибка при создании Markdown', 'error');
    }
  };

  const exportImage = async () => {
    if (!tableRef.current || !currentPlan) return;
    setIsExporting(true);
    try {
      const element = tableRef.current;
      
      const dataUrl = await toPng(element, { 
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `NutriPlan_${currentPlan.clientName}.png`;
      link.href = dataUrl;
      link.click();
      showNotification('Изображение успешно сохранено!', 'success');
    } catch (e) {
      console.error(e);
      showNotification('Ошибка при сохранении картинки', 'error');
    }
    setIsExporting(false);
  };

  // Calculate which meal types are active in the current plan
  const activeMealTypes = useMemo(() => {
    if (!currentPlan || !currentPlan.data) return [];
    
    // 1. Get types from currentPlan.mealTypes (per-plan settings)
    const planMealTypes = [...(currentPlan.mealTypes || settings.mealTypes)];
    
    // 2. Find all types that actually have data in the plan
    const typesWithData = new Set<string>();
    Object.values(currentPlan.data).forEach((day: any) => {
      if (day && day.meals) {
        day.meals.forEach((m: any) => {
          // Check if meal has items
          if (m.type && m.items && m.items.length > 0) {
            // Only consider it "having data" if at least one item has a name or weight
            const hasData = m.items.some((i: any) => i.name.trim() !== '' || i.weight > 0 || i.kcal > 0);
            if (hasData) {
              typesWithData.add(m.type);
            }
          }
        });
      }
    });
    
    // 3. Ensure all types with data are included even if removed from settings
    typesWithData.forEach(typeId => {
      if (!(planMealTypes || []).find(mt => mt.id === typeId)) {
        const globalType = (settings.mealTypes || []).find(mt => mt.id === typeId);
        planMealTypes.push({ 
          id: typeId, 
          label: (globalType?.label || typeId) + ' (Удалено)'
        });
      }
    });
    
    return planMealTypes;
  }, [currentPlan, settings.mealTypes]);

  const planMealCategories = useMemo(() => {
    return currentPlan?.mealCategories || settings.mealCategories;
  }, [currentPlan, settings.mealCategories]);

  // Calculate weekly average for charts
  const weeklyAverage = useMemo(() => {
    if (!currentPlan) return { p: 0, f: 0, c: 0, kcal: 0 };
    const totals = DAYS.map(d => getDayTotals(d.id));
    const avg = {
      p: Math.round(totals.reduce((a, b) => a + b.p, 0) / 7),
      f: Math.round(totals.reduce((a, b) => a + b.f, 0) / 7),
      c: Math.round(totals.reduce((a, b) => a + b.c, 0) / 7),
      kcal: Math.round(totals.reduce((a, b) => a + b.kcal, 0) / 7),
    };
    return avg;
  }, [currentPlan, products, dishes]);

  const handleSaveHeader = () => {
    if (!currentPlan) return;
    const newPlan = {
      ...currentPlan,
      clientName: editName,
      startDate: editStartDate,
      endDate: editEndDate
    };
    updatePlan(newPlan);
    setIsEditingHeader(false);
    showNotification('Данные обновлены', 'success');
  };

  const getDayDate = (dayIndex: number) => {
    if (!currentPlan?.startDate) return null;
    try {
      // Parse YYYY-MM-DD manually to avoid timezone shifts
      const [year, month, day] = currentPlan.startDate.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      
      // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
      const startJsDay = start.getDay();
      // Normalized: 0=Mon, ..., 6=Sun
      const startNormalizedDay = startJsDay === 0 ? 6 : startJsDay - 1;
      
      // Find the Monday of the week containing the startDate
      const monday = new Date(start);
      monday.setDate(start.getDate() - startNormalizedDay);
      
      // Add dayIndex to that Monday
      const targetDate = new Date(monday);
      targetDate.setDate(monday.getDate() + dayIndex);
      
      // Format as DD.MM
      const d = targetDate.getDate().toString().padStart(2, '0');
      const m = (targetDate.getMonth() + 1).toString().padStart(2, '0');
      return `${d}.${m}`;
    } catch (e) {
      return null;
    }
  };

  if (!currentPlan) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
        <FileText size={64} className="mb-4 opacity-20" />
        <h3 className="text-xl font-medium">Рацион не выбран</h3>
        <p>Выберите проект в журнале или создайте новый</p>
      </div>
    );
  }

  const achievementData = [
    { 
      name: 'Ккал', 
      Факт: weeklyAverage.kcal, 
      Цель: currentPlan.targetKcal,
      'Остаток': Math.max(0, currentPlan.targetKcal - weeklyAverage.kcal)
    },
    { 
      name: 'Б', 
      Факт: weeklyAverage.p, 
      Цель: currentPlan.targetProteins || 150,
      'Остаток': Math.max(0, (currentPlan.targetProteins || 150) - weeklyAverage.p)
    },
    { 
      name: 'Ж', 
      Факт: weeklyAverage.f, 
      Цель: currentPlan.targetFats || 70,
      'Остаток': Math.max(0, (currentPlan.targetFats || 70) - weeklyAverage.f)
    },
    { 
      name: 'У', 
      Факт: weeklyAverage.c, 
      Цель: currentPlan.targetCarbs || 250,
      'Остаток': Math.max(0, (currentPlan.targetCarbs || 250) - weeklyAverage.c)
    },
  ];

  return (
    <div className="p-2 h-full flex flex-col gap-2 overflow-hidden">
      {/* Header & Targets */}
      <div className="flex justify-between items-start shrink-0 gap-2 relative z-50">
        <div className="flex flex-col gap-1">
          <div className="bg-white px-3 py-1.5 rounded-xl border border-black/5 shadow-sm relative group/header-edit">
            {isEditingHeader ? (
              <div className="flex flex-col gap-2 p-1">
                <input 
                  type="text"
                  className="text-base font-bold border-b border-emerald-500 focus:outline-none w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Имя клиента"
                />
                <div className="flex gap-2">
                  <input 
                    type="date"
                    className="text-[10px] border border-black/5 rounded px-1"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                  <input 
                    type="date"
                    className="text-[10px] border border-black/5 rounded px-1"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                  />
                  <button 
                    onClick={handleSaveHeader}
                    className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded font-bold"
                  >
                    ОК
                  </button>
                  <button 
                    onClick={() => setIsEditingHeader(false)}
                    className="text-gray-400 text-[10px] px-2 py-0.5 font-bold"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold leading-tight">{currentPlan.clientName}</h2>
                  <button 
                    onClick={() => setIsEditingHeader(true)}
                    className="p-1 text-gray-300 hover:text-emerald-600 opacity-0 group-hover/header-edit:opacity-100 transition-opacity"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest">Недельный рацион</p>
                  {(currentPlan.startDate || currentPlan.endDate) && (
                    <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">
                      ({currentPlan.startDate ? currentPlan.startDate.split('-').reverse().join('.') : '...'} - {currentPlan.endDate ? currentPlan.endDate.split('-').reverse().join('.') : '...'})
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          
          <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-black/5 shadow-sm relative group/macros">
            <div className="flex flex-col gap-0.5">
              <label className="text-[8px] font-bold text-gray-400 uppercase px-1">Ккал</label>
              <input 
                type="number" 
                className="w-14 bg-gray-50 border border-black/5 rounded text-[10px] p-0.5 font-bold text-emerald-700"
                value={currentPlan.targetKcal}
                onChange={(e) => handleTargetChange('targetKcal', Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[8px] font-bold text-gray-400 uppercase px-1">Б</label>
              <input 
                type="number" 
                className="w-14 bg-gray-50 border border-black/5 rounded text-[10px] p-0.5 font-bold text-emerald-600"
                value={currentPlan.targetProteins || 150}
                onChange={(e) => handleTargetChange('targetProteins', Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[8px] font-bold text-gray-400 uppercase px-1">Ж</label>
              <input 
                type="number" 
                className="w-14 bg-gray-50 border border-black/5 rounded text-[10px] p-0.5 font-bold text-amber-600"
                value={currentPlan.targetFats || 70}
                onChange={(e) => handleTargetChange('targetFats', Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[8px] font-bold text-gray-400 uppercase px-1">У</label>
              <input 
                type="number" 
                className="w-14 bg-gray-50 border border-black/5 rounded text-[10px] p-0.5 font-bold text-blue-600"
                value={currentPlan.targetCarbs || 250}
                onChange={(e) => handleTargetChange('targetCarbs', Number(e.target.value))}
              />
            </div>

            {/* Macro Validation Hint */}
            <div className="absolute -right-6 top-1/2 -translate-y-1/2">
              {(() => {
                const p = currentPlan.targetProteins || 150;
                const f = currentPlan.targetFats || 70;
                const c = currentPlan.targetCarbs || 250;
                const kcal = currentPlan.targetKcal;
                const calcKcal = p * 4 + f * 9 + c * 4;
                const diff = kcal - calcKcal;
                const isOk = Math.abs(diff) <= 5;

                return (
                  <div className="relative group/hint">
                    {isOk ? (
                      <CheckCircle size={14} className="text-emerald-500 cursor-help" />
                    ) : (
                      <AlertCircle size={14} className="text-amber-500 cursor-help" />
                    )}
                    
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded-lg shadow-xl opacity-0 group-hover/hint:opacity-100 pointer-events-none transition-opacity z-[100]">
                      <p className="font-bold mb-1">
                        {isOk ? 'Расчет верный' : 'Ошибка в расчете'}
                      </p>
                      <p className="opacity-80 mb-1">
                        Формула: Б*4 + Ж*9 + У*4 = {calcKcal} ккал
                      </p>
                      {!isOk && (
                        <div className="border-t border-white/10 pt-1 mt-1">
                          <p className="text-amber-400 font-bold">Рекомендация:</p>
                          <p>
                            {diff > 0 
                              ? `Добавьте ${Math.round(diff/4)}г Б, ${Math.round(diff/9)}г Ж или ${Math.round(diff/4)}г У`
                              : `Уберите ${Math.abs(Math.round(diff/4))}г Б, ${Math.abs(Math.round(diff/9))}г Ж или ${Math.abs(Math.round(diff/4))}г У`
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="flex-1"></div>

        <div className="flex flex-col gap-2 items-end">
          <div className="flex gap-3">
            <button 
              onClick={() => savePlan(currentPlan)}
              className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Save size={12} />
              Сохранить
            </button>
            <button 
              onClick={exportExcel}
              className="text-xs font-bold text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Download size={14} />
              Excel Таблица
            </button>
            <button 
              onClick={exportMarkdown}
              className="text-xs font-bold text-orange-600 hover:underline cursor-pointer flex items-center gap-1"
            >
              <FileText size={14} />
              Markdown
            </button>
            <button 
              onClick={exportImage}
              className="text-sm font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1.5"
            >
              <Download size={14} />
              Скачать PNG
            </button>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={exportPDF}
              className="text-sm font-bold text-red-600 hover:underline cursor-pointer flex items-center gap-1.5"
            >
              <FileText size={14} />
              Экспорт в PDF
            </button>
            <button 
              onClick={() => window.print()}
              className="text-sm font-bold text-gray-600 hover:underline cursor-pointer flex items-center gap-1.5"
            >
              <Printer size={14} />
              Печать
            </button>
          </div>
        </div>
      </div>

      {/* Daily Remaining Summary (Separate Block) */}
      <div className="shrink-0 bg-white rounded-xl border border-black/5 shadow-sm overflow-hidden">
        <div className="min-w-[1400px] grid grid-cols-[100px_repeat(7,1fr)] bg-gray-50/50">
          <div className="p-2 border-r border-black/5 flex items-center justify-center">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Остаток дня</span>
          </div>
          {DAYS.map(day => {
            const totals = getDayTotals(day.id);
            const remP = (currentPlan.targetProteins || 150) - totals.p;
            const remF = (currentPlan.targetFats || 70) - totals.f;
            const remC = (currentPlan.targetCarbs || 250) - totals.c;
            return (
              <div key={day.id} className="p-1.5 border-r border-black/5 last:border-r-0 flex justify-center gap-2 items-center">
                <div className="flex flex-col items-center">
                  <span className="text-[6px] text-gray-400 font-bold">Б</span>
                  <span className={`text-[9px] font-black ${remP >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {remP >= 0 ? remP : Math.abs(remP)}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[6px] text-gray-400 font-bold">Ж</span>
                  <span className={`text-[9px] font-black ${remF >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {remF >= 0 ? remF : Math.abs(remF)}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[6px] text-gray-400 font-bold">У</span>
                  <span className={`text-[9px] font-black ${remC >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {remC >= 0 ? remC : Math.abs(remC)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7-Day Grid Planner */}
      <div className="flex-1 overflow-auto bg-white rounded-2xl border border-black/5 shadow-sm">
        <div className="min-w-[1400px] flex flex-col" ref={tableRef}>
          {/* Days Header */}
          <div className="grid grid-cols-[100px_repeat(7,1fr)] bg-gray-50 border-b border-black/5 sticky top-0 z-20">
            <div className="p-3 border-r border-black/5 font-bold text-[10px] text-gray-400 uppercase flex flex-col items-center justify-center gap-1">
              <span>Прием</span>
              <div className="relative">
                <button 
                  onClick={() => setShowAddMeal(!showAddMeal)}
                  className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200 transition-colors"
                >
                  <Plus size={12} />
                </button>
                {showAddMeal && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddMeal(false)}></div>
                    <div className="absolute top-full left-0 mt-1 bg-white border border-black/10 rounded-lg shadow-xl min-w-[150px] z-50">
                      <div className="p-2 text-[9px] font-bold text-gray-400 uppercase border-b border-black/5">Добавить блок</div>
                      {(currentPlan.mealTypes || settings.mealTypes).map(mt => (
                        <button 
                          key={mt.id}
                          onClick={() => {
                            addMealBlock(mt.id);
                            setShowAddMeal(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[11px] hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 transition-colors"
                        >
                          {mt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            {DAYS.map((day, idx) => (
              <div key={day.id} className="p-3 border-r border-black/5 last:border-r-0 text-center">
                <h4 className="font-bold text-sm">{day.label}</h4>
                {getDayDate(idx) && (
                  <div className="text-[9px] text-emerald-600 font-bold mb-1">
                    {getDayDate(idx)}
                  </div>
                )}
                <div className="text-[10px] text-gray-400">
                  {getDayTotals(day.id).kcal} / {currentPlan.targetKcal} ккал
                </div>
              </div>
            ))}
          </div>

          {/* Meals Rows */}
          <div className="flex-1 divide-y divide-black/5">
            {activeMealTypes.map(mealType => (
                <div key={mealType.id} className="grid grid-cols-[100px_repeat(7,1fr)] min-h-[100px]">
                  <div className="p-2 border-r border-black/5 bg-gray-50/30 flex flex-col items-center justify-center text-center relative group/header">
                    <span className="font-bold text-[11px]">{mealType.label}</span>
                    <button 
                      onClick={() => removeMealBlock(mealType.id)}
                      className={`absolute top-1 right-1 p-1 rounded-none transition-all ${confirmMealDeleteId === mealType.id ? 'bg-red-600 text-white opacity-100' : 'text-red-300 hover:text-red-500 opacity-0 group-hover/header:opacity-100'}`}
                      title={confirmMealDeleteId === mealType.id ? "Нажмите еще раз" : "Убрать блок"}
                    >
                      {confirmMealDeleteId === mealType.id ? <span className="text-[8px] font-bold">УДАЛИТЬ?</span> : <Trash2 size={12} />}
                    </button>
                  </div>
                
                {DAYS.map(day => {
                  const dayData = currentPlan.data[day.id];
                  const meal = dayData?.meals?.find(m => m.type === mealType.id);
                  
                  return (
                    <div key={day.id} className="p-1 border-r border-black/5 last:border-r-0 flex flex-col gap-1 relative group">
                      <div className="flex-1 space-y-1">
                        {meal?.items.map((item, idx) => (
                          <div key={item.id} className="bg-white p-1.5 rounded-none border border-black/5 shadow-sm text-[11px] group/item relative">
                            <button 
                              onClick={() => removeItem(day.id, mealType.id, item.id)}
                              className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-all shadow-md z-10 hover:bg-red-600"
                            >
                              <Trash2 size={8} />
                            </button>
                            
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex-1 min-w-0">
                                  {item.categoryName && (
                                    <div className="text-[7px] font-black text-gray-400 uppercase tracking-tighter mb-0.5 px-0.5">
                                      {item.categoryName}
                                    </div>
                                  )}
                                  <SearchableItemSelect
                                    value={item.productId ? `product:${item.productId}` : item.dishId ? `dish:${item.dishId}` : ''}
                                    onSelect={(val) => handleItemSelect(day.id, mealType.id, item.id, val)}
                                    placeholder={item.name}
                                    products={products}
                                    dishes={dishes}
                                    categoryFilter={item.categoryName}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-none border border-black/5 flex-1">
                                  <input 
                                    type="number" 
                                    className="w-full bg-transparent border-none p-0 text-center font-black text-gray-700 focus:ring-0 text-[10px]"
                                    value={item.weight}
                                    onChange={(e) => handleWeightChange(day.id, mealType.id, item.id, Number(e.target.value))}
                                  />
                                  <span className="text-gray-400 font-bold text-[8px]">г/мл</span>
                                </div>
                                <div className="text-[10px] font-black text-emerald-600 whitespace-nowrap">
                                  {settings.calculationMethod === 'manual' ? (
                                    <div className="flex items-center gap-0.5">
                                      <input 
                                        type="number" 
                                        className="w-10 bg-transparent border-none p-0 text-right font-black text-emerald-600 focus:ring-0 text-[10px]"
                                        value={Math.round(item.kcal)}
                                        onChange={(e) => handleManualValueChange(day.id, mealType.id, item.id, 'kcal', Number(e.target.value))}
                                      />
                                      <span className="text-[7px] font-bold opacity-70">ккал</span>
                                    </div>
                                  ) : (
                                    <>{Math.round(item.kcal)} <span className="text-[7px] font-bold opacity-70">ккал</span></>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-0.5 pt-1 border-t border-black/5">
                                <div className="flex flex-col items-center">
                                  <span className="text-[7px] text-gray-400 uppercase font-black tracking-tighter">Б</span>
                                  {settings.calculationMethod === 'manual' ? (
                                    <input 
                                      type="number" 
                                      className="w-full bg-transparent border-none p-0 text-center font-black text-gray-700 focus:ring-0 text-[10px]"
                                      value={item.proteins}
                                      onChange={(e) => handleManualValueChange(day.id, mealType.id, item.id, 'proteins', Number(e.target.value))}
                                    />
                                  ) : (
                                    <span className="font-black text-gray-700 text-[10px]">{item.proteins}</span>
                                  )}
                                </div>
                                <div className="flex flex-col items-center border-x border-black/5">
                                  <span className="text-[7px] text-gray-400 uppercase font-black tracking-tighter">Ж</span>
                                  {settings.calculationMethod === 'manual' ? (
                                    <input 
                                      type="number" 
                                      className="w-full bg-transparent border-none p-0 text-center font-black text-gray-700 focus:ring-0 text-[10px]"
                                      value={item.fats}
                                      onChange={(e) => handleManualValueChange(day.id, mealType.id, item.id, 'fats', Number(e.target.value))}
                                    />
                                  ) : (
                                    <span className="font-black text-gray-700 text-[10px]">{item.fats}</span>
                                  )}
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[7px] text-gray-400 uppercase font-black tracking-tighter">У</span>
                                  {settings.calculationMethod === 'manual' ? (
                                    <input 
                                      type="number" 
                                      className="w-full bg-transparent border-none p-0 text-center font-black text-gray-700 focus:ring-0 text-[10px]"
                                      value={item.carbs}
                                      onChange={(e) => handleManualValueChange(day.id, mealType.id, item.id, 'carbs', Number(e.target.value))}
                                    />
                                  ) : (
                                    <span className="font-black text-gray-700 text-[10px]">{item.carbs}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="absolute bottom-1 right-1 flex flex-col items-end gap-1 pointer-events-none">
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                          {planMealCategories.map(cat => (
                            <button 
                              key={cat}
                              onClick={() => addOtherRow(day.id, mealType.id, cat)}
                              className="text-[8px] bg-white border border-black/5 px-2 py-0.5 rounded shadow-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors whitespace-nowrap"
                            >
                              + {cat}
                            </button>
                          ))}
                          <button 
                            onClick={() => addOtherRow(day.id, mealType.id, 'Другое')}
                            className="p-1 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-colors self-end"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Totals Footer */}
          <div className="grid grid-cols-[100px_repeat(7,1fr)] bg-gray-100 border-t border-black/10 sticky bottom-0 z-20">
            <div className="p-2 border-r border-black/5 font-bold text-[10px] flex items-center justify-center">ИТОГО</div>
            {DAYS.map(day => {
              const dayTotals = getDayTotals(day.id);
              const deviationValue = (currentPlan.targetKcal * settings.deviation) / 100;
              const isWithinRange = Math.abs(dayTotals.kcal - currentPlan.targetKcal) <= deviationValue;
              
              return (
                <div key={day.id} className={`p-1.5 border-r border-black/5 last:border-r-0 text-center ${isWithinRange ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <div className="font-black text-xs text-emerald-800">{dayTotals.kcal} ккал</div>
                  <div className="flex justify-center gap-1.5 text-[8px] font-medium text-gray-500">
                    <span>Б: {dayTotals.p}</span>
                    <span>Ж: {dayTotals.f}</span>
                    <span>У: {dayTotals.c}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
