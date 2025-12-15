import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`
                pointer-events-auto px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md flex items-center gap-3 min-w-[300px]
                ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-200' : ''}
                ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-200' : ''}
                ${toast.type === 'info' ? 'bg-panel-bg/80 border-panel-border text-text-primary' : ''}
              `}
            >
               <div className={`w-2 h-2 rounded-full ${
                 toast.type === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                 toast.type === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                 'bg-accent shadow-[0_0_8px_var(--color-accent)]'
               }`} />
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
