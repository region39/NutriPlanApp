import React from 'react';
import { useApp } from '../store';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Notification: React.FC = () => {
  const { notification } = useApp();

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className="fixed bottom-8 left-1/2 z-[9999] flex items-center gap-3 px-6 py-3 rounded-none shadow-2xl border border-white/10 backdrop-blur-md min-w-[300px]"
          style={{
            backgroundColor: 
              notification.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 
              notification.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 
              'rgba(59, 130, 246, 0.95)',
            color: 'white'
          }}
        >
          {notification.type === 'success' && <CheckCircle size={20} />}
          {notification.type === 'error' && <AlertCircle size={20} />}
          {notification.type === 'info' && <Info size={20} />}
          
          <span className="text-sm font-medium flex-1">{notification.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
