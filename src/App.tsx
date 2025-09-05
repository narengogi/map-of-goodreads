import Map from "./components/Map";
import SearchBox from "./components/SearchBox";
import BookDetailsDrawer from "./components/BookDetailsDrawer";
import { useState } from "react";
import { MapGeoJSONFeature } from "maplibre-gl";

export default function App() {
  const [selectedBook, setSelectedBook] = useState<MapGeoJSONFeature | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<[number, number] | null>(null);

  return (
    <div id="main-container" style={{height: "100vh", width: "100vw", margin: "-8px"}}>
      <SearchBox setSelectedCoordinates={setSelectedCoordinates} />
      <Map selectedBook={selectedBook} setSelectedBook={setSelectedBook} selectedCoordinates={selectedCoordinates} />
      <BookDetailsDrawer selectedBook={selectedBook} setSelectedBook={setSelectedBook} />
    </div>
  );
}