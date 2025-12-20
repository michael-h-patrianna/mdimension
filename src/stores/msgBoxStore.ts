import { create } from 'zustand';

export type MsgBoxType = 'info' | 'success' | 'warning' | 'error';

export interface MsgBoxAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

interface MsgBoxState {
  isOpen: boolean;
  title: string;
  message: string;
  type: MsgBoxType;
  actions: MsgBoxAction[];
  
  showMsgBox: (title: string, message: string, type?: MsgBoxType, actions?: MsgBoxAction[]) => void;
  closeMsgBox: () => void;
}

export const useMsgBoxStore = create<MsgBoxState>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
  actions: [],

  showMsgBox: (title, message, type = 'info', actions = []) => {
    set({
      isOpen: true,
      title,
      message,
      type,
      actions: actions.length > 0 ? actions : [{ label: 'OK', onClick: () => set({ isOpen: false }) }]
    });
  },

  closeMsgBox: () => {
    set({ isOpen: false });
  }
}));
