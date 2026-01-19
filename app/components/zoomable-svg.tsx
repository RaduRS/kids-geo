"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

function parseViewBox(viewBox: string) {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    w: Number.isFinite(w) && w > 0 ? w : 100,
    h: Number.isFinite(h) && h > 0 ? h : 100,
  };
}

export function useZoomableMap(baseViewBox: string) {
  const base = useMemo(() => parseViewBox(baseViewBox), [baseViewBox]);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: base.x, y: base.y });
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

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

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

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    const currentScale = scaleRef.current;
    const currentPan = panRef.current;
    const nextScale = Math.min(5, Math.max(1, currentScale * zoomFactor));
    const next = zoomAtClientPoint(
      event.clientX,
      event.clientY,
      nextScale,
      currentPan,
      currentScale,
    );
    setScale(next.scale);
    setPan(next.pan);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const captureTarget = event.target as Element | null;
    if (
      captureTarget &&
      "setPointerCapture" in captureTarget &&
      typeof (captureTarget as { setPointerCapture?: unknown })
        .setPointerCapture === "function"
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
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
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
        pinchGesture.startScale * (distance / pinchGesture.startDistance);
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
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) {
      panGestureRef.current = null;
      pinchGestureRef.current = null;
      return;
    }

    if (pointersRef.current.size === 1) {
      const currentPan = panRef.current;
      const remaining = Array.from(pointersRef.current.values())[0];
      panGestureRef.current = {
        startClientX: remaining.x,
        startClientY: remaining.y,
        startPanX: currentPan.x,
        startPanY: currentPan.y,
      };
      pinchGestureRef.current = null;
    }
  };

  const onPointerCancel = (event: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) {
      panGestureRef.current = null;
      pinchGestureRef.current = null;
    }
  };

  return {
    svgRef,
    currentViewBox,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}

export function ZoomableSvg({
  baseViewBox,
  ariaLabel,
  className,
  children,
}: {
  baseViewBox: string;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const {
    svgRef,
    currentViewBox,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  } = useZoomableMap(baseViewBox);

  return (
    <svg
      ref={svgRef}
      viewBox={currentViewBox}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-label={ariaLabel}
      style={{ touchAction: "none" }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {children}
    </svg>
  );
}
