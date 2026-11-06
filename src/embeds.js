const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  EmbedBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ModalBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { orderStatusLabel } = require('./order-status');
const { orderReference } = require('./order-reference');

const LABELS = { pending: 'Waiting', claimed: 'In progress', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired' };
const SHOP_ANNOUNCEMENT_ROLE_ID = '1555603985694588940';

function orderQueueText(order) {
  const status = orderStatusLabel(order);
  const ticket = order.sourceChannelId ? `<#${order.sourceChannelId}>` : 'Unknown ticket';
  const buyer = order.customerId ? `<@${order.customerId}>` : 'Unknown buyer';
  const ticketHandler = order.supporterId ? `<@${order.supporterId}>` : 'Not assigned';
  return [
      '_ _',
      '_ _       ──────────  <:0cpink_bow:1562803659190829126>  ──────────',
      '_ _              ꒰  <:00_treat:1562793410157613156>  ꒱   **order**  __queue__   !!',
      `_ _                 ⚬  ${ticket}  :  ${buyer}`,
      `_ _                 ⚬  ${order.items ?? order.item ?? 'Unknown item'}．${order.quantity ?? 1}`,
      `_ _                 ⚬  paid via __${order.paymentMethod ?? 'Not specified'}__`,
      `_ _                 ⚬  status   :   __${status}__`,
      `_ _                  served by ${ticketHandler} <a:sweet_nom:1561070811773935797>`,
      '_ _       ──────────  <a:pinkletter:1562804355856597092>  ──────────',
      '_ _',
    ].join('\n');
}

function orderMessagePayload(order) {
  return {
    content: orderQueueText(order),
    components: [orderButtons(order)],
    allowedMentions: { parse: [] },
  };
}

function orderContainer(order) {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(orderQueueText(order)))
    .addActionRowComponents(orderButtons(order));
}

function orderTicketTermsContainer(accepted = false) {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      '_ _',
      '_ _ ` 🧁 `  **dσlc𝚎 vιtα’s** __t𝚎rm σf s𝚎rvιc𝚎__  ʚଓ',
      '_ _ αll   sweeties   bought   αre   finαl   αnd',
      '_ _ cαnnot    be    refunded.',
      '_ _',
      '_ _ ─ ─ ─ ─ ─ ─ ─ ─    ⪩𓋰⪨    ─ ─ ─ ─ ─ ─ ─ ─',
      '_ _',
      '_ _ ⚬  0-1d proc, please no rushing of orders.',
      '_ _ ⚬  force     refunds    are    not    accepted.',
      '_ _ ⚬  once   order   is   being   processed,  no',
      '_ _ cancellation   or   refund   request.',
      '_ _',
    ].join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:terms-agree')
        .setLabel(accepted ? 'Terms accepted' : 'I agree to the terms')
        .setStyle(accepted ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(accepted),
    ));
}

function vouchLinkButton(guildId, ticketChannelId) {
  return new ActionRowBuilder().addComponents(new ButtonBuilder()
    .setCustomId(`vouch:shortcut:${guildId}:${ticketChannelId}`)
    .setLabel('Vouch now')
    .setStyle(ButtonStyle.Primary));
}

function vouchReminderContainer(guildId, ticketChannelId) {
  const reminder = orderCompletionReminderEmbed().toJSON();
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(reminder.description))
    .addActionRowComponents(vouchLinkButton(guildId, ticketChannelId));
}

function vouchFormModal(guildId, ticketChannelId) {
  return new ModalBuilder()
    .setCustomId(`vouch:form:${guildId}:${ticketChannelId}`)
    .setTitle('VOUCH FORM')
    .addLabelComponents(
      new LabelBuilder({
        label: 'PRODUCT',
        component: new TextInputBuilder()
          .setCustomId('product')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('DEKOR / BOBUX / SVBOWCH / PREMS / NAYTRO / GCRED1TS')
          .setMaxLength(20)
          .setRequired(true),
      }),
      new LabelBuilder({
        label: 'QUANTITY',
        component: new TextInputBuilder()
          .setCustomId('quantity')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('1-9999')
          .setMaxLength(4)
          .setRequired(true),
      }),
      new LabelBuilder({
        label: 'FEEDBACK',
        component: new TextInputBuilder()
          .setCustomId('feedback')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1024)
          .setRequired(true),
      }),
      new LabelBuilder({
        label: 'PROOF IMAGES',
        description: 'Upload one or two proof images.',
        component: new FileUploadBuilder()
          .setCustomId('proofs')
          .setMinValues(1)
          .setMaxValues(2)
          .setRequired(true),
      }),
    );
}

