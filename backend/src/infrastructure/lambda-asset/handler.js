/**
 * Placeholder Lambda handler for QuickBooks API.
 * Replace with NestJS + serverless-express bundle (npm run bundle) for full deployment.
 *
 * Strips API Gateway stage prefix from path and returns 200 for health, 501 for other routes.
 */
exports.handler = async (event) => {
  let path = event.path || event.rawPath || '/';
  // Strip stage prefix (dev, staging, prod)
  path = path.replace(/^\/(dev|staging|prod)/, '') || '/';

  const isHealth = path === '/api/v1/health' || path === '/health' || path.endsWith('/health');

  return {
    statusCode: isHealth ? 200 : 501,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(
      isHealth
        ? { status: 'ok', service: 'quickbooks-west-africa' }
        : { error: 'Not implemented', message: 'Run npm run bundle and deploy NestJS Lambda' }
    ),
  };
};
