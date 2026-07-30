# Simple Books API Automation Tests

This project contains Playwright-based API automation tests for the Simple Books API. The suite covers health checks, book retrieval, client registration, authorization, and order lifecycle flows.

## Features

- Smoke tests for the API health endpoint
- Book listing, filtering, and detail validation
- Positive, negative, and boundary-value coverage for authentication and ordering flows
- Domain-based test structure that keeps helper code separate from test cases

## Tech Stack

- Node.js
- Playwright Test
- dotenv

## Project Structure

- [package.json](package.json) – project dependencies and scripts
- [playwright.config.ts](playwright.config.ts) – Playwright configuration and base URL setup
- [tests/api/](tests/api) – domain-based API specs for health/books, authentication, and orders
- [tests/support/](tests/support) – shared helpers used by the API tests
- [.env](.env) – local environment variables (ignored by Git)

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   Create a local [.env](.env) file with the following values:

   ```env
   BASE_URL=https://simple-books-api.click
   CLIENT_NAME=Workshop Learner
   CLIENT_EMAIL=learner@example.com
   ```

3. Run the tests:

   ```bash
   npm test
   ```

## Useful Commands

Run the API specs only:

```bash
npx playwright test tests/api
```

Run tests with a readable terminal reporter:

```bash
npx playwright test --reporter=line
```

Show the HTML report:

```bash
npx playwright show-report
```

## CI/CD notes

- The GitHub Actions workflow runs on pushes, pull requests, and manual dispatch.
- CI builds use npm dependency caching, browser installation for Chromium/Firefox/WebKit, and upload the HTML report plus test artifacts even when tests fail.
- Playwright emits GitHub-style annotations in CI so failures are easier to review directly in pull requests.

## Notes

- The test suite uses the live API base URL from [.env](.env).
- Sensitive values should remain local and should not be committed to source control.
- The HTML report is generated in the [playwright-report](playwright-report) folder.

## License

This project is licensed under ISC.