function orderStatusText(order) {
  const status = orderStatusLabel(order).toLowerCase();
  const ticket = order.sourceChannelId ? `<#${order.sourceChannelId}>` : 'Unknown ticket';
  return [
    '_ _',
    '### _ _    ＠<:e_cupcake:1562794346477256788>  σrder status update  ʚଓ𓏼',
    `_ _ your   order   is   now   __${status}__.   (⁠ ⁠ꈍ⁠ᴗ⁠ꈍ⁠)`,
    '_ _',
    `_ _ <:purpleflower:1557500052107304981>  :  item  —  ${order.items ?? order.item ?? 'Unknown item'}`,
    `_ _ <:purpleflower:1557500052107304981>  :  quantity  —  ${order.quantity ?? 1}`,
    `_ _ <:purpleflower:1557500052107304981>  :  mop  —  ${order.paymentMethod ?? 'Not specified'}`,
    `_ _ <:purpleflower:1557500052107304981>  :  submitted in  —  ${ticket}`,
    '_ _',
  ].join('\n');
}

function voidedOrderMessage(user, product) {
  const username = user?.username ?? 'unknown';
  const userId = user?.id ?? 'unknown';
  return [
    '_ _ ─────────────  <:00_treat:1562793410157613156>  ─────────────',
    '_ _',
    `_ _  ${user?.id ? `<@${user.id}>` : '@user'}, your __warranty__ has been **voided**.`,
    '_ _',
    `_ _ <:purpleflower:1557500052107304981>  user  :  ${username}  | ${userId}`,
    '_ _ <:purpleflower:1557500052107304981>  item purchased  :',
    `_ _ ⎯⎯  ${String(product ?? 'Unknown product')}`,
    '_ _ <:purpleflower:1557500052107304981>  reason  :',
    '_ _ ⎯⎯  no vouch = warranty voided',
    '_ _',
    '_ _ ─────────────  :pinkletter:   ─────────────',
    '_ _',
  ].join('\n');
}

  function tipMessage(buyer, amount) {
    return [
      `_ _ ${'<:dolcevita:1567562931326025738><:dolcevita:1567562829001658428>'.repeat(6)}`,
      '_ _',
      '_ _            ꮺ  <:00_treat:1562793410157613156>  **tip  tip  tip  !**    ࣪    ⊹',
      '_ _',
      `_ _        ${amount}   tip   from   ${buyer}`,
      '_ _    thank   you   for   your   sugar  tip!',
      '_ _',
      `_ _ ${'<:Bandage:1566436975416844298>'.repeat(12)}`,
    ].join('\n');
  }

