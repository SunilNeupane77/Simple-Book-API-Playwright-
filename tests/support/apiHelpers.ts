import { APIRequestContext, expect } from '@playwright/test';

const defaultClientName = process.env.CLIENT_NAME ?? 'QA User';
const defaultClientEmail = process.env.CLIENT_EMAIL ?? 'learner@example.com';

export function buildUniqueEmail(baseEmail = defaultClientEmail): string {
  const [localPart, domain = 'example.com'] = baseEmail.split('@');
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${localPart}+${suffix}@${domain}`;
}

export async function registerClient(
  request: APIRequestContext,
  email: string,
  clientName = defaultClientName
) {
  return request.post('/api-clients', {
    data: {
      clientName,
      clientEmail: email,
    },
  });
}

export async function registerClientAndGetToken(
  request: APIRequestContext,
  email?: string,
  clientName = defaultClientName
) {
  const resolvedEmail = email ?? buildUniqueEmail();
  const response = await registerClient(request, resolvedEmail, clientName);

  expect(response.status()).toBe(201);

  const body = await response.json();
  expect(body).toHaveProperty('accessToken');

  return {
    accessToken: body.accessToken as string,
    email: resolvedEmail,
  };
}

export async function getAvailableBookId(request: APIRequestContext): Promise<number> {
  const response = await request.get('/books');
  expect(response.status()).toBe(200);

  const books = await response.json();
  const availableBook = books.find((book: { available?: boolean }) => book.available);
  return availableBook?.id ?? 1;
}

export function buildAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function createOrder(
  request: APIRequestContext,
  token: string,
  bookId: number,
  customerName: string
) {
  return request.post('/orders', {
    headers: buildAuthHeaders(token),
    data: {
      bookId,
      customerName,
    },
  });
}

export async function getOrder(request: APIRequestContext, token: string, orderId: string) {
  return request.get(`/orders/${orderId}`, {
    headers: buildAuthHeaders(token),
  });
}

export async function deleteOrder(request: APIRequestContext, token: string, orderId: string) {
  return request.delete(`/orders/${orderId}`, {
    headers: buildAuthHeaders(token),
  });
}

export async function updateOrder(
  request: APIRequestContext,
  token: string,
  orderId: string,
  customerName: string
) {
  return request.patch(`/orders/${orderId}`, {
    headers: buildAuthHeaders(token),
    data: { customerName },
  });
}

export async function listOrders(request: APIRequestContext, token: string) {
  return request.get('/orders', {
    headers: buildAuthHeaders(token),
  });
}
