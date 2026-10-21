const assert = require('node:assert/strict');
const test = require('node:test');
const { parseOrderVouchForm } = require('../src/order-vouch-form');

test('order vouch form accepts the supported products and quantities', () => {
  assert.deepEqual(parseOrderVouchForm({
    product: ' bobux ',
    quantity: '0007',
    feedback: ' Great service! ',
  }), {
    value: {
      product: 'BOBUX',
      quantity: '7',
      feedback: 'Great service!',
    },
  });
  assert.deepEqual(parseOrderVouchForm({
    product: 'DEKOR',
    quantity: '9999',
    feedback: 'Good',
  }), {
    value: { product: 'DEKOR', quantity: '9999', feedback: 'Good' },
  });
  assert.deepEqual(parseOrderVouchForm({
    product: 'SVBOWCH',
    quantity: '1',
    feedback: 'Good',
  }), {
    value: { product: 'SVBOWCH', quantity: '1', feedback: 'Good' },
  });
  assert.deepEqual(parseOrderVouchForm({
    product: 'PREMS',
    quantity: '2',
    feedback: 'Nice',
  }), {
    value: { product: 'PREMS', quantity: '2', feedback: 'Nice' },
  });
  for (const product of ['NAYTRO', 'GCRED1TS']) {
    assert.deepEqual(parseOrderVouchForm({
      product: product.toLowerCase(),
      quantity: '1',
      feedback: 'Good',
    }), {
      value: { product, quantity: '1', feedback: 'Good' },
    });
  }
});

test('order vouch form rejects unsupported products, invalid quantities, and blank feedback', () => {
  assert.deepEqual(parseOrderVouchForm({
    product: 'OTHER',
    quantity: '1',
    feedback: 'Good',
  }), { error: 'PRODUCT must be DEKOR, BOBUX, SVBOWCH, PREMS, NAYTRO, or GCRED1TS.' });
  assert.deepEqual(parseOrderVouchForm({
    product: 'PREMS',
    quantity: '10000',
    feedback: 'Good',
  }), { error: 'QUANTITY must be a whole number from 1 to 9999.' });
  assert.deepEqual(parseOrderVouchForm({
    product: 'PREMS',
    quantity: '1.5',
    feedback: 'Good',
  }), { error: 'QUANTITY must be a whole number from 1 to 9999.' });
  assert.deepEqual(parseOrderVouchForm({
    product: 'PREMS',
    quantity: '1',
    feedback: '  ',
  }), { error: 'FEEDBACK cannot be blank.' });
});
