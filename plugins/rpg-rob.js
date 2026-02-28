// ═══════════════════════════════════════════════
//       🥷  RPG ROB SYSTEM — PART 7
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'
import { checkCooldown, setCooldown } from '../lib/cooldown.js'

const ROB_COOLDOWN_MS = 3600000 // 1 hour
const ROB_SUCCESS_STEAL = 0.15  // steal 15% of victim's hand gold on success
const ROB_FAIL_PENALTY  = 0.10  // lose 10% of your hand gold on fail
const ROB_JAIL_TIME_MS  = 1800000 // 30 min jail on fail

// ── !rob @player ─────────────────────────────────
export async function cmdRob(ctx) {
  const robber = getPlayer(ctx.sender)
  if (!robber) return ctx.reply('❌ Not registered.')

  if (robber.inDungeon) return ctx.reply('⚠️ You are in a dungeon!')
  if (robber.inBattle)  return ctx.reply('⚠️ You are in battle!')

  // Jail check
  if (robber.jailUntil && Date.now() < robber.jailUntil) {
    const remaining = Math.ceil((robber.jailUntil - Date.now()) / 60000)
    return ctx.reply(
      `⛓️ *YOU'RE IN JAIL!*\n\n` +
      `You got caught last time and are locked up.\n` +
      `Release in: *${remaining} minute(s)*\n\n` +
      `_Do the crime, do the time._ 😂`
    )
  }

  // Cooldown
  const cd = checkCooldown(ctx.sender, 'rob', ROB_COOLDOWN_MS)
  if (cd.onCooldown) {
    return ctx.reply(`⏳ You need to lay low for a bit!\n_Rob cooldown: ${cd.remaining} remaining_`)
  }

  // Get target from mention or name
  const mentionedId = ctx.mentions?.[0] || null
  if (!mentionedId) return ctx.reply('❓ Usage: *!rob @player*\nTag the person you want to rob!')

  if (mentionedId === ctx.sender) return ctx.reply('🤦 You tried to rob yourself... interesting strategy.')

  const victim = getPlayer(mentionedId)
  if (!victim) return ctx.reply('❌ That player is not registered.')
  if (victim.inDungeon) return ctx.reply('⚠️ Can\'t rob someone who\'s in a dungeon!')

  if (victim.gold < 50) {
    return ctx.reply(
      `💸 *${victim.name}* is basically broke! (${victim.gold}G on hand)\n` +
      `_Not worth the risk, skip this one._`
    )
  }

  // Check level difference — can't rob someone more than 20 levels below you
  if (robber.level - victim.level > 20) {
    return ctx.reply(`🛡️ *${victim.name}* is way below your level. Pick on someone your own size!`)
  }

  setCooldown(ctx.sender, 'rob')

  // Calculate success chance
  // Base 50% + AGI bonus vs victim's LCK
  const robberAgi  = robber.agi || 10
  const victimLck  = victim.lck || 10
  const successChance = Math.min(85, Math.max(20, 50 + (robberAgi - victimLck) * 0.5))
  const roll = Math.random() * 100

  if (roll <= successChance) {
    // SUCCESS
    const stolen = Math.max(1, Math.floor(victim.gold * ROB_SUCCESS_STEAL))
    victim.gold -= stolen
    robber.gold += stolen

    // Add to kill/rob count for titles
    if (!robber.killCounts) robber.killCounts = {}
    robber.killCounts.robberies = (robber.killCounts.robberies || 0) + 1

    await savePlayer(robber)
    await savePlayer(victim)

    const robberies = robber.killCounts.robberies
    let titleHint = ''
    if (robberies === 50) titleHint = `\n\n🏆 *Title Unlocked: "The Bandit"!*`
    else if (robberies === 10) titleHint = `\n\n📊 Robberies: *${robberies}/50* (earn "The Bandit" title at 50)`

    await ctx.reply(
      `🥷 *ROB SUCCESSFUL!*\n\n` +
      `${robber.name} snuck up on *${victim.name}* in the shadows...\n\n` +
      `💰 Stolen: *${stolen.toLocaleString()}G*\n` +
      `${robber.name}'s Gold: *${robber.gold.toLocaleString()}G*\n\n` +
      `😤 @${mentionedId.split('@')[0]} you've been robbed!` +
      titleHint
    )
  } else {
    // FAIL
    const penalty = Math.max(1, Math.floor(robber.gold * ROB_FAIL_PENALTY))
    robber.gold = Math.max(0, robber.gold - penalty)
    robber.jailUntil = Date.now() + ROB_JAIL_TIME_MS

    await savePlayer(robber)

    await ctx.reply(
      `🚔 *CAUGHT RED-HANDED!*\n\n` +
      `*${victim.name}* caught ${robber.name} trying to pick their pockets!\n\n` +
      `💸 Fine paid: *${penalty.toLocaleString()}G*\n` +
      `⛓️ *Jailed for 30 minutes!*\n\n` +
      `_Next time, wait for a lower-LCK target._ 😂`
    )
  }
}
