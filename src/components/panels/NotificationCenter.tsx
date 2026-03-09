import React from 'react';
import { useNotificationStore } from '@/store';
import { CheckCircle, XCircle, Info, AlertTriangle, X, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const NotificationBell: React.FC = () => {
  const { notifications } = useNotificationStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (unreadCount === 0) {
    return null;
  }

  return (
    <div className="relative">
      <Bell size={18} className="text-zinc-400" />
      <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] rounded-full flex items-center justify-center bg-red-500 text-white">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    </div>
  );
};

export const NotificationCenter: React.FC = () => {
  const { notifications, markAsRead, removeNotification, clearAll } = useNotificationStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
      case 'task_complete':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-amber-500" />;
      default:
        return <Info size={16} className="text-blue-500" />;
    }
  };

  const unreadNotifications = notifications.filter((n) => !n.read);

  if (unreadNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] w-80 max-h-96 overflow-hidden">
      <div className="rounded-xl border shadow-2xl overflow-hidden bg-zinc-900 border-zinc-700">
        <div className="px-3 py-2 border-b flex justify-between items-center bg-zinc-800 border-zinc-700">
          <span className="text-sm font-medium text-zinc-200">
            通知 ({unreadNotifications.length})
          </span>
          <button onClick={clearAll} className="text-xs text-zinc-400 hover:text-zinc-200">
            全部清除
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          <AnimatePresence>
            {unreadNotifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-3 py-2 border-b last:border-b-0 cursor-pointer border-zinc-800 hover:bg-zinc-800/50"
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start gap-2">
                  {getIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-200">{notification.title}</div>
                    {notification.message && (
                      <div className="text-xs mt-0.5 text-zinc-400">{notification.message}</div>
                    )}
                    {notification.sessionName && (
                      <div className="text-xs mt-1 text-sky-400">
                        对话: {notification.sessionName}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notification.id);
                    }}
                    className="p-1 rounded hover:bg-zinc-700"
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
