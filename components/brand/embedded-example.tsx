"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Embeds a section of the original brand-guide site (extracted to a
 * standalone same-origin HTML file) and sizes the iframe to its content so
 * it reads as part of the page, not a scrollbox.
 */
export function EmbeddedExample({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1400);

  const measure = useCallback(() => {
    const body = frameRef.current?.contentDocument?.body;
    if (body) setHeight(body.scrollHeight);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let observer: ResizeObserver | null = null;
    function attach() {
      measure();
      const body = frame?.contentDocument?.body;
      if (body && "ResizeObserver" in window) {
        observer = new ResizeObserver(measure);
        observer.observe(body);
      }
    }

    if (frame.contentDocument?.readyState === "complete") attach();
    frame.addEventListener("load", attach);
    window.addEventListener("resize", measure);
    return () => {
      frame.removeEventListener("load", attach);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure]);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title}
      style={{ height }}
      className="block w-full border-0"
    />
  );
}
