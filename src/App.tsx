/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './store';
import { Dashboard } from './components/Dashboard';
import { Planner } from './components/Planner';
import { Database } from './components/Database';
import { DishConstructor } from './components/DishConstructor';
import { SettingsView } from './components/SettingsView';
import { Notification } from './components/Notification';
import { LayoutDashboard, Calendar, Database as DbIcon, Settings as SettingsIcon, Utensils, RefreshCw } from 'lucide-react';

function MainContent() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'database' | 'dishes' | 'settings'>('dashboard');
  const { currentPlan, loadPlans, loadProducts, loadDishes } = useApp();

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-black/5 flex items-center justify-between px-6 py-3 shadow-sm z-50">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-600">NutriPlan+</h1>
          </div>
          
          <nav className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <LayoutDashboard size={18} />
              <span className="text-sm">Журнал рационов</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('planner')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'planner' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <Calendar size={18} />
              <span className="text-sm">Планировщик</span>
            </button>

            <button 
              onClick={() => setActiveTab('dishes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'dishes' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <Utensils size={18} />
              <span className="text-sm">Конструктор блюд</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'database' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <DbIcon size={18} />
              <span className="text-sm">База продуктов</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'settings' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <SettingsIcon size={18} />
              <span className="text-sm">Настройки</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              loadPlans();
              loadProducts();
              loadDishes();
            }}
            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
            title="Обновить данные"
          >
            <RefreshCw size={18} />
          </button>
          
          {currentPlan && (
            <div className="flex items-center gap-3 bg-emerald-50 px-4 py-1.5 rounded-none border border-emerald-100">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Активный:</p>
              <p className="text-sm font-medium text-emerald-900">{currentPlan.clientName}</p>
            </div>
          )}
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'dashboard' && <Dashboard onSelectPlan={() => setActiveTab('planner')} />}
        {activeTab === 'planner' && <Planner />}
        {activeTab === 'database' && <Database />}
        {activeTab === 'dishes' && <DishConstructor />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
      <Notification />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
