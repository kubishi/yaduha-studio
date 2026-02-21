"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface InfoButtonProps {
  text: string;
}

export default function InfoButton({ text }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Position the tooltip above the button
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + window.scrollY,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        tooltipRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  const lines = text.split(/(?<=\.)\s+(?=Known |If )/);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] leading-none hover:bg-gray-300 ml-1"
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg z-[9999] text-xs text-gray-600"
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%) translateY(-8px)",
            }}
          >
            {lines.map((line, i) => (
              <p key={i} className={i > 0 ? "mt-1" : ""}>
                {line}
              </p>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
