// ═══════════════════════════════════════════════════════
//       👑  YATORPHG — ADMIN PANEL  👑
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer, getAllPlayers, setWorldBoss } from '../lib/database.js'
import { spawnWorldBoss } from './rpg-boss.js'
import { startWorldBossScheduler } from '../lib/rpg-engine.js'

// ── !admin ────────────────────────────────────────────
export async function cmdAdmin(ctx) {
  const { senderNumber, isOwner, reply, args } = ctx

  if (!isOwner) {
    return reply(`❌ Admin commands are owner-only!`)
  }

  const sub = args[0]?.toLowerCase()

  if (!sub) {
    return reply(
`👑 *ADMIN PANEL*
━━━━━━━━━━━━━━━━━━━━━
*!admin give @player [amount]G* — Give gold
*!admin level @player [level]* — Set level
*!admin exp @player [amount]* — Add EXP
*!admin hp @player [amount]* — Set HP
*!admin additem @player [itemId]* — Add item
*!admin addsummon @player [id]* — Add summon
*!admin addtitle @player [id]* — Add title
*!admin spawnboss [id]* — Spawn world boss
*!admin killboss* — Remove world boss
*!admin stats* — Global stats
*!admin resetcooldowns @player* — Clear cooldowns
*!admin revive @player* — Revive dead player
*!admin wipe @player* — ⚠️ Delete a player
━━━━━━━━━━━━━━━━━━━━━`)
  }

  const targetMention = args[1]
  const value         = args[2]

  // Extract tagged number or use raw
  function getTargetNumber() {
    if (!targetMention) return null
    return targetMention.replace(/[@+\s]/g, '').replace(/[^0-9]/g,'')
  }

  if (sub === 'stats') {
    const all = getAllPlayers() || {}
    const count   = Object.keys(all).length
    const active  = Object.values(all).filter(p => Date.now() - (p.lastActive||0) < 86400000 * 7).length
    const highest = Object.values(all).sort((a,b) => b.level - a.level)[0]
    return reply(
`📊 *GLOBAL STATS*
━━━━━━━━━━━━━━━━━━━━━
👥 Total players: *${count}*
⚡ Active (7d): *${active}*
🏆 Highest level: *${highest?.name} — Lv.${highest?.level}*`)
  }

  if (sub === 'spawnboss') {
    const bossId = args[1]?.toLowerCase() || null
    await spawnWorldBoss(ctx.sock, ctx.jid, bossId)
    return reply(`✅ World boss spawned!`)
  }

  if (sub === 'killboss') {
    await setWorldBoss(null)
    return reply(`✅ World boss removed.`)
  }

  const targetNum = getTargetNumber()
  if (!targetNum && sub !== 'stats' && sub !== 'spawnboss' && sub !== 'killboss') {
    return reply(`❓ Tag the player!\nExample: *!admin give @player 5000G*`)
  }

  const target = targetNum ? getPlayer(targetNum) : null
  if (!target && targetNum) return reply(`❌ Player *${targetNum}* not found.`)

  if (sub === 'give') {
    const amount = parseInt(value) || 1000
    target.gold += amount
    await savePlayer(target)
    return reply(`✅ Gave *${amount.toLocaleString()}G* to *${target.name}*\nNew balance: ${target.gold.toLocaleString()}G`)
  }

  if (sub === 'level') {
    const lvl = Math.min(100, Math.max(1, parseInt(value) || 1))
    target.level = lvl
    await savePlayer(target)
    return reply(`✅ Set *${target.name}*'s level to *${lvl}*`)
  }

  if (sub === 'exp') {
    const amount = parseInt(value) || 100
    target.exp = (target.exp || 0) + amount
    await savePlayer(target)
    return reply(`✅ Added *${amount} EXP* to *${target.name}*`)
  }

  if (sub === 'hp') {
    const amount = Math.min(2000, Math.max(1, parseInt(value) || 100))
    target.hp = amount
    target.maxHp = Math.max(target.maxHp || 100, amount)
    await savePlayer(target)
    return reply(`✅ Set *${target.name}*'s HP to *${amount}*`)
  }

  if (sub === 'additem') {
    const itemId = args[2]
    if (!itemId) return reply(`❓ Usage: *!admin additem @player [itemId]*`)
    target.inventory = target.inventory || []
    target.inventory.push({ id: itemId, name: itemId.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), qty:1 })
    await savePlayer(target)
    return reply(`✅ Added *${itemId}* to *${target.name}*'s inventory.`)
  }

  if (sub === 'addsummon') {
    const summonId = args[2]
    if (!summonId) return reply(`❓ Usage: *!admin addsummon @player [summonId]*`)
    target.summons = target.summons || []
    if (!target.summons.includes(summonId)) target.summons.push(summonId)
    await savePlayer(target)
    return reply(`✅ Added summon *${summonId}* to *${target.name}*.`)
  }

  if (sub === 'addtitle') {
    const titleId = args[2]
    if (!titleId) return reply(`❓ Usage: *!admin addtitle @player [titleId]*`)
    target.titles = target.titles || []
    if (!target.titles.includes(titleId)) target.titles.push(titleId)
    await savePlayer(target)
    return reply(`✅ Added title *${titleId}* to *${target.name}*.`)
  }

  if (sub === 'revive') {
    target.hp = target.maxHp
    target.inBattle = false
    target.battleState = null
    target.inDungeon  = false
    target.inPvp      = false
    await savePlayer(target)
    return reply(`✅ Revived *${target.name}* at full HP.`)
  }

  if (sub === 'resetcooldowns') {
    // We don't store cooldowns on player object — they're in-memory per session
    // Just clear battle states
    target.inBattle   = false
    target.battleState = null
    target.inDungeon  = false
    target.inPvp      = false
    await savePlayer(target)
    return reply(`✅ Cleared battle/dungeon states for *${target.name}*.\n_In-memory cooldowns will reset on bot restart._`)
  }

  if (sub === 'wipe') {
    // Final confirmation: only if args[3] === 'CONFIRM'
    if (args[3] !== 'CONFIRM') {
      return reply(`⚠️ This will DELETE *${target.name}*'s data!\nTo confirm: *!admin wipe @player x CONFIRM*`)
    }
    const allPlayers = getAllPlayers()
    delete allPlayers[targetNum]
    // Need raw db access — import and write
    const { getDB } = await import('../lib/database.js')
    const db = getDB()
    if (db?.data?.players) {
      delete db.data.players[targetNum]
      await db.write()
    }
    return reply(`🗑️ Player *${target.name}* has been wiped.`)
  }

  await reply(`❓ Unknown admin command: *${sub}*\nUse *!admin* for the full list.`)
}
