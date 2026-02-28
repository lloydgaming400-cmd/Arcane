// ═══════════════════════════════════════════════════════
//       🏆  YATORPHG — LEADERBOARD SYSTEM  🏆
// ═══════════════════════════════════════════════════════
import { getPlayer, getAllPlayers, getRankBadge } from '../lib/database.js'

function medalFor(i) {
  return ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][i] || `${i+1}.`
}

// ── !leaderboard ──────────────────────────────────────
export async function cmdLeaderboard(ctx) {
  const { senderNumber, reply } = ctx

  const allPlayers = getAllPlayers() || {}
  const sorted = Object.values(allPlayers)
    .filter(p => p && p.name)
    .sort((a, b) => b.level - a.level || b.exp - a.exp)
    .slice(0, 10)

  if (!sorted.length) {
    return reply(`🏆 *LEADERBOARD*\n\n_No players yet! Be the first to *!register*!_`)
  }

  const me = getPlayer(senderNumber)
  const myRank = me ? (Object.values(allPlayers)
    .filter(p => p?.name)
    .sort((a,b) => b.level - a.level || b.exp - a.exp)
    .findIndex(p => p.id === me.id) + 1) : null

  let msg = `🏆 *TOP PLAYERS — LEVEL*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (let i = 0; i < sorted.length; i++) {
    const p    = sorted[i]
    const badge = getRankBadge(p.rank || 'Peasant')
    const title = p.equippedTitle ? `_[${p.equippedTitle.replace(/_/g,' ')}]_` : ''
    msg += `${medalFor(i)} ${badge} *${p.name}* ${title}\n`
    msg += `    Lv.*${p.level}* | ${p.rank || 'Peasant'} | ${p.class || '?'}\n\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  if (me && myRank) {
    msg += `📍 Your rank: *#${myRank}* (Level ${me.level})\n`
  }
  msg += `👥 Total players: *${Object.keys(allPlayers).length}*\n`
  msg += `_Use *!goldrank* for the wealth leaderboard_`

  await reply(msg)
}

// ── !goldrank ─────────────────────────────────────────
export async function cmdGoldRank(ctx) {
  const { senderNumber, reply } = ctx

  const allPlayers = getAllPlayers() || {}
  const sorted = Object.values(allPlayers)
    .filter(p => p && p.name)
    .sort((a, b) => {
      const aTotal = (a.gold || 0) + (a.bankGold || 0)
      const bTotal = (b.gold || 0) + (b.bankGold || 0)
      return bTotal - aTotal
    })
    .slice(0, 10)

  if (!sorted.length) {
    return reply(`💰 *WEALTH LEADERBOARD*\n\n_No players yet!_`)
  }

  const me = getPlayer(senderNumber)

  let msg = `💰 *TOP PLAYERS — WEALTH*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (let i = 0; i < sorted.length; i++) {
    const p     = sorted[i]
    const total = (p.gold || 0) + (p.bankGold || 0)
    msg += `${medalFor(i)} *${p.name}*\n`
    msg += `    💰 *${total.toLocaleString()}G* (Hand: ${(p.gold||0).toLocaleString()}G | Bank: ${(p.bankGold||0).toLocaleString()}G)\n\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  if (me) {
    const myTotal = (me.gold || 0) + (me.bankGold || 0)
    msg += `📍 Your wealth: *${myTotal.toLocaleString()}G*\n`
  }
  msg += `_Use *!leaderboard* for the level leaderboard_`

  await reply(msg)
}
