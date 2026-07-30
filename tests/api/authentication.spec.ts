import { test, expect } from '@playwright/test';
import { buildUniqueEmail, registerClient } from '../support/apiHelpers';

test.describe('Simple Books API - authentication', () => {
  test('registers a client successfully and returns an access token', async ({ request }) => {
    const email = buildUniqueEmail();
    const response = await registerClient(request, email);

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('accessToken');
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
  });

  test('rejects duplicate registrations for the same email', async ({ request }) => {
    const email = buildUniqueEmail();
    const firstResponse = await registerClient(request, email);
    expect(firstResponse.status()).toBe(201);

    const secondResponse = await registerClient(request, email);
    expect(secondResponse.status()).toBe(409);

    const body = await secondResponse.json();
    expect(body).toHaveProperty('error');
  });

  test('rejects requests that omit required client fields', async ({ request }) => {
    const missingEmailResponse = await request.post('/api-clients', {
      data: { clientName: 'Missing Email' },
    });
    expect(missingEmailResponse.status()).toBe(400);

    const missingNameResponse = await request.post('/api-clients', {
      data: { clientEmail: buildUniqueEmail() },
    });
    expect(missingNameResponse.status()).toBe(400);
  });

  test('rejects blank client values with validation errors', async ({ request }) => {
    const blankNameResponse = await request.post('/api-clients', {
      data: { clientName: '', clientEmail: buildUniqueEmail() },
    });
    expect(blankNameResponse.status()).toBe(400);

    const blankEmailResponse = await request.post('/api-clients', {
      data: { clientName: 'Blank Email', clientEmail: '   ' },
    });
    expect(blankEmailResponse.status()).toBe(400);
  });
});
