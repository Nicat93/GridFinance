
import React from 'react';

export interface DesignConfig {
  fontSize: number;
  paddingY: number;
}

interface Props {
  config: DesignConfig;
  onChange: (cfg: DesignConfig) => void;
  onClose: () => void;
}

const DesignDebugger: React.FC<Props> = ({ config, onChange, onClose }) => {
  return (
    <div className="fixed bottom-20 right-6 z-[60] bg-black/80 backdrop-blur text-white p-4 rounded-xl border border-gray-700 shadow-2xl w-64 animate-in slide-in-from-right">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Design Tweaks</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Font Size</span>
            <span>{config.fontSize}px</span>
          </div>
          <input 
            type="range" 
            min="9" 
            max="18" 
            step="1"
            value={config.fontSize}
            onChange={(e) => onChange({ ...config, fontSize: parseInt(e.target.value) })}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Vertical Padding</span>
            <span>{config.paddingY}rem</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1.5" 
            step="0.05"
            value={config.paddingY}
            onChange={(e) => onChange({ ...config, paddingY: parseFloat(e.target.value) })}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
        
        <div className="pt-2 border-t border-gray-700">
             <div className="text-[9px] text-gray-500 text-center">
                Updates apply live to History & Plans
             </div>
        </div>
      </div>
    </div>
  );
};

export default DesignDebugger;
