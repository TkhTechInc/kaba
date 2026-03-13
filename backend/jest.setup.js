/**
 * Jest setup. PaymentsClient requires PAYMENTS_SERVICE_URL at construction.
 * Unit tests typically mock PaymentsClient, but integration tests may load the real module.
 * Loads .env so INTEGRATION_TEST_EMAIL, INTEGRATION_TEST_PASSWORD, etc. are available.
 */
require('dotenv').config();

if (!process.env.PAYMENTS_SERVICE_URL) {
  process.env.PAYMENTS_SERVICE_URL = 'http://localhost:9999';
}
