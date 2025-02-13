// shop_creds.js

const { createAdminRestApiClient } = 
  require('@shopify/admin-api-client');

const client = createAdminRestApiClient({
  storeDomain: 'shop-mystore.myshopify.com',
  apiVersion: '2025-01',
  accessToken: 'private',
});

module.exports = { client };
