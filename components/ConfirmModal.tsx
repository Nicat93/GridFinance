import React from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void; // This is now "Abort"
  onAlternative?: () => void; // This is "No, but proceed"
  confirmText?: string;
  cancelText?: string;
  alternativeText?: string;
}

const ConfirmModal: React.FC<Props> = ({ 
    isOpen, 
    title, 
    message, 
    onConfirm, 
    onCancel,
    onAlternative,
    confirmText = "Confirm",
    cancelText = "Cancel",
    alternativeText
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-lg shadow-2xl max-w-xs w-full p-5 animate-in zoom-in-95 duration-200">
        <h3 className="text-gray-200 font-bold text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            {message}
        </p>
        <div className="flex flex-col gap-3">
            <button 
                onClick={onConfirm}
                className="w-full bg-indigo-900 hover:bg-indigo-800 text-indigo-100 py-2.5 rounded text-sm font-medium border border-indigo-700/50 transition-colors"
            >
                {confirmText}
            </button>
            
            {onAlternative && alternativeText && (
                <button 
                    onClick={onAlternative}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 py-2.5 rounded text-sm font-medium border border-gray-700 transition-colors"
                >
                    {alternativeText}
                </button>
            )}

            <button 
                onClick={onCancel}
                className="w-full bg-transparent hover:bg-gray-900 text-gray-500 hover:text-gray-400 py-2 rounded text-sm font-medium transition-colors"
            >
                {cancelText}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;