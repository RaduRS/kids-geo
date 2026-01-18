"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type ContinentId,
  CONTINENTS,
  WORLD_MAP_SVG_SRC,
  mapCountryToContinent,
  shouldKeepOnlyMainlandForContinent,
} from "@/lib/geo/continents";
import { getCountries } from "@/lib/api/countries";

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

export default function ContinentsPage() {
  const [worldSvgText, setWorldSvgText] = useState<string | null>(null);
  const [codeToContinent, setCodeToContinent] = useState<Map<
    string,
    ContinentId
  > | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [svgText, countries] = await Promise.all([
        fetch(WORLD_MAP_SVG_SRC).then((res) => res.text()),
        getCountries(),
      ]);

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

      if (!cancelled) {
        setWorldSvgText(svgText);
        setCodeToContinent(map);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <header className="flex w-full flex-col items-center justify-between gap-4 text-center md:flex-row md:items-end md:text-left">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
            Continents
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-700 md:text-lg">
            Pick a continent to explore its countries, capitals, and flags.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-900/10 transition-colors hover:bg-slate-50 active:bg-slate-100"
        >
          Back to map
        </Link>
      </header>

      <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONTINENTS.map((continent) => {
          const previewReady = !!worldSvgText && !!codeToContinent;

          return (
            <Link
              key={continent.id}
              href={`/continents/${continent.id}`}
              className="group relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-900/10 transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              <div className="relative flex h-44 w-full items-center justify-center bg-slate-50 md:h-52">
                {previewReady ? (
                  <ContinentSvgPreview
                    svgText={worldSvgText}
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
                    <div className="mt-1 text-sm text-slate-600">
                      Tap to explore
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
            </Link>
          );
        })}
      </section>
    </div>
  );
}