function multiplicationContainer(calculation) {
  const resultText = calculation.expression !== undefined
    ? `${calculation.expression} = ${calculation.result}`
    : `${calculation.amountOne} x ${calculation.amountTwo} = ${calculation.product}`;
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${resultText}**`),
    );
}

function robuxFormContainer() {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      '🥞   **RBX FILL UP FORM !**',
      '',
      '**username:**',
      '**display name:**',
    ].join('\n')));
}

function robuxAvailabilityMessage() {
  return [
    `<@&${SHOP_ANNOUNCEMENT_ROLE_ID}>`,
    '_ _',
    '_ _          - ⭑𓂃       **rbx via plus   **   Ი︵𐑼',
    '_ _ • ┈ • ┈ • ୨୧ • ┈ • ┈ • ୨୧ • ┈ • ┈ • ୨୧ • ┈ •',
    '-# _ _                ` 1OO  rbx  `  ~~      ~~  ` ₱ 60  `',
    '-# _ _                ` 2OO  rbx  `  ~~      ~~  ` ₱ 120 `',
    '-# _ _                ` 3OO  rbx  `  ~~      ~~  ` ₱ 180 `',
    '-# _ _                ` 4OO  rbx  `  ~~      ~~  ` ₱ 240 `',
    '-# _ _                ` 5OO  rbx  `  ~~      ~~  ` ₱ 300 `',
    '-# _ _                ` 1OOO rbx  `  ~~      ~~  ` ₱ 600 `',
    '_ _',
    '-# _ _              __viα plus !__',
    '-# _ _              __O-1 dαy procesing time__',
    '-# _ _              __1rbx x .60__',
    '_ _ • ┈ • ┈ • ୨୧ • ┈ • ┈ • ୨୧ • ┈ • ┈ • ୨୧ • ┈ •',
  ].join('\n');
}

function openShopContainer() {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `<@&${SHOP_ANNOUNCEMENT_ROLE_ID}>`,
      '_ _',
      ':candy:  **Dolce Vita is now __open__**',
      '',
      'we never serve rush orders.',
      'check our pricelist before ordering.',
      '',
      '→  [Daily Stocks](https://discord.com/channels/1555578509743755306/1555578511165493401)',
      '→  [Robux Via Plus / Gamepass Gift](https://discord.com/channels/1555578509743755306/1555633960523141220)',
      '→  [Discord Items - Dekor & Sv Boost](https://discord.com/channels/1555578509743755306/1555581838544609430)',
      '→  [Premmies](https://discord.com/channels/1555578509743755306/1555826478522835014) - Soon',
      '→  [Gamecredits](https://discord.com/channels/1555578509743755306/1555826478522835014) - Soon',
    ].join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Order Here')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.com/channels/1555578509743755306/1555625940111855697'),
    ));
}

function closeShopContainer() {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `<@&${SHOP_ANNOUNCEMENT_ROLE_ID}>`,
      '',
      ':candy:   **Dolce Vita is now closed**',
      '',
      'Thank you to everyone who supported Dolce Vita,',
      'We appreciate all of you.',
      '',
      "we're currently closed but you still can create a ticket",
      '',
      'if you create a ticket while closed please wait for',
      'Dolce Vita Staff to open the shop and assist you.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '⟢ please keep an eye on our [Announcement](https://discord.com/channels/1555578509743755306/1555826478522835014) channel for updates on our next opening.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '**what happened?**',
      "> we're busy/sleeping or at school/work, and improving our services",
      "> to serve y'all better",
      '',
      '**what can I do?**',
      '→ [check the pricelist](https://discord.com/channels/1555578509743755306/1555581838544609430)',
      '→ [check the rules](https://discord.com/channels/1555578509743755306/1556310915643867226)',
      '→ [inquire channel](https://discord.com/channels/1555578509743755306/1555592238690598943)',
      'thank you for patience and understanding. See you soon!!',
    ].join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Announcement')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.com/channels/1555578509743755306/1555826478522835014'),
    ));
}

function giveawayContainer(giveaway, ended = false) {
  const endTime = Math.floor(new Date(giveaway.endsAt).getTime() / 1000);
  const lines = [
    '🎉 **GIVEAWAY**',
    '',
    `**Prize:** ${giveaway.prize}`,
    `**Host:** <@${giveaway.hostId}>`,
    ended
      ? `**Winners:** ${giveaway.winners?.length ? giveaway.winners.map((id) => `<@${id}>`).join(', ') : 'No eligible entrants.'}`
      : `**Ends:** <t:${endTime}:R>`,
    `**Entries:** ${giveaway.entrants?.length ?? 0}`,
  ];
  if (giveaway.messageCount) {
    lines.push(`**Message requirement:** ${giveaway.messageCount} messages in <#${giveaway.messageChannelId}>`);
  }
  if (giveaway.requirements) lines.push(`**Additional requirements:** ${giveaway.requirements}`);
  if (giveaway.roleIds?.length) {
    lines.push(`**Eligible roles:** ${giveaway.roleIds.map((id) => `<@&${id}>`).join(', ')}`);
  }
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway:enter:${giveaway.id}`)
        .setLabel(ended ? 'Giveaway ended' : '🎉 Enter giveaway')
        .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(ended),
    ));
}

function paymentReminderContainer(serverIconUrl) {
  const container = new ContainerBuilder()
    .setAccentColor(0x3478c7);
  const reminderText = [
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
  ].join('\n');
  if (serverIconUrl) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(reminderText))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(serverIconUrl)),
    );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(reminderText));
  }
  return container.addActionRowComponents(paymentReminderButtons());
}

function vouchEmbed(user, items, feedback, vouchedAt = new Date()) {
  const date = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(vouchedAt);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
    timeZoneName: 'short',
  }).format(vouchedAt);
  return new EmbedBuilder()
    .setColor(0x35a16b)
    .setDescription([
      '_ _ ・・・・  ๑   <a:hearts7:1562814717481844808>   ๑  ・・・・',
      '_ _',
      '_ _       <:00_candybar:1562793451223916695>  —  𝓞rder  𝓓etails',
      `_ _ ➠  buyer  :  <@${user.id}>`,
      '_ _',
      `_ _ ⚬  item  :  ${items}`,
      `_ _ ⚬  date vouched  :  ${date}`,
      `_ _ ⚬  time vouched  :  ${time}`,
      `_ _ ⚬  feedback  :  ${feedback}`,
      '_ _ ⚬  proof  :  see the attached image.',
      '_ _',
      '_ _ ・・・・  ๑   <a:hearts7:1562814717481844808>   ๑  ・・・・',
    ].join('\n'));
}

function warrantyActivatedContainer(user, items, vouchedAt = new Date()) {
  const date = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
    timeZoneName: 'short',
  }).format(vouchedAt).replace('GMT+8', 'PHT (UTC+8)');
  const userId = user?.id ?? 'unknown';
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      '### _ _             warranty  activated   <:0cpink_bow:1562803659190829126>',
      '_ _',
      '_ _ ⚬  applied  only  to  ntro, prems, and svb.',
      '_ _ ⚬  you  may  ignore  this if you purchased',
      '_ _ dc   items.',
      '_ _ ⚬  present this if your item gets revoked.',
      '_ _',
      '-# _ _ deleting   this   message   will   automatically',
      '-# _ _ void    the    warranty.',
      '_ _',
      '_ _ ─ ─ ─ ─ ─ ─ ─ ─ ─    ⪩𓋰⪨    ─ ─ ─ ─ ─ ─ ─ ─ ─',
      '_ _',
      '_ _  __order details__  <:00_treat:1562793410157613156>',
      '_ _',
      `_ _ ꒰ buyer ꒱  :  <@${userId}>`,
      `_ _ ꒰ item ꒱  :  ${items}`,
      `_ _ ꒰ date vouched ꒱  :  ${date}`,
      '_ _ ꒰ proof ꒱  :',
    ].join('\n')))
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL('attachment://vouch-proofs.png'),
    ));
}

function orderCompletionReminderEmbed() {
  return new EmbedBuilder()
    .setDescription([
      '_ _',
      '_ _   __reminders__  :  **wαrrαnty  policy !!**  <:e_bread:1562794379796684890>',
      '_ _',
      '_ _ ⚬ all  completed  orders  come  with a 12',
      '_ _ hours   warranty.',
      '_ _ ⚬ replacements   will  only   be   provided',
      '_ _ for  verified  issues  covered by warranty.',
      '_ _ ⚬ once  warranty  is  expired,  the shop is',
      '_ _ no  longer responsible for issues covered',
      '_ _ by   the   expired   warranty.',
      '_ _ ⚬ **NO  VOUCH**  =  no  refund  and item will',
      '_ _ not   be   provided   with   a   replacement.',
      '_ _ warranty   will   also   be   voided.',
      '_ _ ⚬ type  __/vouch__  to vouch  **𝓓olce 𝓥ita** !',
      '_ _',
    ].join('\n'));
}

function paymentDetailsEmbed() {
  return new EmbedBuilder()
    .setColor(0x3478c7)
    .setDescription('**🧁 payment method: gcash**\ngcash initials: H. C. S.\ngcash number: `09639298459`\npls send screenshot of the receipt, ty!')
    .setThumbnail('attachment://gcash-payment.png');
}

function paymentReminderButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('payment:yes')
      .setLabel('pay')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('payment:no')
      .setLabel('no')
      .setStyle(ButtonStyle.Danger),
  );
}

function vouchPreviewButtons(previewId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vouch-preview:confirm:${previewId}`)
      .setLabel('Confirm vouch')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`vouch-preview:change:${previewId}`)
      .setLabel("No, I'll change it")
      .setStyle(ButtonStyle.Secondary),
  );
}

