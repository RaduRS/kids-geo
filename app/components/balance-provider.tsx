"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

// Each tablet keeps its own balance: the value lives in this device's
// localStorage and is never synced, so the iPad and the Android tablet never
// share a total. Bumping the version suffix intentionally starts a fresh
// balance for everyone if the reward rules ever change.
const STORAGE_KEY = "kids-geo.balance-pence.v1";

type BalanceContextValue = {
  balancePence: number;
  hydrated: boolean;
  award: (pence: number) => void;
  reset: () => void;
};

const BalanceContext = createContext<BalanceContextValue | null>(null);

// A tiny external store so the balance can be read through useSyncExternalStore.
// That keeps SSR safe (the server snapshot is always £0.00) without calling
// setState inside an effect.
let cachedBalancePence = 0;
let initialized = false;
const listeners = new Set<() => void>();

function readStoredBalance(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  cachedBalancePence = readStoredBalance();
  initialized = true;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribeBalance(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getBalanceSnapshot() {
  ensureInitialized();
  return cachedBalancePence;
}

function getServerSnapshot() {
  return 0;
}

function setBalance(next: number) {
  ensureInitialized();
  if (next === cachedBalancePence) return;
  cachedBalancePence = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Storage can be unavailable (private mode, quota). The in-memory value
    // still works for this session, it just will not survive a reload.
  }
  emit();
}

const noopSubscribe = () => () => {};

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const balancePence = useSyncExternalStore(
    subscribeBalance,
    getBalanceSnapshot,
    getServerSnapshot,
  );
  // false while server-rendering and during hydration, true afterwards. Used to
  // hold a placeholder until the real value is available, avoiding a £0.00 flash.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const award = useCallback((pence: number) => {
    if (!pence) return;
    setBalance(getBalanceSnapshot() + pence);
  }, []);

  const reset = useCallback(() => {
    setBalance(0);
  }, []);

  const value = useMemo(
    () => ({ balancePence, hydrated, award, reset }),
    [balancePence, hydrated, award, reset],
  );

  return (
    <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>
  );
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error("useBalance must be used within a BalanceProvider");
  }
  return context;
}
