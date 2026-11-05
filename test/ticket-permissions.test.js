const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ticketAccessRoleIds,
  hasTicketManagerRole,
  ticketOwnerPermissionOverwrite,
  ticketAccessRolePermissionOverwrite,
} = require('../src/ticket-permissions');
const { PermissionFlagsBits } = require('discord.js');

test('configured /setadmin and /setowner members can close their own tickets', () => {
  const settings = { adminRoleId: 'admin', ownerRoleId: 'owner' };

  assert.equal(hasTicketManagerRole(settings, (roleId) => roleId === 'admin'), true);
  assert.equal(hasTicketManagerRole(settings, (roleId) => roleId === 'owner'), true);
  assert.equal(hasTicketManagerRole(settings, (roleId) => roleId === 'ticket-staff'), false);
  assert.equal(hasTicketManagerRole({}, () => true), false);
});

test('order ticket owners and staff cannot send messages until terms are accepted', () => {
  for (const overwrite of [
    ticketOwnerPermissionOverwrite('owner', 'order'),
    ticketAccessRolePermissionOverwrite('staff', 'order'),
  ]) {
    assert.ok(overwrite.deny.includes(PermissionFlagsBits.SendMessages));
    assert.ok(overwrite.deny.includes(PermissionFlagsBits.SendMessagesInThreads));
    assert.ok(!overwrite.allow.includes(PermissionFlagsBits.SendMessages));
  }

  assert.ok(ticketOwnerPermissionOverwrite('owner', 'report').allow.includes(PermissionFlagsBits.SendMessages));
  assert.ok(ticketAccessRolePermissionOverwrite('staff', 'report').allow.includes(PermissionFlagsBits.SendMessages));
});

test('only the configured PSM role gets access to others tickets', () => {
  const settings = {
    ticketStaffRoleId: 'ticket-staff',
    adminRoleId: 'admin',
    ownerRoleId: 'owner',
    psmRoleId: 'psm',
  };
  assert.deepEqual(ticketAccessRoleIds(settings, 'others'), ['ticket-staff', 'admin', 'owner', 'psm']);
  assert.deepEqual(ticketAccessRolePermissionOverwrite('ticket-staff', 'others', settings), {
    id: 'ticket-staff',
    allow: [PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages],
    deny: [PermissionFlagsBits.ViewChannel],
  });
  assert.ok(ticketAccessRolePermissionOverwrite('psm', 'others', settings).allow.includes(PermissionFlagsBits.ViewChannel));
  assert.ok(ticketAccessRolePermissionOverwrite('admin', 'report', settings).allow.includes(PermissionFlagsBits.ViewChannel));
  assert.deepEqual(ticketAccessRoleIds(settings, 'report'), ['ticket-staff', 'admin', 'owner']);
});
