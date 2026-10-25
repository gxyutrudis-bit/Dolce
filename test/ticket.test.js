const assert = require('node:assert/strict');
const test = require('node:test');
const {
  orderTicketModal,
  ticketPanelButtons,
  ticketEmbed,
  ticketButtons,
  reportTicketModal,
  othersTicketModal,
  ticketTranscriptEmbed,
  ticketCloseConfirmationEmbed,
  ticketCloseConfirmationButtons,
  ticketCloseReasonModal,
  helpEmbed,
  multiplicationContainer,
  paymentReminderContainer,
  paymentDetailsEmbed,
  vouchEmbed,
  vouchPreviewButtons,
  orderTicketTermsContainer,
  vouchLinkButton,
  orderCompletionReminderEmbed,
  warrantyActivatedContainer,
  dmsOrderMessage,
  dmsOrderFormModal,
  dmsOrderFormButtons,
  vouchReminderContainer,
  vouchFormModal,
} = require('../src/embeds');
const commands = require('../src/commands');
const { ticketChannelName } = require('../src/ticket-names');
const {
  ticketOwnerId,
  isOrderTicket,
  ticketChannelTopic,
  ticketTermsRequired,
  ticketTermsAccepted,
  ticketCustomerId,
  ticketProduct,
} = require('../src/ticket-context');
const { findActiveTicket, withTicketCreationLock } = require('../src/ticket-creation');
const { ticketTranscriptText, ticketTranscriptAttachment } = require('../src/ticket-transcript');
const { parseTicketMessageCommand } = require('../src/ticket-message-commands');
const {
  ticketAccessRoleIds,
  ticketManagerRoleIds,
  hasVoidedRole,
  ticketManagerMentionPayload,
} = require('../src/ticket-permissions');
const { voidedOrderMessage } = require('../src/embeds');
const { parseOrderTicketForm } = require('../src/order-ticket-form');
const { parseOthersTicketForm } = require('../src/others-ticket-form');
const { parseDmsOrderForm } = require('../src/dms-order-form');
const { multiplyAmounts, multiplyExpression } = require('../src/multiplication');
const { sendThenDeleteCommand } = require('../src/message-command-actions');
const { setVoidedRole } = require('../src/voided-role');

test('ticket panel contains only the three requested buttons', () => {
  const buttons = ticketPanelButtons().toJSON().components;
  assert.deepEqual(buttons.map((button) => button.label), ['order', 'report', 'others']);
  assert.equal(buttons[0].style, buttons[1].style);
  assert.equal(buttons[0].style, buttons[2].style);
});

test('order ticket modal requires the product, quantity, and payment method fields', () => {
  const modal = orderTicketModal().toJSON();
  assert.equal(modal.title, 'ORDER FORM');
  assert.deepEqual(
    modal.components.map((row) => ({
      label: row.components[0].label,
      required: row.components[0].required,
    })),
    [
      { label: 'PRODUCT', required: true },
      { label: 'QUANTITY', required: true },
      { label: 'PAYMENT METHOD', required: true },
    ],
  );
  assert.deepEqual(
    modal.components.map((row) => row.components[0].placeholder),
    ['DEKOR / BOBUX / SVBOWCH / PREMS / NAYTRO / GCRED1TS', '1-9999', 'GCASH / BANKTRANS / PAYMAYA'],
  );
});

test('order ticket form accepts only listed products and payment methods with quantities from 1 to 9999', () => {
  assert.deepEqual(parseOrderTicketForm({
    product: 'bobux',
    quantity: '0007',
    paymentMethod: 'gcash',
  }), {
    value: { product: 'BOBUX', quantity: '7', paymentMethod: 'GCASH' },
  });
  assert.deepEqual(parseOrderTicketForm({
    product: 'DEKOR',
    quantity: '9999',
    paymentMethod: 'PAYMAYA',
  }), {
    value: { product: 'DEKOR', quantity: '9999', paymentMethod: 'PAYMAYA' },
  });
  assert.deepEqual(parseOrderTicketForm({
    product: 'SVBOWCH',
    quantity: '3',
    paymentMethod: 'GCASH',
  }), {
    value: { product: 'SVBOWCH', quantity: '3', paymentMethod: 'GCASH' },
  });
  for (const product of ['NAYTRO', 'GCRED1TS']) {
    assert.deepEqual(parseOrderTicketForm({
      product: product.toLowerCase(),
      quantity: '1',
      paymentMethod: 'GCASH',
    }), {
      value: { product, quantity: '1', paymentMethod: 'GCASH' },
    });
  }
  assert.deepEqual(parseOrderTicketForm({
    product: 'OTHER',
    quantity: '3',
    paymentMethod: 'GCASH',
  }), { error: 'PRODUCT must be DEKOR, BOBUX, SVBOWCH, PREMS, NAYTRO, or GCRED1TS.' });
  assert.deepEqual(parseOrderTicketForm({
    product: 'PREMS',
    quantity: '10000',
    paymentMethod: 'GCASH',
  }), { error: 'QUANTITY must be a whole number from 1 to 9999.' });
  assert.deepEqual(parseOrderTicketForm({
    product: 'PREMS',
    quantity: '1.5',
    paymentMethod: 'GCASH',
  }), { error: 'QUANTITY must be a whole number from 1 to 9999.' });
  assert.deepEqual(parseOrderTicketForm({
    product: 'PREMS',
    quantity: '3',
    paymentMethod: 'CARD',
  }), { error: 'PAYMENT METHOD must be GCASH, BANKTRANS, or PAYMAYA.' });
});

