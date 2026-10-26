const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { OrderStore, ORDER_ACTIVE_DURATION_MS, VOUCH_WINDOW_MS } = require('../src/store');
const {
  orderButtons,
  orderContainer,
  orderStatusEmbed,
  queueEmbed,
  queueConfirmationMessage,
} = require('../src/embeds');
const { orderReference } = require('../src/order-reference');
const { orderStatusLabel } = require('../src/order-status');

function createStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dolce-vita-'));
  return new OrderStore(path.join(directory, 'orders.json'));
}

test('orders persist, can be claimed in order, and leave the active queue when finished', () => {
  const store = createStore();
  store.setSettings('guild-1', { channelId: 'channel-1', staffRoleId: null });
  const first = store.addOrder({ guildId: 'guild-1', customerId: 'user-1', sourceChannelId: 'source-1', items: 'Latte', paymentMethod: 'Card', supporterId: 'staff-1', quantity: 2 });
  const second = store.addOrder({ guildId: 'guild-1', customerId: 'user-2', sourceChannelId: 'source-2', items: 'Tea', paymentMethod: 'Cash', supporterId: 'staff-2', quantity: 1 });

  const restartedStore = new OrderStore(store.filePath);
  assert.equal(restartedStore.getSettings('guild-1').channelId, 'channel-1');
  restartedStore.setSettings('guild-1', { vouchChannelId: 'vouch-channel' });
  assert.deepEqual(restartedStore.getSettings('guild-1'), {
    channelId: 'channel-1',
    staffRoleId: null,
    vouchChannelId: 'vouch-channel',
  });
  restartedStore.setSettings('guild-1', { channelId: 'orders-updated', staffRoleId: 'staff-role' });
  assert.equal(restartedStore.getSettings('guild-1').vouchChannelId, 'vouch-channel');
  restartedStore.setSettings('guild-1', { ownerRoleId: 'order-owner-role' });
  assert.equal(restartedStore.getSettings('guild-1').ownerRoleId, 'order-owner-role');
  restartedStore.setSettings('guild-1', { adminRoleId: 'order-admin-role' });
  assert.equal(restartedStore.getSettings('guild-1').adminRoleId, 'order-admin-role');
  restartedStore.setSettings('guild-1', { orderChannelId: 'orders-channel' });
  assert.equal(restartedStore.getSettings('guild-1').orderChannelId, 'orders-channel');
  assert.deepEqual(restartedStore.listActive('guild-1').map((order) => order.id), [first.id, second.id]);
  assert.equal(restartedStore.getOrder(first.id).processingStatus, 'not_yet');
  assert.equal(restartedStore.getOrder(first.id).supporterId, 'staff-1');
  assert.equal(restartedStore.getOrder(first.id).sourceChannelId, 'source-1');
  assert.equal(restartedStore.claimNext('guild-1', 'staff-1').id, first.id);
  assert.equal(restartedStore.finishOrder(first.id, 'completed').status, 'completed');
  assert.deepEqual(restartedStore.listActive('guild-1').map((order) => order.id), [second.id]);
  assert.equal(restartedStore.finishOrder(first.id, 'cancelled'), null);
  const processingOrder = restartedStore.markProcessing(second.id, 'staff-2');
  assert.equal(processingOrder.processingStatus, 'processing');
  assert.equal(processingOrder.status, 'claimed');
  assert.equal(processingOrder.processingBy, 'staff-2');
  assert.equal(restartedStore.finishOrder(second.id, 'cancelled').status, 'cancelled');
  assert.deepEqual(restartedStore.listActive('guild-1'), []);
});