function orderButtons(order) {
  const active = ['pending', 'claimed'].includes(order.status);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`order:processing:${order.id}`)
      .setLabel('processing')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!active || order.processingStatus === 'processing'),
    new ButtonBuilder()
      .setCustomId(`order:complete:${order.id}`)
      .setLabel('complete')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!active),
    new ButtonBuilder()
      .setCustomId(`order:cancel:${order.id}`)
      .setLabel('cancelled')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!active),
  );
}

function queueEmbed(orders) {
  const embed = new EmbedBuilder()
    .setColor(0x3478c7)
    .setTitle('Dolce Vita Order Queue')
    .setDescription(orders.length ? `${orders.length} active order${orders.length === 1 ? '' : 's'}` : 'There are no active orders.');

  for (const order of orders.slice(0, 25)) {
    embed.addFields({
      name: `#${orderReference(order)} - ${LABELS[order.status]} ${order.sourceChannelId ? `<#${order.sourceChannelId}>` : 'Not recorded'}`,
      value: `${order.items ?? order.item} - quantity: ${order.quantity ?? 1}\nprepared by: ${order.preparedById ? `<@${order.preparedById}>` : 'Not recorded'}\nBuyer: <@${order.customerId}>`,
      inline: false,
    });
  }
  if (orders.length > 25) embed.setFooter({ text: 'Showing the first 25 active orders.' });
  return embed;
}

