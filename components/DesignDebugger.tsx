
import React from 'react';

export interface DesignConfig {
  fontSize: number;
  paddingY: number;
  fontWeightDesc: number;
  fontWeightAmount: number;
  tracking: number;
  pillRadius: number;
}

interface Props {
  config: DesignConfig;
  onChange: (cfg: DesignConfig) => void;
  onClose: () => void;
}

const DesignDebugger: React.FC<Props> = ({ config, onChange, onClose }) => {
  return (
    <div className="fixed bottom-20 right-6 z-[60] bg-black/90 backdrop-blur text-white p-4 rounded-xl border border-gray-700 shadow-2xl w-72 animate-in slide-in-from-right max-h-[70vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-black/90 pb-2 border-b border-gray-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Design Lab</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>

      <div className="space-y-5">
        
        {/* Sizing Section */}
        <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase">Sizing & Spacing</h4>
            
            <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Base Font Size</span>
                    <span>{config.fontSize}px</span>
                </div>
                <input 
                    type="range" min="9" max="18" step="1"
                    value={config.fontSize}
                    onChange={(e) => onChange({ ...config, fontSize: parseInt(e.target.value) })}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>

            <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Row Vertical Padding</span>
                    <span>{config.paddingY}rem</span>
                </div>
                <input 
                    type="range" min="0" max="1.0" step="0.05"
                    value={config.paddingY}
                    onChange={(e) => onChange({ ...config, paddingY: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>
            
            <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Pill Radius</span>
                    <span>{config.pillRadius}px</span>
                </div>
                <input 
                    type="range" min="0" max="12" step="1"
                    value={config.pillRadius}
                    onChange={(e) => onChange({ ...config, pillRadius: parseInt(e.target.value) })}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>
        </div>

        {/* Typography Section */}
        <div className="space-y-3 pt-2 border-t border-gray-800">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase">Typography</h4>

            <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Desc. Weight</span>
                    <span>{config.fontWeightDesc}</span>
                </div>
                <input 
                    type="range" min="100" max="900" step="100"
                    value={config.fontWeightDesc}
                    onChange={(e) => onChange({ ...config, fontWeightDesc: parseInt(e.target.value) })}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>

            <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Amount Weight</span>
                    <span>{config.fontWeightAmount}</span>
                </div>
                <input 
                    type="range" min="100" max="900" step="100"
                    value={config.fontWeightAmount}
                    onChange={(e) => onChange({ ...config, fontWeightAmount: parseInt(e.target.value) })}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>

            <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Amount Tracking</span>
                    <span>{config.tracking}em</span>
                </div>
                <input 
                    type="range" min="-0.15" max="0.15" step="0.01"
                    value={config.tracking}
                    onChange={(e) => onChange({ ...config, tracking: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>
        </div>
        
        <div className="pt-3 border-t border-gray-800">
             <div className="text-[9px] text-gray-500 text-center">
                Changes apply instantly
             </div>
        </div>
      </div>
    </div>
  );
};

export default DesignDebugger;
