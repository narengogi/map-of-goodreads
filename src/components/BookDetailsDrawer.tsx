export default function BookDetailsDrawer({ selectedBook, setSelectedBook }: { selectedBook: string | null, setSelectedBook: (book: string | null) => void }) {
  if (!selectedBook) return null;
  
  const goodreadsUrl = `https://www.goodreads.com/book/show/${selectedBook}`;
  
  return (
    <div className="drawer-container">
      <div className="drawer-header">
        <button onClick={() => setSelectedBook(null)}>Close</button>
      </div>
      <div className="drawer-content">
        <iframe
          src={goodreadsUrl}
          title="Goodreads Book"
          width="100%"
          height="800px"
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </div>
  );
}
