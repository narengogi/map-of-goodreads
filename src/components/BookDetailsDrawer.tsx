import { MapGeoJSONFeature } from "maplibre-gl";
import './BookDetailsDrawer.css';

export default function BookDetailsDrawer({ selectedBook, setSelectedBook }: { selectedBook: MapGeoJSONFeature | null, setSelectedBook: (book: MapGeoJSONFeature | null) => void }) {
  if (!selectedBook) return null;
  
  const goodreadsUrl = `https://www.goodreads.com/search?q=${selectedBook.properties?.title}`;
  
  return (
    <div className={`drawer-container ${selectedBook ? 'open' : ''}`}>
      <div className="drawer-header">
        <button onClick={() => setSelectedBook(null)}>Close</button>
      </div>
      <div className="drawer-content">
        <h2>{selectedBook.properties?.title}</h2>
        {selectedBook.properties?.author_names && <p>Author(s): {selectedBook.properties?.author_names}</p>}
        {selectedBook.properties?.average_rating && <p>Average Rating: {selectedBook.properties?.average_rating}</p>}
        {selectedBook.properties?.publication_year && <p>Publication Year: {selectedBook.properties?.publication_year}</p>}
        {selectedBook.properties?.publisher && <p>Publisher: {selectedBook.properties?.publisher}</p>}
        {selectedBook.properties?.description && <p>Description: {selectedBook.properties?.description}</p>}
        {selectedBook.properties?.id && <p>Goodreads ID: {selectedBook.properties?.id}</p>}
        {selectedBook.properties?.id && <p>Goodreads URL: <a href={goodreadsUrl} target="_blank" rel="noopener noreferrer">{goodreadsUrl}</a></p>}
      </div>
    </div>
  );
}
