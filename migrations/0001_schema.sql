CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  author TEXT DEFAULT 'R. E. Smith',
  series TEXT DEFAULT '',
  seriesOrder TEXT DEFAULT '',
  description TEXT DEFAULT '',
  fullDescription TEXT DEFAULT '',
  bookPages TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  publicationStatus TEXT DEFAULT '',
  publicationDate TEXT DEFAULT '',
  isbn TEXT DEFAULT '',
  bookFormat TEXT DEFAULT '',
  purchaseLink TEXT DEFAULT '',
  amazonLink TEXT DEFAULT '',
  googlePlayBooksLink TEXT DEFAULT '',
  featuredBook INTEGER DEFAULT 0,
  hardcoverAvailable INTEGER DEFAULT 0,
  paperbackAvailable INTEGER DEFAULT 0,
  eBookAvailable INTEGER DEFAULT 0,
  audiobookAvailable INTEGER DEFAULT 0,
  signedCopyAvailable INTEGER DEFAULT 0,
  signedHardcoverPrice TEXT DEFAULT '',
  signedPaperbackPrice TEXT DEFAULT '',
  directOrderInstructions TEXT DEFAULT '',
  signedCopyContactEmail TEXT DEFAULT '',
  signedCopyInstructions TEXT DEFAULT '',
  signedContactEmail TEXT DEFAULT '',
  slug TEXT DEFAULT '',
  coverUrl TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_series ON books(series);
CREATE INDEX IF NOT EXISTS idx_books_genre ON books(genre);
CREATE INDEX IF NOT EXISTS idx_books_publication_date ON books(publicationDate);
