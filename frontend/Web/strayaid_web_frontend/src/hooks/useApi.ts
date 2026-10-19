import { useCallback, useEffect, useEffectEvent, useState } from "react";

type ApiState<T> = { key: string; data?: T; error?: unknown };

/**
 * Loads data and reloads it whenever `key` changes or `reload()` is called.
 * While reloading, the previous data stays on screen, so polling doesn't flicker.
 */
export function useApi<T>(loader: () => Promise<T>, key = "") {
  const [state, setState] = useState<ApiState<T>>({ key: "" });
  const [version, setVersion] = useState(0);
  const requestKey = `${key}#${version}`;
  const load = useEffectEvent(() => loader());

  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ key: requestKey, data }),
      (error) => active && setState((current) => ({ key: requestKey, data: current.data, error })),
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const setData = useCallback((update: T | ((current: T | undefined) => T)) => {
    setState((current) => ({
      ...current,
      data: typeof update === "function" ? (update as (value: T | undefined) => T)(current.data) : update,
    }));
  }, []);

  const loading = state.key !== requestKey;
  return { data: state.data, error: loading ? undefined : state.error, loading, reload, setData };
}

/** Calls `callback` every `ms` while the page is visible. */
export function usePolling(callback: () => void, ms: number, enabled = true) {
  const tick = useEffectEvent(callback);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
}
