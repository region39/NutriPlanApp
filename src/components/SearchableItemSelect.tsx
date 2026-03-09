import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, Check } from 'lucide-react';

interface Option {
  id: string | number;
  name: string;
  kcal?: number;
  proteins?: number;
  fats?: number;
  carbs?: number;
  type?: 'product' | 'dish';
  category?: string;
  hasImage?: boolean;
}

interface SearchableItemSelectProps {
  options?: Option[]; // Fallback if products/dishes not provided
  products?: any[];
  dishes?: any[];
  value: string | number | null;
  onSelect?: (value: string) => void;
  onChange?: (id: number | null) => void;
  onQuickAdd?: (name: string) => void;
  placeholder?: string;
  className?: string;
  categoryFilter?: string;
}

export const SearchableItemSelect: React.FC<SearchableItemSelectProps> = ({
  options: manualOptions,
  products,
  dishes,
  value,
  onSelect,
  onChange,
  onQuickAdd,
  placeholder = "Поиск...",
  className = "",
  categoryFilter
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine options if products/dishes are provided
  const allOptions: Option[] = useMemo(() => {
    if (manualOptions) return manualOptions;
    
    const combined: Option[] = [];
    if (products) {
      products.forEach(p => {
        if (p.is_ready_meal === 1) return; // Skip ready meals if they are handled as dishes elsewhere, but usually they are products
        combined.push({
          id: `product:${p.id}`,
          name: p.name,
          kcal: p.kcal,
          proteins: p.proteins,
          fats: p.fats,
          carbs: p.carbs,
          type: 'product',
          category: p.category,
          hasImage: p.hasImage
        });
      });
    }
    if (dishes) {
      dishes.forEach(d => {
        combined.push({
          id: `dish:${d.id}`,
          name: d.name,
          kcal: d.kcal,
          proteins: d.proteins,
          fats: d.fats,
          carbs: d.carbs,
          type: 'dish',
          category: d.category,
          hasImage: d.hasImage
        });
      });
    }
    return combined;
  }, [manualOptions, products, dishes]);

  const selectedOption = (allOptions || []).find(o => String(o.id) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = (allOptions || []).filter(o => 
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (option: Option) => {
    if (onSelect) {
      onSelect(String(option.id));
    } else if (onChange) {
      onChange(typeof option.id === 'number' ? option.id : Number(String(option.id).split(':')[1]));
    }
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 10);
        }}
        className="w-full px-2 py-1.5 bg-white border border-black/10 rounded-none text-[11px] cursor-pointer flex items-center justify-between hover:border-emerald-500/50 transition-all"
      >
        <span className={selectedOption ? "text-gray-900 font-bold truncate" : "text-gray-400 truncate"}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <Search size={10} className="text-gray-400 shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0 bg-white border border-black/10 rounded-none shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-black/5 bg-gray-50">
            <input
              ref={inputRef}
              type="text"
              className="w-full px-2 py-1 text-[11px] bg-white border border-black/10 rounded-none focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              placeholder="Введите название..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={String(opt.id)}
                  onClick={() => handleSelect(opt)}
                  className="px-3 py-1.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between group border-b border-black/[0.02] last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {opt.type && (
                      <div className="w-6 h-6 rounded bg-gray-100 border border-black/5 flex items-center justify-center shrink-0 overflow-hidden">
                        {(opt as any).hasImage ? (
                          <img 
                            src={`/api/images/${opt.type}/${String(opt.id).split(':')[1]}`}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            className="w-full h-full object-cover"
                            alt={opt.name}
                          />
                        ) : (
                          <span className="text-gray-300 text-[6px] font-bold uppercase">Нет</span>
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[11px] font-bold text-gray-700 group-hover:text-emerald-700 truncate">{opt.name}</p>
                        {opt.type && (
                          <span className={`text-[7px] font-black uppercase px-1 rounded-sm ${opt.type === 'dish' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {opt.type === 'dish' ? 'Блюдо' : 'Прод'}
                          </span>
                        )}
                      </div>
                      {opt.kcal !== undefined && (
                        <p className="text-[9px] text-gray-400 font-medium">
                          {Math.round(opt.kcal)} ккал | Б:{opt.proteins} Ж:{opt.fats} У:{opt.carbs}
                        </p>
                      )}
                    </div>
                  </div>
                  {String(value) === String(opt.id) && <Check size={12} className="text-emerald-600 shrink-0 ml-2" />}
                </div>
              ))
            ) : (
              <div className="p-3 text-center">
                <p className="text-[10px] text-gray-400 mb-1.5">Ничего не найдено</p>
                {onQuickAdd && search.trim().length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickAdd(search);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mx-auto uppercase tracking-wider"
                  >
                    <Plus size={10} />
                    Создать "{search}"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
