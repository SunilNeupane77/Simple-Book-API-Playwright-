import { test, expect, type APIRequestContext } from '@playwright/test';

const clientName = process.env.CLIENT_NAME ?? 'QA User';
const configuredEmail = process.env.CLIENT_EMAIL ?? 'learner@example.com';

let accessToken = '';
let registeredEmail = '';
let validBookId = 1;
let orderId = '';

function buildUniqueEmail() {
  const [localPart, domain = 'example.com'] = configuredEmail.split('@');
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${localPart}+${suffix}@${domain}`;
}

async function registerClient(request: APIRequestContext, email: string) {
  const response = await request.post('/api-clients/', {
    data: {
      clientName,
      clientEmail: email,
    },
  });

  return response;
}

test.describe('Simple Books API', () => {
  test.beforeAll(async ({ request }) => {
    registeredEmail = buildUniqueEmail();
    const response = await registerClient(request, registeredEmail);

    expect(response.status()).toBe(201);
    const body = await response.json();
    accessToken = body.accessToken;

    const booksResponse = await request.get('/books');
    expect(booksResponse.status()).toBe(200);

    const books = await booksResponse.json();
    validBookId = books.find((book: { available: boolean }) => book.available)?.id ?? 1;
  });

  test('01 - smoke: health check and books endpoint', async ({ request }) => {
    const statusResponse = await request.get('/status');
    expect(statusResponse.status()).toBe(200);
    await expect(statusResponse.json()).resolves.toMatchObject({ status: 'OK' });

    const booksResponse = await request.get('/books');
    expect(booksResponse.status()).toBe(200);
    const books = await booksResponse.json();
    expect(Array.isArray(books)).toBeTruthy();
    expect(books.length).toBeGreaterThan(0);
  });

  test('02 - books: list, filter, and detail endpoints', async ({ request }) => {
    const allBooksResponse = await request.get('/books');
    expect(allBooksResponse.status()).toBe(200);
    const books = await allBooksResponse.json();
    expect(books.length).toBeGreaterThan(0);
    expect(books[0]).toHaveProperty('id');
    expect(books[0]).toHaveProperty('name');

    const fictionResponse = await request.get('/books?type=fiction');
    expect(fictionResponse.status()).toBe(200);
    const fictionBooks = await fictionResponse.json();
    fictionBooks.forEach((book: { type: string }) => {
      expect(book.type).toBe('fiction');
    });

    const detailResponse = await request.get(`/books/${validBookId}`);
    expect(detailResponse.status()).toBe(200);
    const book = await detailResponse.json();
    expect(book.id).toBe(validBookId);
  });

  test('03 - auth: duplicate registration is rejected', async ({ request }) => {
    const response = await registerClient(request, registeredEmail);
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('04 - auth: missing required fields are rejected', async ({ request }) => {
    const missingNameResponse = await request.post('/api-clients/', {
      data: { clientEmail: 'missing.name@example.com' },
    });
    expect(missingNameResponse.status()).toBe(400);

    const missingEmailResponse = await request.post('/api-clients/', {
      data: { clientName: 'No Email' },
    });
    expect(missingEmailResponse.status()).toBe(400);
  });

  test('05 - orders: create and fetch an order', async ({ request }) => {
    const createResponse = await request.post('/orders', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        bookId: validBookId,
        customerName: 'Ada Lovelace',
      },
    });

    expect(createResponse.status()).toBe(201);
    const createdBody = await createResponse.json();
    expect(createdBody).toHaveProperty('orderId');
    orderId = createdBody.orderId;

    const listResponse = await request.get('/orders', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(listResponse.status()).toBe(200);
    const orders = await listResponse.json();
    expect(orders.some((entry: { id: string }) => entry.id === orderId)).toBeTruthy();
  });

  test('06 - orders: update and delete the created order', async ({ request }) => {
    const updateResponse = await request.patch(`/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        customerName: 'Grace Hopper',
      },
    });
    expect(updateResponse.status()).toBe(204);

    const verifyResponse = await request.get(`/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(verifyResponse.status()).toBe(200);
    const updatedOrder = await verifyResponse.json();
    expect(updatedOrder.customerName).toBe('Grace Hopper');

    const deleteResponse = await request.delete(`/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(deleteResponse.status()).toBe(204);
  });

  test('07 - orders: unauthorized requests are rejected', async ({ request }) => {
    const noTokenResponse = await request.post('/orders', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        bookId: validBookId,
        customerName: 'No Token',
      },
    });
    expect(noTokenResponse.status()).toBe(401);

    const badTokenResponse = await request.post('/orders', {
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      data: {
        bookId: validBookId,
        customerName: 'Bad Token',
      },
    });
    expect(badTokenResponse.status()).toBe(401);
  });
});
