import { useEffect, useMemo, useRef, useState } from "react";
import { server } from "../config";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

const SEARCH_BASE_URL = `${server}/v2/search`;
const MAX_SHARDS_PER_QUERY = 8;

type SearchRow = [
  searchKey: string,
  id: string,
  title: string,
  authors: string,
  publicationYear: string,
  longitude: number,
  latitude: number,
  averageRating: number | string,
  popularity: number,
  groupId: number | string,
  publisher: string
];

interface SearchManifest {
  indexes: {
    title: {
      routes: Record<string, string[]>;
    };
    author: {
      routes: Record<string, string[]>;
    };
  };
}

interface SearchResult {
  row: SearchRow;
  score: number;
}

interface SearchBoxProps {
  setSelectedCoordinates: (coordinates: [number, number]) => void;
}

let manifestPromise: Promise<SearchManifest> | null = null;
const shardCache = new Map<string, Promise<SearchRow[]>>();

function trackSearchEvent(searchQuery: string) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "search", {
      search_term: searchQuery,
    });
  }
}

function trackBookSelectionEvent(bookTitle: string) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "select_content", {
      content_type: "book",
      item_id: bookTitle,
    });
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function loadManifest(): Promise<SearchManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${SEARCH_BASE_URL}/manifest.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Search manifest failed: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        manifestPromise = null;
        throw error;
      });
  }

  return manifestPromise;
}

