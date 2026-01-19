"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ZoomableSvg } from "@/app/components/zoomable-svg";
import { WorldMap } from "@/app/components/world-map";
import { getCountries, type Country } from "@/lib/api/countries";
import {
  CONTINENTS,
  type ContinentId,
  WORLD_MAP_SVG_SRC,
  findContinentById,
  mapCountryToContinent,
  shouldKeepOnlyMainlandForContinent,
} from "@/lib/geo/continents";

type QuizMode = "landing" | "continents" | "countries" | "flags" | "capitals";

type SvgCountryPath = {
  id: string;
  d: string;
  countryCode: string | null;
};

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  kv: "xk",
};

function shuffle<T>(items: readonly T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function speakText(text: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  synth.speak(utterance);
}

function getPrimaryCapital(country: Country | null | undefined) {
  const capital = country?.capital?.[0]?.trim();
  return capital && capital.length > 0 ? capital : null;
}

function ResultBadge({ variant }: { variant: "correct" | "wrong" }) {
  const isCorrect = variant === "correct";
  const wrapperClass = isCorrect
    ? "flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200"
    : "flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 ring-1 ring-rose-200";

  const iconClass = isCorrect
    ? "h-5 w-5 text-emerald-700"
    : "h-5 w-5 text-rose-700";

  return (
    <span className={wrapperClass} aria-hidden="true">
      {isCorrect ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      )}
    </span>
  );
}

