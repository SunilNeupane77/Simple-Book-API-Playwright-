import { test, expect } from '@playwright/test';
import {
  createOrder,
  deleteOrder,
  getAvailableBookId,
  getOrder,
  registerClientAndGetToken,
  updateOrder,
} from '../support/apiHelpers';

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

  // --- positive: get single order ---

  test('positive: get single order returns correct order details', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);
    const created = await (await createOrder(request, accessToken, bookId, 'Alan Turing')).json();

    const response = await getOrder(request, accessToken, created.orderId);
    expect(response.status()).toBe(200);
    const order = await response.json();
    expect(order.id).toBe(created.orderId);
    expect(order.bookId).toBe(bookId);
    expect(order.customerName).toBe('Alan Turing');

    await deleteOrder(request, accessToken, created.orderId);
  });

  // --- negative: get order with unknown id ---

  test('negative: get order with unknown id returns 404', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const response = await getOrder(request, accessToken, 'does-not-exist');
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // --- negative: delete already-deleted order is idempotent (404) ---

  test('negative: deleting an already-deleted order returns 404', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);
    const created = await (await createOrder(request, accessToken, bookId, 'Delete Twice')).json();

    await deleteOrder(request, accessToken, created.orderId);
    const secondDelete = await deleteOrder(request, accessToken, created.orderId);
    expect(secondDelete.status()).toBe(404);
  });

  // --- boundary: customer name length ---

  test('boundary: customer name of exactly 2 characters is accepted', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);
    const response = await createOrder(request, accessToken, bookId, 'Jo');
    expect(response.status()).toBe(201);
    const body = await response.json();
    await deleteOrder(request, accessToken, body.orderId);
  });

  test('boundary: very long customer name is handled gracefully', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);
    const longName = 'A'.repeat(300);
    const response = await createOrder(request, accessToken, bookId, longName);
    expect(response.status()).toBeLessThan(500);
    if (response.status() === 201) {
      const body = await response.json();
      await deleteOrder(request, accessToken, body.orderId);
    }
  });

  // --- negative: update with blank customer name ---

  test('negative: update order with blank customer name returns 400', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);
    const created = await (await createOrder(request, accessToken, bookId, 'Valid Name')).json();

    const response = await updateOrder(request, accessToken, created.orderId, '');
    expect(response.status()).toBe(400);

    await deleteOrder(request, accessToken, created.orderId);
  });

  // --- negative: cross-client order isolation ---

  test('negative: client cannot access another client\'s orders', async ({ request }) => {
    const { accessToken: tokenA } = await registerClientAndGetToken(request);
    const { accessToken: tokenB } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);

    const created = await (await createOrder(request, tokenA, bookId, 'Client A Order')).json();

    const response = await getOrder(request, tokenB, created.orderId);
    expect(response.status()).toBe(404);

    await deleteOrder(request, tokenA, created.orderId);
  });

  // --- end-to-end: full order lifecycle ---

  test('e2e: register → create order → update → verify → delete → confirm gone', async ({ request }) => {
    const { accessToken } = await registerClientAndGetToken(request);
    const bookId = await getAvailableBookId(request);

    // Create
    const createResponse = await createOrder(request, accessToken, bookId, 'Initial Name');
    expect(createResponse.status()).toBe(201);
    const { orderId } = await createResponse.json();

    // Verify created
    const getAfterCreate = await getOrder(request, accessToken, orderId);
    expect(getAfterCreate.status()).toBe(200);
    expect((await getAfterCreate.json()).customerName).toBe('Initial Name');

    // Update
    const updateResponse = await updateOrder(request, accessToken, orderId, 'Updated Name');
    expect(updateResponse.status()).toBe(204);

    // Verify updated
    const getAfterUpdate = await getOrder(request, accessToken, orderId);
    expect(getAfterUpdate.status()).toBe(200);
    expect((await getAfterUpdate.json()).customerName).toBe('Updated Name');

    // Delete
    const deleteResponse = await deleteOrder(request, accessToken, orderId);
    expect(deleteResponse.status()).toBe(204);

    // Confirm gone
    const getAfterDelete = await getOrder(request, accessToken, orderId);
    expect(getAfterDelete.status()).toBe(404);
  });
});
