import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

import type { RescueMapHandle, RescueMapMessage } from "./RescueMap";
import { rescueMapHtml } from "./rescueMapHtml";

// Web build of the rescue map: the same Leaflet page as the phone, in an iframe.

type Props = {
  initialCenter: { lat: number; lng: number };
  onMessage: (message: RescueMapMessage) => void;
};

const RescueMap = forwardRef<RescueMapHandle, Props>(function RescueMap({ initialCenter, onMessage }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => rescueMapHtml(initialCenter), []);

  const ping = () =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ toRescueMap: true, message: { type: "ping" } }), "*");

  useImperativeHandle(ref, () => ({
    post: (message) => frame.current?.contentWindow?.postMessage(JSON.stringify({ toRescueMap: true, message }), "*"),
  }));

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.fromRescueMap) onMessageRef.current(data.message);
      } catch {
        // Ignore anything that isn't one of our messages.
      }
    };
    window.addEventListener("message", listener);
    // The page may have said "ready" before this listener existed; ask again.
    ping();
    return () => window.removeEventListener("message", listener);
  }, []);

  return (
    <iframe
      ref={frame}
      srcDoc={html}
      title="Rescue map"
      onLoad={ping}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
});

export default RescueMap;
