# End-to-End Tests for BoatWatcher Dashboard

This directory contains end-to-end tests for the BoatWatcher Dashboard application. These tests verify that the entire system works correctly from the user's perspective, ensuring a smooth experience across different scenarios and edge cases.

## Test Files

### User Workflows (`user-workflows.test.tsx`)

Tests comprehensive user workflows including:
- User registration and onboarding
- Project creation and management
- Dashboard navigation and interaction
- Report generation and export
- User settings and preferences

### Frontend Integration (`frontend-integration.test.tsx`)

Tests frontend integration with live data including:
- Component rendering with live data
- Loading states and spinners
- Error messages and toasts
- User interactions
- Data updates and refresh

### Fallback Mechanism (`fallback-mechanism.test.tsx`)

Tests the fallback mechanism between Python service and Supabase including:
- Automatic failover to Supabase when Python service is unavailable
- User experience during failover
- Recovery after service restoration
- Data consistency during failover

## Running Tests

To run the end-to-end tests:

```bash
npm test -- --testPathPattern=src/test/e2e
```

To run a specific test file:

```bash
npm test -- --testPathPattern=src/test/e2e/user-workflows.test.tsx
```

## Test Status

All end-to-end tests have been implemented according to the test plan. The implementation status has been updated in the main test plan document (`src/integrations/python-service/test-plan.md`).

## Future Improvements

- Add more edge case scenarios
- Implement visual regression testing
- Add performance benchmarks for critical user workflows