test('report ticket modal requires the product, issue, and rules confirmation', () => {
  const modal = reportTicketModal().toJSON();
  assert.equal(modal.title, 'REPORT FORM');
  assert.deepEqual(
    modal.components.map((row) => ({
      label: row.components[0].label,
      required: row.components[0].required,
    })),
    [
      { label: 'WHAT IS THE PRODUCT YOU BOUGHT?', required: true },
      { label: 'WHAT IS THE ISSUE ABOUT IT?', required: true },
      { label: 'DID YOU READ THE RULES?', required: true },
    ],
  );
});

test('others ticket modal requires a partnership or concern description', () => {
  const modal = othersTicketModal().toJSON();
  assert.equal(modal.title, 'PARTNERSHIP / CONCERN');
  assert.equal(modal.components.length, 1);
  assert.deepEqual(
    {
      label: modal.components[0].components[0].label,
      placeholder: modal.components[0].components[0].placeholder,
      required: modal.components[0].components[0].required,
    },
    {
      label: 'PARTNERSHIP / CONCERN',
      placeholder: 'Type PARTNERSHIP or CONCERN',
      required: true,
    },
  );
});

test('others ticket form accepts only partnership or concern', () => {
  assert.deepEqual(parseOthersTicketForm({ type: ' partnership ' }), {
    value: { type: 'PARTNERSHIP' },
  });
  assert.deepEqual(parseOthersTicketForm({ type: 'Concern' }), {
    value: { type: 'CONCERN' },
  });
  assert.deepEqual(parseOthersTicketForm({ type: 'question' }), {
    error: 'Please enter exactly PARTNERSHIP or CONCERN.',
  });
  assert.deepEqual(parseOthersTicketForm({ type: '' }), {
    error: 'Please enter exactly PARTNERSHIP or CONCERN.',
  });
});

test('order ticket embed includes the submitted form answers', () => {
  const embed = ticketEmbed('order', { id: 'user-1' }, {
    product: 'Latte',
    quantity: '2',
    paymentMethod: 'Card',
  }).toJSON();

  assert.deepEqual(
    embed.fields.map((field) => [field.name, field.value]),
    [
      ['PRODUCT', 'Latte'],
      ['QUANTITY', '2'],
      ['PAYMENT METHOD', 'Card'],
    ],
  );
});

test('report ticket embed includes all submitted report form answers', () => {
  const embed = ticketEmbed('report', { id: 'user-1' }, undefined, {
    product: 'Latte',
    issue: 'Wrong order',
    readRules: 'Yes',
  }).toJSON();

  assert.deepEqual(
    embed.fields.map((field) => [field.name, field.value]),
    [
      ['WHAT IS THE PRODUCT YOU BOUGHT?', 'Latte'],
      ['WHAT IS THE ISSUE ABOUT IT?', 'Wrong order'],
      ['DID YOU READ THE RULES?', 'Yes'],
    ],
  );
});

test('others ticket embed includes the submitted partnership or concern', () => {
  const embed = ticketEmbed('others', { id: 'user-1' }, undefined, undefined, {
    type: 'PARTNERSHIP',
  }).toJSON();

  assert.deepEqual(
    embed.fields.map((field) => [field.name, field.value]),
    [['PARTNERSHIP / CONCERN', 'PARTNERSHIP']],
  );
});

test('ticket action buttons include claim and close, disabling claim after assignment', () => {
  const buttons = ticketButtons().toJSON().components;
  assert.deepEqual(buttons.map((button) => button.custom_id), ['ticket:claim', 'ticket:close']);
  assert.equal(buttons[0].label, 'Claim Ticket');
  assert.notEqual(buttons[0].disabled, true);

  const claimedButtons = ticketButtons(true).toJSON().components;
  assert.deepEqual(
    claimedButtons.map((button) => button.custom_id),
    ['ticket:claim', 'ticket:unclaim', 'ticket:close'],
  );
  assert.equal(claimedButtons[0].label, 'Claimed');
  assert.equal(claimedButtons[0].disabled, true);
  assert.equal(claimedButtons[1].label, 'Unclaim Ticket');
  assert.notEqual(claimedButtons[1].disabled, true);
  assert.notEqual(claimedButtons[2].disabled, true);
});

test('ticket close confirmation embed asks before closing and offers confirm or cancel', () => {
  const embed = ticketCloseConfirmationEmbed({ toString: () => '<#ticket-1>' }).toJSON();
  assert.equal(embed.title, 'Confirm Ticket Closure');
  assert.equal(embed.description, 'Are you sure you want to close <#ticket-1>?');

  const buttons = ticketCloseConfirmationButtons('confirm-123').toJSON().components;
  assert.deepEqual(buttons.map(({ custom_id, label }) => [custom_id, label]), [
    ['ticket-close:confirm:confirm-123', 'Confirm Close'],
    ['ticket-close:cancel:confirm-123', "No, don't close"],
  ]);
});

test('ticket close reason modal requires a reason before closure', () => {
  const modal = ticketCloseReasonModal('confirm-123').toJSON();
  assert.equal(modal.custom_id, 'ticket-close-reason:confirm-123');
  assert.equal(modal.title, 'Ticket Closure Reason');
  assert.deepEqual(
    modal.components.map((row) => {
      const input = row.components[0];
      return {
        customId: input.custom_id,
        label: input.label,
        style: input.style,
        required: input.required,
        maxLength: input.max_length,
      };
    }),
    [{
      customId: 'ticket-close-reason',
      label: 'Why are you closing this ticket?',
      style: 2,
      required: true,
      maxLength: 1000,
    }],
  );
});

