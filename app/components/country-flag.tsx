"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Flag image with a graceful fallback. Flags are served from flagcdn.com, so a
 * single failed request (offline, blocked, missing flag) would otherwise leave a
 * broken image. On error we show the country code on a neutral tile instead.
 *
 * Always fills its parent, which must be `relative` with an explicit size.
 */
export function CountryFlag({
  src,
  alt,
  code,
  sizes,
  className = "object-cover",
}: {
  src: string | undefined;
  alt: string;
  code: string;
  sizes: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-slate-200"
        role="img"
        aria-label={alt}
      >
        <span className="text-[0.6rem] font-bold tracking-wider text-slate-500">
          {code.toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
