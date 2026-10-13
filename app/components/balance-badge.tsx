"use client";

import { useEffect, useRef, useState } from "react";
import { useBalance } from "@/app/components/balance-provider";
import { formatGBP } from "@/lib/rewards/earnings";

// The balance can only be cleared with this code, so a child cannot wipe it by
// poking around the UI.
const RESET_CODE = "1990";

export function BalanceBadge() {
  const { balancePence, hydrated, reset } = useBalance();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setPin("");
    setPinError(false);
  };

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setPin("");
      setPinError(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      setPin("");
      setPinError(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleReset = () => {
    if (pin.trim() !== RESET_CODE) {
      setPinError(true);
      return;
    }
    reset();
    close();
  };

  if (!hydrated) {
    return (
      <div
        className="h-9 w-28 animate-pulse rounded-full bg-white/60 ring-1 ring-slate-900/10 motion-reduce:animate-none"
        aria-hidden="true"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setOpen(true);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 items-center gap-2 rounded-full bg-amber-100 px-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200 outline-none hover:bg-amber-200/70 focus-visible:ring-2 focus-visible:ring-amber-500 active:bg-amber-200"
      >
        <span className="font-semibold text-amber-700">Balance</span>
        <span className="tabular-nums">{formatGBP(balancePence)}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Quiz earnings"
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl bg-white p-4 text-left shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/10"
        >
          <div className="text-sm font-semibold text-slate-700">
            Quiz earnings
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {formatGBP(balancePence)}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="balance-reset-pin" className="sr-only">
              Parent code
            </label>
            <input
              id="balance-reset-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(event) => {
                setPin(event.target.value);
                setPinError(false);
              }}
              placeholder="Parent code"
              className="h-9 w-full min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400"
            />
            <button
              type="button"
              onClick={handleReset}
              className="h-9 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 outline-none hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500 active:bg-rose-100"
            >
              Reset
            </button>
          </div>
          {pinError ? (
            <p className="mt-2 text-xs font-semibold text-rose-600">
              Incorrect code.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
