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
  sevenDayStarterKit: 8048084451587,
  sevenDayStarterKitCustom: 8548174659843,
  allInOneKit: 8001062732035,
  allInOneKitCustom: 8438050717955,
  aloeHydrationKit: 8114636980483,
  aloeHydrationKitCustom: 8626870714627,
  aloeVeraDrinkMix: 7601000612099,
  appetiteSuppressant: 7601000677635,
  bodyToner2x1: 8181958279427,
  carbBlocker: 7633926193411,
  collagen: 7601000743171,
  colonCleanser: 7601000775939,
  detoxPlusKit: 7979354128643,
  detoxPlusKitCustom: 8548397809923,
  drinkBoosterGreens: 7647125995779,
  easyDigestion2x1: 8121877823747,
  fatBurner2x1: 7954778489091,
  foodLoverKit: 7983185035523,
  foodLoverKitCustom: 8548406329603,
  happyJoints2x1: 8145415012611,
  heartBand: 7601001103619,
  heartBandCard: 7601001136387,
  laxativeTea: 8358596378883,
  liverSuperCleanse2x1: 8239179727107,
  mealReplacement15: 7601000841475,
  menoPause2x1: 8349587144963,
  motivationalWaterBottle: 8001513226499,
  multiVitamin: 7601001332995,
  naturalDetox: 7601001070851,
  proteinBars: 7611445444867,
  proteinBrownies: 8154863993091,
  pureFiber: 8248682873091,
  shakeBoosterCelluFit: 7601001595139,
  shakeBoosterHighEnergy: 7601001627907,
  shakeBoosterPureFiber: 7601001660675,
  shakerBottle: 7601001693443,
  sleepBurn2x1: 8062251696387,
  slimDown: 7601001726211,
  transformationKit: 7983124316419,
  transformationKitCustom: 8548149559555,
  transformationSupplementKit: 7601001791747,
  waterLipoKit: 8529942708483,
  waterLipo: 7960617419011,
  waterLipoSpecial: 8111114256643,
  waterLipoTea: 8154872086787,
  wheyProtein30: 7601000972547
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

async function queryApp(appId) {
  const operation = `
    query App($id: ID!) {
      app(id: $id) {
        title
      }
    }
  `;

  const {data, errors, extensions} = await client.request(operation, {
    variables: {
      id: `gid://shopify/Product/${productId}`,
    },
  });

  return data.app
}

// Needs pagination
async function queryAppList(numberOfApps = 250) {
  const operation = `
    query AppList {
      appInstallations(first: ${numberOfApps}) {
        nodes {
          app {
            id
            title
          }
        }
      }
    }
  `;

  const {data, errors, extensions} = await client.request(operation);

  debug(data, errors);

  return data.appInstallations.nodes;
}

// Needs pagination
async function queryAppSalesChannels(numberOfChannels = 250) {
  const operation = `
    query AppSalesChannels {
      publications(first: ${numberOfChannels}) {
        nodes {
          app {
            id
            title
          }
        }
      }
    }
  `;

  const {data, errors, extensions} = await client.request(operation);

  debug(data, errors);

  return data.publications;
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
  queryApp,
  queryAppList,
  queryAppSalesChannels,
  writeProductDescriptionToFile
  // queryProductDescription
};
