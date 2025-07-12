export default function SearchBox({ searchQuery, setSearchQuery }: { searchQuery: string, setSearchQuery: (query: string) => void }) {
  return (
    <div
      id="search-box"
      style={{ position: "absolute", top: "10px", left: "10px", zIndex: 1000 }}
    >
      <input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
    </div>
  );
}