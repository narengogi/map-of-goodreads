import type { MapGeoJSONFeature } from "maplibre-gl";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

type AnalyticsParameters = Record<
  string,
  string | number | boolean | undefined
>;

function trackEvent(
  eventName: string,
  parameters: AnalyticsParameters
) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, parameters);
}

export function trackSearchEvent(searchQuery: string) {
  trackEvent("search", {
    search_term: searchQuery,
  });
}

export function trackBookSelectionEvent(bookTitle: string) {
  trackEvent("select_content", {
    content_type: "book",
    item_id: bookTitle,
  });
}

export function trackMapNodeClickEvent(book: MapGeoJSONFeature) {
  trackEvent("map_node_click", {
    book_title: String(book.properties?.title ?? ""),
    author_names: String(book.properties?.author_names ?? ""),
    group_id: String(book.properties?.groupId ?? ""),
  });
}

export function trackMapEdgeClickEvent({
  fromBookTitle,
  toBookTitle,
  returningToSelectedBook,
}: {
  fromBookTitle: string;
  toBookTitle: string;
  returningToSelectedBook: boolean;
}) {
  trackEvent("map_edge_click", {
    from_book_title: fromBookTitle,
    to_book_title: toBookTitle,
    navigation_direction: returningToSelectedBook
      ? "return_to_selected"
      : "to_recommendation",
  });
}
