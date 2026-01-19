"use client";

import { useEffect, useRef, useState } from "react";
import {
  type ContinentId,
  findContinentById,
  mapCountryToContinent,
} from "@/lib/geo/continents";
import { getCountries, type Country } from "@/lib/api/countries";

type WorldMapProps = {
  highlightDurationMs?: number;
  activeContinentId?: ContinentId | null;
  onContinentPress?: (id: ContinentId) => void;
  enableSpeech?: boolean;
  showLabel?: boolean;
};

type SvgPathData = {
  id: string; // ISO code or _somaliland
  d: string;
  continentId: ContinentId | null;
};

export function WorldMap({
  highlightDurationMs = 5000,
  activeContinentId,
  onContinentPress,
  enableSpeech = true,
  showLabel = true,
}: WorldMapProps) {
  const [internalActiveContinentId, setInternalActiveContinentId] =
    useState<ContinentId | null>(null);
  const [svgPaths, setSvgPaths] = useState<SvgPathData[]>([]);
  const [viewBox, setViewBox] = useState("0 0 800 600");
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<number | null>(null);
  const isControlled = activeContinentId !== undefined;
  const effectiveActiveContinentId = isControlled
    ? activeContinentId
    : internalActiveContinentId;

  useEffect(() => {
    async function initMap() {
      try {
        const svgRes = await fetch("/maps/world.svg");
        const svgText = await svgRes.text();

        const countries = await getCountries();
        const countryMap = new Map<string, Country>();
        countries.forEach((c) => {
          countryMap.set(c.cca2.toLowerCase(), c);
        });

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");

        const svgElement = doc.querySelector("svg");
        const viewBoxValue =
          svgElement?.getAttribute("viewBox") ?? "0 0 800 600";
        setViewBox(viewBoxValue);

        const paths = Array.from(doc.querySelectorAll("path"));

        const extractedPaths: SvgPathData[] = paths.map((p, index) => {
          const rawId =
            p.getAttribute("id") ??
            p.closest("g[id]")?.getAttribute("id") ??
            "";
          const id = rawId || `path-${index}`;
          const d = p.getAttribute("d") || "";
          let continentId: ContinentId | null = null;

          const lookupId = rawId.toLowerCase();
          if (lookupId === "_somaliland") {
            continentId = "africa";
          } else if (lookupId) {
            const country = countryMap.get(lookupId);
            if (country) {
              continentId = mapCountryToContinent(
                country.region,
                country.subregion,
                country.cca2,
              );
            }
          }

          return { id, d, continentId };
        });

        setSvgPaths(extractedPaths);
      } catch (e) {
        console.error("Failed to load map:", e);
      } finally {
        setLoading(false);
      }
    }

    initMap();
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleContinentPress = (id: ContinentId) => {
    onContinentPress?.(id);

    if (isControlled) {
      return;
    }

    if (timeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(timeoutRef.current);
    }

    setInternalActiveContinentId(id);
    if (enableSpeech) {
      speakContinentName(id);
    }

    if (typeof window !== "undefined") {
      const timeoutId = window.setTimeout(() => {
        setInternalActiveContinentId(null);
      }, highlightDurationMs);
      timeoutRef.current = timeoutId;
    }
  };

  const activeContinent = effectiveActiveContinentId
    ? findContinentById(effectiveActiveContinentId)
    : null;

  if (loading) {
    return (
      <div className="flex w-full max-w-4xl aspect-video items-center justify-center rounded-xl bg-sky-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
      <svg
        viewBox={viewBox}
        className="h-full w-full bg-sky-300"
        aria-label="World map with tappable continents"
      >
        {svgPaths.map((pathData, index) => {
          const continent = pathData.continentId
            ? findContinentById(pathData.continentId)
            : null;
          const isActive = pathData.continentId === effectiveActiveContinentId;

          const fill = continent
            ? isActive
              ? continent.activeColor
              : continent.color
            : "#f1f5f9";

          const stroke = isActive ? "#ffffff" : "#ffffff";
          const strokeWidth = isActive ? 1.5 : 0.5;

          if (!continent) {
            return (
              <path
                key={`${pathData.id}-${index}`}
                d={pathData.d}
                fill={fill}
                stroke="#cbd5e1"
                strokeWidth={0.5}
              />
            );
          }

          return (
            <path
              key={`${pathData.id}-${index}`}
              d={pathData.d}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              role="button"
              aria-label={continent.name}
              tabIndex={0}
              className="cursor-pointer outline-none transition-colors focus:outline-none focus-visible:outline-none"
              style={{ outline: "none" }}
              onClick={(event) => {
                handleContinentPress(continent.id);
                (event.currentTarget as SVGPathElement).blur();
              }}
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

      {showLabel && activeContinent && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 px-6 py-3 text-xl font-bold text-slate-900 shadow-2xl ring-1 ring-slate-900/10 backdrop-blur-sm transition-all animate-in fade-in zoom-in duration-300 md:text-3xl"
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
