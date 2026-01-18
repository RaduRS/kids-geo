"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  WORLD_MAP_SVG_SRC,
  findContinentById,
  mapCountryToContinent,
  shouldKeepOnlyMainlandForContinent,
} from "@/lib/geo/continents";
import { getCountries, type Country } from "@/lib/api/countries";

type SvgCountryPath = {
  id: string;
  d: string;
  countryCode: string | null;
};

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  kv: "xk",
};

const COUNTRY_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
];

export default function ContinentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const continent = findContinentById(id);
  const [countriesByCode, setCountriesByCode] = useState<Map<string, Country>>(
    () => new Map(),
  );
  const [svgPaths, setSvgPaths] = useState<SvgCountryPath[]>([]);
  const [baseViewBox, setBaseViewBox] = useState("0 0 100 100");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(true);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryQueryNotFound, setCountryQueryNotFound] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panGestureRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const pinchGestureRef = useRef<{
    startDistance: number;
    startScale: number;
    startPanX: number;
    startPanY: number;
    centerClientX: number;
    centerClientY: number;
  } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const base = useMemo(() => {
    const [x, y, w, h] = baseViewBox.split(/\s+/).map(Number);
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      w: Number.isFinite(w) && w > 0 ? w : 100,
      h: Number.isFinite(h) && h > 0 ? h : 100,
    };
  }, [baseViewBox]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    setScale(1);
    setPan({ x: base.x, y: base.y });
  }, [base.x, base.y, base.w, base.h]);

  const currentViewBox = useMemo(() => {
    const clampedScale = Math.min(5, Math.max(1, scale));
    const currentW = base.w / clampedScale;
    const currentH = base.h / clampedScale;
    const maxX = base.x + base.w - currentW;
    const maxY = base.y + base.h - currentH;
    const nextX = Math.min(Math.max(pan.x, base.x), maxX);
    const nextY = Math.min(Math.max(pan.y, base.y), maxY);
    return `${nextX} ${nextY} ${currentW} ${currentH}`;
  }, [base.h, base.w, base.x, base.y, pan.x, pan.y, scale]);

  const continentCountries = useMemo(() => {
    const uniqueByCode = new Map<string, Country>();
    svgPaths.forEach((path) => {
      if (!path.countryCode) return;
      const country = countriesByCode.get(path.countryCode);
      if (!country) return;
      uniqueByCode.set(country.cca2.toLowerCase(), country);
    });
    return Array.from(uniqueByCode.values()).sort((a, b) =>
      a.name.common.localeCompare(b.name.common),
    );
  }, [countriesByCode, svgPaths]);

  const getCountryFill = (countryCode: string) => {
    let hash = 0;
    for (let i = 0; i < countryCode.length; i += 1) {
      hash = (hash * 31 + countryCode.charCodeAt(i)) >>> 0;
    }
    return COUNTRY_COLORS[hash % COUNTRY_COLORS.length];
  };

  const zoomAtClientPoint = (
    clientX: number,
    clientY: number,
    nextScale: number,
    referencePan: { x: number; y: number },
    referenceScale: number,
  ) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { scale: Math.min(5, Math.max(1, nextScale)), pan: referencePan };
    }

    const refW = base.w / referenceScale;
    const refH = base.h / referenceScale;
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    const worldX = referencePan.x + rx * refW;
    const worldY = referencePan.y + ry * refH;

    const clampedScale = Math.min(5, Math.max(1, nextScale));
    const nextW = base.w / clampedScale;
    const nextH = base.h / clampedScale;
    const nextPanX = worldX - rx * nextW;
    const nextPanY = worldY - ry * nextH;

    const maxX = base.x + base.w - nextW;
    const maxY = base.y + base.h - nextH;

    return {
      scale: clampedScale,
      pan: {
        x: Math.min(Math.max(nextPanX, base.x), maxX),
        y: Math.min(Math.max(nextPanY, base.y), maxY),
      },
    };
  };

  const searchAndSelectCountry = (rawQuery: string) => {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return;

    const matchBy = (
      value: string | undefined,
      mode: "equals" | "starts" | "includes",
    ) => {
      if (!value) return false;
      const normalized = value.toLowerCase();
      if (mode === "equals") return normalized === query;
      if (mode === "starts") return normalized.startsWith(query);
      return normalized.includes(query);
    };

    let found =
      query.length === 2
        ? continentCountries.find((c) => c.cca2.toLowerCase() === query)
        : undefined;

    found =
      found ??
      continentCountries.find((c) => matchBy(c.name.common, "equals")) ??
      continentCountries.find((c) => matchBy(c.name.official, "equals")) ??
      continentCountries.find((c) => matchBy(c.name.common, "starts")) ??
      continentCountries.find((c) => matchBy(c.name.common, "includes")) ??
      continentCountries.find((c) => matchBy(c.name.official, "includes"));

    if (!found) {
      setCountryQueryNotFound(true);
      return;
    }

    setCountryQueryNotFound(false);
    setSelectedCountry(found);
    speakCountryName(found);
  };

  useEffect(() => {
    async function loadData() {
      if (!continent) return;

      setLoading(true);
      setSelectedCountry(null);
      setCountryQuery("");
      setCountryQueryNotFound(false);

      try {
        const [allCountries, svgText] = await Promise.all([
          getCountries(),
          fetch(WORLD_MAP_SVG_SRC).then((res) => res.text()),
        ]);

        const map = new Map<string, Country>();
        allCountries.forEach((country) => {
          map.set(country.cca2.toLowerCase(), country);
        });
        setCountriesByCode(map);

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svg = doc.querySelector("svg");

        if (!svg) {
          setSvgPaths([]);
          setBaseViewBox("0 0 100 100");
          return;
        }

        const svgForBBox = svg.cloneNode(true) as SVGSVGElement;
        svgForBBox.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svgForBBox.removeAttribute("width");
        svgForBBox.removeAttribute("height");

        const paths = Array.from(svgForBBox.querySelectorAll("path"));
        const extractedPaths: SvgCountryPath[] = [];

        paths.forEach((p, index) => {
          const rawId =
            p.getAttribute("id") ??
            p.closest("g[id]")?.getAttribute("id") ??
            "";
          const normalized = rawId.toLowerCase();

          if (normalized === "_somaliland") {
            if (continent.id !== "africa") {
              p.remove();
              return;
            }

            extractedPaths.push({
              id: rawId || `path-${index}`,
              d: p.getAttribute("d") || "",
              countryCode: null,
            });

            return;
          }

          const aliased = COUNTRY_CODE_ALIASES[normalized] ?? normalized;
          const countryCode = aliased.length === 2 ? aliased : null;

          if (!countryCode) {
            p.remove();
            return;
          }

          if (
            shouldKeepOnlyMainlandForContinent(continent.id, countryCode) &&
            !p.classList.contains("mainland")
          ) {
            p.remove();
            return;
          }

          const country = map.get(countryCode);
          if (!country) {
            p.remove();
            return;
          }

          const countryContinent = mapCountryToContinent(
            country.region,
            country.subregion,
            country.cca2,
          );

          if (countryContinent !== continent.id) {
            p.remove();
            return;
          }

          extractedPaths.push({
            id: rawId || `path-${index}`,
            d: p.getAttribute("d") || "",
            countryCode,
          });
        });

        setSvgPaths(extractedPaths);

        const tempHost = document.createElement("div");
        tempHost.style.position = "absolute";
        tempHost.style.left = "-10000px";
        tempHost.style.top = "0";
        tempHost.style.width = "1px";
        tempHost.style.height = "1px";
        tempHost.style.overflow = "visible";
        tempHost.style.visibility = "hidden";
        document.body.appendChild(tempHost);

        try {
          const importedSvg = document.importNode(svgForBBox, true);
          importedSvg.setAttribute("width", "1000");
          importedSvg.setAttribute("height", "1000");
          tempHost.appendChild(importedSvg);

          const bboxTarget =
            importedSvg.querySelector("g") ??
            (importedSvg as SVGGraphicsElement);
          const bbox = (bboxTarget as SVGGraphicsElement).getBBox();
          const padX = bbox.width * 0.05;
          const padY = bbox.height * 0.05;
          setBaseViewBox(
            `${bbox.x - padX} ${bbox.y - padY} ${bbox.width + padX * 2} ${bbox.height + padY * 2}`,
          );
        } finally {
          tempHost.remove();
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [continent]);

  if (!continent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-red-600">Continent not found</h1>
        <Link href="/continents" className="mt-4 text-sky-600 underline">
          Back to list
        </Link>
      </div>
    );
  }

  const baseFill = "#e2e8f0";

  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              {continent.name}
            </h1>
            <p className="text-base text-slate-700 md:text-lg">
              Tap a country to hear its name and see details.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
          <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
            <div className="border-b border-slate-200/60 bg-slate-50 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-slate-700">
                  {loading ? "Loading map…" : "Map"}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                  <div className="flex w-full items-center gap-2 sm:w-[260px]">
                    <input
                      value={countryQuery}
                      onChange={(event) => {
                        setCountryQuery(event.target.value);
                        setCountryQueryNotFound(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        searchAndSelectCountry(countryQuery);
                      }}
                      type="search"
                      inputMode="search"
                      autoComplete="off"
                      placeholder="Search country…"
                      aria-label="Search country"
                      className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none placeholder:font-semibold placeholder:text-slate-400 focus:outline-none focus-visible:outline-none"
                      disabled={loading || continentCountries.length === 0}
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-400"
                      onClick={() => searchAndSelectCountry(countryQuery)}
                      disabled={loading || continentCountries.length === 0}
                    >
                      Find
                    </button>
                  </div>
                  {countryQueryNotFound ? (
                    <div className="text-xs font-semibold text-rose-700">
                      Not found in {continent.name}.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6">
              <div className="relative w-full h-[55vh] md:h-[70vh] lg:h-[75vh] rounded-2xl bg-slate-100">
                {loading ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600"></div>
                  </div>
                ) : (
                  <svg
                    ref={svgRef}
                    viewBox={currentViewBox}
                    preserveAspectRatio="xMidYMid meet"
                    className="h-full w-full touch-none"
                    aria-label={`${continent.name} country map`}
                    onWheel={(event) => {
                      event.preventDefault();
                      const zoomFactor = Math.exp(-event.deltaY * 0.001);
                      const currentScale = scaleRef.current;
                      const currentPan = panRef.current;
                      const nextScale = Math.min(
                        5,
                        Math.max(1, currentScale * zoomFactor),
                      );
                      const next = zoomAtClientPoint(
                        event.clientX,
                        event.clientY,
                        nextScale,
                        currentPan,
                        currentScale,
                      );
                      setScale(next.scale);
                      setPan(next.pan);
                    }}
                    onPointerDown={(event) => {
                      if (!svgRef.current) return;
                      const captureTarget = event.target as Element | null;
                      if (
                        captureTarget &&
                        "setPointerCapture" in captureTarget &&
                        typeof (
                          captureTarget as { setPointerCapture?: unknown }
                        ).setPointerCapture === "function"
                      ) {
                        (
                          captureTarget as Element & {
                            setPointerCapture: (pointerId: number) => void;
                          }
                        ).setPointerCapture(event.pointerId);
                      } else {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }
                      pointersRef.current.set(event.pointerId, {
                        x: event.clientX,
                        y: event.clientY,
                      });

                      const currentPan = panRef.current;
                      const currentScale = scaleRef.current;

                      if (pointersRef.current.size === 1) {
                        panGestureRef.current = {
                          startClientX: event.clientX,
                          startClientY: event.clientY,
                          startPanX: currentPan.x,
                          startPanY: currentPan.y,
                        };
                        pinchGestureRef.current = null;
                        return;
                      }

                      if (pointersRef.current.size === 2) {
                        const points = Array.from(pointersRef.current.values());
                        const dx = points[0].x - points[1].x;
                        const dy = points[0].y - points[1].y;
                        const startDistance = Math.hypot(dx, dy) || 1;

                        const centerClientX = (points[0].x + points[1].x) / 2;
                        const centerClientY = (points[0].y + points[1].y) / 2;

                        pinchGestureRef.current = {
                          startDistance,
                          startScale: currentScale,
                          startPanX: currentPan.x,
                          startPanY: currentPan.y,
                          centerClientX,
                          centerClientY,
                        };
                        panGestureRef.current = null;
                      }
                    }}
                    onPointerMove={(event) => {
                      if (!svgRef.current) return;
                      if (!pointersRef.current.has(event.pointerId)) return;
                      pointersRef.current.set(event.pointerId, {
                        x: event.clientX,
                        y: event.clientY,
                      });

                      const pinchGesture = pinchGestureRef.current;
                      if (pinchGesture && pointersRef.current.size >= 2) {
                        const points = Array.from(pointersRef.current.values());
                        const dx = points[0].x - points[1].x;
                        const dy = points[0].y - points[1].y;
                        const distance = Math.hypot(dx, dy) || 1;
                        const nextScaleRaw =
                          pinchGesture.startScale *
                          (distance / pinchGesture.startDistance);
                        const next = zoomAtClientPoint(
                          pinchGesture.centerClientX,
                          pinchGesture.centerClientY,
                          nextScaleRaw,
                          {
                            x: pinchGesture.startPanX,
                            y: pinchGesture.startPanY,
                          },
                          pinchGesture.startScale,
                        );
                        setScale(next.scale);
                        setPan(next.pan);
                        return;
                      }

                      const panGesture = panGestureRef.current;
                      if (!panGesture || pointersRef.current.size !== 1) {
                        return;
                      }

                      const rect = svgRef.current.getBoundingClientRect();
                      const currentScale = scaleRef.current;
                      const currentW = base.w / currentScale;
                      const currentH = base.h / currentScale;
                      const dxClient = event.clientX - panGesture.startClientX;
                      const dyClient = event.clientY - panGesture.startClientY;
                      const dxWorld = (dxClient / rect.width) * currentW;
                      const dyWorld = (dyClient / rect.height) * currentH;
                      const nextPanX = panGesture.startPanX - dxWorld;
                      const nextPanY = panGesture.startPanY - dyWorld;
                      const maxX = base.x + base.w - currentW;
                      const maxY = base.y + base.h - currentH;
                      setPan({
                        x: Math.min(Math.max(nextPanX, base.x), maxX),
                        y: Math.min(Math.max(nextPanY, base.y), maxY),
                      });
                    }}
                    onPointerUp={(event) => {
                      pointersRef.current.delete(event.pointerId);
                      if (pointersRef.current.size === 0) {
                        panGestureRef.current = null;
                        pinchGestureRef.current = null;
                        return;
                      }

                      if (pointersRef.current.size === 1) {
                        const currentPan = panRef.current;
                        const remaining = Array.from(
                          pointersRef.current.values(),
                        )[0];
                        panGestureRef.current = {
                          startClientX: remaining.x,
                          startClientY: remaining.y,
                          startPanX: currentPan.x,
                          startPanY: currentPan.y,
                        };
                        pinchGestureRef.current = null;
                      }
                    }}
                    onPointerCancel={(event) => {
                      pointersRef.current.delete(event.pointerId);
                      if (pointersRef.current.size === 0) {
                        panGestureRef.current = null;
                        pinchGestureRef.current = null;
                      }
                    }}
                  >
                    {svgPaths.map((pathData, index) => {
                      const code = pathData.countryCode;
                      const country = code ? countriesByCode.get(code) : null;
                      const isSelected =
                        !!selectedCountry &&
                        !!country &&
                        selectedCountry.cca2.toLowerCase() ===
                          country.cca2.toLowerCase();

                      const fill = country
                        ? getCountryFill(country.cca2.toLowerCase())
                        : baseFill;
                      const stroke = isSelected ? "#0f172a" : "#ffffff";
                      const strokeWidth = isSelected ? 1.4 : 0.6;

                      return (
                        <path
                          key={`${pathData.id}-${index}`}
                          d={pathData.d}
                          fill={fill}
                          stroke={country ? stroke : "#ffffff"}
                          strokeWidth={country ? strokeWidth : 0.6}
                          role={country ? "button" : undefined}
                          aria-label={country ? country.name.common : undefined}
                          tabIndex={country ? 0 : -1}
                          className={
                            country
                              ? "cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                              : undefined
                          }
                          style={country ? { outline: "none" } : undefined}
                          onClick={() => {
                            if (!country) return;
                            setSelectedCountry(country);
                            speakCountryName(country);
                          }}
                          onKeyDown={(event) => {
                            if (!country) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedCountry(country);
                              speakCountryName(country);
                            }
                          }}
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          </section>

          <aside className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10 lg:sticky lg:top-6">
            <div className="border-b border-slate-200/60 bg-slate-50 px-5 py-4">
              <div className="text-sm font-semibold text-slate-700">
                Country details
              </div>
            </div>

            <div className="p-5">
              {selectedCountry ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="relative h-14 w-20 overflow-hidden rounded-xl ring-1 ring-slate-900/10 outline-none focus:outline-none focus-visible:outline-none"
                      onClick={() => speakCountryName(selectedCountry)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          speakCountryName(selectedCountry);
                        }
                      }}
                      aria-label={`Speak ${selectedCountry.name.common}`}
                    >
                      <Image
                        src={selectedCountry.flags.svg}
                        alt={
                          selectedCountry.flags.alt ||
                          `Flag of ${selectedCountry.name.common}`
                        }
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="block w-full truncate text-left text-xl font-bold text-slate-900 outline-none focus:outline-none focus-visible:outline-none"
                        onClick={() => speakCountryName(selectedCountry)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            speakCountryName(selectedCountry);
                          }
                        }}
                        aria-label={`Speak ${selectedCountry.name.common}`}
                      >
                        {selectedCountry.name.common}{" "}
                        <span className="font-semibold text-slate-500">
                          | {selectedCountry.cca2}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="mt-1 block w-full text-left text-base font-semibold text-slate-700 outline-none focus:outline-none focus-visible:outline-none"
                        onClick={() => {
                          const capital = selectedCountry.capital?.[0];
                          if (!capital) return;
                          speakText(capital);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return;
                          }
                          event.preventDefault();
                          const capital = selectedCountry.capital?.[0];
                          if (!capital) return;
                          speakText(capital);
                        }}
                        aria-label={`Speak capital of ${selectedCountry.name.common}`}
                      >
                        {selectedCountry.capital?.[0] || "N/A"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-slate-700 ring-1 ring-slate-900/10">
                  Tap a country on the map to see its name, capital, and flag.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function speakCountryName(country: Country) {
  speakText(country.name.common);
}

function speakText(text: string) {
  if (!text.trim()) {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  const synth = window.speechSynthesis;
  if (!synth) {
    return;
  }

  if (synth.speaking) {
    synth.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  synth.speak(utterance);
}
