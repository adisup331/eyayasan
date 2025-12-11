
import React from 'react';
import { X } from './ui/Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full'; // Added 'full'
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const getSizeClass = () => {
      switch (size) {
          case 'sm': return 'max-w-sm';
          case 'md': return 'max-w-lg';
          case 'lg': return 'max-w-2xl';
          case 'xl': return 'max-w-4xl';
          case '2xl': return 'max-w-5xl';
          case '3xl': return 'max-w-6xl';
          case '4xl': return 'max-w-7xl';
          case 'full': return 'w-screen h-screen max-w-none rounded-none m-0';
          default: return 'max-w-lg';
      }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${size === 'full' ? 'p-0' : 'p-4'}`}>
      {/* Added max-h-[90vh] and flex-col to allow internal scrolling */}
      <div className={`bg-white dark:bg-dark-card shadow-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-dark-border ${getSizeClass()} ${size !== 'full' ? 'rounded-xl max-h-[90vh]' : ''}`}>
        {/* Header - Fixed */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-dark-border bg-white dark:bg-dark-card z-10 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <X size={20} />
          </button>
        </div>
        
        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};
