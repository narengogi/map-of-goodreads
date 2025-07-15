import Map from "./components/Map";
import SearchBox from "./components/SearchBox";
import BookDetailsDrawer from "./components/BookDetailsDrawer";
import { useState } from "react";

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<string | null>(null);

  return (
    <div id="main-container" style={{height: "100vh", width: "100vw"}}>
      <SearchBox searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <Map searchQuery={searchQuery} selectedBook={selectedBook} setSelectedBook={setSelectedBook} />
      {/* <BookDetailsDrawer selectedBook={selectedBook} setSelectedBook={setSelectedBook} /> */}
    </div>
  );
}