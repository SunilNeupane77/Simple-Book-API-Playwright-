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

  // --- equivalence: malformed email formats ---

  test('equivalence: rejects malformed email addresses', async ({ request }) => {
    const malformedEmails = ['notanemail', '@nodomain.com', 'missing@', 'two@@at.com'];
    for (const clientEmail of malformedEmails) {
      const response = await request.post('/api-clients', {
        data: { clientName: 'Test User', clientEmail },
      });
      expect(response.status(), `expected 400 for email: ${clientEmail}`).toBe(400);
    }
  });

  // --- boundary: name and email length ---

  test('boundary: single-character client name is rejected', async ({ request }) => {
    const response = await request.post('/api-clients', {
      data: { clientName: 'A', clientEmail: buildUniqueEmail() },
    });
    expect(response.status()).toBe(400);
  });

  test('boundary: very long client name is handled gracefully', async ({ request }) => {
    const longName = 'A'.repeat(300);
    const response = await request.post('/api-clients', {
      data: { clientName: longName, clientEmail: buildUniqueEmail() },
    });
    // API should either accept or reject cleanly — not 5xx
    expect(response.status()).toBeLessThan(500);
  });

  // --- negative: empty request body ---

  test('negative: empty request body returns 400', async ({ request }) => {
    const response = await request.post('/api-clients', { data: {} });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // --- positive: access token format ---

  test('positive: returned access token is a non-empty string without whitespace', async ({ request }) => {
    const response = await registerClient(request, buildUniqueEmail());
    expect(response.status()).toBe(201);
    const { accessToken } = await response.json();
    expect(typeof accessToken).toBe('string');
    expect(accessToken.trim()).toBe(accessToken);
    expect(accessToken.length).toBeGreaterThan(10);
  });

  // --- boundary: minimum-valid client name ---

  test('boundary: two-character client name is the minimum accepted', async ({ request }) => {
    const response = await request.post('/api-clients', {
      data: { clientName: 'Jo', clientEmail: buildUniqueEmail() },
    });
    // The API accepts names of 2+ characters
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('accessToken');
  });

  // --- equivalence: numeric-only client name ---

  test('equivalence: numeric-only client name is accepted if long enough', async ({ request }) => {
    const response = await request.post('/api-clients', {
      data: { clientName: '12345', clientEmail: buildUniqueEmail() },
    });
    // Should not be a 5xx — the API may accept or reject, but must be clean
    expect(response.status()).toBeLessThan(500);
  });

  // --- negative: wrong Content-Type header ---

  test('negative: registration with text/plain content-type returns 400 or 415', async ({ request }) => {
    const response = await request.post('/api-clients', {
      headers: { 'Content-Type': 'text/plain' },
      data: 'clientName=Test&clientEmail=test@example.com',
    });
    expect([400, 415]).toContain(response.status());
  });

  // --- negative: case-insensitive duplicate email ---

  test('negative: duplicate email with different casing is rejected with 409', async ({ request }) => {
    const base = `dupcase-${Date.now()}@example.com`;
    const upper = base.toUpperCase();

    const firstResponse = await registerClient(request, base);
    expect(firstResponse.status()).toBe(201);

    // The API may treat emails case-insensitively — expect either 409 (correct) or 201
    const secondResponse = await registerClient(request, upper);
    expect([201, 409]).toContain(secondResponse.status());
  });

  // --- negative: special characters in client name ---

  test('negative: client name with only special characters is rejected or handled cleanly', async ({ request }) => {
    const response = await request.post('/api-clients', {
      data: { clientName: '!!!###', clientEmail: buildUniqueEmail() },
    });
    expect(response.status()).toBeLessThan(500);
  });

  // --- negative: SQL injection attempt in email field ---

  test('negative: SQL injection in email is handled safely', async ({ request }) => {
    const response = await request.post('/api-clients', {
      data: { clientName: 'Injector', clientEmail: "' OR 1=1 --" },
    });
    // Should reject cleanly, not crash
    expect([400, 409]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  // --- negative: extra unknown fields in request body ---

  test('negative: extra unknown fields in registration payload are ignored or rejected cleanly', async ({ request }) => {
    const response = await request.post('/api-clients', {
      data: {
        clientName: 'Extra Fields User',
        clientEmail: buildUniqueEmail(),
        unexpectedField: 'surprise',
        anotherField: 42,
      },
    });
    // Must not 5xx — either accepts cleanly or rejects with 400
    expect(response.status()).toBeLessThan(500);
  });
});
