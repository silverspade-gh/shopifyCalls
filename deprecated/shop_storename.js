const { client } = require('./shop_creds');

// Get product listing
async function queryProductList() {
  const response = await client.get('products.json');

  if (response.ok) {
    const body = await response.json();
    console.log(body);
  } else {
    console.error('Error fetching product:', response.statusText);
  }
}

// Get individual product
async function queryProduct(productId) {
  const response = await client.get(`products/${productId}`);

  if (response.ok) {
    const body = await response.json();
    console.log(body);
  } else {
    console.error('Error fetching product:', response.statusText);
  }
}

// Get individual product
async function queryProductDescription(productId) {
  const response = await client.get(`products/${productId}`);

  if (response.ok) {
    const body = await response.json();
    console.log(body);
  } else {
    console.error('Error fetching product:', response.statusText);
  }
}


module.exports = { 
    queryProduct,
    queryProductList
};
