# DolceVita Order Bot

A Discord bot for submitting orders, showing a public queue, and letting staff claim and close orders.

All bot message responses and posts use colorless Discord Components V2 containers. Modals remain Discord modals.

## Setup

1. Install Node.js 20 or newer, then run `npm install`.
2. Create a Discord application and bot in the [Discord Developer Portal](https://discord.com/developers/applications). Enable the `bot` and `applications.commands` scopes in its server install link. Enable the privileged **Message Content Intent** in the bot settings to use the `,calc` message command. The bot needs permission to view and send messages, embed links, manage channels and roles for private tickets, and use application commands.
3. Copy `.env.example` to `.env`, then fill in the bot token and application client ID. Commands are registered globally on startup. Set `DISCORD_GUILD_ID` to register them only in one development server and remove any global registrations, avoiding duplicate commands there. Remove `DISCORD_GUILD_ID` to register commands globally.
4. Run `npm run deploy`, invite the bot to your server, and start it with `npm start`.
5. An administrator runs `/setup channel:#orders`. Optionally choose a staff role; without one, staff actions require the Discord `Manage Messages` permission.

## Railway deployment

Set the Railway service root directory to the repository root and clear any custom start command so Railpack detects this root-level `package.json` and runs `npm start`. Do not configure a `start.sh` command; the app starts through the npm script. Set `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` in Railway's environment variables; `DISCORD_GUILD_ID` is optional. The bot stores its order data in `data/orders.json`; attach a persistent volume at `/app/data` to keep it across deployments.

## Commands

- `/order items:<items> payment_method:<method> supporter:<staff member> quantity:<quantity>` is staff-only; quantity is required and must be from 1 to 9999. Its Components V2 container shows the source channel, items with quantity, payment method, status, and the assigned supporter, with **processing**, **done**, and **cancelled** buttons inside the container. When submitted inside an order ticket, the ticket form's quantity is used. The customer is the ticket owner when `/order` is run inside a ticket; otherwise it is the staff member who submitted the order. New orders show **noted** until updated.
- Orders remain active for 48 hours after submission. Orders that are still pending or claimed at the end of that period expire and can no longer be processed, completed, or cancelled.
- When an order is marked **Processing**, **Complete**, or **Cancelled**, the bot sends a status-update embed both to the channel where `/order` was run and by DM to the order submitter.
- New order tickets automatically post Dolce Vita's terms of service. The ticket owner and ticket staff cannot send messages or claim the ticket until the owner selects **I agree to the terms**.
- When an order is marked **Complete**, the bot also sends the warranty-policy reminder to the original order channel and customer by DM. The DM's **Vouch now** button is bound to that order ticket and opens the vouch form for its owner. A vouch can only be submitted by the owner of that active order ticket, requires a completed order, and can be recorded only once per ticket.
- The role configured with `/set voided_role` is assigned to the order customer when an order is completed. Members with this role cannot open new order tickets. A vouch within 12 hours removes the role. If no vouch is recorded within 12 hours, the role remains assigned and the configured voided channel receives the warranty-void notice with the buyer, item, and reason.
- `/queue` posts the latest order confirmation for the active ticket owner in the current ticket, including the buyer, item, quantity, payment method, and staff member who ran `/order`. Run `/order` in the ticket before `/queue`. `/queuelist` displays active orders in submission order with quantity, preparer, and buyer.
- `/claim` lets authorized staff claim the oldest waiting order.
- `/payment` lets authorized staff send the payment reminder in an active ticket.
- `/solving amount_one:<number> amount_two:<number>` multiplies two numbers and displays the result.
- `,calc <number>*<number>` (for example, `,calc 5*5`) sends the result as `5 x 5 = 25` in a Discord Components V2 container, then deletes the command message. The bot needs the **Manage Messages** permission in that channel. The `/solving` slash command remains available.
- `/message text:<message> channel:<optional>` lets authorized staff post a message as the bot in the current or selected text channel, using a colorless Discord Components V2 container. Mentions are not triggered.
- `/robuxform` lets authorized staff post the Robux fill-up form in the current channel as a colorless Discord Components V2 container.
- `/robuxavail` lets authorized staff post the Robux Via Plus availability and price list in the current channel, with no extra command confirmation message.
- `/openshop` posts the shop-open announcement as a Discord Components V2 container in the current channel and mentions the shop announcement role.
- `/closeshop` posts the shop-closed announcement as a Discord Components V2 container in the current channel, with red “closed” text and blue bold section headings, and mentions the shop announcement role.
- `/dmsuser user:@user reply:<message>` lets authorized staff DM a user in a Discord Components V2 container. Mentions in the reply do not trigger notifications.
- `/dmsorder user:@user` is restricted to the role configured with `/setowner`. It opens a form with separate item and link fields. Add up to five pairs over a short, multi-step form, then send the buyer the formatted Dolce Vita order and warranty message. Links are spoiler-censored in the DM.
- `/set vouch channel:#vouches` lets an administrator choose where vouches are posted.
- `/set voidvouch channel:#channel` lets an administrator choose where customers with a closed, voided order can run `/vouch`; successful vouches are posted to the configured vouch channel and restore the shop-announcement role.
- `/tip channel channel:#tips` lets an administrator choose where tips are posted. Staff can run `/tip send amount:<amount>` inside a ticket to post the thank-you message for that ticket's owner.
- `/set voided_role role:<role>` configures the role assigned to the order customer when an order is completed. A vouch submitted within 12 hours removes the role and posts a notice in the order ticket.
- `/voidedchannel channel:#channel` configures where the warranty-void notice is sent after 12 hours without a vouch.
- `/set ticket_transcript channel:#transcripts` lets an administrator choose where closed ticket transcripts are posted. Closing a ticket posts a summary embed and attaches the complete conversation and attachment links as a text file in that channel only.
- `/setupticketcategory category_id:<category id>` sets the fallback category for new ticket channels.
- `/help` posts an embed with slash commands and the remaining `,calc` message command.
- `/vouch items:<items> feedback:<feedback> proof:<image> proof2:<optional image>` is available only to the owner of an active order ticket that has a completed order. The private preview includes the buyer, item, vouch date, feedback, and proof collage; confirming posts one embed publicly and records the ticket's single vouch. The buyer receives a warranty-activation DM with the buyer, item, UTC+8 vouch date, and proof collage, and the ticket is closed with its transcript; `/set ticket_transcript` must be configured. The **Vouch now** button in the buyer's order DM opens the same ticket-bound form. Choosing **No, I'll change it** cancels the preview without using the ticket's vouch. One or two proof images are combined into a single collage that preserves their proportions.
- `/checkvouch user:<optional>` displays a user's total vouches and their vouch dates/items. Omit the user to check your own history.
- `/giveaway start prize:<prize> host:<user> duration:<duration> winners:<count>` starts a colorless V2 giveaway container with a 🎉 join button in the current channel. Durations use `s`, `m`, `h`, or `d` (for example `30m` or `2d`). Optional `message_count` and `message_channel` require that many messages the bot has tracked since message tracking was enabled; if no channel is selected, the giveaway channel is used. `messagerequirements` adds displayed instructions; `override_req_roles` accepts up to 10 comma-separated role mentions or IDs and limits joining to members with one of those roles. The configured `/setadmin` and `/setowner` roles can manage giveaways.
- `/giveaway end message_id:<id>` ends a giveaway and randomly selects the configured number of winners. Giveaways end automatically at their duration, including after a bot restart. `/giveaway reroll message_id:<id>` chooses new winner(s) who were not selected previously. `/giveaway ban user:<user>` and `/giveaway banned` manage server-specific entry bans.
- `/giveaway reroll message_id:<id>` selects replacement winners from eligible entrants, excluding previous winners.
- `/giveaway ban user:<user>` prevents a user from joining any server giveaway; `/giveaway banned` lists all giveaway bans. Bans are server-specific.
- `/stickymessage set text:<message> channel:<optional>` keeps a message at the bottom of the chosen channel by reposting it after each new message. `/stickymessage remove channel:<optional>` clears it. Both actions require staff access.
- `/ticketsetup staff_role:<optional>` or `/ticket setup staff_role:<optional>` posts a panel in the current channel with **order**, **report**, and **others** buttons. Order opens an **ORDER FORM** for one product (**DEKOR**, **BOBUX**, **SVBOWCH**, **PREMS**, **NAYTRO**, or **GCRED1TS**), quantity from 1 to 9999, and payment method; report opens a **REPORT FORM** for the purchased product, issue, and rules confirmation; others asks the user to enter exactly **PARTNERSHIP** or **CONCERN** (case-insensitive) before creating a ticket. Each form creates its private ticket only after valid submission, and the answers appear in the ticket embed. Form tickets are named by button type, submitted product, and username (for example, `order-latte-alex`, `report-latte-alex`, or `others-partnership-concern-alex`). Discord channel names use the username rather than a real `@mention`. The configured `/setadmin` and `/setowner` roles can claim and close tickets, including tickets created by their members; the optional ticket staff role can view tickets but cannot claim or close them. After a claim, only the claimant (and ticket creator) can send messages, while other ticket-access roles can still view the ticket. Only the claimant can unclaim, which lets another authorized staff member take over. Closing a ticket requires confirmation and a reason, which is included in its transcript. The transcript is sent before the channel is deleted.
- `/setowner role:<role>` can only be run by the server owner. The selected role and server owner can use **Processing**, **Complete**, and **Cancel** buttons. The selected role can also claim and close tickets, including tickets created by its members. Closed orders leave the active queue.
- `/setadmin role:<role>` can be run by a server administrator and grants the selected role access to `/order`, `/claim`, and ticket claim/close actions, including closing tickets created by its members.
- `/setorder channel:#orders` can be run by a server administrator to choose where new order embeds are posted. Each order also shows the channel where `/order` was submitted.
- `/setup channel:<channel> staff_role:<optional>` changes the public order channel and staff role.

Order and server setup data are stored in `data/orders.json` at the repository root. Back up that file to preserve the queue between deployments.

Run `npm test` for the order-store checks.
