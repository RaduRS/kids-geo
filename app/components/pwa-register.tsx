"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      (window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost")
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => undefined);
  }, []);

  return null;
}