function queueConfirmationMessage(order) {
  return orderQueueText(order);
}

function dmsOrderMessage(orders) {
  return [
    '_ _',
    '## _ _  (  <:purplecandy:1557485716223828088>  )   Dolce Vita !',
    '_ _ ════════════════════════',
    '',
    ...orders.map(({ item, link }) => `_ _     (${item}) - (||${link}||)`),
    '',
    '_ _ ════════════════════════',
    '_ _  ',
    '_ _  ⧽  no   vouch   =   no   warranty / regen',
    '_ _  ⧽  link        invalid        =        no      regen',
    '_ _  ⧽  failure   to   vouch  correctly  within',
    '_ _        12        hours         voids        warranty',
    '',
    '_ _       tysm for buying!',
    '_ _',
  ].join('\n');
}

function helpEmbed(commands) {
  const lines = ['## Slash commands'];
  for (const command of commands) {
    const subcommands = command.options?.filter((option) => option.type === 1) ?? [];
    if (subcommands.length) {
      for (const subcommand of subcommands) {
        lines.push(`**/${command.name} ${subcommand.name}** — ${subcommand.description}`);
      }
      continue;
    }

    const options = command.options?.map((option) => (
      option.required ? `<${option.name}>` : `[${option.name}]`
    )) ?? [];
    lines.push(`**/${command.name}${options.length ? ` ${options.join(' ')}` : ''}** — ${command.description}`);
  }
  lines.push('', '## Message shortcuts');
  lines.push('**,calc <number>*<number>** — Multiply two numbers, then automatically delete the command message.');
  lines.push('', '## Ticket notes');
  lines.push('Claimed tickets can be unclaimed only by the current claimant, allowing another authorized staff member to claim the ticket.');
  lines.push('Ticket close actions require a reason, post it in the transcript, then automatically delete the ticket channel.');

  return new EmbedBuilder()
    .setColor(0x3478c7)
    .setTitle('Bot Commands')
    .setDescription(lines.join('\n'));
}

function ticketPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:order')
      .setLabel('order')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:report')
      .setLabel('report')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:others')
      .setLabel('others')
      .setStyle(ButtonStyle.Secondary),
  );
}

