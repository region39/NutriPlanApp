/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { Dashboard } from './components/Dashboard';
import { Planner } from './components/Planner';
import { Database } from './components/Database';
import { DishConstructor } from './components/DishConstructor';
import { SettingsView } from './components/SettingsView';
import { Notification } from './components/Notification';
import { PublicPlanView } from './components/PublicPlanView';
import { Login } from './components/Login';
import { LayoutDashboard, Calendar, Database as DbIcon, Settings as SettingsIcon, Utensils, RefreshCw, LogOut } from 'lucide-react';
import { APP_VERSION, BUILD_NUMBER } from './constants';

function MainContent({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'database' | 'dishes' | 'settings'>('dashboard');
  const { currentPlan, loadPlans, loadProducts, loadDishes, isDishConstructorDirty, setIsDishConstructorDirty } = useApp();

  const handleTabChange = (tab: 'dashboard' | 'planner' | 'database' | 'dishes' | 'settings') => {
    if (activeTab === 'dishes' && tab !== 'dishes' && isDishConstructorDirty) {
      if (!window.confirm('У вас есть несохраненные изменения в конструкторе блюд. Вы уверены, что хотите уйти? Изменения будут потеряны.')) {
        return;
      }
      setIsDishConstructorDirty(false);
    }
    setActiveTab(tab);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      // Clear state and redirect to root
      onLogout();
      window.location.href = '/';
    } catch (e) {
      console.error('Logout failed', e);
      window.location.href = '/';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-black/5 flex items-center justify-between px-6 py-3 shadow-sm z-50">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-600 flex items-baseline gap-2">
              NutriPlan+
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest" title={`Build ${BUILD_NUMBER}`}>
                v{APP_VERSION}
              </span>
            </h1>
          </div>
          
          <nav className="flex items-center gap-1">
            <button 
              onClick={() => handleTabChange('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <LayoutDashboard size={18} />
              <span className="text-sm">Журнал рационов</span>
            </button>
            
            <button 
              onClick={() => handleTabChange('planner')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'planner' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <Calendar size={18} />
              <span className="text-sm">Планировщик</span>
            </button>

            <button 
              onClick={() => handleTabChange('dishes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'dishes' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <Utensils size={18} />
              <span className="text-sm">Конструктор блюд</span>
            </button>
            
            <button 
              onClick={() => handleTabChange('database')}
              className={`flex items-center gap-2 px-4 py-2 rounded-none transition-all ${activeTab === 'database' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-500'}`}
            >
              <DbIcon size={18} />
              <span className="text-sm">База продуктов</span>
            </button>
            
            <button 
              onClick={() => handleTabChange('settings')}
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

          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Выйти"
          >
            <LogOut size={18} />
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
  const [sharedPlanId, setSharedPlanId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const checkAuth = async () => {
    // Safety timeout to prevent eternal loading
    const timeout = setTimeout(() => {
      setIsAuthenticated(prev => prev === null ? false : prev);
    }, 3000);

    try {
      const response = await fetch(`/api/me?t=${Date.now()}`, { credentials: 'include' });
      if (!response.ok) {
        setIsAuthenticated(false);
        return;
      }
      const data = await response.json();
      setIsAuthenticated(!!data.authenticated);
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsAuthenticated(false);
    } finally {
      clearTimeout(timeout);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared');
    if (shared) {
      setSharedPlanId(shared);
    } else {
      checkAuth();
    }
  }, []);

  if (sharedPlanId) {
    return <PublicPlanView planId={sharedPlanId} />;
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <AppProvider>
      <MainContent onLogout={() => setIsAuthenticated(false)} />
    </AppProvider>
  );
}
