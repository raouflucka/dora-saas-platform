import type { ReactNode } from 'react';

interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h2 className="text-base font-bold text-zinc-100">{title}</h2>
        <div className="text-sm text-zinc-400">{message}</div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-sm ${danger ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-900/20'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
