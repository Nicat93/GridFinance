
import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  initialValue: string;
  onClose: () => void;
  onApply: (value: string) => void;
}

interface ButtonProps {
    label: React.ReactNode;
    onClick: () => void;
    className?: string;
}

const CalculatorButton: React.FC<ButtonProps> = ({ label, onClick, className = '' }) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`h-14 sm:h-16 rounded-lg text-xl sm:text-2xl font-mono font-medium transition-transform active:scale-95 flex items-center justify-center select-none ${className}`}
    >
      {label}
    </button>
);

const CalculatorSheet: React.FC<Props> = ({ isOpen, initialValue, onClose, onApply }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isResult, setIsResult] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // If initial value is "0" or empty, start fresh. Otherwise load it.
      if (!initialValue || initialValue === '0') {
          setDisplay('0');
      } else {
          setDisplay(initialValue);
      }
      setEquation('');
      setIsResult(true); // Treat initial value as a result so next number replaces it
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleNumber = (num: string) => {
    if (isResult) {
      setDisplay(num);
      setIsResult(false);
    } else {
      setDisplay(prev => prev === '0' ? num : prev + num);
    }
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setIsResult(true);
  };

  const handleDecimal = () => {
    if (isResult) {
      setDisplay('0.');
      setIsResult(false);
    } else if (!display.includes('.')) {
      setDisplay(prev => prev + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setIsResult(false);
  };

  const handleBackspace = () => {
    if (isResult) {
        handleClear();
        return;
    }
    setDisplay(prev => {
        if (prev.length === 1) return '0';
        return prev.slice(0, -1);
    });
  };

  const calculate = (): string => {
    try {
      const fullExpr = equation + display;
      // Safe evaluation of basic math
      // eslint-disable-next-line
      const result = Function('"use strict";return (' + fullExpr + ')')();
      const resultStr = String(Math.round(result * 100) / 100); // Round to 2 decimals
      return resultStr;
    } catch (e) {
      return display;
    }
  };

  const handleEqual = () => {
    if (!equation) return;
    const res = calculate();
    setDisplay(res);
    setEquation('');
    setIsResult(true);
  };

  const handleSubmit = () => {
    // If there is a pending equation (e.g. "50 + 20"), calculate it first
    let finalValue = display;
    if (equation) {
        finalValue = calculate();
    }
    onApply(finalValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside to close (cancel) */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div 
        className="relative z-10 bg-white dark:bg-gray-950 w-full max-w-md rounded-t-2xl shadow-2xl p-4 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 border-t border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Display Screen */}
        <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 flex flex-col items-end justify-center h-24 border border-gray-200 dark:border-gray-800">
            <div className="text-gray-500 dark:text-gray-400 text-xs font-mono h-4">
                {equation}
            </div>
            <div className="text-gray-900 dark:text-gray-100 text-3xl sm:text-4xl font-mono font-bold tracking-tighter truncate w-full text-right">
                {display}
            </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <CalculatorButton label="C" onClick={handleClear} className="bg-gray-200 dark:bg-gray-800 text-red-600 dark:text-red-400" />
            <CalculatorButton label="÷" onClick={() => handleOperator('/')} className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" />
            <CalculatorButton label="×" onClick={() => handleOperator('*')} className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" />
            <CalculatorButton label="⌫" onClick={handleBackspace} className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300" />

            <CalculatorButton label="7" onClick={() => handleNumber('7')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="8" onClick={() => handleNumber('8')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="9" onClick={() => handleNumber('9')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="-" onClick={() => handleOperator('-')} className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" />

            <CalculatorButton label="4" onClick={() => handleNumber('4')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="5" onClick={() => handleNumber('5')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="6" onClick={() => handleNumber('6')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="+" onClick={() => handleOperator('+')} className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" />

            <CalculatorButton label="1" onClick={() => handleNumber('1')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="2" onClick={() => handleNumber('2')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="3" onClick={() => handleNumber('3')} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            
            {/* Enter/Equals Button Spanning 2 Rows */}
            <button 
                type="button"
                onClick={handleSubmit} 
                className="row-span-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xl font-bold transition-all active:scale-95 flex items-center justify-center shadow-lg"
            >
                OK
            </button>

            <CalculatorButton label="0" onClick={() => handleNumber('0')} className="col-span-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
            <CalculatorButton label="." onClick={handleDecimal} className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800" />
        </div>
      </div>
    </div>
  );
};

export default CalculatorSheet;
