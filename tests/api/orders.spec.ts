import { test, expect } from '@playwright/test';
import { createOrder, deleteOrder, getAvailableBookId, getOrder, registerClientAndGetToken } from '../support/apiHelpers';

test.describe('Simple Books API - orders', () => {
  test('creates an order for an available book and lists it', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);

    const createResponse = await createOrder(request, accessToken, bookId, 'Ada Lovelace');
    expect(createResponse.status()).toBe(201);

    const createdOrder = await createResponse.json();
    expect(createdOrder).toHaveProperty('orderId');

    const listResponse = await request.get('/orders', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(listResponse.status()).toBe(200);
    const orders = await listResponse.json();
    expect(orders.some((entry: { id: string }) => entry.id === createdOrder.orderId)).toBeTruthy();

    await deleteOrder(request, accessToken, createdOrder.orderId);
  });

  test('rejects invalid order payloads with 400-level errors', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);

    const invalidBookIdResponse = await createOrder(request, accessToken, 0, 'Invalid Book');
    expect(invalidBookIdResponse.status()).toBe(400);

    const missingCustomerNameResponse = await createOrder(request, accessToken, bookId, '');
    expect(missingCustomerNameResponse.status()).toBe(400);

    const shortCustomerNameResponse = await createOrder(request, accessToken, bookId, 'A');
    expect(shortCustomerNameResponse.status()).toBe(400);
  });

  test('updates an existing order and confirms the new customer name', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);
    const createdOrder = await createOrder(request, accessToken, bookId, 'Grace Hopper');
    const createdBody = await createdOrder.json();

    const updateResponse = await request.patch(`/orders/${createdBody.orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        customerName: 'Ada Lovelace',
      },
    });

    expect(updateResponse.status()).toBe(204);

    const updatedOrderResponse = await getOrder(request, accessToken, createdBody.orderId);
    expect(updatedOrderResponse.status()).toBe(200);

    const updatedOrder = await updatedOrderResponse.json();
    expect(updatedOrder.customerName).toBe('Ada Lovelace');

    await deleteOrder(request, accessToken, createdBody.orderId);
  });

  test('returns 404 when an update targets an unknown order id', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const response = await request.patch('/orders/does-not-exist', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        customerName: 'No Order',
      },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('deletes an existing order and makes it disappear from the detail endpoint', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);
    const createdOrder = await createOrder(request, accessToken, bookId, 'Delete Me');
    const createdBody = await createdOrder.json();

    const deleteResponse = await deleteOrder(request, accessToken, createdBody.orderId);
    expect(deleteResponse.status()).toBe(204);

    const detailResponse = await getOrder(request, accessToken, createdBody.orderId);
    expect(detailResponse.status()).toBe(404);
  });

  test('rejects order operations that omit an authorization header', async ({ request }) => {
    const response = await request.post('/orders', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        bookId: 1,
        customerName: 'No Token',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('rejects order operations with an invalid bearer token', async ({ request }) => {
    const response = await request.get('/orders', {
      headers: {
        Authorization: 'Bearer not-a-real-token',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