function CountryContinentPicker({
  svgText,
  codeToContinent,
  onSelect,
}: {
  svgText: string | null;
  codeToContinent: Map<string, ContinentId> | null;
  onSelect: (id: ContinentId) => void;
}) {
  return (
    <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CONTINENTS.map((continent) => {
        const previewReady = !!svgText && !!codeToContinent;

        return (
          <button
            key={continent.id}
            type="button"
            onClick={() => onSelect(continent.id)}
            className="group relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10 transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            <div className="relative flex h-44 w-full items-center justify-center bg-slate-50 md:h-52">
              {previewReady ? (
                <ContinentSvgPreview
                  svgText={svgText}
                  codeToContinent={codeToContinent}
                  continentId={continent.id}
                  color={continent.color}
                  name={continent.name}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="text-sm font-semibold text-slate-700">
                    Preview loading…
                  </div>
                  <div className="text-xs text-slate-500">
                    {continent.name} map preview
                  </div>
                </div>
              )}
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-bold text-slate-900 md:text-2xl">
                    {continent.name}
                  </div>
                </div>
                <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition-colors group-hover:bg-slate-800">
                  Open
                </div>
              </div>
            </div>

            <div
              className="h-2 w-full"
              style={{ backgroundColor: continent.color }}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </section>
  );
}

function ContinentSvgPreview({
  svgText,
  codeToContinent,
  continentId,
  color,
  name,
}: {
  svgText: string;
  codeToContinent: Map<string, ContinentId>;
  continentId: ContinentId;
  color: string;
  name: string;
}) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svg = doc.querySelector("svg");

        if (!svg) {
          return;
        }

        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.removeAttribute("width");
        svg.removeAttribute("height");

        const paths = Array.from(svg.querySelectorAll("path"));
        paths.forEach((p) => {
          const rawId =
            p.getAttribute("id") ??
            p.closest("g[id]")?.getAttribute("id") ??
            "";
          const normalized = rawId.toLowerCase();
          const isSomaliland = normalized === "_somaliland";
          const mappedContinent = isSomaliland
            ? ("africa" as const)
            : (codeToContinent.get(normalized) ?? null);

          if (mappedContinent !== continentId) {
            p.remove();
            return;
          }

          if (
            shouldKeepOnlyMainlandForContinent(continentId, normalized) &&
            !p.classList.contains("mainland")
          ) {
            p.remove();
            return;
          }

          p.setAttribute("fill", color);
          p.setAttribute("stroke", "#ffffff");
          p.setAttribute("stroke-width", "0.5");
          p.removeAttribute("class");
        });

        const tempHost = document.createElement("div");
        tempHost.style.position = "absolute";
        tempHost.style.left = "-10000px";
        tempHost.style.top = "0";
        tempHost.style.width = "1px";
        tempHost.style.height = "1px";
        tempHost.style.overflow = "visible";
        tempHost.style.visibility = "hidden";
        document.body.appendChild(tempHost);

        let markup: string | null = null;

        try {
          const importedSvg = document.importNode(svg, true);
          importedSvg.setAttribute("width", "100%");
          importedSvg.setAttribute("height", "100%");
          tempHost.appendChild(importedSvg);

          const bboxTarget =
            importedSvg.querySelector("g") ??
            (importedSvg as SVGGraphicsElement);
          const bbox = (bboxTarget as SVGGraphicsElement).getBBox();
          const padX = bbox.width * 0.06;
          const padY = bbox.height * 0.06;
          const viewBox = `${bbox.x - padX} ${bbox.y - padY} ${bbox.width + padX * 2} ${bbox.height + padY * 2}`;
          importedSvg.setAttribute("viewBox", viewBox);

          const serializer = new XMLSerializer();
          markup = serializer.serializeToString(importedSvg);
        } finally {
          tempHost.remove();
        }

        if (!cancelled) {
          setSvgMarkup(markup);
        }
      } catch {
        if (!cancelled) {
          setSvgMarkup(null);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [codeToContinent, color, continentId, svgText]);

  const label = useMemo(() => `${name} map preview`, [name]);

  if (!svgMarkup) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="text-sm font-semibold text-slate-700">
          Preview loading…
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full p-4 [&_svg]:h-full [&_svg]:w-full"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}

function WorldSvgPreview({ svgText }: { svgText: string }) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svg = doc.querySelector("svg");

        if (!svg) {
          return;
        }

        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.removeAttribute("width");
        svg.removeAttribute("height");

        const paths = Array.from(svg.querySelectorAll("path"));
        paths.forEach((p) => {
          p.setAttribute("fill", "#cbd5e1");
          p.setAttribute("stroke", "#ffffff");
          p.setAttribute("stroke-width", "0.5");
          p.removeAttribute("class");
        });

        const serializer = new XMLSerializer();
        const markup = serializer.serializeToString(svg);
        if (!cancelled) {
          setSvgMarkup(markup);
        }
      } catch {
        if (!cancelled) {
          setSvgMarkup(null);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [svgText]);

  if (!svgMarkup) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="text-sm font-semibold text-slate-700">
          Preview loading…
        </div>
        <div className="text-xs text-slate-500">World map preview</div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full p-4 [&_svg]:h-full [&_svg]:w-full"
      aria-label="World map preview"
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}

function EuropeHighlightPreview({
  svgText,
  codeToContinent,
  highlightCode,
}: {
  svgText: string;
  codeToContinent: Map<string, ContinentId>;
  highlightCode: string;
}) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const svg = doc.querySelector("svg");

        if (!svg) {
          return;
        }

        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.removeAttribute("width");
        svg.removeAttribute("height");

        const normalizedHighlight = highlightCode.toLowerCase();
        const paths = Array.from(svg.querySelectorAll("path"));
        paths.forEach((p) => {
          const rawId =
            p.getAttribute("id") ??
            p.closest("g[id]")?.getAttribute("id") ??
            "";
          const normalized = rawId.toLowerCase();
          const isSomaliland = normalized === "_somaliland";
          const mappedContinent = isSomaliland
            ? ("africa" as const)
            : (codeToContinent.get(normalized) ?? null);

          if (mappedContinent !== "europe") {
            p.remove();
            return;
          }

          if (
            shouldKeepOnlyMainlandForContinent("europe", normalized) &&
            !p.classList.contains("mainland")
          ) {
            p.remove();
            return;
          }

          const isHighlight =
            normalized === normalizedHighlight ||
            (normalizedHighlight === "gb" && normalized === "uk");
          p.setAttribute("fill", isHighlight ? "#86efac" : "#e2e8f0");
          p.setAttribute("stroke", "#ffffff");
          p.setAttribute("stroke-width", "0.5");
          p.removeAttribute("class");
        });

        const tempHost = document.createElement("div");
        tempHost.style.position = "absolute";
        tempHost.style.left = "-10000px";
        tempHost.style.top = "0";
        tempHost.style.width = "1px";
        tempHost.style.height = "1px";
        tempHost.style.overflow = "visible";
        tempHost.style.visibility = "hidden";
        document.body.appendChild(tempHost);

        let markup: string | null = null;

        try {
          const importedSvg = document.importNode(svg, true);
          importedSvg.setAttribute("width", "100%");
          importedSvg.setAttribute("height", "100%");
          tempHost.appendChild(importedSvg);

          const bboxTarget =
            importedSvg.querySelector("g") ??
            (importedSvg as SVGGraphicsElement);
          const bbox = (bboxTarget as SVGGraphicsElement).getBBox();
          const padX = bbox.width * 0.06;
          const padY = bbox.height * 0.06;
          const viewBox = `${bbox.x - padX} ${bbox.y - padY} ${bbox.width + padX * 2} ${bbox.height + padY * 2}`;
          importedSvg.setAttribute("viewBox", viewBox);

          const serializer = new XMLSerializer();
          markup = serializer.serializeToString(importedSvg);
        } finally {
          tempHost.remove();
        }

        if (!cancelled) {
          setSvgMarkup(markup);
        }
      } catch {
        if (!cancelled) {
          setSvgMarkup(null);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [codeToContinent, highlightCode, svgText]);

  if (!svgMarkup) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="text-sm font-semibold text-slate-700">
          Preview loading…
        </div>
        <div className="text-xs text-slate-500">Europe map preview</div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full p-4 [&_svg]:h-full [&_svg]:w-full"
      aria-label="Europe map preview"
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}

export default function QuizPage() {
  const [mode, setMode] = useState<QuizMode>("landing");
  const [svgText, setSvgText] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[] | null>(null);

  const codeToContinent = useMemo(() => {
    if (!countries) return null;
    const map = new Map<string, ContinentId>();
    countries.forEach((country) => {
      const continentId = mapCountryToContinent(
        country.region,
        country.subregion,
        country.cca2,
      );
      if (continentId) {
        map.set(country.cca2.toLowerCase(), continentId);
      }
    });
    map.set("_somaliland", "africa");
    return map;
  }, [countries]);

  const allCountriesByCode = useMemo(() => {
    const map = new Map<string, Country>();
    (countries ?? []).forEach((country) => {
      map.set(country.cca2.toLowerCase(), country);
    });
    return map;
  }, [countries]);

  const previewCapitalCountry = useMemo(() => {
    const preferred = ["us", "gb", "fr"];
    for (const code of preferred) {
      const country = allCountriesByCode.get(code);
      if (
        country &&
        getPrimaryCapital(country) &&
        (country.flags?.svg || country.flags?.png)
      ) {
        return country;
      }
    }

    return (
      Array.from(allCountriesByCode.values()).find(
        (country) =>
          getPrimaryCapital(country) &&
          (country.flags?.svg || country.flags?.png),
      ) ?? null
    );
  }, [allCountriesByCode]);

  const previewCapitalName = getPrimaryCapital(previewCapitalCountry);

  const previewFlagCountries = useMemo(() => {
    const preferred = ["us", "fr", "jp", "br", "ng"];
    const selected: Country[] = [];
    const seen = new Set<string>();

    preferred.forEach((code) => {
      const country = allCountriesByCode.get(code);
      if (!country) return;
      const flag = country.flags?.svg || country.flags?.png;
      if (!flag) return;
      selected.push(country);
      seen.add(country.cca2.toLowerCase());
    });

    if (selected.length < 5) {
      for (const country of allCountriesByCode.values()) {
        if (selected.length >= 5) break;
        if (seen.has(country.cca2.toLowerCase())) continue;
        const flag = country.flags?.svg || country.flags?.png;
        if (!flag) continue;
        selected.push(country);
        seen.add(country.cca2.toLowerCase());
      }
    }

    return selected.slice(0, 5);
  }, [allCountriesByCode]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [nextSvgText, nextCountries] = await Promise.all([
        fetch(WORLD_MAP_SVG_SRC).then((res) => res.text()),
        getCountries(),
      ]);

      if (cancelled) return;
      setSvgText(nextSvgText);
      setCountries(nextCountries);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get("reset")) return;
    setMode("landing");
    setSelectedContinentId(null);
    setCountryQuestionOrder([]);
    setCountrySvgPaths([]);
    setCountryAnswered(false);
    setCountryRevealCode(null);
    setCountryLastGuessCode(null);
    setCountryScore(0);
    setCountryQuestionIndex(0);
    setCountryAvailableCodes([]);
    setCountryMapLoading(false);
    setCapitalsContinentId(null);
    setCapitalsQuestionOrder([]);
    setCapitalsSvgPaths([]);
    setCapitalsAnswered(false);
    setCapitalsRevealCode(null);
    setCapitalsLastGuess(null);
    setCapitalsSelectedAnswer(null);
    setCapitalsOptions([]);
    setCapitalsAvailableCodes([]);
    setCapitalsScore(0);
    setCapitalsQuestionIndex(0);
    setCapitalsMapLoading(false);
    setFlagsContinentId(null);
    setFlagsQuestionOrder([]);
    setFlagsSvgPaths([]);
    setFlagsAnswered(false);
    setFlagsRevealCode(null);
    setFlagsLastGuessCode(null);
    setFlagsAvailableCodes([]);
    setFlagsScore(0);
    setFlagsQuestionIndex(0);
    setFlagsMapLoading(false);
    setContinentOrder([]);
    setContinentQuestionIndex(0);
    setContinentScore(0);
    setContinentAnswered(false);
    setContinentRevealId(null);
    setContinentLastGuessId(null);
  }, []);

  const [continentOrder, setContinentOrder] = useState<ContinentId[]>([]);
  const [continentQuestionIndex, setContinentQuestionIndex] = useState(0);
  const [continentScore, setContinentScore] = useState(0);
  const [continentAnswered, setContinentAnswered] = useState(false);
  const [continentRevealId, setContinentRevealId] =
    useState<ContinentId | null>(null);
  const [continentLastGuessId, setContinentLastGuessId] =
    useState<ContinentId | null>(null);

  const startContinentsQuiz = () => {
    const order = shuffle(CONTINENTS.map((c) => c.id));
    setContinentOrder(order);
    setContinentQuestionIndex(0);
    setContinentScore(0);
    setContinentAnswered(false);
    setContinentRevealId(null);
    setContinentLastGuessId(null);
    setMode("continents");
  };

  const continentsTargetId = continentOrder[continentQuestionIndex] ?? null;
  const continentsTarget = continentsTargetId
    ? findContinentById(continentsTargetId)
    : null;

  const handleContinentGuess = (guessId: ContinentId) => {
    if (!continentsTargetId) return;

    if (continentAnswered) {
      const isAllowed =
        guessId === continentsTargetId || guessId === continentLastGuessId;
      if (!isAllowed) return;

      const guess = findContinentById(guessId);
      if (guess) {
        speakText(guess.name);
      }
      return;
    }

    setContinentAnswered(true);
    setContinentLastGuessId(guessId);
    setContinentRevealId(continentsTargetId);

    const isCorrect = guessId === continentsTargetId;
    if (isCorrect) {
      setContinentScore((prev) => prev + 1);
    }

    const guess = findContinentById(guessId);
    const target = findContinentById(continentsTargetId);
    if (!guess || !target) return;

    speakText(
      isCorrect
        ? `${target.name}. Correct!`
        : `${guess.name}. Not quite! ${target.name} is here!`,
    );
  };

  const nextContinentQuestion = () => {
    const nextIndex = continentQuestionIndex + 1;
    if (nextIndex >= continentOrder.length) {
      setContinentQuestionIndex(continentOrder.length);
      setContinentAnswered(false);
      setContinentRevealId(null);
      setContinentLastGuessId(null);
      return;
    }

    setContinentQuestionIndex(nextIndex);
    setContinentAnswered(false);
    setContinentRevealId(null);
    setContinentLastGuessId(null);
  };

  const continentsDone =
    continentOrder.length > 0 &&
    continentQuestionIndex >= continentOrder.length;

  const [selectedContinentId, setSelectedContinentId] =
    useState<ContinentId | null>(null);
  const [countriesByCode, setCountriesByCode] = useState<Map<string, Country>>(
    () => new Map(),
  );
  const [countrySvgPaths, setCountrySvgPaths] = useState<SvgCountryPath[]>([]);
  const [countryViewBox, setCountryViewBox] = useState("0 0 100 100");
  const [countryQuestionOrder, setCountryQuestionOrder] = useState<string[]>(
    [],
  );
  const [countryQuestionIndex, setCountryQuestionIndex] = useState(0);
  const [countryScore, setCountryScore] = useState(0);
  const [countryAnswered, setCountryAnswered] = useState(false);
  const [countryRevealCode, setCountryRevealCode] = useState<string | null>(
    null,
  );
  const [countryLastGuessCode, setCountryLastGuessCode] = useState<
    string | null
  >(null);
  const [countryMapLoading, setCountryMapLoading] = useState(false);
  const [countryAvailableCodes, setCountryAvailableCodes] = useState<string[]>(
    [],
  );
  const [capitalsContinentId, setCapitalsContinentId] =
    useState<ContinentId | null>(null);
  const [capitalsCountriesByCode, setCapitalsCountriesByCode] = useState<
    Map<string, Country>
  >(() => new Map());
  const [capitalsSvgPaths, setCapitalsSvgPaths] = useState<SvgCountryPath[]>(
    [],
  );
  const [capitalsViewBox, setCapitalsViewBox] = useState("0 0 100 100");
  const [capitalsQuestionOrder, setCapitalsQuestionOrder] = useState<string[]>(
    [],
  );
  const [capitalsQuestionIndex, setCapitalsQuestionIndex] = useState(0);
  const [capitalsScore, setCapitalsScore] = useState(0);
  const [capitalsAnswered, setCapitalsAnswered] = useState(false);
  const [capitalsRevealCode, setCapitalsRevealCode] = useState<string | null>(
    null,
  );
  const [capitalsLastGuess, setCapitalsLastGuess] = useState<string | null>(
    null,
  );
  const [capitalsMapLoading, setCapitalsMapLoading] = useState(false);
  const [capitalsAvailableCodes, setCapitalsAvailableCodes] = useState<
    string[]
  >([]);
  const [capitalsSelectedAnswer, setCapitalsSelectedAnswer] = useState<
    string | null
  >(null);
  const [capitalsOptions, setCapitalsOptions] = useState<string[]>([]);

  const scoreGoal = 10;

  const [flagsContinentId, setFlagsContinentId] = useState<ContinentId | null>(
    null,
  );
  const [flagsCountriesByCode, setFlagsCountriesByCode] = useState<
    Map<string, Country>
  >(() => new Map());
  const [flagsSvgPaths, setFlagsSvgPaths] = useState<SvgCountryPath[]>([]);
  const [flagsBaseViewBox, setFlagsBaseViewBox] = useState("0 0 100 100");
  const [flagsQuestionOrder, setFlagsQuestionOrder] = useState<string[]>([]);
  const [flagsQuestionIndex, setFlagsQuestionIndex] = useState(0);
  const [flagsScore, setFlagsScore] = useState(0);
  const [flagsAnswered, setFlagsAnswered] = useState(false);
  const [flagsRevealCode, setFlagsRevealCode] = useState<string | null>(null);
  const [flagsLastGuessCode, setFlagsLastGuessCode] = useState<string | null>(
    null,
  );
  const [flagsMapLoading, setFlagsMapLoading] = useState(false);
  const [flagsAvailableCodes, setFlagsAvailableCodes] = useState<string[]>([]);

  const loadContinentMapData = async (continentId: ContinentId) => {
    if (!countries) return null;

    const filteredCountries = countries.filter((country) => {
      const mapped = mapCountryToContinent(
        country.region,
        country.subregion,
        country.cca2,
      );
      return mapped === continentId;
    });

    const map = new Map<string, Country>();
    filteredCountries.forEach((country) => {
      map.set(country.cca2.toLowerCase(), country);
    });

    const nextSvgText =
      svgText ?? (await fetch(WORLD_MAP_SVG_SRC).then((r) => r.text()));
    if (!nextSvgText) {
      return {
        paths: [],
        viewBox: "0 0 100 100",
        countriesByCode: map,
        availableCodes: [],
      };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(nextSvgText, "image/svg+xml");
    const svg = doc.querySelector("svg");

    if (!svg) {
      return {
        paths: [],
        viewBox: "0 0 100 100",
        countriesByCode: map,
        availableCodes: [],
      };
    }

    const svgForBBox = svg.cloneNode(true) as SVGSVGElement;
    svgForBBox.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgForBBox.removeAttribute("width");
    svgForBBox.removeAttribute("height");

    const paths = Array.from(svgForBBox.querySelectorAll("path"));
    const extractedPaths: SvgCountryPath[] = [];

    paths.forEach((p, index) => {
      const rawId =
        p.getAttribute("id") ?? p.closest("g[id]")?.getAttribute("id") ?? "";
      const normalized = rawId.toLowerCase();

      if (normalized === "_somaliland") {
        if (continentId !== "africa") {
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
        shouldKeepOnlyMainlandForContinent(continentId, countryCode) &&
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

      extractedPaths.push({
        id: rawId || `path-${index}`,
        d: p.getAttribute("d") || "",
        countryCode,
      });
    });

    const availableCountryCodes = Array.from(
      new Set(
        extractedPaths
          .map((path) => path.countryCode)
          .filter((code): code is string => !!code),
      ),
    );

    const tempHost = document.createElement("div");
    tempHost.style.position = "absolute";
    tempHost.style.left = "-10000px";
    tempHost.style.top = "0";
    tempHost.style.width = "1px";
    tempHost.style.height = "1px";
    tempHost.style.overflow = "visible";
    tempHost.style.visibility = "hidden";
    document.body.appendChild(tempHost);

    let viewBox = "0 0 100 100";

    try {
      const importedSvg = document.importNode(svgForBBox, true);
      importedSvg.setAttribute("width", "1000");
      importedSvg.setAttribute("height", "1000");
      tempHost.appendChild(importedSvg);

      const bboxTarget =
        importedSvg.querySelector("g") ?? (importedSvg as SVGGraphicsElement);
      const bbox = (bboxTarget as SVGGraphicsElement).getBBox();
      const padX = bbox.width * 0.05;
      const padY = bbox.height * 0.05;
      viewBox = `${bbox.x - padX} ${bbox.y - padY} ${bbox.width + padX * 2} ${bbox.height + padY * 2}`;
    } finally {
      tempHost.remove();
    }

    return {
      paths: extractedPaths,
      viewBox,
      countriesByCode: map,
      availableCodes: availableCountryCodes,
    };
  };

  const startCountriesQuizForContinent = async (continentId: ContinentId) => {
    if (!countries) return;

    setSelectedContinentId(continentId);
    setCountryScore(0);
    setCountryQuestionIndex(0);
    setCountryAnswered(false);
    setCountryRevealCode(null);
    setCountryLastGuessCode(null);
    setCountrySvgPaths([]);
    setCountryViewBox("0 0 100 100");
    setCountryMapLoading(true);
    setCountryAvailableCodes([]);
    setCountryQuestionOrder([]);

    try {
      const data = await loadContinentMapData(continentId);
      if (!data) return;

      setCountriesByCode(data.countriesByCode);
      setCountrySvgPaths(data.paths);
      setCountryViewBox(data.viewBox);
      setCountryAvailableCodes(data.availableCodes);
      const order = shuffle(data.availableCodes).slice(
        0,
        Math.min(20, data.availableCodes.length),
      );
      setCountryQuestionOrder(order);
    } finally {
      setCountryMapLoading(false);
    }

    setMode("countries");
  };

  const countriesTargetCode =
    countryQuestionOrder[countryQuestionIndex] ?? null;
  const countriesTargetCountry = countriesTargetCode
    ? (countriesByCode.get(countriesTargetCode) ?? null)
    : null;

  const handleCountryGuess = (countryCode: string) => {
    if (!countriesTargetCode || countryAnswered || countryScore >= scoreGoal) {
      return;
    }

    setCountryAnswered(true);
    setCountryLastGuessCode(countryCode);
    setCountryRevealCode(countriesTargetCode);

    const isCorrect = countryCode === countriesTargetCode;
    if (isCorrect) {
      setCountryScore((prev) => prev + 1);
    }

    const guessName = countriesByCode.get(countryCode)?.name.common ?? null;
    const targetName =
      countriesByCode.get(countriesTargetCode)?.name.common ?? null;
    if (!guessName || !targetName) return;

    speakText(
      isCorrect
        ? `${targetName}. Correct!`
        : `${guessName}. Not quite! ${targetName} is here!`,
    );
  };

  const nextCountryQuestion = () => {
    if (countryScore >= scoreGoal) return;
    const nextIndex = countryQuestionIndex + 1;
    if (
      nextIndex >= countryQuestionOrder.length &&
      countryAvailableCodes.length
    ) {
      const avoid = new Set(countryQuestionOrder.slice(-3));
      let nextBatch = shuffle(countryAvailableCodes).filter(
        (code) => !avoid.has(code),
      );
      if (!nextBatch.length) {
        nextBatch = shuffle(countryAvailableCodes);
      }
      const append = nextBatch.slice(0, Math.min(20, nextBatch.length));
      if (append.length) {
        setCountryQuestionOrder([...countryQuestionOrder, ...append]);
      }
    }

    setCountryQuestionIndex(nextIndex);
    setCountryAnswered(false);
    setCountryRevealCode(null);
    setCountryLastGuessCode(null);
  };

  const countriesDone =
    selectedContinentId !== null && countryScore >= scoreGoal;

  const startCapitalsQuizForContinent = async (continentId: ContinentId) => {
    if (!countries) return;

    setCapitalsContinentId(continentId);
    setCapitalsScore(0);
    setCapitalsQuestionIndex(0);
    setCapitalsAnswered(false);
    setCapitalsRevealCode(null);
    setCapitalsLastGuess(null);
    setCapitalsSelectedAnswer(null);
    setCapitalsOptions([]);
    setCapitalsSvgPaths([]);
    setCapitalsViewBox("0 0 100 100");
    setCapitalsMapLoading(true);
    setCapitalsAvailableCodes([]);
    setCapitalsQuestionOrder([]);

    try {
      const data = await loadContinentMapData(continentId);
      if (!data) return;

      setCapitalsCountriesByCode(data.countriesByCode);
      setCapitalsSvgPaths(data.paths);
      setCapitalsViewBox(data.viewBox);

      const availableCapitalCodes = data.availableCodes.filter((code) =>
        getPrimaryCapital(data.countriesByCode.get(code) ?? null),
      );
      setCapitalsAvailableCodes(availableCapitalCodes);
      const order = shuffle(availableCapitalCodes).slice(
        0,
        Math.min(20, availableCapitalCodes.length),
      );
      setCapitalsQuestionOrder(order);
    } finally {
      setCapitalsMapLoading(false);
    }

    setMode("capitals");
  };

  const capitalsTargetCode =
    capitalsQuestionOrder[capitalsQuestionIndex] ?? null;
  const capitalsTargetCountry = capitalsTargetCode
    ? (capitalsCountriesByCode.get(capitalsTargetCode) ?? null)
    : null;
  const capitalsTargetCapital = getPrimaryCapital(capitalsTargetCountry);
  useEffect(() => {
    if (!capitalsTargetCode) {
      setCapitalsOptions([]);
      setCapitalsSelectedAnswer(null);
      return;
    }

    const correctCapital = getPrimaryCapital(capitalsTargetCountry);
    if (!correctCapital) {
      setCapitalsOptions([]);
      setCapitalsSelectedAnswer(null);
      return;
    }

    const otherCapitals = capitalsAvailableCodes
      .map((code) => getPrimaryCapital(capitalsCountriesByCode.get(code)))
      .filter(
        (capital): capital is string => !!capital && capital !== correctCapital,
      );
    const uniqueOther = Array.from(new Set(otherCapitals));
    let optionsPool = uniqueOther;

    if (optionsPool.length < 3) {
      const fallbackCapitals = Array.from(allCountriesByCode.values())
        .map((country) => getPrimaryCapital(country))
        .filter(
          (capital): capital is string =>
            !!capital &&
            capital !== correctCapital &&
            !optionsPool.includes(capital),
        );
      const uniqueFallback = Array.from(new Set(fallbackCapitals));
      optionsPool = [
        ...optionsPool,
        ...uniqueFallback.slice(0, 3 - optionsPool.length),
      ];
    }

    const options = shuffle([
      correctCapital,
      ...shuffle(optionsPool).slice(0, 3),
    ]);
    setCapitalsOptions(options);
    setCapitalsSelectedAnswer(null);
  }, [
    allCountriesByCode,
    capitalsAvailableCodes,
    capitalsCountriesByCode,
    capitalsQuestionIndex,
    capitalsTargetCode,
    capitalsTargetCountry,
  ]);

  const handleCapitalAnswerSelect = (capital: string) => {
    speakText(capital);
    if (capitalsAnswered) return;
    setCapitalsSelectedAnswer(capital);
  };

  const handleCapitalSubmit = () => {
    if (
      capitalsAnswered ||
      capitalsScore >= scoreGoal ||
      !capitalsTargetCode ||
      !capitalsTargetCountry
    ) {
      return;
    }

    const correctCapital = getPrimaryCapital(capitalsTargetCountry);
    if (!correctCapital || !capitalsSelectedAnswer) return;

    setCapitalsAnswered(true);
    setCapitalsRevealCode(capitalsTargetCode);
    setCapitalsLastGuess(capitalsSelectedAnswer);

    const isCorrect = capitalsSelectedAnswer === correctCapital;
    if (isCorrect) {
      setCapitalsScore((prev) => prev + 1);
    }

    const answerSentence = `${correctCapital} is the capital of ${capitalsTargetCountry.name.common}.`;
    speakText(
      isCorrect
        ? `${answerSentence} Correct!`
        : `${capitalsSelectedAnswer}. Not quite! ${answerSentence}`,
    );
  };

  const nextCapitalQuestion = () => {
    if (capitalsScore >= scoreGoal) return;
    const nextIndex = capitalsQuestionIndex + 1;
    if (
      nextIndex >= capitalsQuestionOrder.length &&
      capitalsAvailableCodes.length
    ) {
      const avoid = new Set(capitalsQuestionOrder.slice(-3));
      let nextBatch = shuffle(capitalsAvailableCodes).filter(
        (code) => !avoid.has(code),
      );
      if (!nextBatch.length) {
        nextBatch = shuffle(capitalsAvailableCodes);
      }
      const append = nextBatch.slice(0, Math.min(20, nextBatch.length));
      if (append.length) {
        setCapitalsQuestionOrder([...capitalsQuestionOrder, ...append]);
      }
    }

    setCapitalsQuestionIndex(nextIndex);
    setCapitalsAnswered(false);
    setCapitalsRevealCode(null);
    setCapitalsLastGuess(null);
    setCapitalsSelectedAnswer(null);
  };

  const capitalsDone =
    capitalsContinentId !== null && capitalsScore >= scoreGoal;

  const startFlagsQuizForContinent = async (continentId: ContinentId) => {
    if (!countries) return;

    setSelectedContinentId(null);
    setCountryQuestionOrder([]);
    setCountrySvgPaths([]);
    setCountryAnswered(false);
    setCountryRevealCode(null);
    setCountryLastGuessCode(null);

    setFlagsContinentId(continentId);
    setFlagsScore(0);
    setFlagsQuestionIndex(0);
    setFlagsAnswered(false);
    setFlagsRevealCode(null);
    setFlagsLastGuessCode(null);
    setFlagsSvgPaths([]);
    setFlagsBaseViewBox("0 0 100 100");
    setFlagsMapLoading(true);
    setFlagsQuestionOrder([]);
    setFlagsAvailableCodes([]);

    try {
      const data = await loadContinentMapData(continentId);
      if (!data) return;

      setFlagsCountriesByCode(data.countriesByCode);
      setFlagsSvgPaths(data.paths);
      setFlagsBaseViewBox(data.viewBox);
      setFlagsAvailableCodes(data.availableCodes);
      const order = shuffle(data.availableCodes).slice(
        0,
        Math.min(20, data.availableCodes.length),
      );
      setFlagsQuestionOrder(order);
    } finally {
      setFlagsMapLoading(false);
    }

    setMode("flags");
  };

  const flagsTargetCode = flagsQuestionOrder[flagsQuestionIndex] ?? null;
  const flagsTargetCountry = flagsTargetCode
    ? (flagsCountriesByCode.get(flagsTargetCode) ?? null)
    : null;

  const handleFlagGuess = (countryCode: string) => {
    if (!flagsTargetCode || flagsAnswered || flagsScore >= scoreGoal) {
      return;
    }

    setFlagsAnswered(true);
    setFlagsLastGuessCode(countryCode);
    setFlagsRevealCode(flagsTargetCode);

    const isCorrect = countryCode === flagsTargetCode;
    if (isCorrect) {
      setFlagsScore((prev) => prev + 1);
    }

    const guessName =
      flagsCountriesByCode.get(countryCode)?.name.common ?? null;
    const targetName = flagsTargetCountry?.name.common ?? null;
    if (!guessName || !targetName) return;

    speakText(
      isCorrect
        ? `${targetName}. Correct!`
        : `${guessName}. Not quite! ${targetName} is here!`,
    );
  };

  const nextFlagQuestion = () => {
    if (flagsScore >= scoreGoal) return;
    const nextIndex = flagsQuestionIndex + 1;
    if (nextIndex >= flagsQuestionOrder.length && flagsAvailableCodes.length) {
      const avoid = new Set(flagsQuestionOrder.slice(-3));
      let nextBatch = shuffle(flagsAvailableCodes).filter(
        (code) => !avoid.has(code),
      );
      if (!nextBatch.length) {
        nextBatch = shuffle(flagsAvailableCodes);
      }
      const append = nextBatch.slice(0, Math.min(20, nextBatch.length));
      if (append.length) {
        setFlagsQuestionOrder([...flagsQuestionOrder, ...append]);
      }
    }

    setFlagsQuestionIndex(nextIndex);
    setFlagsAnswered(false);
    setFlagsRevealCode(null);
    setFlagsLastGuessCode(null);
  };

  const flagsDone = flagsScore >= scoreGoal;

  const currentCountryContinent = selectedContinentId
    ? findContinentById(selectedContinentId)
    : null;
  const currentCapitalContinent = capitalsContinentId
    ? findContinentById(capitalsContinentId)
    : null;
  const currentFlagsContinent = flagsContinentId
    ? findContinentById(flagsContinentId)
    : null;
  const continentLastGuessName =
    findContinentById(continentLastGuessId ?? "")?.name ??
    "a different continent";

  const showLanding = mode === "landing";
  const showContinents = mode === "continents";
  const showCountries = mode === "countries";
  const showFlags = mode === "flags";
  const showCapitals = mode === "capitals";
  const landingPreviewReady = !!svgText && !!codeToContinent;
  const flagsPreviewReady = previewFlagCountries.length > 0;

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <header className="flex w-full flex-col items-center justify-between gap-4 text-center md:flex-row md:items-end md:text-left">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Quiz
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-700 md:text-lg">
            Choose a quiz and score points by tapping the right place.
          </p>
        </div>
      </header>

      {showLanding ? (
        <section className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={startContinentsQuiz}
            className="group overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-900/10 outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:outline-none active:translate-y-0"
          >
            <div className="relative h-40 w-full bg-slate-50 md:h-44">
              {landingPreviewReady ? (
                <WorldSvgPreview svgText={svgText ?? ""} />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="text-sm font-semibold text-slate-700">
                    Preview loading…
                  </div>
                  <div className="text-xs text-slate-500">
                    World map preview
                  </div>
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="text-sm font-semibold text-slate-600">
                Continents
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                Find the continent
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("countries");
              setSelectedContinentId(null);
            }}
            className="group overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-900/10 outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:outline-none active:translate-y-0"
          >
            <div className="relative h-40 w-full bg-slate-50 md:h-44">
              {landingPreviewReady ? (
                <EuropeHighlightPreview
                  svgText={svgText ?? ""}
                  codeToContinent={codeToContinent ?? new Map()}
                  highlightCode="gb"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="text-sm font-semibold text-slate-700">
                    Preview loading…
                  </div>
                  <div className="text-xs text-slate-500">
                    Europe map preview
                  </div>
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="text-sm font-semibold text-slate-600">
                Countries
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                Find the country
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("capitals");
              setCapitalsContinentId(null);
            }}
            className="group overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-900/10 outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:outline-none active:translate-y-0"
          >
            <div className="relative flex h-40 w-full items-center justify-center bg-slate-50 md:h-44">
              {previewCapitalCountry ? (
                <div className="flex flex-col items-center gap-2 px-6 text-center">
                  <div className="flex items-center gap-3">
                    <div className="relative h-9 w-14 overflow-hidden rounded-md ring-1 ring-slate-900/10">
                      <Image
                        src={
                          previewCapitalCountry.flags.svg ||
                          previewCapitalCountry.flags.png
                        }
                        alt={
                          previewCapitalCountry.flags.alt ??
                          `Flag of ${previewCapitalCountry.name.common}`
                        }
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="text-lg font-bold text-slate-900">
                      {previewCapitalCountry.name.common}
                    </div>
                  </div>
                  {previewCapitalName ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                      {previewCapitalName}
                    </div>
                  ) : (
                    <div className="h-8 w-32 rounded-2xl bg-slate-200" />
                  )}
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="text-sm font-semibold text-slate-700">
                    Preview loading…
                  </div>
                  <div className="text-xs text-slate-500">Capital preview</div>
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="text-sm font-semibold text-slate-600">
                Capitals
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                Name the capital
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("flags");
              setFlagsContinentId(null);
            }}
            className="group overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-900/10 outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:outline-none active:translate-y-0"
          >
            <div className="relative h-40 w-full overflow-hidden bg-slate-50 md:h-44">
              {flagsPreviewReady ? (
                <div className="relative h-full w-full">
                  {previewFlagCountries.map((country, index) => {
                    const flagSrc = country.flags.svg || country.flags.png;
                    const offset =
                      (previewFlagCountries.length - 1 - index) * 6;
                    const shadowClass =
                      index === previewFlagCountries.length - 1
                        ? "shadow-lg"
                        : "shadow-sm";
                    return (
                      <div
                        key={`${country.cca2}-${index}`}
                        className="absolute inset-0"
                        style={{
                          transform: `translate(${offset}px, ${offset}px)`,
                        }}
                      >
                        <div
                          className={`h-full w-full overflow-hidden rounded-2xl ring-1 ring-slate-900/10 ${shadowClass}`}
                        >
                          <Image
                            src={flagSrc}
                            alt={
                              country.flags.alt ??
                              `Flag of ${country.name.common}`
                            }
                            fill
                            sizes="240px"
                            className="object-cover"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="text-sm font-semibold text-slate-700">
                    Preview loading…
                  </div>
                  <div className="text-xs text-slate-500">Flags preview</div>
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="text-sm font-semibold text-slate-600">Flags</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                Match the flag
              </div>
            </div>
          </button>
        </section>
      ) : null}

      {showContinents ? (
        <section className="flex w-full flex-col gap-4">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
            <div className="flex flex-col gap-3 border-b border-slate-200/60 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="text-sm font-semibold text-slate-700">
                  Continents quiz
                </div>
                <div className="text-sm text-slate-600">
                  Score: {continentScore}/{continentOrder.length || 6}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startContinentsQuiz}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                >
                  Restart
                </button>
                {!continentsDone ? (
                  <button
                    type="button"
                    onClick={nextContinentQuestion}
                    disabled={!continentAnswered}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Next
                  </button>
                ) : null}
              </div>
            </div>

            <div className="p-4 md:p-6">
              <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-slate-900 ring-1 ring-slate-900/10">
                {continentsDone ? (
                  <>
                    <div className="text-sm font-semibold text-slate-600">
                      Congratulations!
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      Score: {continentScore}/{continentOrder.length || 6}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 text-2xl font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          speakText(
                            `Where is ${continentsTarget?.name ?? "this continent"}?`,
                          );
                        }}
                        className="cursor-pointer text-left"
                      >
                        Where is {continentsTarget?.name ?? "…"}?
                      </button>
                    </div>
                    {continentAnswered && continentsTarget ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {continentLastGuessId === continentsTarget.id ? (
                          <>
                            <ResultBadge variant="correct" />
                            <button
                              type="button"
                              onClick={() => {
                                speakText("Correct!");
                              }}
                              className="cursor-pointer text-left text-base font-extrabold text-emerald-700"
                            >
                              Correct!
                            </button>
                          </>
                        ) : (
                          <>
                            <ResultBadge variant="wrong" />
                            <button
                              type="button"
                              onClick={() => {
                                speakText("Not quite!");
                              }}
                              className="cursor-pointer text-left text-base font-extrabold text-rose-700"
                            >
                              Not quite!
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                speakText(
                                  `That was ${continentLastGuessName}.`,
                                );
                              }}
                              className="cursor-pointer text-left text-sm font-semibold text-slate-700"
                            >
                              That was {continentLastGuessName}.
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">
                        Tap the continent on the map.
                      </div>
                    )}
                  </>
                )}
              </div>

              {!continentsDone ? (
                <WorldMap
                  activeContinentId={continentRevealId}
                  onContinentPress={handleContinentGuess}
                  enableSpeech={false}
                  showLabel={continentAnswered}
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {showCountries ? (
        <section className="flex w-full flex-col gap-4">
          {!selectedContinentId ? (
            <div className="flex flex-col gap-4">
              <CountryContinentPicker
                svgText={svgText}
                codeToContinent={codeToContinent}
                onSelect={(id) => {
                  void startCountriesQuizForContinent(id);
                }}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
              <div className="flex flex-col gap-3 border-b border-slate-200/60 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-slate-700">
                    {currentCountryContinent?.name ?? "Countries"} quiz
                  </div>
                  <div className="text-sm text-slate-600">
                    Score: {countryScore}/{scoreGoal}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContinentId(null);
                      setCountryQuestionOrder([]);
                      setCountrySvgPaths([]);
                      setCountryAnswered(false);
                      setCountryRevealCode(null);
                      setCountryLastGuessCode(null);
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                  >
                    Change continent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedContinentId) return;
                      void startCountriesQuizForContinent(selectedContinentId);
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                  >
                    Restart
                  </button>
                  {!countriesDone ? (
                    <button
                      type="button"
                      onClick={nextCountryQuestion}
                      disabled={!countryAnswered}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      Next
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="p-4 md:p-6">
                <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-slate-900 ring-1 ring-slate-900/10">
                  {countriesDone ? (
                    <>
                      <div className="text-sm font-semibold text-slate-600">
                        Congratulations!
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        Score: {countryScore}/{scoreGoal}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {countriesTargetCountry ? (
                          <div className="relative h-8 w-12 overflow-hidden rounded-md ring-1 ring-slate-900/10">
                            <Image
                              src={
                                countriesTargetCountry.flags.svg ||
                                countriesTargetCountry.flags.png
                              }
                              alt={
                                countriesTargetCountry.flags.alt ??
                                `Flag of ${countriesTargetCountry.name.common}`
                              }
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className="h-8 w-12 rounded-md bg-slate-200"
                            aria-hidden="true"
                          />
                        )}
                        <div className="text-2xl font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              speakText(
                                `Where is ${countriesTargetCountry?.name.common ?? "this country"}?`,
                              );
                            }}
                            className="cursor-pointer text-left"
                          >
                            Where is{" "}
                            {countriesTargetCountry?.name.common ?? "…"}?
                          </button>
                        </div>
                      </div>
                      {countryAnswered && countriesTargetCountry ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {countryLastGuessCode === countriesTargetCode ? (
                            <>
                              <ResultBadge variant="correct" />
                              <button
                                type="button"
                                onClick={() => {
                                  speakText("Correct!");
                                }}
                                className="cursor-pointer text-left text-base font-extrabold text-emerald-700"
                              >
                                Correct!
                              </button>
                            </>
                          ) : (
                            <>
                              <ResultBadge variant="wrong" />
                              <button
                                type="button"
                                onClick={() => {
                                  speakText("Not quite!");
                                }}
                                className="cursor-pointer text-left text-base font-extrabold text-rose-700"
                              >
                                Not quite!
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  speakText(
                                    "The correct country is highlighted.",
                                  );
                                }}
                                className="cursor-pointer text-left text-sm font-semibold text-slate-700"
                              >
                                The correct country is highlighted.
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-600">
                          Tap the country on the map.
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!countriesDone ? (
                  <div className="relative h-[55vh] w-full overflow-hidden rounded-2xl bg-slate-100 md:h-[70vh] lg:h-[75vh]">
                    {countryMapLoading ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                      </div>
                    ) : (
                      <ZoomableSvg
                        key={countryViewBox}
                        baseViewBox={countryViewBox}
                        ariaLabel="Country quiz map"
                        className="h-full w-full touch-none"
                      >
                        {countrySvgPaths.map((pathData, index) => {
                          const code = pathData.countryCode;
                          const country = code
                            ? countriesByCode.get(code)
                            : null;
                          const isCorrect =
                            !!code && code === countryRevealCode;
                          const isWrongGuess =
                            !!code &&
                            countryAnswered &&
                            code === countryLastGuessCode &&
                            countryLastGuessCode !== countryRevealCode;

                          const fill = isCorrect
                            ? "#86efac"
                            : isWrongGuess
                              ? "#fecdd3"
                              : country
                                ? "#cbd5e1"
                                : "#e2e8f0";
                          const stroke = isCorrect
                            ? "#16a34a"
                            : isWrongGuess
                              ? "#e11d48"
                              : "#ffffff";
                          const strokeWidth =
                            isCorrect || isWrongGuess ? 1.6 : 0.6;

                          return (
                            <path
                              key={`${pathData.id}-${index}`}
                              d={pathData.d}
                              fill={fill}
                              stroke={stroke}
                              strokeWidth={strokeWidth}
                              role={country ? "button" : undefined}
                              aria-label={
                                country ? country.name.common : undefined
                              }
                              tabIndex={country ? 0 : -1}
                              className={
                                country
                                  ? "cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                                  : undefined
                              }
                              style={country ? { outline: "none" } : undefined}
                              onClick={(event) => {
                                if (!country || !code) return;
                                if (countryAnswered) {
                                  if (
                                    code !== countryRevealCode &&
                                    code !== countryLastGuessCode
                                  ) {
                                    return;
                                  }
                                  speakText(country.name.common);
                                  (
                                    event.currentTarget as SVGPathElement
                                  ).blur();
                                  return;
                                }
                                handleCountryGuess(code);
                                (event.currentTarget as SVGPathElement).blur();
                              }}
                              onKeyDown={(event) => {
                                if (!country || !code) return;
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  if (countryAnswered) {
                                    if (
                                      code !== countryRevealCode &&
                                      code !== countryLastGuessCode
                                    ) {
                                      return;
                                    }
                                    speakText(country.name.common);
                                    return;
                                  }
                                  handleCountryGuess(code);
                                }
                              }}
                            />
                          );
                        })}
                      </ZoomableSvg>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {showCapitals ? (
        <section className="flex w-full flex-col gap-4">
          {!capitalsContinentId ? (
            <div className="flex flex-col gap-4">
              <CountryContinentPicker
                svgText={svgText}
                codeToContinent={codeToContinent}
                onSelect={(id) => {
                  void startCapitalsQuizForContinent(id);
                }}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
              <div className="flex flex-col gap-3 border-b border-slate-200/60 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-slate-700">
                    {currentCapitalContinent?.name ?? "Capitals"} quiz
                  </div>
                  <div className="text-sm text-slate-600">
                    Score: {capitalsScore}/{scoreGoal}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCapitalsContinentId(null);
                      setCapitalsQuestionOrder([]);
                      setCapitalsSvgPaths([]);
                      setCapitalsAnswered(false);
                      setCapitalsRevealCode(null);
                      setCapitalsLastGuess(null);
                      setCapitalsSelectedAnswer(null);
                      setCapitalsOptions([]);
                      setCapitalsAvailableCodes([]);
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                  >
                    Change continent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!capitalsContinentId) return;
                      void startCapitalsQuizForContinent(capitalsContinentId);
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                  >
                    Restart
                  </button>
                  {!capitalsDone ? (
                    <button
                      type="button"
                      onClick={nextCapitalQuestion}
                      disabled={!capitalsAnswered}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      Next
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="p-4 md:p-6">
                <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-slate-900 ring-1 ring-slate-900/10">
                  {capitalsDone ? (
                    <>
                      <div className="text-sm font-semibold text-slate-600">
                        Congratulations!
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        Score: {capitalsScore}/{scoreGoal}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {capitalsTargetCountry ? (
                          <div className="relative h-8 w-12 overflow-hidden rounded-md ring-1 ring-slate-900/10">
                            <Image
                              src={
                                capitalsTargetCountry.flags.svg ||
                                capitalsTargetCountry.flags.png
                              }
                              alt={
                                capitalsTargetCountry.flags.alt ??
                                `Flag of ${capitalsTargetCountry.name.common}`
                              }
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className="h-8 w-12 rounded-md bg-slate-200"
                            aria-hidden="true"
                          />
                        )}
                        <div className="text-2xl font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              speakText(
                                `What is the capital of ${capitalsTargetCountry?.name.common ?? "this country"}?`,
                              );
                            }}
                            className="cursor-pointer text-left"
                          >
                            What is the capital of{" "}
                            {capitalsTargetCountry?.name.common ?? "…"}?
                          </button>
                        </div>
                      </div>
                      {capitalsAnswered && capitalsTargetCountry ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {capitalsLastGuess === capitalsTargetCapital ? (
                            <>
                              <ResultBadge variant="correct" />
                              <button
                                type="button"
                                onClick={() => {
                                  speakText("Correct!");
                                }}
                                className="cursor-pointer text-left text-base font-extrabold text-emerald-700"
                              >
                                Correct!
                              </button>
                            </>
                          ) : (
                            <>
                              <ResultBadge variant="wrong" />
                              <button
                                type="button"
                                onClick={() => {
                                  speakText("Not quite!");
                                }}
                                className="cursor-pointer text-left text-base font-extrabold text-rose-700"
                              >
                                Not quite!
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!capitalsTargetCapital) return;
                                  speakText(
                                    `${capitalsTargetCapital} is the capital of ${capitalsTargetCountry.name.common}.`,
                                  );
                                }}
                                className="cursor-pointer text-left text-sm font-semibold text-slate-700"
                              >
                                {capitalsTargetCapital ?? "That"} is the capital
                                of {capitalsTargetCountry.name.common}.
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-600">
                          Tap a capital, then press submit.
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!capitalsDone ? (
                  <>
                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {capitalsOptions.map((capital) => {
                        const isSelected = capitalsSelectedAnswer === capital;
                        const isCorrect =
                          capitalsAnswered && capital === capitalsTargetCapital;
                        const isWrongSelected =
                          capitalsAnswered &&
                          isSelected &&
                          capital !== capitalsTargetCapital;

                        const buttonClass = isCorrect
                          ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-base font-semibold text-emerald-700"
                          : isWrongSelected
                            ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-base font-semibold text-rose-700"
                            : isSelected
                              ? "rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-left text-base font-semibold text-white"
                              : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50";

                        return (
                          <button
                            key={capital}
                            type="button"
                            onClick={() => handleCapitalAnswerSelect(capital)}
                            className={buttonClass}
                          >
                            {capital}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCapitalSubmit}
                        disabled={!capitalsSelectedAnswer || capitalsAnswered}
                        className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        Submit
                      </button>
                    </div>

                    <div className="relative h-[55vh] w-full overflow-hidden rounded-2xl bg-slate-100 md:h-[70vh] lg:h-[75vh]">
                      {capitalsMapLoading ? (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                        </div>
                      ) : (
                        <ZoomableSvg
                          key={capitalsViewBox}
                          baseViewBox={capitalsViewBox}
                          ariaLabel="Capitals quiz map"
                          className="h-full w-full touch-none"
                        >
                          {capitalsSvgPaths.map((pathData, index) => {
                            const code = pathData.countryCode;
                            const country = code
                              ? capitalsCountriesByCode.get(code)
                              : null;
                            const revealCode =
                              capitalsRevealCode ?? capitalsTargetCode;
                            const isTarget = !!code && code === revealCode;

                            const fill = isTarget
                              ? capitalsAnswered
                                ? "#86efac"
                                : "#fde68a"
                              : country
                                ? "#cbd5e1"
                                : "#e2e8f0";
                            const stroke = isTarget
                              ? capitalsAnswered
                                ? "#16a34a"
                                : "#f59e0b"
                              : "#ffffff";
                            const strokeWidth = isTarget ? 1.6 : 0.6;

                            return (
                              <path
                                key={`${pathData.id}-${index}`}
                                d={pathData.d}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth={strokeWidth}
                                aria-label={
                                  country ? country.name.common : undefined
                                }
                              />
                            );
                          })}
                        </ZoomableSvg>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {showFlags ? (
        <section className="flex w-full flex-col gap-4">
          {!flagsContinentId ? (
            <div className="flex flex-col gap-4">
              <CountryContinentPicker
                svgText={svgText}
                codeToContinent={codeToContinent}
                onSelect={(id) => {
                  void startFlagsQuizForContinent(id);
                }}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
              <div className="flex flex-col gap-3 border-b border-slate-200/60 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-slate-700">
                    {currentFlagsContinent?.name ?? "Flags"} quiz
                  </div>
                  <div className="text-sm text-slate-600">
                    Score: {flagsScore}/{scoreGoal}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFlagsContinentId(null);
                      setFlagsQuestionOrder([]);
                      setFlagsSvgPaths([]);
                      setFlagsAnswered(false);
                      setFlagsRevealCode(null);
                      setFlagsLastGuessCode(null);
                      setFlagsAvailableCodes([]);
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                  >
                    Change continent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!flagsContinentId) return;
                      void startFlagsQuizForContinent(flagsContinentId);
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                  >
                    Restart
                  </button>
                  {!flagsDone ? (
                    <button
                      type="button"
                      onClick={nextFlagQuestion}
                      disabled={!flagsAnswered}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      Next
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="p-4 md:p-6">
                <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-slate-900 ring-1 ring-slate-900/10">
                  {flagsDone ? (
                    <>
                      <div className="text-sm font-semibold text-slate-600">
                        Congratulations!
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        Score: {flagsScore}/{scoreGoal}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {flagsTargetCountry ? (
                          <div className="relative h-10 w-16 overflow-hidden rounded-md ring-1 ring-slate-900/10">
                            <Image
                              src={
                                flagsTargetCountry.flags.svg ||
                                flagsTargetCountry.flags.png
                              }
                              alt={
                                flagsTargetCountry.flags.alt ??
                                `Flag of ${flagsTargetCountry.name.common}`
                              }
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className="h-10 w-16 rounded-md bg-slate-200"
                            aria-hidden="true"
                          />
                        )}
                        <div className="text-2xl font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              speakText("Which country has this flag?");
                            }}
                            className="cursor-pointer text-left"
                          >
                            Which country has this flag?
                          </button>
                        </div>
                      </div>

                      {flagsAnswered && flagsTargetCountry ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {flagsLastGuessCode === flagsTargetCode ? (
                            <>
                              <ResultBadge variant="correct" />
                              <button
                                type="button"
                                onClick={() => {
                                  speakText("Correct!");
                                }}
                                className="cursor-pointer text-left text-base font-extrabold text-emerald-700"
                              >
                                Correct!
                              </button>
                            </>
                          ) : (
                            <>
                              <ResultBadge variant="wrong" />
                              <button
                                type="button"
                                onClick={() => {
                                  speakText("Not quite!");
                                }}
                                className="cursor-pointer text-left text-base font-extrabold text-rose-700"
                              >
                                Not quite!
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  speakText(
                                    `${flagsTargetCountry.name.common} is highlighted.`,
                                  );
                                }}
                                className="cursor-pointer text-left text-sm font-semibold text-slate-700"
                              >
                                {flagsTargetCountry.name.common} is highlighted.
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-600">
                          Tap the country on the map.
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!flagsDone ? (
                  <div className="relative h-[55vh] w-full overflow-hidden rounded-2xl bg-slate-100 md:h-[70vh] lg:h-[75vh]">
                    {flagsMapLoading ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                      </div>
                    ) : (
                      <ZoomableSvg
                        key={flagsBaseViewBox}
                        baseViewBox={flagsBaseViewBox}
                        ariaLabel="Flags quiz map"
                        className="h-full w-full touch-none"
                      >
                        {flagsSvgPaths.map((pathData, index) => {
                          const code = pathData.countryCode;
                          const country = code
                            ? flagsCountriesByCode.get(code)
                            : null;
                          const isCorrect = !!code && code === flagsRevealCode;
                          const isWrongGuess =
                            !!code &&
                            flagsAnswered &&
                            code === flagsLastGuessCode &&
                            flagsLastGuessCode !== flagsRevealCode;

                          const fill = isCorrect
                            ? "#86efac"
                            : isWrongGuess
                              ? "#fecdd3"
                              : country
                                ? "#cbd5e1"
                                : "#e2e8f0";
                          const stroke = isCorrect
                            ? "#16a34a"
                            : isWrongGuess
                              ? "#e11d48"
                              : "#ffffff";
                          const strokeWidth =
                            isCorrect || isWrongGuess ? 1.6 : 0.6;

                          return (
                            <path
                              key={`${pathData.id}-${index}`}
                              d={pathData.d}
                              fill={fill}
                              stroke={stroke}
                              strokeWidth={strokeWidth}
                              role={country ? "button" : undefined}
                              aria-label={
                                country ? country.name.common : undefined
                              }
                              tabIndex={country ? 0 : -1}
                              className={
                                country
                                  ? "cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                                  : undefined
                              }
                              style={country ? { outline: "none" } : undefined}
                              onClick={(event) => {
                                if (!country || !code) return;
                                if (flagsAnswered) {
                                  if (
                                    code !== flagsRevealCode &&
                                    code !== flagsLastGuessCode
                                  ) {
                                    return;
                                  }
                                  speakText(country.name.common);
                                  (
                                    event.currentTarget as SVGPathElement
                                  ).blur();
                                  return;
                                }
                                handleFlagGuess(code);
                                (event.currentTarget as SVGPathElement).blur();
                              }}
                              onKeyDown={(event) => {
                                if (!country || !code) return;
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  if (flagsAnswered) {
                                    if (
                                      code !== flagsRevealCode &&
                                      code !== flagsLastGuessCode
                                    ) {
                                      return;
                                    }
                                    speakText(country.name.common);
                                    return;
                                  }
                                  handleFlagGuess(code);
                                }
                              }}
                            />
                          );
                        })}
                      </ZoomableSvg>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