function orderTicketModal() {
  return new ModalBuilder()
    .setCustomId('ticket:order-form')
    .setTitle('ORDER FORM')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-product')
          .setLabel('PRODUCT')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(1024)
          .setPlaceholder('DEKOR / BOBUX / SVBOWCH / PREMS / NAYTRO / GCRED1TS'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-price')
          .setLabel('PRICE')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setPlaceholder('e.g. ₱ 100'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-quantity')
          .setLabel('QUANTITY')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(4)
          .setPlaceholder('1-9999'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-payment-method')
          .setLabel('PAYMENT METHOD')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(1024)
          .setPlaceholder('GCASH / BANKTRANS / PAYMAYA'),
      ),
    );
}

function reportTicketModal() {
  return new ModalBuilder()
    .setCustomId('ticket:report-form')
    .setTitle('REPORT FORM')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-report-product')
          .setLabel('WHAT IS THE PRODUCT YOU BOUGHT?')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(1024),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-report-issue')
          .setLabel('WHAT IS THE ISSUE ABOUT IT?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1024),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-report-rules')
          .setLabel('DID YOU READ THE RULES?')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
    );
}

function othersTicketModal() {
  return new ModalBuilder()
    .setCustomId('ticket:others-form')
    .setTitle('PARTNERSHIP / CONCERN')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-others-message')
          .setLabel('PARTNERSHIP / CONCERN')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder('Type PARTNERSHIP or CONCERN'),
      ),
    );
}

function ticketOrderText(orderForm) {
  return [
    '## _ _ σrd𝚎r⸺tιck𝚎t   ( <:pink_phone:1562813781996998656> )',
    '_ _ hello! a staff member will be with',
    '_ _ you   shortly.  please   don’t  spam',
    '_ _ pings,   and   strictly   no   rushing.',
    '_ _',
    '_ _ <:sweets_candy:1561070771093119106>  —  **order  details  !**',
    '_ _',
    `_ _ \` product  \`  :  ${orderForm.product}`,
    `_ _ \`  price   \`  :  ${orderForm.price}`,
    `_ _ \` quantity \`  :  ${orderForm.quantity}`,
    `_ _ \`   mop    \`  :  ${orderForm.paymentMethod}`,
    '_ _',
  ].join('\n');
}

function ticketEmbed(type, user, orderForm, reportForm, othersForm) {
  const embed = new EmbedBuilder()
    .setColor(0x3478c7)
    .setTitle(`${type.toUpperCase()} TICKET`)
    .setDescription(`Hello <@${user.id}>. A staff member will be with you shortly.`);

  if (reportForm) {
    embed.addFields(
      { name: 'WHAT IS THE PRODUCT YOU BOUGHT?', value: reportForm.product },
      { name: 'WHAT IS THE ISSUE ABOUT IT?', value: reportForm.issue },
      { name: 'DID YOU READ THE RULES?', value: reportForm.readRules },
    );
  }
  if (othersForm) {
    embed.addFields({ name: 'PARTNERSHIP / CONCERN', value: othersForm.type });
  }
  return embed;
}

function ticketButtons(claimed = false) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel(claimed ? 'Claimed' : 'Claim Ticket')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(claimed),
  ];
  if (claimed) {
    buttons.push(new ButtonBuilder()
      .setCustomId('ticket:unclaim')
      .setLabel('Unclaim Ticket')
      .setStyle(ButtonStyle.Secondary));
  }
  buttons.push(new ButtonBuilder()
    .setCustomId('ticket:close')
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger));
  return new ActionRowBuilder().addComponents(...buttons);
}

function ticketCloseConfirmationEmbed(channel) {
  return new EmbedBuilder()
    .setColor(0xe6a23c)
    .setTitle('Confirm Ticket Closure')
    .setDescription(`Are you sure you want to close ${channel}?`);
}

function ticketCloseConfirmationButtons(confirmationId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket-close:confirm:${confirmationId}`)
      .setLabel('Confirm Close')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket-close:cancel:${confirmationId}`)
      .setLabel("No, don't close")
      .setStyle(ButtonStyle.Secondary),
  );
}

