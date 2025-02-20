// Required modules for functionality
const { client } = require('./shop_creds');
const fs = require('fs');
const path = require('path');
const logFilePath = path.join(__dirname, 'shopifyProductUpdateLog.txt');

const shopifyProductURI = 'gid://shopify/Product/';
const shopifyMetaobjectURI = 'gid://shopify/Metaobject/';

// Shopify Product IDs of listed products
// This is a variable that needs manual updates for now.
const shopifyProductIDs = {
/* a private collection of product IDs */
}

// Helper debugging function
function debug(data, errors) {
  console.log('Response Data:', data);
  console.log('Response Errors:', errors);

  if (errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(errors)}`);
  }
}

// Helper parser
function shopifyIdNumberOnly(idString) {

  // Use a regular expression to extract the number
  const match = idString.match(/(\d+)$/);

  // Return the result (second item in the regex result; first in group)
  const idNumberOnly = match[1];
  
  return idNumberOnly;
}

// Helper function to log messages to a file
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error("Failed to write to log file", err);
    }
  });
}

// Helper function to convert the requested metafields/metaobjects to string.
async function stringifyNewDescription(productObject) {

  console.log("object is: " + productObject);

  const metafieldsText = [];

  if (productObject && productObject["productDesc"] && productObject["productDesc"].jsonValue.children[0].children[0].value) {
    metafieldsText.push(productObject["productDesc"].jsonValue.children[0].children[0].value);
  } else {
    logToFile(`Product description for ${productObject.title} is blank!`);
  }

  if (productObject["howToTake"] && productObject["howToTake"].jsonValue) {
    metafieldsText.push(`<b>How to Take ${productObject.title}</b>`);
    metafieldsText.push(productObject["howToTake"].jsonValue);
  } else {
    logToFile(`How to Take section for ${productObject.title} is blank!`);
  }

  /*
  ** USE THIS INSTEAD OF ABOVE IF WE USE "how_to_take" for $keyHTT
  metafieldsText.push(`How to take ${productObject.title}`)
  metafieldsText.push(
    productObject["howToTake"].
    jsonValue.children[0].children[0].value
    );
  */

  if (productObject["keyIngredients"] && Array.isArray(productObject["keyIngredients"].jsonValue)) {
      metafieldsText.push(`<b>Key Ingredients</b>`)
      for (const ingredient of productObject["keyIngredients"].jsonValue) {
          const metaobjectIdNumberOnly = shopifyIdNumberOnly(ingredient);
          const ingredientObject = await queryMetaobject(metaobjectIdNumberOnly);
          metafieldsText.push(ingredientObject.displayName);
      }
  } else {
      logToFile(`Key ingredients section for ${productObject.title} is blank!`);
  }

  // Join with one line of whitespace between sections
    return metafieldsText.join('<br /><br />');
}

// Get shop information
async function queryShopDetails() {
    const operation = `
      query getShopDetails {
        shop {
          name
          primaryDomain{
            host
            url
          }
        }
      }
    `;

    const {data, errors, extensions} = await client.request(operation);

    return data.shop;
}

// Get list of all products
// Max amount of products is 250, but can exceed more using pagination
// (Currently working on pagination feature. 
// BulkOperation is also an alternative.)
async function queryProductList(numberOfProducts = 250) {
    const operation = `
      query ProductList {
        products(first: ${numberOfProducts}) {
          nodes {
            id
            title
          }
        }
      }
    `;

    const {data, errors, extensions} = await client.request(operation);

    debug(data, errors);

    return data;
}

// Get individual product's basic information
// Including description in HTML
// Custom query functionality is on the way.
async function queryProduct(productId) {

    const operation = `
      query Product($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          description
        }
      }
    `;

    const {data, errors, extensions} = await client.request(operation, {
      variables: {
        id: `gid://shopify/Product/${productId}`,
      },
    });

    return data.product
}

async function queryMetaobject(metaobjectId) {

    const operation = `
      query Metaobject($id: ID!) {
        metaobject(id: $id) {
          id
          displayName
        }      
      }
    `;

    const {data, errors, extensions} = await client.request(operation, {
      variables: {
        id: `gid://shopify/Metaobject/${metaobjectId}`,
      },
    });

    return data.metaobject;
}

// Get a product's new description based on last three product metafields
async function queryProductNewDescription(productId) {
  const operation = `
    query ProductNewDescription($id: ID!, $namespace: String!, $keyPDesc: String!, $keyHTT: String!, $keyIngr: String!) {
      product(id: $id) {
        id
        title
        productDesc: metafield(namespace: $namespace, key: $keyPDesc) {
          jsonValue
        }
        howToTake: metafield(namespace: $namespace, key: $keyHTT) {
          jsonValue
        }
        keyIngredients: metafield(namespace: $namespace, key: $keyIngr) {
          jsonValue
        }
      }
    }
  `;

  const {data, errors, extensions} = await client.request(operation, {
    variables: {
      id: `gid://shopify/Product/${productId}`,
      namespace: "custom",
      keyPDesc: "product_description",
      keyHTT: "how_to_take_subheading",
      keyIngr: "key_ingredients_object"
    },
  });

  return data.product;
}

// Change a product's description using 
// the new description stored in the metafields
async function mutateProductNewDescription(productId) {

  // New description of product
  const newDescriptionInObject = await queryProductNewDescription(productId);
  const newDesc = await stringifyNewDescription(newDescriptionInObject);

  // Mutation operation to push description in Html
  const operation = `
      mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }
    `

  const {data, errors, extensions} = await client.request(operation, {
    variables: {
      input: {
        id: `gid://shopify/Product/${productId}`,
        descriptionHtml: `${newDesc}`
      }
    },
  });

  console.log("logging data w: " + data.productUpdate.product.title);

  // return data;

}

// Writes a product's description in plain-text and HTML
// to a file called "foo.txt"
async function writeProductDescriptionToFile(productId, fileName) {
    try {
        const product = await queryProduct(productId); // Await the product info directly
        fs.appendFileSync(fileName, `${product.title}\n\nProduct Description:\n${product.description}\n\n`);
        fs.appendFileSync(fileName, `${product.title}\n\nProduct Description in HTML:\n${product.descriptionHtml}\n\n\n`);
    } catch (error) {
        console.error("Error writing product description to file:", error);
    }
}

module.exports = { 
  shopifyProductIDs,
  mutateProductNewDescription,
  queryProduct,
  queryProductList,
  queryShopDetails,
  queryProductNewDescription,
  queryMetaobject,
  writeProductDescriptionToFile
  // queryProductDescription
};
