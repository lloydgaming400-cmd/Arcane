// ═══════════════════════════════════════════════════════════════
//   HANDLER ADDITIONS — PARTS 6, 7, 8
//   Add these imports at the top of handler.js
//   Add these cases inside your switch(command) or if/else chain
// ═══════════════════════════════════════════════════════════════

// ─── ADD THESE IMPORTS AT THE TOP OF handler.js ─────────────────

import { cmdInventory, cmdInspect, cmdDrop, cmdUse }
  from './plugins/rpg-inventory.js'

import { cmdEquip, cmdUnequip, cmdEquipment }
  from './plugins/rpg-equip.js'

import { cmdShop, cmdShopView, cmdBuy, cmdSell }
  from './plugins/rpg-shop.js'

import {
  cmdMarket, cmdList, cmdMktbuy, cmdMyListings, cmdUnlist
} from './plugins/rpg-market.js'

import { cmdBank, cmdDeposit, cmdWithdraw }
  from './plugins/rpg-bank.js'

import { cmdLoan, cmdRepay }
  from './plugins/rpg-loan.js'

import { cmdRob }
  from './plugins/rpg-rob.js'

import { cmdTrade, cmdAccept, cmdDecline, cmdSendGold }
  from './plugins/rpg-trade.js'

import {
  cmdPartyCreate, cmdPartyInvite, cmdPartyJoin,
  cmdPartyLeave, cmdPartyInfo, cmdPartyKick
} from './plugins/rpg-party.js'

import {
  cmdGuildCreate, cmdGuildJoin, cmdGuildLeave,
  cmdGuildInfo, cmdGuildMembers, cmdGuildDeposit,
  cmdGuildUpgrade, cmdGuildRank, cmdGuildWar, cmdGuildDisband
} from './plugins/rpg-guild.js'

import {
  cmdQuestList, cmdQuest, cmdQuestAccept, cmdQuestComplete
} from './plugins/rpg-quest.js'

import { cmdJobs, cmdJobApply, cmdWork, cmdJobResign }
  from './plugins/rpg-jobs.js'


// ─── ADD THESE CASES INSIDE YOUR COMMAND HANDLER ────────────────
// (replace the old stub cases with these)

// === PART 6: ITEMS & SHOP ===
case 'inventory':
case 'inv':
  return cmdInventory(ctx)

case 'inspect':
  return cmdInspect(ctx)

case 'drop':
  return cmdDrop(ctx)

case 'use':
  return cmdUse(ctx)

case 'equip':
  return cmdEquip(ctx)

case 'unequip':
  return cmdUnequip(ctx)

case 'equipment':
case 'gear':
  return cmdEquipment(ctx)

case 'shop':
  // If they typed a shop name after "!shop", view that shop
  if (ctx.args?.length) return cmdShopView(ctx)
  return cmdShop(ctx)

case 'buy':
  return cmdBuy(ctx)

case 'sell':
  return cmdSell(ctx)

case 'market':
  return cmdMarket(ctx)

case 'list':
  return cmdList(ctx)

case 'mktbuy':
  return cmdMktbuy(ctx)

case 'mylistings':
  return cmdMyListings(ctx)

case 'unlist':
  return cmdUnlist(ctx)


// === PART 7: ECONOMY ===
case 'bank':
  return cmdBank(ctx)

case 'deposit':
  return cmdDeposit(ctx)

case 'withdraw':
  return cmdWithdraw(ctx)

case 'loan':
  return cmdLoan(ctx)

case 'repay':
  return cmdRepay(ctx)

case 'rob':
  return cmdRob(ctx)

case 'trade':
  return cmdTrade(ctx)

case 'accept':
  return cmdAccept(ctx)

case 'decline':
  return cmdDecline(ctx)

case 'sendgold':
case 'give':
  return cmdSendGold(ctx)


// === PART 8: SOCIAL ===
case 'party':
  const subCmd = ctx.args?.[0]?.toLowerCase()
  if (subCmd === 'create')                  return cmdPartyCreate(ctx)
  if (subCmd === 'invite')                  return cmdPartyInvite(ctx)
  if (subCmd === 'join')                    return cmdPartyJoin(ctx)
  if (subCmd === 'leave')                   return cmdPartyLeave(ctx)
  if (subCmd === 'info' || !subCmd)         return cmdPartyInfo(ctx)
  if (subCmd === 'kick')                    return cmdPartyKick(ctx)
  return ctx.reply('❓ Usage: *!party [create/invite/join/leave/info/kick]*')

case 'guild':
  const gSub = ctx.args?.[0]?.toLowerCase()
  ctx.args = ctx.args?.slice(1) // remove subcommand from args
  if (gSub === 'create')   return cmdGuildCreate(ctx)
  if (gSub === 'join')     return cmdGuildJoin(ctx)
  if (gSub === 'leave')    return cmdGuildLeave(ctx)
  if (gSub === 'info')     return cmdGuildInfo(ctx)
  if (gSub === 'members')  return cmdGuildMembers(ctx)
  if (gSub === 'deposit')  return cmdGuildDeposit(ctx)
  if (gSub === 'upgrade')  return cmdGuildUpgrade(ctx)
  if (gSub === 'rank')     return cmdGuildRank(ctx)
  if (gSub === 'war')      return cmdGuildWar(ctx)
  if (gSub === 'disband')  return cmdGuildDisband(ctx)
  return ctx.reply('❓ Usage: *!guild [create/join/leave/info/members/deposit/upgrade/rank/war/disband]*')

case 'questlist':
  return cmdQuestList(ctx)

case 'quest':
  return cmdQuest(ctx)

case 'questaccept':
  return cmdQuestAccept(ctx)

case 'questcomplete':
  return cmdQuestComplete(ctx)

case 'jobs':
  return cmdJobs(ctx)

case 'jobapply':
  return cmdJobApply(ctx)

case 'work':
  return cmdWork(ctx)

case 'jobresign':
  return cmdJobResign(ctx)
