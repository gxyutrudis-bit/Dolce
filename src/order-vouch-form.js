const PRODUCTS = new Set(['DEKOR', 'BOBUX', 'SVBOWCH', 'PREMS', 'NAYTRO', 'GCRED1TS']);

function parseOrderVouchForm(form) {
  const product = form.product.trim().toUpperCase();
  const quantity = form.quantity.trim();
  const feedback = form.feedback.trim();

  if (!PRODUCTS.has(product)) {
    return { error: 'PRODUCT must be DEKOR, BOBUX, SVBOWCH, PREMS, NAYTRO, or GCRED1TS.' };
  }
  if (!/^\d{1,4}$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 9999) {
    return { error: 'QUANTITY must be a whole number from 1 to 9999.' };
  }
  if (!feedback) {
    return { error: 'FEEDBACK cannot be blank.' };
  }

  return {
    value: {
      product,
      quantity: String(Number(quantity)),
      feedback,
    },
  };
}

module.exports = { parseOrderVouchForm };
