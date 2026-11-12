"use client";

import { useRef, useState } from "react";
import { Spinner } from "./ui";

export function SwipeButton({ onComplete, text = "Свайп для принятия", loading = false }: { onComplete: () => void; text?: string; loading?: boolean }) {
  const [dragX, setDragX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const isDragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (loading) return;
    isDragging.current = true;
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = e.clientX - startX.current;
    const maxDrag = containerRef.current ? containerRef.current.clientWidth - 56 : 200;
    setDragX(Math.max(0, Math.min(delta, maxDrag)));
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const maxDrag = containerRef.current ? containerRef.current.clientWidth - 56 : 200;
    if (dragX > maxDrag * 0.8) {
      onComplete();
    } else {
      setDragX(0);
    }
  };

  const progress = containerRef.current ? (dragX / (containerRef.current.clientWidth - 56)) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-2xl bg-accent/10"
    >
      <div 
        className="absolute left-0 top-0 h-full bg-accent transition-all duration-75"
        style={{ width: `${Math.max(56, dragX + 56)}px` }}
      />
      <span className="relative z-10 font-semibold text-ink select-none pointer-events-none">
        {loading ? <Spinner className="h-5 w-5 text-white" /> : text}
      </span>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="absolute left-1 top-1 flex h-12 w-12 cursor-grab active:cursor-grabbing items-center justify-center rounded-xl bg-white shadow-md z-20"
        style={{ transform: `translateX(${dragX}px)` }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-accent">
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
