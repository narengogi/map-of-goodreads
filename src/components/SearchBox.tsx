import { useState, useEffect, useRef } from "react";
import { server } from "../config";

// Google Analytics helper function
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

const trackSearchEvent = (searchQuery: string) => {
  console.log('tracking search event', searchQuery);
  console.log('window and window.gtag', window, window.gtag);
  if (typeof window !== 'undefined' && window.gtag) {
    console.log('adding search event', searchQuery);
    window.gtag('event', 'search', {
      search_term: searchQuery,
    });
  }
};

const trackBookSelectionEvent = (bookTitle: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'select_content', {
      content_type: 'book',
      item_id: bookTitle,
    });
  }
};

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface SearchBoxProps {
  setSelectedCoordinates: (coordinates: [number, number]) => void;
}

type BookEntry = [string, string, string]; // [title, longitude, latitude]

export default function SearchBox({ setSelectedCoordinates }: SearchBoxProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [lastFetchedQuery, setLastFetchedQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 1000); // 1000ms delay
  const [booksMap, setBooksMap] = useState<BookEntry[] | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedSearchQuery.slice(0, 2).toLowerCase() !== lastFetchedQuery) {
      setLastFetchedQuery(debouncedSearchQuery.slice(0, 2).toLowerCase());
      fetch(`${server}/v1/books_map_by_first_few_letters/${debouncedSearchQuery.slice(0, 2).toLowerCase()}.json`)
        .then(response => response.json())
        .then(data => setBooksMap(data))
        .catch(error => console.error('Error fetching books map:', error));
      
      // Track search event if query is meaningful (at least 2 characters)
      if (debouncedSearchQuery.trim().length >= 2) {
        trackSearchEvent(debouncedSearchQuery.trim());
      }
    }
  }, [debouncedSearchQuery]);

  // Filter books based on search query and get top 10 matches
  const getFilteredBooks = (): BookEntry[] => {
    if (!booksMap || !searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase().trim();
    const matches = booksMap.filter((book: BookEntry) => 
      book[0].toLowerCase().includes(query)
    );

    return matches.slice(0, 10);
  };

  const filteredBooks = getFilteredBooks();

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowDropdown(value.trim().length > 0);
    setSelectedIndex(-1);
  };

  // Handle book selection
  const handleBookSelect = (book: BookEntry) => {
    const longitude = parseFloat(book[1]);
    const latitude = parseFloat(book[2]);
    setSelectedCoordinates([longitude, latitude]);
    setSearchQuery(book[0]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    
    // Track book selection event
    trackBookSelectionEvent(book[0]);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredBooks.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredBooks.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredBooks.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleBookSelect(filteredBooks[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div
      id="search-box"
      ref={searchBoxRef}
      style={{ 
        position: "absolute", 
        top: "10px", 
        left: "10px", 
        zIndex: 1000,
        width: "300px"
      }}
    >
      <input 
        type="text" 
        placeholder="Search books..." 
        value={searchQuery} 
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => searchQuery.trim() && setShowDropdown(true)}
        style={{
          padding: "8px 12px",
          borderRadius: showDropdown && filteredBooks.length > 0 ? "4px 4px 0 0" : "4px",
          border: "1px solid #ccc",
          fontSize: "14px",
          width: "100%",
          boxSizing: "border-box",
          outline: "none"
        }}
      />
      
      {showDropdown && filteredBooks.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            maxHeight: "300px",
            overflowY: "auto",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
        >
          {filteredBooks.map((book, index) => (
            <div
              key={`${book[0]}-${index}`}
              onClick={() => handleBookSelect(book)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: selectedIndex === index ? "#f0f0f0" : "white",
                borderBottom: index < filteredBooks.length - 1 ? "1px solid #eee" : "none",
                fontSize: "14px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
              title={book[0]} // Show full title on hover
            >
              {book[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}