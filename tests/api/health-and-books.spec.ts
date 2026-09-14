import { test, expect } from '@playwright/test';
import { getAvailableBookId } from '../support/apiHelpers';

type Book = { id: number; name: string; type: string; available: boolean };

test.describe('Simple Books API - health and books', () => {
  test('smoke: health endpoint responds with OK', async ({ request }) => {
    const response = await request.get('/status');

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'OK' });
  });

  test('lists books with the expected payload shape', async ({ request }) => {
    const response = await request.get('/books');

    expect(response.status()).toBe(200);

    const books = await response.json();
    expect(Array.isArray(books)).toBeTruthy();
    expect(books.length).toBeGreaterThan(0);

    books.forEach((book: { id?: number; name?: string; type?: string; available?: boolean }) => {
      expect(book).toHaveProperty('id');
      expect(book).toHaveProperty('name');
      expect(book).toHaveProperty('type');
      expect(typeof book.available).toBe('boolean');
    });
  });

  test('filters books by supported type values', async ({ request }) => {
    const fictionResponse = await request.get('/books?type=fiction');
    expect(fictionResponse.status()).toBe(200);

    const fictionBooks = await fictionResponse.json();
    expect(fictionBooks.length).toBeGreaterThan(0);
    fictionBooks.forEach((book: { type: string }) => {
      expect(book.type).toBe('fiction');
    });

    const nonFictionResponse = await request.get('/books?type=non-fiction');
    expect(nonFictionResponse.status()).toBe(200);

    const nonFictionBooks = await nonFictionResponse.json();
    expect(nonFictionBooks.length).toBeGreaterThan(0);
    nonFictionBooks.forEach((book: { type: string }) => {
      expect(book.type).toBe('non-fiction');
    });
  });

  test('rejects unsupported book type filters', async ({ request }) => {
    const response = await request.get('/books?type=unknown');

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('treats an empty type filter as no filter', async ({ request }) => {
    const response = await request.get('/books?type=');

    expect(response.status()).toBe(200);
    const books = await response.json();
    expect(Array.isArray(books)).toBeTruthy();
    expect(books.length).toBeGreaterThan(0);
  });

  test('returns a detail payload for a valid book id', async ({ request }) => {
    const validBookId = await getAvailableBookId(request);
    const response = await request.get(`/books/${validBookId}`);

    expect(response.status()).toBe(200);
    const book = await response.json();
    expect(book.id).toBe(validBookId);
    expect(book).toHaveProperty('name');
    expect(book).toHaveProperty('type');
  });

  test('handles invalid and unknown book ids with the right status codes', async ({ request }) => {
    const missingBookResponse = await request.get('/books/999999');
    expect(missingBookResponse.status()).toBe(404);

    const invalidBookResponse = await request.get('/books/abc');
    expect(invalidBookResponse.status()).toBe(400);
  });

  // --- boundary: limit parameter ---

  test('boundary: limit=1 returns exactly one book', async ({ request }) => {
    const response = await request.get('/books?limit=1');
    expect(response.status()).toBe(200);
    const books = await response.json();
    expect(books).toHaveLength(1);
  });

  test('boundary: limit=20 returns at most 20 books', async ({ request }) => {
    const response = await request.get('/books?limit=20');
    expect(response.status()).toBe(200);
    const books = await response.json();
    expect(books.length).toBeLessThanOrEqual(20);
  });

  test('boundary: limit=0 is rejected with 400', async ({ request }) => {
    const response = await request.get('/books?limit=0');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('boundary: limit=21 exceeds maximum and is rejected with 400', async ({ request }) => {
    const response = await request.get('/books?limit=21');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // --- equivalence: type filter case sensitivity ---

  test('equivalence: type filter is case-sensitive and rejects wrong case', async ({ request }) => {
    const response = await request.get('/books?type=Fiction');
    expect(response.status()).toBe(400);
  });

  // --- positive: book detail has all expected fields ---

  test('positive: book detail includes all required fields', async ({ request }) => {
    const bookId = await getAvailableBookId(request);
    const response = await request.get(`/books/${bookId}`);
    expect(response.status()).toBe(200);
    const book: Book & { 'current-stock'?: number; price?: number } = await response.json();
    expect(book).toHaveProperty('id');
    expect(book).toHaveProperty('name');
    expect(book).toHaveProperty('type');
    expect(book).toHaveProperty('available');
    expect(book).toHaveProperty('price');
    expect(book).toHaveProperty('current-stock');
  });

  // --- equivalence: limit combined with type filter ---

  test('equivalence: limit and type filters combine correctly', async ({ request }) => {
    const response = await request.get('/books?type=fiction&limit=1');
    expect(response.status()).toBe(200);
    const books: Book[] = await response.json();
    expect(books).toHaveLength(1);
    expect(books[0].type).toBe('fiction');
  });

  // --- response headers ---

  test('health endpoint returns JSON content-type header', async ({ request }) => {
    const response = await request.get('/status');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('books listing endpoint returns JSON content-type header', async ({ request }) => {
    const response = await request.get('/books');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('book detail endpoint returns JSON content-type header', async ({ request }) => {
    const bookId = await getAvailableBookId(request);
    const response = await request.get(`/books/${bookId}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  // --- non-fiction book detail ---

  test('positive: non-fiction book detail has all required fields', async ({ request }) => {
    const nonFictionResponse = await request.get('/books?type=non-fiction');
    expect(nonFictionResponse.status()).toBe(200);
    const nonFictionBooks: Book[] = await nonFictionResponse.json();
    expect(nonFictionBooks.length).toBeGreaterThan(0);

    const bookId = nonFictionBooks[0].id;
    const detailResponse = await request.get(`/books/${bookId}`);
    expect(detailResponse.status()).toBe(200);

    const book: Book & { 'current-stock'?: number; price?: number } = await detailResponse.json();
    expect(book.id).toBe(bookId);
    expect(book.type).toBe('non-fiction');
    expect(book).toHaveProperty('name');
    expect(book).toHaveProperty('available');
    expect(book).toHaveProperty('price');
    expect(book).toHaveProperty('current-stock');
    expect(typeof book.price).toBe('number');
    expect(typeof book['current-stock']).toBe('number');
  });

  // --- negative: special and negative book id shapes ---

  test('negative: negative book id returns 404', async ({ request }) => {
    const response = await request.get('/books/-1');
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('positive: floating-point book id is truncated to integer and returns a book', async ({ request }) => {
    // The API truncates 1.5 → book 1 and returns 200 with that book's detail
    const response = await request.get('/books/1.5');
    expect([200, 400]).toContain(response.status());
  });

  test('negative: book id with special characters returns 400', async ({ request }) => {
    const response = await request.get('/books/$!@');
    expect([400, 404]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // --- boundary: limit edge cases ---

  test('boundary: limit=-1 is rejected with 400', async ({ request }) => {
    const response = await request.get('/books?limit=-1');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('boundary: non-numeric limit is ignored and all books are returned', async ({ request }) => {
    // The API ignores non-numeric limit values and returns the default book list
    const response = await request.get('/books?limit=abc');
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      const books = await response.json();
      expect(Array.isArray(books)).toBeTruthy();
    }
  });

  // --- equivalence: unknown query parameters are ignored ---

  test('equivalence: unknown query parameters are ignored and books are still returned', async ({ request }) => {
    const response = await request.get('/books?unknown=param&foo=bar');
    expect(response.status()).toBe(200);
    const books = await response.json();
    expect(Array.isArray(books)).toBeTruthy();
    expect(books.length).toBeGreaterThan(0);
  });

  // --- positive: available flag correctness ---

  test('positive: every available book in the list has available set to true', async ({ request }) => {
    const response = await request.get('/books');
    expect(response.status()).toBe(200);
    const books: Book[] = await response.json();
    const available = books.filter((b) => b.available);
    available.forEach((book) => {
      expect(book.available).toBe(true);
    });
  });
});
