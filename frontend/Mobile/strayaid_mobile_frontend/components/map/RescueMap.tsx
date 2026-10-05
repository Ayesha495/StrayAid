import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import { rescueMapHtml } from "./rescueMapHtml";

// Interactive rescue map (Stitch 12): Leaflet + OpenStreetMap in a WebView. The web build
// uses RescueMap.web.tsx (an iframe) with the same page and messages.

export type RescueMapMessage =
  | { type: "ready" }
  | { type: "select"; id: number }
  | { type: "moved"; lat: number; lng: number };

export type RescueMapHandle = { post: (message: object) => void };

type Props = {
  initialCenter: { lat: number; lng: number };
  onMessage: (message: RescueMapMessage) => void;
};

const RescueMap = forwardRef<RescueMapHandle, Props>(function RescueMap({ initialCenter, onMessage }, ref) {
  const webView = useRef<WebView>(null);
  // Built once: later moves go through messages so the map doesn't reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => rescueMapHtml(initialCenter), []);

  useImperativeHandle(ref, () => ({
    post: (message) => webView.current?.injectJavaScript(`window.receive && window.receive(${JSON.stringify(message)}); true;`),
  }));

  return (
    <WebView
      ref={webView}
      style={StyleSheet.absoluteFill}
      source={{ html }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      onMessage={(event) => {
        try {
          onMessage(JSON.parse(event.nativeEvent.data));
        } catch {
          // Ignore anything that isn't one of our messages.
        }
      }}
    />
  );
});

export default RescueMap;