function loadShard(relativePath: string): Promise<SearchRow[]> {
  if (!shardCache.has(relativePath)) {
    const request = fetch(`${SEARCH_BASE_URL}/${relativePath}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Search shard failed: ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        shardCache.delete(relativePath);
        throw error;
      });
    shardCache.set(relativePath, request);
  }

  return shardCache.get(relativePath)!;
}

function resolveShardFiles(
  routes: Record<string, string[]>,
  normalizedQuery: string
): { files: string[]; tooBroad: boolean } {
  for (
    let prefixLength = normalizedQuery.length;
    prefixLength > 0;
    prefixLength -= 1
  ) {
    const route = routes[normalizedQuery.slice(0, prefixLength)];
    if (route) {
      return {
        files: route,
        tooBroad: route.length > MAX_SHARDS_PER_QUERY,
      };
    }
  }

  const descendantFiles = Object.entries(routes)
    .filter(([prefix]) => prefix.startsWith(normalizedQuery))
    .flatMap(([, files]) => files);

  return {
    files: descendantFiles.slice(0, MAX_SHARDS_PER_QUERY),
    tooBroad: descendantFiles.length > MAX_SHARDS_PER_QUERY,
  };
}

function levenshteinDistance(
  left: string,
  right: string,
  maxDistance: number
): number {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let smallestDistance = current[0];

    for (
      let rightIndex = 1;
      rightIndex <= right.length;
      rightIndex += 1
    ) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      smallestDistance = Math.min(smallestDistance, current[rightIndex]);
    }

    if (smallestDistance > maxDistance) return maxDistance + 1;
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function fuzzyScore(query: string, target: string): number {
  if (!query) return 0;
  if (query === target) return 1000;
  if (target.startsWith(query)) return 900 - (target.length - query.length);

  const substringIndex = target.indexOf(query);
  if (substringIndex >= 0) {
    return 800 - substringIndex;
  }

  const queryTokens = query.split(" ");
  const targetTokens = target.split(" ");
  let totalDistance = 0;

  for (const queryToken of queryTokens) {
    let bestDistance = Infinity;
    const allowedDistance =
      queryToken.length <= 4
        ? 1
        : Math.max(1, Math.floor(queryToken.length / 4));

    for (const targetToken of targetTokens) {
      bestDistance = Math.min(
        bestDistance,
        levenshteinDistance(queryToken, targetToken, allowedDistance)
      );
      if (bestDistance === 0) break;
    }

    if (bestDistance > allowedDistance) return -1;
    totalDistance += bestDistance;
  }

  return 650 - totalDistance * 30;
}

function formatResultMetadata(row: SearchRow): string {
  const [, , , authors, publicationYear] = row;
  return [authors, publicationYear].filter(Boolean).join(" · ");
}

export default function SearchBox({
  setSelectedCoordinates,
}: SearchBoxProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const suppressNextSearchRef = useRef(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const debouncedAuthorQuery = useDebounce(authorQuery, 250);
  const normalizedSearchQuery = useMemo(
    () => normalizeSearchText(debouncedSearchQuery),
    [debouncedSearchQuery]
  );
  const normalizedAuthorQuery = useMemo(
    () => normalizeSearchText(debouncedAuthorQuery),
    [debouncedAuthorQuery]
  );

  useEffect(() => {
    const primaryQuery = normalizedSearchQuery || normalizedAuthorQuery;
    const indexType = normalizedSearchQuery ? "title" : "author";
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      setIsLoading(false);
      return;
    }

    if (primaryQuery.length < 2) {
      setResults([]);
      setMessage(
        primaryQuery
          ? "Type at least 2 characters"
          : "Search by title or author"
      );
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage("");

    loadManifest()
      .then((manifest) => {
        const resolution = resolveShardFiles(
          manifest.indexes[indexType].routes,
          primaryQuery
        );

        if (resolution.tooBroad) {
          throw new Error("TOO_BROAD");
        }
        if (resolution.files.length === 0) return [];

        return Promise.all(resolution.files.map(loadShard)).then((shards) =>
          shards.flat()
        );
      })
      .then((rows) => {
        if (requestId !== requestIdRef.current) return;

        const fromYear = Number(yearFrom) || null;
        const toYear = Number(yearTo) || null;
        const deduplicatedResults = new Map<string, SearchResult>();

        for (const row of rows) {
          const [, id, , authors, publicationYear] = row;
          const titleScore = normalizedSearchQuery
            ? fuzzyScore(normalizedSearchQuery, row[0])
            : 0;
          const authorScore = normalizedAuthorQuery
            ? fuzzyScore(
                normalizedAuthorQuery,
                normalizeSearchText(authors)
              )
            : 0;

          if (normalizedSearchQuery && titleScore < 0) continue;
          if (normalizedAuthorQuery && authorScore < 0) continue;

          const publicationYearNumber = Number(publicationYear);
          if (
            fromYear &&
            (!publicationYearNumber || publicationYearNumber < fromYear)
          ) {
            continue;
          }
          if (
            toYear &&
            (!publicationYearNumber || publicationYearNumber > toYear)
          ) {
            continue;
          }

          const popularity = Number(row[8]) || 0;
          const score =
            titleScore + authorScore + Math.log10(popularity + 1) * 5;
          const existing = deduplicatedResults.get(id);
          if (!existing || score > existing.score) {
            deduplicatedResults.set(id, { row, score });
          }
        }

        const nextResults = Array.from(deduplicatedResults.values())
          .sort((left, right) => right.score - left.score)
          .slice(0, 20);

        setResults(nextResults);
        setMessage(nextResults.length ? "" : "No matching books");
        setSelectedIndex(-1);
        setShowDropdown(true);
        setIsLoading(false);

        trackSearchEvent(
          [debouncedSearchQuery, debouncedAuthorQuery]
            .filter(Boolean)
            .join(" · ")
        );
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setIsLoading(false);
        setMessage(
          error.message === "TOO_BROAD"
            ? "Keep typing to narrow the search"
            : "Search is temporarily unavailable"
        );
        setShowDropdown(true);
      });
  }, [
    debouncedAuthorQuery,
    debouncedSearchQuery,
    normalizedAuthorQuery,
    normalizedSearchQuery,
    yearFrom,
    yearTo,
  ]);

  const handleBookSelect = (result: SearchResult) => {
    const [, , title, , , longitude, latitude] = result.row;
    requestIdRef.current += 1;
    suppressNextSearchRef.current = true;
    setSelectedCoordinates([longitude, latitude]);
    setSearchQuery(title);
    setShowDropdown(false);
    setSelectedIndex(-1);
    trackBookSelectionEvent(title);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((previous) =>
          previous < results.length - 1 ? previous + 1 : 0
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((previous) =>
          previous > 0 ? previous - 1 : results.length - 1
        );
        break;
      case "Enter":
        event.preventDefault();
        if (selectedIndex >= 0) {
          handleBookSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const dropdownVisible =
    showDropdown &&
    (results.length > 0 || isLoading || Boolean(message));

  return (
    <div
      id="search-box"
      ref={searchBoxRef}
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        zIndex: 1000,
        width: "360px",
        maxWidth: "calc(100vw - 20px)",
      }}
    >
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          type="text"
          placeholder="Search books..."
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          style={{
            padding: "9px 12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "14px",
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => setShowFilters((visible) => !visible)}
          aria-expanded={showFilters}
          style={{
            padding: "8px 10px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            background: showFilters ? "#f0f0f0" : "white",
            cursor: "pointer",
          }}
        >
          Filters
        </button>
      </div>

      {showFilters && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 90px",
            gap: "6px",
            padding: "8px",
            marginTop: "4px",
            background: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        >
          <input
            type="text"
            placeholder="Author"
            value={authorQuery}
            onChange={(event) => {
              setAuthorQuery(event.target.value);
              setShowDropdown(true);
            }}
            style={{ minWidth: 0, padding: "7px", boxSizing: "border-box" }}
          />
          <input
            type="number"
            placeholder="From year"
            value={yearFrom}
            onChange={(event) => {
              setYearFrom(event.target.value);
              setShowDropdown(true);
            }}
            style={{ minWidth: 0, padding: "7px", boxSizing: "border-box" }}
          />
          <input
            type="number"
            placeholder="To year"
            value={yearTo}
            onChange={(event) => {
              setYearTo(event.target.value);
              setShowDropdown(true);
            }}
            style={{ minWidth: 0, padding: "7px", boxSizing: "border-box" }}
          />
        </div>
      )}

      {dropdownVisible && (
        <div
          style={{
            marginTop: "4px",
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            maxHeight: "360px",
            overflowY: "auto",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {isLoading && (
            <div style={{ padding: "10px 12px", color: "#666" }}>
              Searching…
            </div>
          )}

          {!isLoading && message && (
            <div style={{ padding: "10px 12px", color: "#666" }}>
              {message}
            </div>
          )}

          {!isLoading &&
            results.map((result, index) => {
              const [, id, title] = result.row;
              const metadata = formatResultMetadata(result.row);

              return (
                <div
                  key={id}
                  onClick={() => handleBookSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    padding: "9px 12px",
                    cursor: "pointer",
                    backgroundColor:
                      selectedIndex === index ? "#f0f0f0" : "white",
                    borderBottom:
                      index < results.length - 1
                        ? "1px solid #eee"
                        : "none",
                  }}
                  title={title}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {title}
                  </div>
                  {metadata && (
                    <div
                      style={{
                        marginTop: "2px",
                        color: "#666",
                        fontSize: "12px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {metadata}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
