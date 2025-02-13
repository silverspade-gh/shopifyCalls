import {createAdminApiClient} from '@shopify/admin-api-client';

const client = createAdminApiClient({
  storeDomain: 'shop-storename.myshopify.com',
  apiVersion: '2025-01',
  accessToken: 'private-eyes-only',
});

module.exports = { client };
