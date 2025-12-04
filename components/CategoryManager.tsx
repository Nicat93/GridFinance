
import React, { useState, useEffect } from 'react';
import { CategoryDef } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryDef[];
  onSave: (categories: CategoryDef[]) => void;
}

const AVAILABLE_COLORS = [
  'slate', 'gray', 'red', 'orange', 'amber', 'yellow', 
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 
  'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
];

const CategoryManager: React.FC<Props> = ({ isOpen, onClose, categories, onSave }) => {
  const [localCategories, setLocalCategories] = useState<CategoryDef[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('gray');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setLocalCategories([...categories].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName.trim()) return;
    
    if (localCategories.some(c => c.name.toLowerCase() === newName.trim().toLowerCase())) {
        alert('Category already exists');
        return;
    }

    const newCat: CategoryDef = {
        id: Math.random().toString(36).substr(2, 9),
        name: newName.trim(),
        color: newColor.trim() || 'gray',
        lastModified: Date.now()
    };
    
    const updated = [...localCategories, newCat].sort((a, b) => a.name.localeCompare(b.name));
    setLocalCategories(updated);
    onSave(updated);
    setNewName('');
    // Pick random next color from list or keep current if custom
    if (AVAILABLE_COLORS.includes(newColor)) {
        setNewColor(AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)]);
    }
  };

  const handleDelete = (id: string) => {
      if (window.confirm('Delete this category? Transactions using it will keep the text name but lose the color.')) {
          // Note: In a real sync system, we should mark as deleted (tombstone).
          // For now, removing it locally effectively hides it. 
          // If we want sync deletion, we'd need a deleted flag on CategoryDef.
          // Since the prompt hasn't asked for category deletion syncing specifically,
          // we'll stick to local removal for now, or update the timestamp on the remaining ones?
          // Actually, simply removing it from the array works for "Last Write Wins" if the other side doesn't have a newer update.
          const updated = localCategories.filter(c => c.id !== id);
          setLocalCategories(updated);
          onSave(updated);
      }
  };

  const handleColorChange = (id: string, color: string) => {
      const updated = localCategories.map(c => c.id === id ? { ...c, color, lastModified: Date.now() } : c);
      setLocalCategories(updated);
      onSave(updated);
  };

  const getPreviewStyle = (color: string) => {
      if (AVAILABLE_COLORS.includes(color)) {
          // Map to a representative background color for the preview circle
           switch(color) {
            case 'slate': return { className: 'bg-slate-500' };
            case 'gray': return { className: 'bg-gray-500' };
            case 'red': return { className: 'bg-red-500' };
            case 'orange': return { className: 'bg-orange-500' };
            case 'amber': return { className: 'bg-amber-500' };
            case 'yellow': return { className: 'bg-yellow-500' };
            case 'lime': return { className: 'bg-lime-500' };
            case 'green': return { className: 'bg-green-500' };
            case 'emerald': return { className: 'bg-emerald-500' };
            case 'teal': return { className: 'bg-teal-500' };
            case 'cyan': return { className: 'bg-cyan-500' };
            case 'sky': return { className: 'bg-sky-500' };
            case 'blue': return { className: 'bg-blue-500' };
            case 'indigo': return { className: 'bg-indigo-500' };
            case 'violet': return { className: 'bg-violet-500' };
            case 'purple': return { className: 'bg-purple-500' };
            case 'fuchsia': return { className: 'bg-fuchsia-500' };
            case 'pink': return { className: 'bg-pink-500' };
            case 'rose': return { className: 'bg-rose-500' };
            default: return { className: 'bg-gray-500' };
        }
      } else {
          // Assume valid CSS string (hex, rgb, etc)
          return { style: { backgroundColor: color } };
      }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Categories</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">✕</button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {localCategories.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-xs italic">
                    No categories defined.
                </div>
            )}
            {localCategories.map(cat => {
                const preview = getPreviewStyle(cat.color);
                return (
                <div key={cat.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900/30 rounded group border border-transparent hover:border-gray-100 dark:hover:border-gray-800 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative group/color shrink-0">
                            <div 
                                className={`w-3.5 h-3.5 rounded-full cursor-pointer border border-gray-200 dark:border-gray-700 shadow-sm ${preview.className || ''}`}
                                style={preview.style}
                            ></div>
                            <input 
                                type="color"
                                value={cat.color.startsWith('#') ? cat.color : '#808080'}
                                onChange={(e) => handleColorChange(cat.id, e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                        </div>
                        {/* Inline Edit for Color Text */}
                        <div className="flex flex-col flex-1 min-w-0">
                             <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{cat.name}</span>
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <input 
                            type="text" 
                            value={cat.color}
                            onChange={(e) => handleColorChange(cat.id, e.target.value)}
                            className="w-12 bg-transparent text-[9px] text-gray-400 focus:text-gray-600 dark:focus:text-gray-200 focus:outline-none border-b border-transparent focus:border-gray-300 transition-colors text-right font-mono"
                            list="colors-list"
                        />
                        <button 
                            onClick={() => handleDelete(cat.id)}
                            className="text-gray-400 hover:text-rose-500 p-1"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
            )})}
        </div>

        {/* Add New - Streamlined */}
        <form onSubmit={handleAdd} className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
            <div className="space-y-3">
                <input 
                    type="text" 
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="New Category Name..."
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 font-bold"
                />
                
                {/* Quick Color Swatches */}
                <div className="flex flex-wrap gap-1.5 justify-between">
                    {AVAILABLE_COLORS.slice(0, 10).map(c => {
                        const style = getPreviewStyle(c);
                        const isSelected = newColor === c;
                        return (
                            <div 
                                key={c}
                                onClick={() => setNewColor(c)}
                                className={`w-5 h-5 rounded-full cursor-pointer border transition-transform ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110 border-transparent' : 'border-gray-300 dark:border-gray-700 hover:scale-105'} ${style.className || ''}`}
                                style={style.style}
                            ></div>
                        )
                    })}
                     <div className="relative w-5 h-5 rounded-full border border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer bg-white dark:bg-gray-800">
                        <span className="text-[8px] text-gray-500">More</span>
                        <input 
                            type="color"
                            value={newColor.startsWith('#') ? newColor : '#808080'}
                            onChange={(e) => setNewColor(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={!newName.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-gray-400 text-white py-2 rounded-lg font-bold text-sm shadow-md transition-colors"
                >
                    Add
                </button>
            </div>
        </form>

        <datalist id="colors-list">
            {AVAILABLE_COLORS.map(c => <option key={c} value={c} />)}
        </datalist>

      </div>
    </div>
  );
};

export default CategoryManager;
