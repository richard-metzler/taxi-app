"use client";

import { useEffect, useRef } from "react";

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Да",
  cancelText = "Нет",
  onConfirm,
  onCancel,
  onClose,
  isDestructive = false,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Закрытие окна; если не передано, используется onCancel. */
  onClose?: () => void;
  isDestructive?: boolean;
}) {
  const closeRef = useRef(onClose ?? onCancel);
  useEffect(() => {
    closeRef.current = onClose ?? onCancel;
  }, [onCancel, onClose]);

  // Блокируем скролл фона, пока открыто окно, и возвращаем исходное значение стиля.
  // Escape и кнопка «Нет» закрывают окно, не вызывая сайд-эффект подтверждения.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="neo w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-white/20" aria-hidden="true" />
        <h2 className="mb-2 text-center text-xl font-bold text-ink">{title}</h2>
        <p className="mb-6 text-center text-sm text-muted">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={() => closeRef.current()}
            className="neo-btn flex h-12 flex-1 items-center justify-center rounded-2xl text-base font-semibold text-ink"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              // Подтверждение закрывает окно само (через onConfirm), отмена не вызывается.
              onConfirm();
            }}
            className={
              isDestructive
                ? "neo-btn flex h-12 flex-1 items-center justify-center rounded-2xl bg-danger/15 text-base font-semibold text-danger"
                : "neo-btn-primary flex h-12 flex-1 items-center justify-center rounded-2xl text-base font-semibold"
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
