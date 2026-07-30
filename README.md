# Simple Books API Automation Tests

This project contains Playwright-based API automation tests for the Simple Books API. The suite covers health checks, book retrieval, client registration, authorization, and order lifecycle flows.

## Features

- Smoke tests for the API health endpoint
- Book listing, filtering, and detail validation
- Client registration validation and duplicate handling
- Order creation, update, and deletion flows
- Authorization checks for protected endpoints

## Tech Stack

- Node.js
- Playwright Test
- dotenv

## Project Structure

- [package.json](package.json) – project dependencies and scripts
- [playwright.config.ts](playwright.config.ts) – Playwright configuration and base URL setup
- [tests/example.spec.ts](tests/example.spec.ts) – main API test suite
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
   npx playwright test
   ```

## Useful Commands

Run only the main spec:

```bash
npx playwright test tests/example.spec.ts
```

Run tests with a readable terminal reporter:

```bash
npx playwright test --reporter=line
```

Show the HTML report:

```bash
npx playwright show-report
```

## Notes

- The test suite uses the live API base URL from [.env](.env).
- Sensitive values should remain local and should not be committed to source control.
- The HTML report is generated in the [playwright-report](playwright-report) folder.

## License

This project is licensed under ISC.