test('orders remain active until 48 hours and then expire from actions and the queue', () => {
  assert.equal(ORDER_ACTIVE_DURATION_MS, 48 * 60 * 60 * 1000);
  const store = createStore();
  const order = store.addOrder({
    guildId: 'guild-1',
    customerId: 'user-1',
    sourceChannelId: 'source-1',
    items: 'Latte',
    paymentMethod: 'Card',
    supporterId: 'staff-1',
    quantity: 1,
  });
  const state = store.read();
  const createdAt = Date.now() - (48 * 60 * 60 * 1000) + 60_000;
  state.orders[0].createdAt = new Date(createdAt).toISOString();
  store.write(state);

  assert.deepEqual(store.listActive('guild-1').map((entry) => entry.id), [order.id]);
  assert.equal(store.finishOrder(order.id, 'completed').status, 'completed');

  const expiredByQueue = store.addOrder({
    guildId: 'guild-1',
    customerId: 'user-2',
    sourceChannelId: 'source-2',
    items: 'Tea',
    paymentMethod: 'Cash',
    supporterId: 'staff-2',
    quantity: 1,
  });
  const expiredByQueueState = store.read();
  expiredByQueueState.orders.find((entry) => entry.id === expiredByQueue.id).createdAt =
    new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  store.write(expiredByQueueState);

  assert.deepEqual(store.listActive('guild-1'), []);
  const expired = store.getOrder(expiredByQueue.id);
  assert.equal(expired.status, 'expired');
  assert.equal(
    Date.parse(expired.expiredAt),
    Date.parse(expired.createdAt) + 48 * 60 * 60 * 1000,
  );
  assert.ok(orderButtons(expired).toJSON().components.every((button) => button.disabled));

  const expiredBeforeProcessing = store.addOrder({
    guildId: 'guild-1',
    customerId: 'user-3',
    sourceChannelId: 'source-3',
    items: 'Cake',
    paymentMethod: 'Cash',
    supporterId: 'staff-3',
    quantity: 1,
  });
  const processingState = store.read();
  processingState.orders.find((entry) => entry.id === expiredBeforeProcessing.id).createdAt =
    new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  store.write(processingState);
  assert.equal(store.markProcessing(expiredBeforeProcessing.id, 'staff-3'), null);
  assert.equal(store.getOrder(expiredBeforeProcessing.id).status, 'expired');

  const expiredBeforeClaim = store.addOrder({
    guildId: 'guild-1',
    customerId: 'user-4',
    sourceChannelId: 'source-4',
    items: 'Coffee',
    paymentMethod: 'Cash',
    supporterId: 'staff-4',
    quantity: 1,
  });
  const claimState = store.read();
  claimState.orders.find((entry) => entry.id === expiredBeforeClaim.id).createdAt =
    new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  store.write(claimState);
  assert.equal(store.claimNext('guild-1', 'staff-4'), null);
  assert.equal(store.getOrder(expiredBeforeClaim.id).status, 'expired');
});

test('claim returns null when there are no pending orders', () => {
  const store = createStore();
  assert.equal(store.claimNext('guild-1', 'staff-1'), null);
});

test('latest order lookup is scoped to its guild, source channel, and optional ticket owner', () => {
  const store = createStore();
  const first = store.addOrder({
    guildId: 'guild-1', customerId: 'buyer-1', sourceChannelId: 'ticket-1',
    items: 'DEKOR', paymentMethod: 'GCash', supporterId: 'supporter-1', preparedById: 'staff-1', quantity: 1,
  });
  const second = store.addOrder({
    guildId: 'guild-1', customerId: 'buyer-1', sourceChannelId: 'ticket-1',
    items: 'BOBUX', paymentMethod: 'GCash', supporterId: 'supporter-1', preparedById: 'staff-2', quantity: 2,
  });
  const otherBuyer = store.addOrder({
    guildId: 'guild-1', customerId: 'buyer-2', sourceChannelId: 'ticket-1',
    items: 'PREMS', paymentMethod: 'GCash', supporterId: 'supporter-1', preparedById: 'staff-2', quantity: 1,
  });

  assert.equal(store.getLatestOrderForSource('guild-1', 'ticket-1').id, otherBuyer.id);
  assert.equal(store.getLatestOrderForSource('guild-1', 'ticket-1', 'buyer-1').id, second.id);
  assert.equal(store.getLatestOrderForSource('guild-1', 'ticket-1', 'buyer-2').id, otherBuyer.id);
  assert.equal(store.getLatestOrderForSource('guild-1', 'ticket-1', 'buyer-3'), null);
  assert.equal(store.getLatestOrderForSource('guild-2', 'ticket-1'), null);
  assert.equal(store.getLatestOrderForSource('guild-1', 'ticket-2'), null);
});

