"use client";

import { useEffect, useRef, useState } from "react";
import { useBalance } from "@/app/components/balance-provider";
import {
  EUROPE_REWARD_PENCE,
  OTHER_CONTINENT_REWARD_PENCE,
  formatGBP,
} from "@/lib/rewards/earnings";

export function BalanceBadge() {
  const { balancePence, hydrated, reset } = useBalance();
  const [open, setOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setConfirmingReset(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      setConfirmingReset(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
          setOpen((prev) => !prev);
          setConfirmingReset(false);
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
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            A perfect 10 out of 10 earns {formatGBP(EUROPE_REWARD_PENCE)} in
            Europe and {formatGBP(OTHER_CONTINENT_REWARD_PENCE)} in every other
            continent. Only quizzes earn money.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!confirmingReset) {
                setConfirmingReset(true);
                return;
              }
              reset();
              setConfirmingReset(false);
            }}
            className={
              confirmingReset
                ? "mt-3 w-full rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white outline-none hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-500 active:bg-rose-800"
                : "mt-3 w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 outline-none hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500 active:bg-rose-100"
            }
          >
            {confirmingReset ? "Tap again to confirm reset" : "Reset balance"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
