"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowCounterClockwise,
  Check,
  X,
} from "@phosphor-icons/react";
import { ZoomableSvg } from "@/app/components/zoomable-svg";
import { CountryFlag } from "@/app/components/country-flag";
import { WorldMap } from "@/app/components/world-map";
import { useBalance } from "@/app/components/balance-provider";
import { getCountries, type Country } from "@/lib/api/countries";
import {
  formatGBP,
  rewardPenceForContinent,
} from "@/lib/rewards/earnings";
import {
  CONTINENTS,
  type ContinentId,
  WORLD_MAP_SVG_SRC,
  NON_SOVEREIGN_QUIZ_CODES,
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

// A full round is ten questions. A continent with fewer than ten countries on
// the map plays a shorter round instead, which never reaches this goal and so
// never pays out (Oceania).
const QUIZ_ROUND_GOAL = 10;

function shuffle<T>(items: readonly T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// The countries kids already know well. They stay in the rotation, but are
// drawn about half as often, so a round has more room for the ones still being
// learned instead of repeating the same handful. Codes match the path ids in
// the world map SVG (the UK's is "gb", not "uk").
const EASY_COUNTRY_CODES = new Set([
  "fr", // France
  "gb", // United Kingdom
  "es", // Spain
  "de", // Germany
  "ro", // Romania
  "fi", // Finland
  "no", // Norway
  "dk", // Denmark
  "pt", // Portugal
  "is", // Iceland
  "ie", // Ireland
  "it", // Italy
  "gr", // Greece
]);

// Weight applied to the codes above. 0.5 means "roughly half as likely".
const EASY_COUNTRY_WEIGHT = 0.5;

// Weighted sampling without replacement (Efraimidis-Spirakis): each item gets a
// key of random^(1/weight), and sorting by that key draws heavier items first.
// With every weight equal to 1 it behaves like a plain shuffle.
function weightedShuffle<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
) {
  return items
    .map((item) => ({
      item,
      key: Math.random() ** (1 / Math.max(weightOf(item), 1e-6)),
    }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}

function pickQuizCountries(availableCodes: readonly string[], roundSize: number) {
  return weightedShuffle(availableCodes, (code) =>
    EASY_COUNTRY_CODES.has(code) ? EASY_COUNTRY_WEIGHT : 1,
  ).slice(0, Math.min(roundSize, availableCodes.length));
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
        <Check weight="bold" className={iconClass} />
      ) : (
        <X weight="bold" className={iconClass} />
      )}
    </span>
  );
}

// Restart + Next, floated over the bottom-right of the quiz's map so the child
// does not have to scroll back to the header between questions. The wrapper is
// click-through so it never blocks map drags; only the buttons are interactive.
function QuizControls({
  onRestart,
  onNext,
  nextDisabled,
  showNext,
}: {
  onRestart: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  showNext: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 p-3">
      <button
        type="button"
        onClick={onRestart}
        className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
      >
        Restart
      </button>
      {showNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="pointer-events-auto rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Next
        </button>
      ) : null}
    </div>
  );
}

// The country quiz is played entirely on the map, so everything the child needs
// mid-round floats over it: the question top-left, the score top-right, and
// Restart bottom-left. Each layer is a click-through wrapper holding one
// interactive card, so map drags still work everywhere between them.
function MapPrompt({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3">
      {children}
    </div>
  );
}

function MapScore({
  score,
  total,
}: {
  score: number;
  total: number;
}) {
  return (
    <div className="pointer-events-auto shrink-0 rounded-full bg-white/95 px-4 py-1.5 text-lg font-bold tabular-nums text-slate-900 shadow-sm ring-1 ring-slate-900/10 backdrop-blur-sm">
      {score}/{total}
    </div>
  );
}

// Restart, floated over the bottom-left of the map so the child can start the
// round again without scrolling back up. `children` lets a quiz add its own
// buttons alongside Restart without leaving the map.
function MapRestart({
  onRestart,
  children,
}: {
  onRestart: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-2 p-3">
      <button
        type="button"
        onClick={onRestart}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
      >
        <ArrowCounterClockwise weight="bold" className="h-4 w-4" />
        Restart
      </button>
      {children}
    </div>
  );
}

