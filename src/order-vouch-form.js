const PRODUCTS = new Set(['DEKOR', 'BOBUX', 'SVBOWCH', 'PREMS', 'NAYTRO', 'GCRED1TS']);

function parseOrderVouchForm(form) {
  const product = form.product.trim().toUpperCase();
  const quantity = form.quantity.trim();
  const feedback = form.feedback.trim();

  if (!PRODUCTS.has(product)) {
    return { error: 'PRODUCT must be DEKOR, BOBUX, SVBOWCH, PREMS, NAYTRO, or GCRED1TS.' };
  }
  if (!/^\d+$/.test(quantity) || Number(quantity) < 1) {
    return { error: 'QUANTITY must be a positive whole number.' };
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
