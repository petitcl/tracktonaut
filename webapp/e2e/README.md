# E2E Tests with Playwright

This directory contains end-to-end tests for the Tracktonaut application.

## Setup

1. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

2. Make sure your environment variables are set in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

## Running Tests

### Unauthenticated Tests
Tests that check authentication flows and redirects can run without setup:

```bash
npm run test:e2e
```

### Authenticated Tests

Most tests require an authenticated session. To set this up:

1. Generate an authenticated state file:
   ```bash
   npx playwright codegen http://localhost:3000 --save-storage=auth.json
   ```

2. Sign in with Google in the browser that opens

3. Close the browser when done - this saves the auth state to `auth.json`

4. Update `playwright.config.ts` to use the saved state:
   ```typescript
   use: {
     storageState: 'auth.json',
     // ... other config
   }
   ```

5. Remove `.skip` from tests in `navigation.spec.ts` and `user-flow.spec.ts`

6. Run the tests:
   ```bash
   npm run test:e2e
   ```

## Test Structure

- `auth.spec.ts` - Authentication and redirect tests (no auth required)
- `navigation.spec.ts` - Navigation between pages (requires auth)
- `user-flow.spec.ts` - Complete user journeys (requires auth)

## Debugging Tests

Run tests in UI mode to see what's happening:

```bash
npm run test:e2e:ui
```

Run tests in headed mode (see the browser):

```bash
npx playwright test --headed
```

Run a specific test file:

```bash
npx playwright test e2e/auth.spec.ts
```

## CI/CD Integration

For CI/CD pipelines, you'll need to:

1. Use a test user with known credentials
2. Implement programmatic login (not OAuth)
3. Or use Supabase's test helpers to create authenticated sessions

Example approach:
- Create a test-only API route that generates a session token
- Use this in `beforeAll()` to authenticate the test user
- Only enable this route in test environments

## Notes

- Tests marked with `.skip` require authentication setup
- OAuth testing is complex - consider mocking or using a test auth provider
- Some tests use `waitForTimeout()` which is not ideal - replace with proper waiters
- Add data-testid attributes to components for more reliable selectors
