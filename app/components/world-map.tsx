"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONTINENTS,
  type ContinentId,
  findContinentById,
} from "@/lib/geo/continents";

type WorldMapProps = {
  highlightDurationMs?: number;
};

export function WorldMap({ highlightDurationMs = 5000 }: WorldMapProps) {
  const [activeContinentId, setActiveContinentId] = useState<ContinentId | null>(
    null,
  );
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleContinentPress = (id: ContinentId) => {
    if (timeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(timeoutRef.current);
    }

    setActiveContinentId(id);
    speakContinentName(id);

    if (typeof window !== "undefined") {
      const timeoutId = window.setTimeout(() => {
        setActiveContinentId(null);
      }, highlightDurationMs);
      timeoutRef.current = timeoutId;
    }
  };

  const activeContinent = activeContinentId
    ? findContinentById(activeContinentId)
    : null;

  return (
    <div className="relative w-full max-w-4xl aspect-[16/9]">
      <svg
        viewBox="0 0 800 400"
        className="h-full w-full"
        aria-label="World map with tappable continents"
      >
        <rect x="0" y="0" width="800" height="400" fill="#0ea5e9" />
        {CONTINENTS.map((continent) => {
          const isActive = continent.id === activeContinentId;

          return (
            <path
              key={continent.id}
              d={continent.path}
              fill={isActive ? continent.activeColor : continent.color}
              stroke="#0f172a"
              strokeWidth={1.5}
              role="button"
              aria-label={continent.name}
              tabIndex={0}
              className="cursor-pointer touch-manipulation transition-colors focus:outline-none focus-visible:stroke-4"
              onClick={() => handleContinentPress(continent.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleContinentPress(continent.id);
                }
              }}
            />
          );
        })}
      </svg>
      {activeContinent && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-900/80 px-4 py-2 text-lg font-semibold text-sky-50 shadow-lg md:text-2xl"
            style={{
              left: `${activeContinent.labelXPercent}%`,
              top: `${activeContinent.labelYPercent}%`,
            }}
          >
            {activeContinent.name}
          </div>
        </div>
      )}
    </div>
  );
}

function speakContinentName(id: ContinentId) {
  if (typeof window === "undefined") {
    return;
  }

  const continent = findContinentById(id);

  if (!continent) {
    return;
  }

  const synth = window.speechSynthesis;

  if (!synth) {
    return;
  }

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(continent.name);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  synth.speak(utterance);
}

