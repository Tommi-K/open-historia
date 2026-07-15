import { useEffect, useState } from "react";
import { JSON_URLS, readJson } from "../../runtime/assets.js";

// Singleton: all consumers share one poll interval and one set of results,
// eliminating the 4 redundant world.json requests the app used to fire.

const POLL_MS = 5000;
let sharedState = null;
let pollTimer = null;
const subscribers = new Set();

const poll = async () => {
  try {
    sharedState = await readJson(JSON_URLS.world, { defaultValue: {}, force: true });
  } catch {
    sharedState = {};
  }
  for (const fn of subscribers) fn(sharedState);
};

const startPolling = () => {
  if (pollTimer) return;
  poll();
  pollTimer = setInterval(poll, POLL_MS);
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

export function useWorldState() {
  const [state, setState] = useState(() => sharedState || {});

  useEffect(() => {
    startPolling();
    const handler = (data) => setState(data);
    subscribers.add(handler);
    if (sharedState) setState(sharedState);
    return () => {
      subscribers.delete(handler);
      if (subscribers.size === 0) stopPolling();
    };
  }, []);

  return {
    worldState: state,
    worldKnown: Boolean(state && Object.keys(state).length > 0),
    customRegions: Boolean(state?.customRegions),
    customCities: Boolean(state?.customCities),
    basemap: state?.basemap || null,
    background: state?.background ?? null,
    regionOwnershipOverrides: state?.regionOwnershipOverrides ?? {},
    polityOverrides: state?.polityOverrides ?? {},
  };
}