test('ticket access includes configured ticket, admin, and owner roles', () => {
  assert.deepEqual(ticketAccessRoleIds({
    ticketStaffRoleId: 'ticket-staff',
    adminRoleId: 'admin',
    ownerRoleId: 'owner',
  }), ['ticket-staff', 'admin', 'owner']);
  assert.deepEqual(ticketAccessRoleIds({
    ticketStaffRoleId: 'same-role',
    adminRoleId: 'same-role',
    ownerRoleId: 'owner',
  }), ['same-role', 'owner']);
});

test('configured voided role is recognized for order-ticket blocking', () => {
  assert.equal(hasVoidedRole({ voidedRoleId: 'voided' }, (roleId) => roleId === 'voided'), true);
  assert.equal(hasVoidedRole({ voidedRoleId: 'voided' }, (roleId) => roleId === 'customer'), false);
  assert.equal(hasVoidedRole({}, () => true), false);
});

test('voided role can be granted and removed idempotently', async () => {
  const roleIds = new Set();
  const role = { id: 'voided' };
  const member = {
    roles: {
      cache: { has: (roleId) => roleIds.has(roleId) },
      add: async (addedRole) => roleIds.add(addedRole.id),
      remove: async (removedRole) => roleIds.delete(removedRole.id),
    },
  };
  const guild = {
    roles: { fetch: async () => role },
    members: { fetch: async () => member },
  };

  assert.equal(await setVoidedRole(guild, 'voided', 'buyer', true), true);
  assert.equal(await setVoidedRole(guild, 'voided', 'buyer', true), false);
  assert.equal(roleIds.has('voided'), true);
  assert.equal(await setVoidedRole(guild, 'voided', 'buyer', false), true);
  assert.equal(await setVoidedRole(guild, 'voided', 'buyer', false), false);
  assert.equal(roleIds.has('voided'), false);
});

test('only configured /setadmin and /setowner roles can claim or close tickets', () => {
  assert.deepEqual(ticketManagerRoleIds({
    ticketStaffRoleId: 'ticket-staff',
    adminRoleId: 'admin',
    ownerRoleId: 'owner',
  }), ['admin', 'owner']);
  assert.deepEqual(ticketManagerRoleIds({ ticketStaffRoleId: 'ticket-staff' }), []);
});

test('new tickets mention only the configured /setadmin and /setowner roles', () => {
  assert.deepEqual(ticketManagerMentionPayload({
    ticketStaffRoleId: 'ticket-staff',
    adminRoleId: 'admin',
    ownerRoleId: 'owner',
  }), {
    content: '<@&admin> <@&owner>',
    allowedMentions: { roles: ['admin', 'owner'] },
  });
  assert.deepEqual(ticketManagerMentionPayload({}), {
    allowedMentions: { roles: [] },
  });
});

test('ticket channel names include type, submitted form answer, and username', () => {
  assert.equal(ticketChannelName('order', 'Alex Smith', 'Latte'), 'order-latte-alex-smith');
  assert.equal(ticketChannelName('report', 'Alex Smith', 'Wrong item!'), 'report-wrong-item-alex-smith');
  assert.equal(
    ticketChannelName('others', 'Alex Smith', 'I want to discuss a partnership'),
    'others-partnership-concern-alex-smith',
  );
  assert.equal(ticketChannelName('others', 'Alex Smith'), 'others-partnership-concern-alex-smith');
  assert.ok(ticketChannelName('order', 'Alex', 'A'.repeat(200)).length <= 100);
});

test('ticket owner lookup only recognizes active ticket topics', () => {
  assert.equal(ticketOwnerId({ topic: 'ticket-owner:123456789012345678;ticket-type:order' }), '123456789012345678');
  assert.equal(ticketOwnerId({ topic: 'ticket-owner:123456789012345678;ticket-type:report;ticket-claimed:234567890123456789' }), '123456789012345678');
  assert.equal(ticketOwnerId({ topic: 'ticket-owner:123456789012345678' }), null);
  assert.equal(ticketOwnerId({ topic: 'ticket-owner:123456789012345678;ticket-type:unknown' }), null);
  assert.equal(ticketOwnerId(null), null);
  assert.equal(isOrderTicket({ topic: 'ticket-owner:123456789012345678;ticket-type:order' }), true);
  assert.equal(isOrderTicket({ topic: 'ticket-owner:123456789012345678;ticket-type:report' }), false);
  assert.equal(isOrderTicket({ topic: 'ticket-type:order' }), false);
});

test('order ticket topic includes owner, type, terms, product, and quantity', () => {
  assert.equal(
    ticketChannelTopic('123456789012345678', 'order', { product: 'DEKOR', quantity: '3' }),
    'ticket-owner:123456789012345678;ticket-type:order;ticket-terms-required;ticket-product:DEKOR;ticket-quantity:3',
  );
});

test('orders in tickets use the ticket owner as the customer', () => {
  const channel = { topic: 'ticket-owner:123456789012345678;ticket-type:order' };
  assert.equal(ticketCustomerId(channel, '987654321098765432'), '123456789012345678');
  assert.equal(ticketCustomerId({ topic: null }, '987654321098765432'), '987654321098765432');
});