test('queue confirmation uses the new layout and includes ticket, owner, order, status, and supporter', () => {
  const message = queueConfirmationMessage({
    ticketProduct: 'DEKOR',
    sourceChannelId: 'ticket-1',
    customerId: 'buyer-1',
    customerUsername: 'alice',
    items: 'DEKOR',
    quantity: 2,
    paymentMethod: 'GCash',
    supporterId: 'staff-1',
    status: 'pending',
    processingStatus: 'not_yet',
  });

  assert.equal(message, [
    '_ _',
    '_ _       ──────────  <:0cpink_bow:1562803659190829126>  ──────────',
    '_ _              ꒰  <:00_treat:1562793410157613156>  ꒱   **order**  __queue__   !!',
    '_ _                 ⚬  @alice',
    '_ _                 ⚬  <#ticket-1>  :  <@buyer-1>',
    '_ _                 ⚬  DEKOR．2',
    '_ _                 ⚬  paid via __GCash__',
    '_ _                 ⚬  status   :   __Noted__',
    '_ _         served by <@staff-1> <a:sweet_nom:1561070811773935797>',
    '_ _       ──────────  <a:pinkletter:1562804355856597092>  ──────────',
    '_ _',
  ].join('\n'));
});

test('queue list shows its title, count, ticket source, quantity, /order author, and buyer', () => {
  const embed = queueEmbed([{
    id: 'ORDER-1',
    status: 'pending',
    ticketProduct: 'DEKOR',
    items: 'DEKOR',
    quantity: 3,
    customerId: 'buyer-1',
    preparedById: 'staff-1',
    sourceChannelId: 'ticket-1',
  }]).toJSON();

  assert.equal(embed.title, 'Dolce Vita Order Queue');
  assert.equal(embed.description, '1 active order');
  assert.match(embed.fields[0].name, /^#DEKOR - Waiting <#ticket-1>$/);
  assert.match(embed.fields[0].value, /^DEKOR - quantity: 3/);
  assert.match(embed.fields[0].value, /prepared by: <@staff-1>/);
  assert.match(embed.fields[0].value, /Buyer: <@buyer-1>/);
});

test('ticket product is displayed as the order reference while buttons retain the UUID', () => {
  assert.equal(orderReference({ id: 'ORDER-LEGACY' }), 'ORDER-LEGACY');
  const store = createStore();
  const order = store.addOrder({
    guildId: 'guild-1',
    customerId: 'user-1',
    sourceChannelId: 'source-1',
    items: 'GAMECREDITS',
    paymentMethod: 'GCASH',
    supporterId: 'staff-1',
    quantity: 1,
    ticketProduct: 'GAMECREDITS',
  });

  assert.equal(orderReference(store.getOrder(order.id)), 'GAMECREDITS');
  assert.deepEqual(
    orderButtons(order).toJSON().components.map((button) => [button.custom_id, button.label]),
    [
      [`order:processing:${order.id}`, 'processing'],
      [`order:complete:${order.id}`, 'complete'],
      [`order:cancel:${order.id}`, 'cancelled'],
    ],
  );
  assert.match(queueEmbed([order]).toJSON().fields[0].name, /#GAMECREDITS/);
});

test('completed and cancelled statuses override processing in the order container', () => {
  const order = {
    id: 'ORDER-1',
    status: 'completed',
    processingStatus: 'processing',
    items: 'Coffee',
    quantity: 1,
    customerId: 'customer-1',
    paymentMethod: 'Cash',
    supporterId: 'staff-1',
    sourceChannelId: 'source-1',
    createdAt: new Date().toISOString(),
  };

  const completedContainer = orderContainer(order).toJSON();
  assert.match(completedContainer.components[0].content, /status   :   __Complete__/);
  const cancelledContainer = orderContainer({ ...order, status: 'cancelled' }).toJSON();
  assert.match(cancelledContainer.components[0].content, /status   :   __Cancelled__/);
});

test('source-channel status labels reflect processing, complete, and cancelled transitions', () => {
  assert.equal(orderStatusLabel({ status: 'claimed', processingStatus: 'processing' }), 'Processing');
  assert.equal(orderStatusLabel({ status: 'completed', processingStatus: 'processing' }), 'Complete');
  assert.equal(orderStatusLabel({ status: 'cancelled', processingStatus: 'not_yet' }), 'Cancelled');
  assert.equal(orderStatusLabel({ status: 'expired', processingStatus: 'not_yet' }), 'Expired');
});

test('order status notification embed includes the order status and details', () => {
  const embed = orderStatusEmbed({
    id: 'ORDER-3',
    ticketProduct: 'DEKOR',
    status: 'completed',
    processingStatus: 'processing',
    items: 'Coffee',
    quantity: 2,
    paymentMethod: 'Card',
    sourceChannelId: 'source-1',
  }).toJSON();

  assert.equal(embed.title, 'Order Status Update');
  assert.match(embed.description, /#DEKOR.*Complete/);
  assert.deepEqual(
    embed.fields.map(({ name, value }) => [name, value]),
    [
      ['Items', 'Coffee'],
      ['Quantity', '2'],
      ['Payment method', 'Card'],
      ['Submitted in', '<#source-1>'],
    ],
  );
});

test('new order container uses the requested order-list layout and displays the ticket owner, quantity, and supporter', () => {
  const container = orderContainer({
    id: 'ORDER-2',
    ticketProduct: 'DEKOR',
    status: 'pending',
    processingStatus: 'not_yet',
    items: 'Coffee',
    quantity: 1,
    customerId: 'customer-1',
    customerUsername: 'alex',
    paymentMethod: 'Cash',
    supporterId: 'staff-1',
    sourceChannelId: 'source-1',
    createdAt: new Date().toISOString(),
  }).toJSON();

  assert.equal(container.type, 17);
  assert.equal(container.accent_color, undefined);
  assert.deepEqual(container.components.map(({ type }) => type), [10, 1]);
  assert.equal(container.components[0].content, [
    '_ _',
    '_ _       ──────────  <:0cpink_bow:1562803659190829126>  ──────────',
    '_ _              ꒰  <:00_treat:1562793410157613156>  ꒱   **order**  __queue__   !!',
    '_ _                 ⚬  @alex',
    '_ _                 ⚬  <#source-1> : <@customer-1>',
    '_ _                 ⚬  Coffee．1',
    '_ _                 ⚬  paid via __Cash__',
    '_ _                 ⚬  status   :   __Noted__',
    '_ _         served by <@staff-1> <a:sweet_nom:1561070811773935797>',
    '_ _       ──────────  <a:pinkletter:1562804355856597092>  ──────────',
    '_ _',
  ].join('\n'));

  const missingSupporter = orderContainer({
    id: 'ORDER-3',
    status: 'pending',
    processingStatus: 'not_yet',
    items: 'Tea',
    quantity: 2,
    paymentMethod: 'GCASH',
    sourceChannelId: 'source-2',
  }).toJSON();
  assert.match(missingSupporter.components[0].content, /<#source-2> : Unknown buyer/);
  assert.match(missingSupporter.components[0].content, /Tea．2/);
  assert.match(missingSupporter.components[0].content, /served by Not assigned/);
});

test('order container includes item quantity and status styling', () => {
  const container = orderContainer({
    id: 'ORDER-9',
    status: 'pending',
    processingStatus: 'processing',
    items: 'Coffee',
    quantity: 7,
    customerId: 'customer-1',
    paymentMethod: 'Cash',
    supporterId: 'staff-1',
    sourceChannelId: 'source-1',
  }).toJSON();

  assert.match(container.components[0].content, /<#source-1> : <@customer-1>/);
  assert.match(container.components[0].content, /Coffee．7/);
  assert.match(container.components[0].content, /status   :   __Processing__/);
  assert.match(container.components[0].content, /served by <@staff-1>/);
});

test('vouch embed omits warranty text and shows the date in Philippine time', () => {
  const date = new Date('2024-01-01T00:00:00Z');
  const embed = require('../src/embeds').vouchEmbed({ id: 'user-1' }, 'Coffee', 'Great service', date).toJSON();

  const expectedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date);
  const expectedTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
    timeZoneName: 'short',
  }).format(date);
  assert.ok(embed.description.includes(`date vouched  :  ${expectedDate}`));
  assert.ok(embed.description.includes(`time vouched  :  ${expectedTime}`));
  assert.match(embed.description, /buyer  :  <@user-1>/);
  assert.match(embed.description, /item  :  Coffee/);
  assert.match(embed.description, /feedback  :  Great service/);
  assert.match(embed.description, /proof  :  see the attached image\./);
});

test('vouch item details retain an order-ticket quantity', () => {
  const embed = require('../src/embeds').vouchEmbed(
    { id: 'user-1' },
    'SVBOOST (x7)',
    'Great service',
    new Date('2026-10-07T00:00:00Z'),
  ).toJSON();

  assert.match(embed.description, /item  :  SVBOOST \(x7\)/);
});

test('vouches persist and are counted only for the requested user and server', () => {
  const store = createStore();
  store.addVouch({ guildId: 'guild-1', userId: 'user-1', items: 'Latte' });
  store.addVouch({ guildId: 'guild-1', userId: 'user-1', items: 'Tea' });
  store.addVouch({ guildId: 'guild-1', userId: 'user-2', items: 'Cake' });
  store.addVouch({ guildId: 'guild-2', userId: 'user-1', items: 'Coffee' });

  const restartedStore = new OrderStore(store.filePath);
  const vouches = restartedStore.listVouches('guild-1', 'user-1');
  assert.equal(vouches.length, 2);
  assert.deepEqual(vouches.map((vouch) => vouch.items).sort(), ['Latte', 'Tea']);
});

test('only one vouch can be recorded for each ticket', () => {
  const store = createStore();
  const firstVouch = store.addVouch({
    guildId: 'guild-1',
    userId: 'buyer-1',
    items: 'BOBUX',
    ticketChannelId: 'ticket-1',
  });

  assert.ok(firstVouch);
  assert.equal(store.hasVouchForTicket('guild-1', 'ticket-1'), true);
  assert.equal(store.hasVouchForTicket('guild-2', 'ticket-1'), false);
  assert.equal(store.addVouch({
    guildId: 'guild-1',
    userId: 'buyer-1',
    items: 'PREMS',
    ticketChannelId: 'ticket-1',
  }), null);
  assert.ok(store.addVouch({
    guildId: 'guild-1',
    userId: 'buyer-1',
    items: 'PREMS',
    ticketChannelId: 'ticket-2',
  }));
});

test('vouch validity is limited to the completed order 12-hour window', () => {
  const store = createStore();
  const finishedAt = new Date('2026-10-08T00:00:00.000Z');
  const order = store.addOrder({
    guildId: 'guild-1',
    customerId: 'buyer-1',
    sourceChannelId: 'source-1',
    items: 'DEKOR',
    paymentMethod: 'GCash',
    supporterId: 'staff-1',
    quantity: 1,
  });
  const state = store.read();
  Object.assign(state.orders.find((entry) => entry.id === order.id), {
    status: 'completed',
    finishedAt: finishedAt.toISOString(),
  });
  state.vouches = [
    { guildId: 'guild-1', userId: 'buyer-1', createdAt: new Date(finishedAt.getTime() + VOUCH_WINDOW_MS).toISOString() },
    { guildId: 'guild-1', userId: 'buyer-1', createdAt: new Date(finishedAt.getTime() + VOUCH_WINDOW_MS + 1).toISOString() },
  ];
  store.write(state);

  assert.equal(store.hasVouchWithinWindow(
    'guild-1', 'buyer-1', finishedAt, new Date(finishedAt.getTime() + VOUCH_WINDOW_MS),
  ), true);
  assert.deepEqual(
    store.listCompletedWithinVouchWindow('guild-1', 'buyer-1', new Date(finishedAt.getTime() + VOUCH_WINDOW_MS + 1)),
    [],
  );
});

test('completed orders can be marked voided once with the automatic-close reason', () => {
  const store = createStore();
  const order = store.addOrder({
    guildId: 'guild-1',
    customerId: 'buyer-1',
    sourceChannelId: 'ticket-1',
    items: 'DEKOR',
    paymentMethod: 'GCash',
    supporterId: 'staff-1',
    quantity: 1,
  });
  store.finishOrder(order.id, 'completed');

  const voidedAt = '2026-10-10T12:00:00.000Z';
  const voidedOrder = store.markOrderVoided(order.id, 'No Vouch = Voided', voidedAt);
  assert.equal(voidedOrder.voidedAt, voidedAt);
  assert.equal(voidedOrder.voidReason, 'No Vouch = Voided');
  assert.equal(store.getOrder(order.id).voidedAt, voidedAt);
  assert.equal(store.markOrderVoided(order.id, 'No Vouch = Voided'), null);
});

test('voided orders without an existing ticket vouch can be listed for recovery', () => {
  const store = createStore();
  const eligible = store.addOrder({
    guildId: 'guild-1', customerId: 'buyer-1', sourceChannelId: 'ticket-1',
    items: 'DEKOR', paymentMethod: 'GCash', supporterId: 'staff-1', quantity: 1,
  });
  const alreadyVouched = store.addOrder({
    guildId: 'guild-1', customerId: 'buyer-1', sourceChannelId: 'ticket-2',
    items: 'BOBUX', paymentMethod: 'GCash', supporterId: 'staff-1', quantity: 1,
  });
  const otherBuyer = store.addOrder({
    guildId: 'guild-1', customerId: 'buyer-2', sourceChannelId: 'ticket-3',
    items: 'PREMS', paymentMethod: 'GCash', supporterId: 'staff-1', quantity: 1,
  });
  for (const order of [eligible, alreadyVouched, otherBuyer]) {
    store.finishOrder(order.id, 'completed');
    store.markOrderVoided(order.id, 'No Vouch = Voided');
  }
  store.addVouch({
    guildId: 'guild-1', userId: 'buyer-1', items: 'BOBUX', ticketChannelId: 'ticket-2',
  });

  assert.deepEqual(
    store.listVoidedOrdersForVouch('guild-1', 'buyer-1').map((order) => order.id),
    [eligible.id],
  );
  assert.deepEqual(store.listVoidedOrdersForVouch('guild-2', 'buyer-1'), []);
});

test('giveaway entries, winners, bans, and tracked message counts persist', () => {
  const store = createStore();
  const giveaway = store.createGiveaway({
    guildId: 'guild-1',
    channelId: 'channel-1',
    prize: 'Robux',
    hostId: 'host-1',
    winnerCount: 1,
    endsAt: new Date(Date.now() + 60_000).toISOString(),
  });
  store.setGiveawayMessage(giveaway.id, 'message-1');
  assert.equal(store.addGiveawayEntrant('guild-1', giveaway.id, 'user-1'), true);
  assert.equal(store.addGiveawayEntrant('guild-1', giveaway.id, 'user-1'), false);
  assert.equal(store.endGiveaway('guild-1', giveaway.id, ['user-1']).status, 'ended');
  assert.equal(store.addGiveawayReroll('guild-1', giveaway.id, ['user-2']).rerolls.length, 1);
  assert.equal(store.banFromGiveaways('guild-1', 'user-3', 'admin-1'), true);
  assert.equal(store.isBannedFromGiveaways('guild-1', 'user-3'), true);
  assert.equal(store.incrementMessageCount('guild-1', 'channel-1', 'user-1'), 1);
  assert.equal(store.incrementMessageCount('guild-1', 'channel-1', 'user-1'), 2);

  const restartedStore = new OrderStore(store.filePath);
  assert.equal(restartedStore.findGiveawayByMessage('guild-1', 'message-1').id, giveaway.id);
  assert.equal(restartedStore.getMessageCount('guild-1', 'channel-1', 'user-1'), 2);
  assert.equal(restartedStore.listGiveawayBans('guild-1').length, 1);
});

test('sticky messages persist per channel and can be replaced or removed', () => {
  const store = createStore();
  assert.equal(store.setStickyMessage('guild-1', 'channel-1', 'First notice', 'message-1'), null);
  const replaced = store.setStickyMessage('guild-1', 'channel-1', 'Updated notice', 'message-2');
  assert.equal(replaced.content, 'First notice');

  const restartedStore = new OrderStore(store.filePath);
  assert.deepEqual(restartedStore.getStickyMessage('guild-1', 'channel-1'), {
    guildId: 'guild-1',
    channelId: 'channel-1',
    content: 'Updated notice',
    messageId: 'message-2',
  });
  assert.equal(restartedStore.getStickyMessage('guild-1', 'channel-2'), null);
  assert.equal(restartedStore.removeStickyMessage('guild-1', 'channel-1').messageId, 'message-2');
  assert.equal(restartedStore.getStickyMessage('guild-1', 'channel-1'), null);
});