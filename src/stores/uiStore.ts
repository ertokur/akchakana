import { create } from 'zustand';
import type { PeriodKind } from '../domain/dates';
import type { Id, Transaction, TransactionType } from '../domain/types';

export interface PeriodSelection {
  kind: PeriodKind;
  /** Момент внутри периода (для day/week/month/year). */
  anchor: number;
  /** Для произвольного периода: `yyyy-MM-dd`. */
  from?: string;
  to?: string;
}

export interface ToastMessage {
  id: number;
  text: string;
  tone?: 'info' | 'warning' | 'error';
  action?: { label: string; run: () => void };
  duration?: number;
}

export type EditorState =
  | { mode: 'closed' }
  | { mode: 'new'; type: TransactionType; preset?: Partial<Transaction> }
  | { mode: 'edit'; transaction: Transaction };

interface UiState {
  period: PeriodSelection;
  accountFilter: Id | 'all';
  editor: EditorState;
  toasts: ToastMessage[];
  setPeriod(p: PeriodSelection): void;
  setAccountFilter(id: Id | 'all'): void;
  openNew(type?: TransactionType, preset?: Partial<Transaction>): void;
  openEdit(t: Transaction): void;
  closeEditor(): void;
  toast(t: Omit<ToastMessage, 'id'>): void;
  dismissToast(id: number): void;
}

let toastId = 0;

export const useUi = create<UiState>((set, get) => ({
  period: { kind: 'month', anchor: Date.now() },
  accountFilter: 'all',
  editor: { mode: 'closed' },
  toasts: [],
  setPeriod: (period) => set({ period }),
  setAccountFilter: (accountFilter) => set({ accountFilter }),
  openNew: (type = 'expense', preset) => set({ editor: { mode: 'new', type, preset } }),
  openEdit: (transaction) => set({ editor: { mode: 'edit', transaction } }),
  closeEditor: () => set({ editor: { mode: 'closed' } }),
  toast: (t) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
