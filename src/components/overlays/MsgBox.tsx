import React from 'react';
import { useMsgBoxStore } from '@/stores/msgBoxStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';

export const MsgBox: React.FC = () => {
  const { isOpen, title, message, type, actions, closeMsgBox } = useMsgBoxStore();

  const getIcon = (): IconName => {
    switch (type) {
      case 'error': return 'warning'; // We use 'warning' icon for error as it's the triangle exclamation
      case 'warning': return 'warning';
      case 'success': return 'check';
      case 'info': default: return 'info';
    }
  };

  const getColorClass = () => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      case 'success': return 'text-green-400';
      case 'info': default: return 'text-blue-400';
    }
  };

  const getBgClass = () => {
    switch (type) {
      case 'error': return 'bg-red-500/10 border-red-500/20';
      case 'warning': return 'bg-amber-500/10 border-amber-500/20';
      case 'success': return 'bg-green-500/10 border-green-500/20';
      case 'info': default: return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeMsgBox}
      title={title}
      width="max-w-md"
    >
      <div className="space-y-6">
        <div className={`flex items-start gap-4 p-4 rounded-xl border ${getBgClass()}`}>
          <div className={`shrink-0 p-2 rounded-full bg-black/20 ${getColorClass()}`}>
            <Icon name={getIcon()} size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => {
                action.onClick();
                // We don't auto-close here to allow actions to chain or keep open if needed,
                // but default actions usually close it.
              }}
              variant={action.variant || 'secondary'}
              size="md"
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
};
