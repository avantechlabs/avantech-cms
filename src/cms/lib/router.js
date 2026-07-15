import { useEffect, useSyncExternalStore } from "react";

// Minimal client-side router: pushState + a subscribable location snapshot.
// Internal <a href="/..."> clicks are intercepted globally (useLinkInterceptor)
// so navigation never reloads the page; middle-click and modifier keys keep
// their native open-in-new-tab behavior.

const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

export function navigate(href) {
  window.history.pushState({}, "", href);
  emit();
}

function subscribe(callback) {
  listeners.add(callback);
  window.addEventListener("popstate", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("popstate", callback);
  };
}

let cachedRoute = null;

function snapshot() {
  const key = window.location.pathname + window.location.search;
  if (!cachedRoute || cachedRoute.key !== key) {
    cachedRoute = {
      key,
      pathname: window.location.pathname,
      search: window.location.search,
    };
  }
  return cachedRoute;
}

export function useRoute() {
  return useSyncExternalStore(subscribe, snapshot);
}

export function useLinkInterceptor() {
  useEffect(() => {
    function onClick(event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = event.target.closest?.("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      event.preventDefault();
      navigate(href);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