function ticketCloseReasonModal(confirmationId) {
  return new ModalBuilder()
    .setCustomId(`ticket-close-reason:${confirmationId}`)
    .setTitle('Ticket Closure Reason')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket-close-reason')
          .setLabel('Why are you closing this ticket?')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setPlaceholder('Enter the reason for closing this ticket'),
      ),
    );
}

function dmsOrderFormModal(formId, startItemNumber = 1) {
  const pairCount = Math.min(2, 6 - startItemNumber);
  const itemNumbers = Array.from({ length: pairCount }, (_, index) => startItemNumber + index);
  return new ModalBuilder()
    .setCustomId(`dmsorder:form:${formId}:${startItemNumber}`)
    .setTitle('DOLCE VITA ORDER DM')
    .addLabelComponents(...itemNumbers.flatMap((itemNumber, index) => [
      new LabelBuilder({
        label: `ITEM ${itemNumber}`,
        component: new TextInputBuilder()
          .setCustomId(`item${itemNumber}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter item name')
          .setMaxLength(200)
          .setRequired(index === 0),
      }),
      new LabelBuilder({
        label: `LINK ${itemNumber}`,
        component: new TextInputBuilder()
          .setCustomId(`link${itemNumber}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://example.com/order')
          .setMaxLength(1024)
          .setRequired(index === 0),
      }),
    ]));
}

function dmsOrderFormButtons(formId, nextItemNumber) {
  const buttons = [];
  if (nextItemNumber <= 5) {
    buttons.push(new ButtonBuilder()
      .setCustomId(`dmsorder:next:${formId}:${nextItemNumber}`)
      .setLabel(`Add item${nextItemNumber === 3 ? 's 3–4' : ' 5'}`)
      .setStyle(ButtonStyle.Primary));
  }
  buttons.push(new ButtonBuilder()
    .setCustomId(`dmsorder:send:${formId}`)
    .setLabel('Send order DM')
    .setStyle(ButtonStyle.Success));
  return new ActionRowBuilder().addComponents(...buttons);
}

function ticketTranscriptEmbed({
  channelId,
  createdAt,
  ownerId,
  closedById,
  claimedById,
  reason = 'done',
}) {
  return new EmbedBuilder()
    .setColor(0x3478c7)
    .setTitle('Ticket Closed')
    .addFields(
      { name: '🔢 Ticket ID', value: channelId, inline: true },
      { name: '✅ Opened By', value: `<@${ownerId}>`, inline: true },
      { name: '🔒 Closed By', value: `<@${closedById}>`, inline: true },
      { name: '🕒 Open Time', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:f>`, inline: true },
      { name: '🟣 Claimed By', value: claimedById ? `<@${claimedById}>` : 'Unclaimed', inline: true },
      { name: '❔ Reason', value: reason, inline: true },
    )
    .setTimestamp();
}

module.exports = {
  orderButtons,
  orderContainer,
  orderMessagePayload,
  orderStatusText,
  voidedOrderMessage,
  tipMessage,
  orderCompletionReminderEmbed,
  multiplicationContainer,
  robuxFormContainer,
  robuxAvailabilityMessage,
  openShopContainer,
  closeShopContainer,
  giveawayContainer,
  paymentReminderContainer,
  vouchEmbed,
  warrantyActivatedContainer,
  paymentDetailsEmbed,
  paymentReminderButtons,
  orderTicketTermsContainer,
  vouchLinkButton,
  vouchReminderContainer,
  vouchFormModal,
  vouchPreviewButtons,
  orderTicketModal,
  othersTicketModal,
  helpEmbed,
  queueEmbed,
  queueConfirmationMessage,
  SHOP_ANNOUNCEMENT_ROLE_ID,
  dmsOrderMessage,
  dmsOrderFormModal,
  dmsOrderFormButtons,
  reportTicketModal,
  ticketButtons,
  ticketCloseConfirmationEmbed,
  ticketCloseConfirmationButtons,
  ticketCloseReasonModal,
  ticketOrderText,
  ticketEmbed,
  ticketPanelButtons,
  ticketTranscriptEmbed,
};