"use client";

import { useEffect } from "react";

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Да",
  cancelText = "Нет",
  onConfirm,
  onCancel,
  isDestructive = false,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}) {
  // Блокируем скролл фона, пока открыто окно
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="neo-btn w-full max-w-sm rounded-[32px] bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <h2 className="mb-2 text-center text-xl font-bold text-ink">{title}</h2>
        <p className="mb-6 text-center text-sm text-muted">{message}</p>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="neo-btn flex h-12 flex-1 items-center justify-center rounded-2xl bg-white text-base font-semibold text-ink active:bg-gray-50"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel(); // Закрываем окно после подтверждения
            }}
            className={`neo-btn flex h-12 flex-1 items-center justify-center rounded-2xl bg-white text-base font-semibold active:bg-gray-50 ${
              isDestructive ? "text-red-500" : "text-accent"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
