import Map from "./components/Map";
import SearchBox from "./components/SearchBox";
import BookDetailsDrawer from "./components/BookDetailsDrawer";
import Walkthrough from "./components/Walkthrough";
import { useRef, useState } from "react";
import { MapGeoJSONFeature } from "maplibre-gl";

const WALKTHROUGH_STORAGE_KEY = "map-of-goodreads.walkthrough.v1";

export default function App() {
  const [selectedBook, setSelectedBook] = useState<MapGeoJSONFeature | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<[number, number] | null>(null);
  const [walkthroughStep, setWalkthroughStep] = useState<number | null>(() => {
    try {
      return localStorage.getItem(WALKTHROUGH_STORAGE_KEY) ? null : 0;
    } catch {
      return 0;
    }
  });
  const walkthroughStartingBookId = useRef<string | null>(null);

  const completeWalkthrough = () => {
    try {
      localStorage.setItem(WALKTHROUGH_STORAGE_KEY, "complete");
    } catch {
      // The tour can still close if storage is unavailable.
    }
    setWalkthroughStep(null);
  };

  const restartWalkthrough = () => {
    walkthroughStartingBookId.current = null;
    setWalkthroughStep(0);
  };

  const handleMapNodeSelected = (book: MapGeoJSONFeature) => {
    const bookId = String(book.properties?.id ?? "");

    setWalkthroughStep((currentStep) => {
      if (currentStep === 0) {
        walkthroughStartingBookId.current = bookId;
        return 1;
      }

      if (
        currentStep === 3 &&
        bookId &&
        bookId !== walkthroughStartingBookId.current
      ) {
        return 4;
      }

      return currentStep;
    });
  };

  return (
    <div id="main-container" style={{height: "100vh", width: "100vw", margin: "-8px"}}>
      <SearchBox
        setSelectedCoordinates={setSelectedCoordinates}
        showFiltersForTour={walkthroughStep === 4}
      />
      <Map
        selectedBook={selectedBook}
        setSelectedBook={setSelectedBook}
        selectedCoordinates={selectedCoordinates}
        onNodeSelected={handleMapNodeSelected}
        onEdgeNavigate={() => {
          setWalkthroughStep((currentStep) =>
            currentStep === 1 ? 2 : currentStep
          );
        }}
        onUserZoom={() => {
          setWalkthroughStep((currentStep) =>
            currentStep === 2 ? 3 : currentStep
          );
        }}
      />
      <BookDetailsDrawer selectedBook={selectedBook} setSelectedBook={setSelectedBook} />
      <Walkthrough
        step={walkthroughStep}
        onSkip={completeWalkthrough}
        onFinish={completeWalkthrough}
        onRestart={restartWalkthrough}
      />
    </div>
  );
}