test('order ticket terms container shows the terms and can be marked accepted', () => {
  const terms = orderTicketTermsContainer().toJSON();
  assert.equal(terms.type, 17);
  assert.match(terms.components[0].content, /dolce vita's terms of service/);
  assert.match(terms.components[0].content, /final and non-refundable/);
  assert.equal(terms.components[1].components[0].type, 2);
  assert.equal(terms.components[1].components[0].style, 3);
  assert.equal(terms.components[1].components[0].label, 'I agree to the terms');
  assert.equal(terms.components[1].components[0].custom_id, 'ticket:terms-agree');

  const accepted = orderTicketTermsContainer(true).toJSON();
  assert.equal(accepted.components[1].components[0].label, 'Terms accepted');
  assert.equal(accepted.components[1].components[0].disabled, true);
});

test('ticket terms status comes from order-ticket channel topic markers', () => {
  assert.equal(ticketTermsRequired({ topic: 'ticket-owner:123;ticket-type:order;ticket-terms-required' }), true);
  assert.equal(ticketTermsAccepted({ topic: 'ticket-owner:123;ticket-type:order;ticket-terms-required;ticket-terms-accepted' }), true);
  assert.equal(ticketTermsRequired({ topic: 'ticket-owner:123;ticket-type:report' }), false);
  assert.equal(ticketTermsAccepted({ topic: 'ticket-owner:123;ticket-type:order;ticket-terms-required' }), false);
});

test('order ticket product comes from the topic or the original ticket embed', async () => {
  assert.equal(await ticketProduct({
    topic: 'ticket-owner:123;ticket-type:order;ticket-product:GAMECREDITS',
  }), 'GAMECREDITS');

  const messages = new Map([['message-1', {
    embeds: [{
      title: 'ORDER TICKET',
      fields: [{ name: 'PRODUCT', value: 'ROBUX' }],
    }],
  }]]);
  assert.equal(await ticketProduct({
    topic: 'ticket-owner:123;ticket-type:order',
    messages: { fetch: async () => messages },
  }), 'ROBUX');

  assert.equal(await ticketProduct({ topic: 'ticket-owner:123;ticket-type:report' }), null);
});

test('ticket creation finds existing tickets and serializes simultaneous submissions', async () => {
  const existingTicket = { id: 'ticket-1', topic: 'ticket-owner:123;ticket-type:report' };
  assert.equal(findActiveTicket(new Map([[existingTicket.id, existingTicket]]), '123'), existingTicket);
  assert.equal(findActiveTicket(new Map([[existingTicket.id, existingTicket]]), '456'), null);

  const channels = new Map();
  const attempts = await Promise.all([1, 2].map((attempt) => withTicketCreationLock('guild:user', async () => {
    if (findActiveTicket(channels, '123')) return false;
    await Promise.resolve();
    const ticket = { id: `ticket-${attempt}`, topic: 'ticket-owner:123;ticket-type:order' };
    channels.set(ticket.id, ticket);
    return true;
  })));

  assert.equal(attempts.filter(Boolean).length, 1);
  assert.equal(channels.size, 1);
});

test('/ticket setup is registered for administrators with an optional staff role', () => {
  const command = commands.find((entry) => entry.name === 'ticket');
  assert.ok(command);
  assert.equal(command.default_member_permissions, '8');
  assert.deepEqual(command.options.map((option) => option.name), ['setup']);
  assert.equal(command.options[0].options[0].name, 'staff_role');
  assert.equal(command.options[0].options[0].required, false);
});

test('/vouch accepts one required proof and an optional second proof', () => {
  const command = commands.find((entry) => entry.name === 'vouch');
  const proofs = command.options.filter((option) => option.type === 11);

  assert.deepEqual(
    proofs.map(({ name, required }) => ({ name, required })),
    [
      { name: 'proof', required: true },
      { name: 'proof2', required: false },
    ],
  );
});

test('vouch preview offers confirm and change actions', () => {
  const buttons = vouchPreviewButtons('preview-123').toJSON().components;
  assert.deepEqual(buttons.map(({ custom_id, label }) => [custom_id, label]), [
    ['vouch-preview:confirm:preview-123', 'Confirm vouch'],
    ['vouch-preview:change:preview-123', "No, I'll change it"],
  ]);
});

test('/solving is registered with two required numeric amounts', () => {
  const command = commands.find((entry) => entry.name === 'solving');
  assert.ok(command);
  assert.deepEqual(
    command.options.map(({ name, type, required }) => ({ name, type, required })),
    [
      { name: 'amount_one', type: 10, required: true },
      { name: 'amount_two', type: 10, required: true },
    ],
  );
});

test('calc shortcut parses a single multiplication expression', () => {
  assert.deepEqual(parseTicketMessageCommand(',calc 5*5'), {
    name: 'calc',
    args: ['5*5'],
  });
  assert.deepEqual(parseTicketMessageCommand(',calc'), {
    name: 'calc',
    args: [],
  });
  assert.equal(parseTicketMessageCommand(',solving 5*5'), null);
});

test('multiplication handles finite numbers and rejects invalid values or overflow', () => {
  assert.deepEqual(multiplyAmounts('2.5', '-4'), {
    amountOne: 2.5,
    amountTwo: -4,
    product: -10,
  });
  assert.deepEqual(multiplyAmounts(0, 3), {
    amountOne: 0,
    amountTwo: 3,
    product: 0,
  });
  assert.equal(multiplyAmounts('not-a-number', '3'), null);
  assert.equal(multiplyAmounts('1e309', '2'), null);
  assert.equal(multiplyAmounts(Number.MAX_VALUE, 2), null);
  assert.deepEqual(multiplyExpression('5*5'), {
    amountOne: 5,
    amountTwo: 5,
    product: 25,
  });
  assert.deepEqual(multiplyExpression('-2.5 * 4'), {
    amountOne: -2.5,
    amountTwo: 4,
    product: -10,
  });
  assert.equal(multiplyExpression('5**5'), null);
  assert.equal(multiplyExpression('5*x'), null);
});

test('multiplication result is formatted as a colorless V2 container', () => {
  const container = multiplicationContainer(multiplyExpression('5*5')).toJSON();
  assert.equal(container.accent_color, undefined);
  assert.deepEqual(container.components, [
    { type: 10, content: '**5 x 5 = 25**' },
  ]);
});

test('payment reminder V2 container shows the server icon as a right-side thumbnail', () => {
  const container = paymentReminderContainer('https://cdn.example/server.png').toJSON();
  assert.equal(container.type, 17);
  assert.equal(container.accent_color, 0x3478c7);
  assert.deepEqual(container.components[0], {
    type: 9,
    components: [{
      type: 10,
      content: [
        '_ _ ─────────────  <:purpledonut:1557485667091746896>  ─────────────',
        '_ _',
        '_ _       **𝓓olce   𝓥ita**   payment   __reminders__    !!',
        '_ _ ⚬  send   the  payment  details  via  screenshot.',
        '_ _ ⚬  please complete your payment within 12 hrs.',
        '_ _ ⚬  order    will    be    processed   once   verified.',
        '_ _ ⚬  strictly   no   rushing  of  orders.   thank  you!',
        '_ _ ⚬  click  ` pay `  to  proceed,  ` no `  to  cancel.',
        '_ _',
        '_ _ ─────────────  <:purplecupcake:1557485583960379402>  ─────────────',
      ].join('\n'),
    }],
    accessory: {
      type: 11,
      media: { url: 'https://cdn.example/server.png' },
    },
  });
  const buttonRow = container.components[1];
  assert.equal(buttonRow.type, 1);
  assert.deepEqual(
    buttonRow.components.map(({ label, custom_id }) => [label, custom_id]),
    [['pay', 'payment:yes'], ['no', 'payment:no']],
  );
});

test('payment reminder V2 container supports servers without a custom icon', () => {
  const container = paymentReminderContainer(null).toJSON();
  assert.equal(container.type, 17);
  assert.equal(container.components.length, 2);
  assert.equal(container.components[1].type, 1);
  assert.equal(
    container.components[0].content,
    [
      '_ _ ─────────────  <:purpledonut:1557485667091746896>  ─────────────',
      '_ _',
      '_ _       **𝓓olce   𝓥ita**   payment   __reminders__    !!',
      '_ _ ⚬  send   the  payment  details  via  screenshot.',
      '_ _ ⚬  please complete your payment within 12 hrs.',
      '_ _ ⚬  order    will    be    processed   once   verified.',
      '_ _ ⚬  strictly   no   rushing  of  orders.   thank  you!',
      '_ _ ⚬  click  ` pay `  to  proceed,  ` no `  to  cancel.',
      '_ _',
      '_ _ ─────────────  <:purplecupcake:1557485583960379402>  ─────────────',
    ].join('\n'),
  );
});

test('vouch embed matches the order-details layout and Philippine time zone', () => {
  const vouchedAt = new Date('2026-10-04T22:53:00Z');
  const embed = vouchEmbed({
    id: 'user-123',
    displayName: 'Alex',
    displayAvatarURL: () => 'https://example.test/avatar.png',
  }, '1 Deco', 'Great service!', vouchedAt).toJSON();

  assert.equal(embed.title, undefined);
  assert.equal(embed.fields, undefined);
  assert.equal(embed.description, [
    '_ _ ・・・・  ๑   <a:hearts7:1562814717481844808>   ๑  ・・・・',
    '_ _',
    '_ _       <:00_candybar:1562793451223916695>  —  𝓞rder  𝓓etails',
    '_ _ ➠  buyer  :  <@user-123>',
    '_ _',
    '_ _ ⚬  item  :  1 Deco',
    '_ _ ⚬  date vouched  :  October 05, 2026',
    '_ _ ⚬  time vouched  :  6:53 AM GMT+8',
    '_ _ ⚬  feedback  :  Great service!',
    '_ _ ⚬  proof  :  see the attached image.',
    '_ _',
    '_ _ ・・・・  ๑   <a:hearts7:1562814717481844808>   ๑  ・・・・',
  ].join('\n'));
});

test('completed order reminder embed has no title and the warranty policy description', () => {
  const embed = orderCompletionReminderEmbed().toJSON();

  assert.equal(embed.title, undefined);
  assert.equal(embed.description, [
    '**REMINDERS : WARRANTY POLICY!!**',
    '› All completed orders come with a 12-hours warranty.',
    '› Replacements will only be provided for verified issues covered by warranty.',
    '› Once the warranty expires, the shop is no longer responsible for issues covered by the expired warranty.',
    '› NO VOUCH = no refund, no replacement & no warranty.',
    '› VOUCH IN YOUR ACTIVE ORDER TICKET.',
  ].join('\n'));
});

test('buyer warranty DM after vouch uses the card style and keeps its warranty details', () => {
  const container = warrantyActivatedContainer(
    { id: '1329447441128230962', username: 'alice' },
    'Bobux',
    new Date('2026-10-04T22:53:00Z'),
  ).toJSON();
  const text = container.components
    .filter((component) => component.type === 10)
    .map((component) => component.content)
    .join('\n');

  assert.equal(container.type, 17);
  assert.match(text, /WARRANTY ACTIVATED/i);
  assert.match(text, /<a:vitacheck:1557378165457027072>/);
  assert.match(text, /applies only to \(nitro, premium subs, svboosts\)/i);
  assert.match(text, /you may ignore this if you purchased discord items/i);
  assert.match(text, /present this if your item gets \*\*revoked\*\*/i);
  assert.match(text, /Deleting this message will automatically void the warranty/);
  assert.match(text, /<@1329447441128230962>/);
  assert.match(text, /🍩 \*\*order details\*\*/);
  assert.match(text, /> Bobux/);
  assert.match(text, /October 05, 2026 at 6:53 AM PHT \(UTC\+8\)/);
  assert.match(text, /proof:/i);
  assert.ok(container.components.some((component) => (
    component.type === 12
    && component.items[0].media.url === 'attachment://vouch-proofs.png'
  )));
});

test('completion DM puts the vouch shortcut button inside the reminder container', () => {
  const container = vouchReminderContainer('guild-123', 'ticket-456').toJSON();
  const button = container.components[1].components[0];
  assert.equal(container.type, 17);
  assert.match(container.components[0].content, /CLICK “Vouch now” TO VOUCH DOLCE VITA/);
  assert.equal(button.label, 'Vouch now');
  assert.equal(button.style, 1);
  assert.equal(button.custom_id, 'vouch:shortcut:guild-123:ticket-456');
  assert.equal(button.url, undefined);
});

test('DM vouch shortcut opens a form with order details and proof upload', () => {
  const modal = vouchFormModal('guild-123', 'ticket-456').toJSON();
  assert.equal(modal.custom_id, 'vouch:form:guild-123:ticket-456');
  assert.equal(modal.title, 'VOUCH FORM');
  assert.deepEqual(modal.components.map(({ label }) => label), [
    'PRODUCT',
    'QUANTITY',
    'FEEDBACK',
    'PROOF IMAGES',
  ]);
  assert.deepEqual(modal.components[3].component, {
    type: 19,
    custom_id: 'proofs',
    min_values: 1,
    max_values: 2,
    required: true,
  });
});

test('removed order and voided-role message shortcuts are not recognized', () => {
  assert.equal(parseTicketMessageCommand(',setorder 123456789012345678'), null);
  assert.equal(parseTicketMessageCommand(',setvoided 1234567890'), null);
  assert.equal(parseTicketMessageCommand(',setvoidedrole 9876543210'), null);
  assert.equal(parseTicketMessageCommand(',setrolevoided 9876543210'), null);
});

test('voided order notice uses the requested layout and includes buyer, item, and reason', () => {
  const message = voidedOrderMessage({
    id: '1234567890',
    username: 'alice',
    tag: 'alice#0001',
  }, 'ROBUX');

  assert.equal(message, [
    '_ _ ─────────────  <:00_treat:1562793410157613156>  ─────────────',
    '_ _',
    '_ _  <@1234567890>, your __warranty__ has been **voided**.',
    '_ _',
    '_ _ <:purpleflower:1557500052107304981>  user  :  @alice  | 1234567890 of ticket owner',
    '_ _ <:purpleflower:1557500052107304981>  item purchased  :',
    '_ _ ⎯⎯  ROBUX',
    '_ _ <:purpleflower:1557500052107304981>  reason  :',
    '_ _ ⎯⎯  no vouch = warranty voided',
    '_ _',
    '_ _ ─────────────  <a:pinkletter:1450249803530244337>  ─────────────',
    '_ _',
  ].join('\n'));
});

test('payment details embed includes GCash instructions and the attached payment thumbnail', () => {
  const embed = paymentDetailsEmbed().toJSON();
  assert.equal(embed.title, undefined);
  assert.equal(
    embed.description,
    '**🧁 payment method: gcash**\ngcash initials: H. C. S.\ngcash number: `09639298459`\npls send screenshot of the receipt, ty!',
  );
  assert.deepEqual(embed.thumbnail, { url: 'attachment://gcash-payment.png' });
});

test('calc shortcut sends the result before deleting the command message', async () => {
  const calls = [];
  const message = {
    channel: { send: async (payload) => calls.push(['send', payload]) },
    delete: async () => calls.push(['delete']),
  };
  const resultContainer = multiplicationContainer(multiplyAmounts('2', '3'));
  const payload = {
    components: [resultContainer],
    flags: require('discord.js').MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
  const deleteError = await sendThenDeleteCommand(message, payload);
  assert.equal(deleteError, null);
  assert.deepEqual(calls, [
    ['send', payload],
    ['delete'],
  ]);
});

test('calc shortcut reports command deletion errors to its caller', async () => {
  const deleteError = new Error('Missing Manage Messages permission');
  const message = {
    channel: { send: async () => {} },
    delete: async () => { throw deleteError; },
  };
  assert.equal(await sendThenDeleteCommand(message, 'result'), deleteError);
});

test('ticketsetup shortcut is registered as an administrator command', () => {
  const shortcut = commands.find((command) => command.name === 'ticketsetup');
  assert.ok(shortcut);
  assert.equal(shortcut.default_member_permissions, '8');
});

test('/set voided is registered with a required text channel', () => {
  const setCommand = commands.find((entry) => entry.name === 'set');
  const voidedSubcommand = setCommand.options.find((option) => option.name === 'voided');
  assert.ok(voidedSubcommand);
  assert.equal(voidedSubcommand.options[0].name, 'channel');
  assert.equal(voidedSubcommand.options[0].required, true);
  assert.equal(setCommand.default_member_permissions, '8');
});

test('ticket category setup slash command takes a category ID and requires administrator permission', () => {
  const command = commands.find((entry) => entry.name === 'setupticketcategory');
  assert.ok(command);
  assert.equal(command.options[0].name, 'category_id');
  assert.equal(command.options[0].required, true);
  assert.equal(command.default_member_permissions, '8');
});

test('voidedchannel slash command is registered with a required channel option', () => {
  const command = commands.find((entry) => entry.name === 'voidedchannel');
  assert.ok(command);
  assert.equal(command.options[0].name, 'channel');
  assert.equal(command.options[0].required, true);
});

test('/tip channel and /tip send are registered with their required options', () => {
  const command = commands.find((entry) => entry.name === 'tip');
  assert.ok(command);
  assert.equal(command.default_member_permissions, undefined);
  const channelCommand = command.options.find((option) => option.name === 'channel');
  const sendCommand = command.options.find((option) => option.name === 'send');
  assert.equal(channelCommand.options[0].name, 'channel');
  assert.equal(channelCommand.options[0].required, true);
  assert.equal(sendCommand.options[0].name, 'amount');
  assert.equal(sendCommand.options[0].required, true);
});

test('payment and giveaway slash commands expose matching subcommands', () => {
  const payment = commands.find((entry) => entry.name === 'payment');
  const giveaway = commands.find((entry) => entry.name === 'giveaway');
  assert.ok(payment);
  assert.ok(giveaway);
  assert.deepEqual(giveaway.options.map((option) => option.name), [
    'start',
    'end',
    'reroll',
    'ban',
    'banned',
  ]);
});

test('/queuelist is registered as a slash command', () => {
  assert.ok(commands.find((entry) => entry.name === 'queuelist'));
});

test('/dmsorder opens separate item and link fields in up to three modal steps', () => {
  const command = commands.find((entry) => entry.name === 'dmsorder');
  assert.ok(command);
  assert.deepEqual(command.options.map(({ name, required }) => ({ name, required })), [
    { name: 'user', required: true },
  ]);

  const modal = dmsOrderFormModal('form-123').toJSON();
  assert.equal(modal.custom_id, 'dmsorder:form:form-123:1');
  assert.equal(modal.title, 'DOLCE VITA ORDER DM');
  assert.deepEqual(modal.components.map(({ label, component }) => ({
    label,
    customId: component.custom_id,
    required: component.required,
  })), [
    { label: 'ITEM 1', customId: 'item1', required: true },
    { label: 'LINK 1', customId: 'link1', required: true },
    { label: 'ITEM 2', customId: 'item2', required: false },
    { label: 'LINK 2', customId: 'link2', required: false },
  ]);
  assert.deepEqual(dmsOrderFormModal('form-123', 5).toJSON().components.map(({ label, component }) => ({
    label,
    customId: component.custom_id,
    required: component.required,
  })), [
    { label: 'ITEM 5', customId: 'item5', required: true },
    { label: 'LINK 5', customId: 'link5', required: true },
  ]);
  const buttons = dmsOrderFormButtons('form-123', 3).toJSON().components;
  assert.deepEqual(buttons.map(({ custom_id, label }) => [custom_id, label]), [
    ['dmsorder:next:form-123:3', 'Add items 3–4'],
    ['dmsorder:send:form-123', 'Send order DM'],
  ]);
});

test('order DM form parses item/link pairs and validates optional entries', () => {
  assert.deepEqual(parseDmsOrderForm([
    { item: 'PREMS', link: 'https://example.com/1' },
    { item: 'BOBUX', link: 'https://example.com/2' },
  ]), {
    value: [
      { item: 'PREMS', link: 'https://example.com/1' },
      { item: 'BOBUX', link: 'https://example.com/2' },
    ],
  });
  assert.deepEqual(parseDmsOrderForm([
    { item: 'DEKOR', link: 'http://example.com/3' },
    { item: '', link: '' },
  ], 3), { value: [{ item: 'DEKOR', link: 'http://example.com/3' }] });
  assert.match(parseDmsOrderForm([{ item: 'PREMS', link: '' }]).error, /both item 1 and its order link/);
  assert.match(parseDmsOrderForm([{ item: 'PREMS', link: 'javascript:alert(1)' }]).error, /valid http or https/);
  assert.match(parseDmsOrderForm([{ item: '', link: '' }]).error, /item 1 and its order link/);
});

test('order DM message preserves the warranty text and spoiler-wraps the link', () => {
  const message = dmsOrderMessage([
    { item: 'PREMS', link: 'https://example.com/order/123' },
  ]);
  assert.match(message, /\(PREMS\) - \(\|\|https:\/\/example\.com\/order\/123\|\|\)/);
  assert.match(message, /no   vouch   =   no   warranty \/ regen/);
  assert.match(message, /link        invalid        =        no      regen/);
  assert.match(message, /12        hours         voids        warranty/);
  assert.match(message, /tysm for buying!/);
});

test('order DM message supports five item/link pairs in order', () => {
  const message = dmsOrderMessage([
    { item: 'PREMS', link: 'https://example.com/1' },
    { item: 'BOBUX', link: 'https://example.com/2' },
    { item: 'DEKOR', link: 'https://example.com/3' },
    { item: 'SVBOWCH', link: 'https://example.com/4' },
    { item: 'NITRO', link: 'https://example.com/5' },
  ]);
  const itemPositions = ['PREMS', 'BOBUX', 'DEKOR', 'SVBOWCH', 'NITRO']
    .map((item) => message.indexOf(`(${item})`));
  assert.deepEqual([...itemPositions].sort((a, b) => a - b), itemPositions);
  for (let index = 1; index <= 5; index += 1) {
    assert.ok(message.includes(`(||https://example.com/${index}||)`));
  }
});

test('removed per-ticket category slash commands are not registered', () => {
  for (const name of ['ordercategory', 'reportcategory', 'othercategory']) {
    assert.equal(commands.find((command) => command.name === name), undefined);
  }
});

test('removed category and transcript message shortcuts are not recognized', () => {
  assert.equal(parseTicketMessageCommand(',setupticketcategory 123456789012345678'), null);
  assert.equal(parseTicketMessageCommand(',set ticket_transcript 123456789012345678'), null);
  assert.equal(parseTicketMessageCommand(',set something-else 123'), null);
});

test('removed per-ticket category message shortcuts are not recognized', () => {
  for (const name of ['ordercategory', 'reportcategory', 'othercategory']) {
    assert.equal(parseTicketMessageCommand(`,${name} 123456789012345678`), null);
  }
});

test('payment reminder is not a message shortcut', () => {
  assert.equal(parseTicketMessageCommand(',payment'), null);
  assert.equal(parseTicketMessageCommand(',payment extra'), null);
});

test('bot pronouns shortcut is not registered', () => {
  assert.equal(parseTicketMessageCommand(',botpronouns'), null);
  assert.equal(parseTicketMessageCommand(',pronouns'), null);
});

test('removed ticket role setup message commands are not recognized', () => {
  assert.equal(parseTicketMessageCommand(',ticket setup staff_role 123456789012345678'), null);
  assert.equal(parseTicketMessageCommand(',ticket setup ownersv_role 123456789012345678'), null);
});

test('help command lists registered commands, subcommands, and message shortcuts', () => {
  const embed = helpEmbed(commands).toJSON();
  assert.equal(commands.find((command) => command.name === 'help')?.description, 'List all bot commands.');
  for (const commandText of [
    '/help',
    '/setup',
    '/queue',
    '/queuelist',
    '/dmsorder',
    '/solving',
    ',calc <number>*<number>',
    '/set vouch',
    '/set ticket_transcript',
    '/set voided',
    '/set voided_role',
    '/ticket setup',
    '/ticketsetup',
    '/stickymessage set',
    '/stickymessage remove',
    '/setupticketcategory',
  ]) {
    assert.ok(embed.description.includes(commandText), `Expected help embed to include ${commandText}`);
  }
  assert.match(embed.description, /unclaimed only by the current claimant/);
  assert.match(embed.description, /automatically delete the ticket channel/);
  assert.ok(embed.description.indexOf('## Slash commands') < embed.description.indexOf('## Message shortcuts'));
  assert.ok(embed.description.indexOf('## Message shortcuts') < embed.description.indexOf('## Ticket notes'));
  assert.ok(embed.description.length <= 4096);
});

test('ticket transcript channel setup is registered under /set for administrators', () => {
  const setCommand = commands.find((command) => command.name === 'set');
  const transcriptSubcommand = setCommand.options.find((option) => option.name === 'ticket_transcript');
  assert.ok(transcriptSubcommand);
  assert.equal(transcriptSubcommand.options[0].name, 'channel');
  assert.equal(setCommand.default_member_permissions, '8');
});

test('/set voidvouch is registered for administrators with a required channel', () => {
  const setCommand = commands.find((command) => command.name === 'set');
  const subcommand = setCommand.options.find((option) => option.name === 'voidvouch');
  assert.ok(subcommand);
  assert.equal(subcommand.options[0].name, 'channel');
  assert.equal(subcommand.options[0].required, true);
  assert.equal(setCommand.default_member_permissions, '8');
});

test('ticket transcript embed shows the closure details in the requested layout', () => {
  const embed = ticketTranscriptEmbed({
    channelId: '282',
    createdAt: new Date('2026-10-04T08:47:00Z'),
    ownerId: 'ticket-owner',
    closedById: 'staff-1',
    claimedById: 'staff-1',
    reason: 'Customer request',
  }).toJSON();

  assert.equal(embed.title, 'Ticket Closed');
  assert.equal(embed.description, undefined);
  assert.deepEqual(
    embed.fields.map(({ name, value, inline }) => [name, value, inline]),
    [
      ['🔢 Ticket ID', '282', true],
      ['✅ Opened By', '<@ticket-owner>', true],
      ['🔒 Closed By', '<@staff-1>', true],
      ['🕒 Open Time', '<t:1791103620:f>', true],
      ['🟣 Claimed By', '<@staff-1>', true],
      ['❔ Reason', 'Customer request', true],
    ],
  );
});

test('ticket transcript shows unclaimed tickets in the closure summary', () => {
  const embed = ticketTranscriptEmbed({
    channelId: '282',
    createdAt: new Date('2026-10-04T08:47:00Z'),
    ownerId: 'ticket-owner',
    closedById: 'staff-1',
  }).toJSON();

  assert.equal(embed.fields.find(({ name }) => name === '🟣 Claimed By').value, 'Unclaimed');
});

test('ticket transcript text preserves message order, content, and attachment links', () => {
  const messages = [
    {
      createdTimestamp: Date.parse('2026-01-02T00:00:00.000Z'),
      author: { tag: 'Alex#0001' },
      content: 'Hello staff',
      attachments: new Map([['attachment-1', { name: 'proof.png', url: 'https://example.test/proof.png' }]]),
    },
    {
      createdTimestamp: Date.parse('2026-01-02T00:01:00.000Z'),
      author: { tag: 'Staff#0001' },
      content: 'How can I help?',
      attachments: new Map(),
    },
  ];

  const transcript = ticketTranscriptText(messages);
  assert.ok(transcript.indexOf('Alex#0001:') < transcript.indexOf('Staff#0001:'));
  assert.match(transcript, /Hello staff/);
  assert.match(transcript, /proof\.png \(https:\/\/example\.test\/proof\.png\)/);
});

test('ticket transcript attachments keep a .txt extension for the configured channel copy', () => {
  const attachment = ticketTranscriptAttachment('support-ticket', 'hello world');
  assert.equal(attachment.name, 'support-ticket-transcript.txt');
  assert.equal(Buffer.from(attachment.attachment).toString('utf8'), 'hello world');
});
