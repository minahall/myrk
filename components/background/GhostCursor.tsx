"use client";
import { useEffect, useRef } from "react";

export default function GhostCursor() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    if (!matchMedia("(pointer:fine)").matches) return;
    const host = hostRef.current;
    if (!host) return;

    const N = 9;
    const dots: HTMLElement[] = Array.from({ length: N }, (_, i) => {
      const d = document.createElement("i");
      d.className = "ghost";
      d.style.opacity = String(0.55 - i * 0.055);
      d.style.scale = String(1 - i * 0.09);
      host.appendChild(d);
      return d;
    });

    let x = -50;
    let y = -50;
    const points: [number, number][] = dots.map(() => [x, y]);

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
    };
    window.addEventListener("pointermove", onMove);

    let raf = 0;
    const loop = () => {
      let a: [number, number] = [x, y];
      dots.forEach((d, i) => {
        const q = points[i];
        q[0] += (a[0] - q[0]) * 0.32;
        q[1] += (a[1] - q[1]) * 0.32;
        d.style.transform = `translate(${q[0] - 5}px, ${q[1] - 5}px)`;
        a = [q[0], q[1]];
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      dots.forEach((d) => d.remove());
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" />;
}