function CountryContinentPicker({
  svgText,
  codeToContinent,
  quizzedCountryCounts,
  onSelect,
}: {
  svgText: string | null;
  codeToContinent: Map<string, ContinentId> | null;
  quizzedCountryCounts: Map<ContinentId, number> | null;
  onSelect: (id: ContinentId) => void;
}) {
  return (
    <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CONTINENTS.map((continent) => {
        const previewReady = !!svgText && !!codeToContinent;
        const quizzedCount = quizzedCountryCounts?.get(continent.id) ?? null;
        // A continent with fewer than ten countries plays a shorter round, so
        // the perfect score that pays out is unreachable on it.
        const paysOut =
          quizzedCount !== null && quizzedCount >= QUIZ_ROUND_GOAL;

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
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-900 md:text-2xl">
                    {continent.name}
                  </div>
                  {/* What a flawless round is worth, so the child knows the
                      prize before starting rather than only at the end. */}
                  <div
                    className={
                      paysOut
                        ? "mt-1 text-sm font-semibold text-emerald-700"
                        : "mt-1 text-sm font-semibold text-slate-500"
                    }
                  >
                    {quizzedCount === null
                      ? "Loading prize…"
                      : paysOut
                        ? `${QUIZ_ROUND_GOAL}/${QUIZ_ROUND_GOAL} earns ${formatGBP(
                            rewardPenceForContinent(continent.id),
                          )}`
                        : `No prize — only ${quizzedCount} to find`}
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
  const { award } = useBalance();
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

  // How many countries each continent actually quizzes, counted from the paths
  // drawn on the world map minus the dependent territories that are never asked
  // about. A round is min(10, this), so this also decides whether a continent
  // can reach the 10/10 that pays out. Shown on the continent picker so the
  // reward is known before the child starts.
  const quizzedCountryCounts = useMemo(() => {
    if (!svgText || !codeToContinent) return null;

    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const seen = new Set<string>();
    const counts = new Map<ContinentId, number>();

    Array.from(doc.querySelectorAll("path")).forEach((path) => {
      const rawId =
        path.getAttribute("id") ??
        path.closest("g[id]")?.getAttribute("id") ??
        "";
      const code =
        COUNTRY_CODE_ALIASES[rawId.toLowerCase()] ?? rawId.toLowerCase();

      // Two-letter ids are countries; anything else (_somaliland, path-N) is
      // not quizzed, and dependent territories are drawn but never asked about.
      if (code.length !== 2 || seen.has(code)) return;
      if (NON_SOVEREIGN_QUIZ_CODES.has(code)) return;

      const continentId = codeToContinent.get(code);
      if (!continentId) return;

      seen.add(code);
      counts.set(continentId, (counts.get(continentId) ?? 0) + 1);
    });

    return counts;
  }, [svgText, codeToContinent]);

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
    setCountrySelectedCode(null);
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
    setFlagsSelectedCode(null);
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
  // The country the child has tapped but not yet submitted. Tapping only
  // selects; the answer is judged when Submit is pressed.
  const [countrySelectedCode, setCountrySelectedCode] = useState<string | null>(
    null,
  );
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

  const scoreGoal = QUIZ_ROUND_GOAL;

  // Pays out once, at the moment the final question of a round is answered
  // correctly and every earlier question was also correct. A wrong answer
  // earlier in the round means the score never reaches the goal, so no reward
  // is given. Only the quiz awards money; the map and continents screens do not.
  const awardIfPerfectRound = (
    continentId: ContinentId | null,
    roundLength: number,
    isCorrect: boolean,
    questionIndex: number,
    scoreBefore: number,
  ) => {
    if (!continentId || !isCorrect) return;
    // Only a full 10-question round pays out. A short round (Oceania has fewer
    // than 10 countries on the map) never awards money.
    if (roundLength < scoreGoal) return;
    if (questionIndex + 1 < roundLength) return;
    if (scoreBefore < roundLength - 1) return;
    award(rewardPenceForContinent(continentId));
  };

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
  // See countrySelectedCode: tapping selects a country, Submit judges it.
  const [flagsSelectedCode, setFlagsSelectedCode] = useState<string | null>(
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

      // Dependent territories stay on the map as inert land but are never
      // quizzed, so they are pushed without a code (like Somaliland above).
      extractedPaths.push({
        id: rawId || `path-${index}`,
        d: p.getAttribute("d") || "",
        countryCode: NON_SOVEREIGN_QUIZ_CODES.has(countryCode)
          ? null
          : countryCode,
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
    setCountrySelectedCode(null);
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
      const order = pickQuizCountries(data.availableCodes, scoreGoal);
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
  // A round is 10 questions, or fewer only when the continent has fewer than
  // 10 countries on the map (Oceania). Capping here is what stops repeats.
  const countryRoundLength = Math.min(
    scoreGoal,
    countryAvailableCodes.length,
  );

  // Tapping a country only selects it, so an accidental tap while pinching to
  // zoom does not cost the child a question. Submit then judges the selection.
  const handleCountrySelect = (countryCode: string) => {
    if (!countriesTargetCode || countryAnswered) {
      return;
    }

    setCountrySelectedCode(countryCode);
  };

  const handleCountrySubmit = () => {
    const countryCode = countrySelectedCode;
    if (!countryCode || !countriesTargetCode || countryAnswered) {
      return;
    }

    setCountryAnswered(true);
    setCountryLastGuessCode(countryCode);
    setCountryRevealCode(countriesTargetCode);

    const isCorrect = countryCode === countriesTargetCode;
    if (isCorrect) {
      setCountryScore((prev) => prev + 1);
    }
    awardIfPerfectRound(
      selectedContinentId,
      countryRoundLength,
      isCorrect,
      countryQuestionIndex,
      countryScore,
    );

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
    const nextIndex = countryQuestionIndex + 1;
    if (nextIndex >= countryRoundLength) {
      setCountryQuestionIndex(countryRoundLength);
      setCountryAnswered(false);
      setCountryRevealCode(null);
      setCountryLastGuessCode(null);
      setCountrySelectedCode(null);
      return;
    }

    setCountryQuestionIndex(nextIndex);
    setCountryAnswered(false);
    setCountryRevealCode(null);
    setCountryLastGuessCode(null);
    setCountrySelectedCode(null);

    // Read the next question aloud once, so the child hears it without having
    // to tap. Only on Next: the first question of a round stays silent.
    const nextCode = countryQuestionOrder[nextIndex];
    const nextName = nextCode
      ? countriesByCode.get(nextCode)?.name.common
      : null;
    if (nextName) {
      speakText(`Where is ${nextName}?`);
    }
  };

  const countriesDone =
    selectedContinentId !== null &&
    countryRoundLength > 0 &&
    countryQuestionIndex >= countryRoundLength;

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
        Math.min(scoreGoal, availableCapitalCodes.length),
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
  // See countryRoundLength: 10 questions, or fewer for a continent with fewer
  // than 10 mapped countries (Oceania). Prevents repeats and short-circuits
  // the reward for such a round.
  const capitalsRoundLength = Math.min(
    scoreGoal,
    capitalsAvailableCodes.length,
  );
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
    awardIfPerfectRound(
      capitalsContinentId,
      capitalsRoundLength,
      isCorrect,
      capitalsQuestionIndex,
      capitalsScore,
    );

    const answerSentence = `${correctCapital} is the capital of ${capitalsTargetCountry.name.common}.`;
    speakText(
      isCorrect
        ? `${answerSentence} Correct!`
        : `${capitalsSelectedAnswer}. Not quite! ${answerSentence}`,
    );
  };

  const nextCapitalQuestion = () => {
    const nextIndex = capitalsQuestionIndex + 1;
    if (nextIndex >= capitalsRoundLength) {
      setCapitalsQuestionIndex(capitalsRoundLength);
      setCapitalsAnswered(false);
      setCapitalsRevealCode(null);
      setCapitalsLastGuess(null);
      setCapitalsSelectedAnswer(null);
      return;
    }

    setCapitalsQuestionIndex(nextIndex);
    setCapitalsAnswered(false);
    setCapitalsRevealCode(null);
    setCapitalsLastGuess(null);
    setCapitalsSelectedAnswer(null);
  };

  const capitalsDone =
    capitalsContinentId !== null &&
    capitalsRoundLength > 0 &&
    capitalsQuestionIndex >= capitalsRoundLength;

  const startFlagsQuizForContinent = async (continentId: ContinentId) => {
    if (!countries) return;

    setSelectedContinentId(null);
    setCountryQuestionOrder([]);
    setCountrySvgPaths([]);
    setCountryAnswered(false);
    setCountryRevealCode(null);
    setCountryLastGuessCode(null);
    setCountrySelectedCode(null);

    setFlagsContinentId(continentId);
    setFlagsScore(0);
    setFlagsQuestionIndex(0);
    setFlagsAnswered(false);
    setFlagsRevealCode(null);
    setFlagsLastGuessCode(null);
    setFlagsSelectedCode(null);
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
      const order = pickQuizCountries(data.availableCodes, scoreGoal);
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
  // See countryRoundLength: 10 questions, or fewer for Oceania. No money is
  // awarded on a short round.
  const flagsRoundLength = Math.min(scoreGoal, flagsAvailableCodes.length);

  // See handleCountrySelect: tapping only selects, Submit judges the answer.
  const handleFlagSelect = (countryCode: string) => {
    if (!flagsTargetCode || flagsAnswered) {
      return;
    }

    setFlagsSelectedCode(countryCode);
  };

  const handleFlagSubmit = () => {
    const countryCode = flagsSelectedCode;
    if (!countryCode || !flagsTargetCode || flagsAnswered) {
      return;
    }

    setFlagsAnswered(true);
    setFlagsLastGuessCode(countryCode);
    setFlagsRevealCode(flagsTargetCode);

    const isCorrect = countryCode === flagsTargetCode;
    if (isCorrect) {
      setFlagsScore((prev) => prev + 1);
    }
    awardIfPerfectRound(
      flagsContinentId,
      flagsRoundLength,
      isCorrect,
      flagsQuestionIndex,
      flagsScore,
    );

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
    const nextIndex = flagsQuestionIndex + 1;
    if (nextIndex >= flagsRoundLength) {
      setFlagsQuestionIndex(flagsRoundLength);
      setFlagsAnswered(false);
      setFlagsRevealCode(null);
      setFlagsLastGuessCode(null);
      setFlagsSelectedCode(null);
      return;
    }

    setFlagsQuestionIndex(nextIndex);
    setFlagsAnswered(false);
    setFlagsRevealCode(null);
    setFlagsLastGuessCode(null);
    setFlagsSelectedCode(null);
  };

  const flagsDone = flagsRoundLength > 0 && flagsQuestionIndex >= flagsRoundLength;

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
                      <CountryFlag
                        src={
                          previewCapitalCountry.flags.svg ||
                          previewCapitalCountry.flags.png
                        }
                        alt={
                          previewCapitalCountry.flags.alt ??
                          `Flag of ${previewCapitalCountry.name.common}`
                        }
                        code={previewCapitalCountry.cca2}
                        sizes="56px"
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
                          zIndex: index + 1,
                        }}
                      >
                        <div
                          className={`relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-slate-900/10 ${shadowClass}`}
                        >
                          <CountryFlag
                            src={flagSrc}
                            alt={
                              country.flags.alt ??
                              `Flag of ${country.name.common}`
                            }
                            code={country.cca2}
                            sizes="240px"
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
              {continentsDone ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={startContinentsQuiz}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                  >
                    Restart
                  </button>
                </div>
              ) : null}
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
                <div className="relative">
                  <WorldMap
                    activeContinentId={continentRevealId}
                    onContinentPress={handleContinentGuess}
                    enableSpeech={false}
                    showLabel={continentAnswered}
                  />
                  <QuizControls
                    onRestart={startContinentsQuiz}
                    onNext={nextContinentQuestion}
                    nextDisabled={!continentAnswered}
                    showNext
                  />
                </div>
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
                quizzedCountryCounts={quizzedCountryCounts}
                onSelect={(id) => {
                  void startCountriesQuizForContinent(id);
                }}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
              <div className="p-4 md:p-6">
                {countriesDone ? (
                  <div className="flex flex-col items-start gap-4 rounded-2xl bg-slate-50 p-5 text-slate-900 ring-1 ring-slate-900/10">
                    <div>
                      <div className="text-sm font-semibold text-slate-600">
                        {currentCountryContinent?.name ?? "Countries"} quiz
                        finished
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        Score: {countryScore}/{countryRoundLength}
                      </div>
                    </div>
                    {selectedContinentId && countryRoundLength >= scoreGoal ? (
                      <div className="text-sm font-semibold">
                        {countryScore >= countryRoundLength ? (
                          <span className="text-emerald-700">
                            You earned{" "}
                            {formatGBP(
                              rewardPenceForContinent(selectedContinentId),
                            )}
                            !
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            A perfect {scoreGoal} out of {scoreGoal} earns{" "}
                            {formatGBP(
                              rewardPenceForContinent(selectedContinentId),
                            )}
                            .
                          </span>
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedContinentId) return;
                        void startCountriesQuizForContinent(
                          selectedContinentId,
                        );
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none active:bg-slate-700"
                    >
                      <ArrowCounterClockwise weight="bold" className="h-4 w-4" />
                      Play again
                    </button>
                  </div>
                ) : null}

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
                          const isSelected =
                            !!code &&
                            !countryAnswered &&
                            code === countrySelectedCode;

                          const fill = isCorrect
                            ? "#86efac"
                            : isWrongGuess
                              ? "#fecdd3"
                              : isSelected
                                ? "#93c5fd"
                                : country
                                  ? "#cbd5e1"
                                  : "#e2e8f0";
                          const stroke = isCorrect
                            ? "#16a34a"
                            : isWrongGuess
                              ? "#e11d48"
                              : isSelected
                                ? "#2563eb"
                                : "#ffffff";
                          const strokeWidth =
                            isCorrect || isWrongGuess || isSelected ? 1.6 : 0.6;

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
                                handleCountrySelect(code);
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
                                  handleCountrySelect(code);
                                }
                              }}
                            />
                          );
                        })}
                      </ZoomableSvg>
                    )}
                    {!countryMapLoading && countriesTargetCountry ? (
                      <MapPrompt>
                        <div className="pointer-events-auto flex min-w-0 flex-col gap-3 rounded-3xl bg-white/95 px-4 py-3 shadow-sm ring-1 ring-slate-900/10 backdrop-blur-sm">
                          <div className="flex items-center gap-3">
                            <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded-md ring-1 ring-slate-900/10">
                              <CountryFlag
                                src={
                                  countriesTargetCountry.flags.svg ||
                                  countriesTargetCountry.flags.png
                                }
                                alt={
                                  countriesTargetCountry.flags.alt ??
                                  `Flag of ${countriesTargetCountry.name.common}`
                                }
                                code={countriesTargetCountry.cca2}
                                sizes="48px"
                              />
                            </div>
                            <div className="flex min-w-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  speakText(
                                    `Where is ${countriesTargetCountry.name.common}?`,
                                  );
                                }}
                                className="cursor-pointer text-left text-xl font-bold text-slate-900 outline-none focus:outline-none focus-visible:outline-none md:text-2xl"
                              >
                                Where is {countriesTargetCountry.name.common}?
                              </button>
                              {/* The tick or cross lands right after the
                                  question mark, so the verdict reads as part
                                  of the question the child just answered. */}
                              {countryAnswered ? (
                                <>
                                  <ResultBadge
                                    variant={
                                      countryLastGuessCode ===
                                      countriesTargetCode
                                        ? "correct"
                                        : "wrong"
                                    }
                                  />
                                  <span className="sr-only">
                                    {countryLastGuessCode === countriesTargetCode
                                      ? "Correct"
                                      : "Not quite, the correct country is highlighted"}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          {countryAnswered ? (
                            <button
                              type="button"
                              onClick={nextCountryQuestion}
                              className="inline-flex items-center gap-2 self-start rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none active:bg-slate-700"
                            >
                              Next
                              <ArrowRight weight="bold" className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleCountrySubmit}
                              disabled={!countrySelectedCode}
                              className="inline-flex items-center gap-2 self-start rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none active:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Submit
                            </button>
                          )}
                        </div>
                        <MapScore
                          score={countryScore}
                          total={countryRoundLength}
                        />
                      </MapPrompt>
                    ) : null}
                    {!countryMapLoading ? (
                      <MapRestart
                        onRestart={() => {
                          if (!selectedContinentId) return;
                          void startCountriesQuizForContinent(
                            selectedContinentId,
                          );
                        }}
                      />
                    ) : null}
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
                quizzedCountryCounts={quizzedCountryCounts}
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
                    Score: {capitalsScore}/{capitalsRoundLength}
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
                  {capitalsDone ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!capitalsContinentId) return;
                        void startCapitalsQuizForContinent(
                          capitalsContinentId,
                        );
                      }}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                    >
                      Restart
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
                        Score: {capitalsScore}/{capitalsRoundLength}
                      </div>
                      {capitalsContinentId && capitalsRoundLength >= scoreGoal ? (
                        capitalsScore >= capitalsRoundLength ? (
                          <div className="mt-2 text-sm font-semibold text-emerald-700">
                            You earned{" "}
                            {formatGBP(
                              rewardPenceForContinent(capitalsContinentId),
                            )}
                            !
                          </div>
                        ) : (
                          <div className="mt-2 text-sm font-semibold text-slate-600">
                            A perfect {scoreGoal} out of {scoreGoal} earns{" "}
                            {formatGBP(
                              rewardPenceForContinent(capitalsContinentId),
                            )}
                            .
                          </div>
                        )
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {capitalsTargetCountry ? (
                          <div className="relative h-8 w-12 overflow-hidden rounded-md ring-1 ring-slate-900/10">
                            <CountryFlag
                              src={
                                capitalsTargetCountry.flags.svg ||
                                capitalsTargetCountry.flags.png
                              }
                              alt={
                                capitalsTargetCountry.flags.alt ??
                                `Flag of ${capitalsTargetCountry.name.common}`
                              }
                              code={capitalsTargetCountry.cca2}
                              sizes="48px"
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
                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                              : "rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50 active:bg-slate-100";

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
                        className="h-12 rounded-full bg-slate-900 px-7 text-base font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 active:bg-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
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
                      <QuizControls
                        onRestart={() => {
                          if (!capitalsContinentId) return;
                          void startCapitalsQuizForContinent(
                            capitalsContinentId,
                          );
                        }}
                        onNext={nextCapitalQuestion}
                        nextDisabled={!capitalsAnswered}
                        showNext
                      />
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
                quizzedCountryCounts={quizzedCountryCounts}
                onSelect={(id) => {
                  void startFlagsQuizForContinent(id);
                }}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10">
              <div className="p-4 md:p-6">
                {flagsDone ? (
                  <div className="flex flex-col items-start gap-4 rounded-2xl bg-slate-50 p-5 text-slate-900 ring-1 ring-slate-900/10">
                    <div>
                      <div className="text-sm font-semibold text-slate-600">
                        {currentFlagsContinent?.name ?? "Flags"} quiz finished
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        Score: {flagsScore}/{flagsRoundLength}
                      </div>
                    </div>
                    {flagsContinentId && flagsRoundLength >= scoreGoal ? (
                      <div className="text-sm font-semibold">
                        {flagsScore >= flagsRoundLength ? (
                          <span className="text-emerald-700">
                            You earned{" "}
                            {formatGBP(
                              rewardPenceForContinent(flagsContinentId),
                            )}
                            !
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            A perfect {scoreGoal} out of {scoreGoal} earns{" "}
                            {formatGBP(
                              rewardPenceForContinent(flagsContinentId),
                            )}
                            .
                          </span>
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (!flagsContinentId) return;
                        void startFlagsQuizForContinent(flagsContinentId);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none active:bg-slate-700"
                    >
                      <ArrowCounterClockwise weight="bold" className="h-4 w-4" />
                      Play again
                    </button>
                  </div>
                ) : null}

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
                          const isSelected =
                            !!code &&
                            !flagsAnswered &&
                            code === flagsSelectedCode;

                          const fill = isCorrect
                            ? "#86efac"
                            : isWrongGuess
                              ? "#fecdd3"
                              : isSelected
                                ? "#93c5fd"
                                : country
                                  ? "#cbd5e1"
                                  : "#e2e8f0";
                          const stroke = isCorrect
                            ? "#16a34a"
                            : isWrongGuess
                              ? "#e11d48"
                              : isSelected
                                ? "#2563eb"
                                : "#ffffff";
                          const strokeWidth =
                            isCorrect || isWrongGuess || isSelected ? 1.6 : 0.6;

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
                                handleFlagSelect(code);
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
                                  handleFlagSelect(code);
                                }
                              }}
                            />
                          );
                        })}
                      </ZoomableSvg>
                    )}
                    {!flagsMapLoading && flagsTargetCountry ? (
                      <MapPrompt>
                        <div className="pointer-events-auto flex min-w-0 flex-col gap-3 rounded-3xl bg-white/95 px-4 py-3 shadow-sm ring-1 ring-slate-900/10 backdrop-blur-sm">
                          <div className="flex items-center gap-3">
                            {/* The flag alone is the question. Tapping it
                                reads the wording aloud for a child who cannot
                                read it yet. */}
                            <button
                              type="button"
                              onClick={() => {
                                speakText("Which country has this flag?");
                              }}
                              className="relative h-14 w-24 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-slate-900/10"
                            >
                              <CountryFlag
                                src={
                                  flagsTargetCountry.flags.svg ||
                                  flagsTargetCountry.flags.png
                                }
                                alt={
                                  flagsTargetCountry.flags.alt ??
                                  `Flag of ${flagsTargetCountry.name.common}`
                                }
                                code={flagsTargetCountry.cca2}
                                sizes="96px"
                              />
                            </button>
                            {/* The verdict sits beside the flag, the way the
                                countries quiz puts it after its question. */}
                            {flagsAnswered ? (
                              <div className="flex min-w-0 items-center gap-2">
                                <ResultBadge
                                  variant={
                                    flagsLastGuessCode === flagsTargetCode
                                      ? "correct"
                                      : "wrong"
                                  }
                                />
                                <span
                                  className={
                                    flagsLastGuessCode === flagsTargetCode
                                      ? "text-lg font-bold text-emerald-700"
                                      : "text-lg font-bold text-rose-700"
                                  }
                                >
                                  {flagsLastGuessCode === flagsTargetCode
                                    ? "Correct!"
                                    : "Not quite!"}
                                </span>
                                <span className="sr-only">
                                  {flagsLastGuessCode === flagsTargetCode
                                    ? "Correct"
                                    : `Not quite, ${flagsTargetCountry.name.common} is highlighted`}
                                </span>
                              </div>
                            ) : null}
                          </div>
                          {flagsAnswered ? (
                            <button
                              type="button"
                              onClick={nextFlagQuestion}
                              className="inline-flex items-center gap-2 self-start rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none active:bg-slate-700"
                            >
                              Next
                              <ArrowRight weight="bold" className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleFlagSubmit}
                              disabled={!flagsSelectedCode}
                              className="inline-flex items-center gap-2 self-start rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 outline-none hover:bg-slate-800 focus:outline-none focus-visible:outline-none active:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Submit
                            </button>
                          )}
                        </div>
                        <MapScore score={flagsScore} total={flagsRoundLength} />
                      </MapPrompt>
                    ) : null}
                    {!flagsMapLoading ? (
                      <MapRestart
                        onRestart={() => {
                          if (!flagsContinentId) return;
                          void startFlagsQuizForContinent(flagsContinentId);
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setFlagsContinentId(null);
                            setFlagsQuestionOrder([]);
                            setFlagsSvgPaths([]);
                            setFlagsAnswered(false);
                            setFlagsRevealCode(null);
                            setFlagsLastGuessCode(null);
                            setFlagsSelectedCode(null);
                            setFlagsAvailableCodes([]);
                          }}
                          className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 outline-none hover:bg-slate-50 focus:outline-none focus-visible:outline-none active:bg-slate-100"
                        >
                          Change continent
                        </button>
                      </MapRestart>
                    ) : null}
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
