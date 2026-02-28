// ═══════════════════════════════════════════════
//       🤝  RPG PARTY SYSTEM — PART 8
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer, getDB } from '../lib/database.js'

// In-memory party data (resets on restart; you could persist if needed)
const parties = {}      // partyId → { id, leader, members[], invites[] }
const playerParty = {}  // senderId → partyId

let partyCounter = 1

function makePartyId() { return `party_${partyCounter++}` }

function getPartyOf(playerId) {
  const pid = playerParty[playerId]
  return pid ? parties[pid] : null
}

function disbandParty(partyId) {
  const party = parties[partyId]
  if (!party) return
  for (const memberId of party.members) {
    const p = getPlayer(memberId)
    if (p) { p.party = null; savePlayer(p) }
    delete playerParty[memberId]
  }
  delete parties[partyId]
}

// ── !party create ─────────────────────────────────
export async function cmdPartyCreate(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (player.inDungeon) return ctx.reply('⚠️ Exit the dungeon first.')

  if (getPartyOf(ctx.sender)) {
    return ctx.reply('⚠️ You\'re already in a party! Leave first with *!party leave*.')
  }

  const partyId = makePartyId()
  parties[partyId] = {
    id: partyId,
    leader: ctx.sender,
    leaderName: player.name,
    members: [ctx.sender],
    invites: [],
    createdAt: Date.now(),
  }
  playerParty[ctx.sender] = partyId
  player.party = partyId
  await savePlayer(player)

  await ctx.reply(
    `⚔️ *Party Created!*\n\n` +
    `👑 Leader: *${player.name}*\n` +
    `👥 Members: 1/4\n` +
    `🆔 Party ID: \`${partyId}\`\n\n` +
    `Invite others with *!party invite @player*\n` +
    `Then enter a dungeon together with *!partydungeon*`
  )
}

// ── !party invite @player ─────────────────────────
export async function cmdPartyInvite(ctx) {
  const leader = getPlayer(ctx.sender)
  if (!leader) return ctx.reply('❌ Not registered.')

  const party = getPartyOf(ctx.sender)
  if (!party) return ctx.reply('❌ You\'re not in a party. Create one with *!party create*')
  if (party.leader !== ctx.sender) return ctx.reply('❌ Only the party leader can invite!')
  if (party.members.length >= 4) return ctx.reply('⚠️ Party is full! Max 4 members.')

  const targetId = ctx.mentions?.[0]
  if (!targetId) return ctx.reply('❓ Usage: *!party invite @player*')
  if (targetId === ctx.sender) return ctx.reply('🤦 You\'re already the leader...')

  const target = getPlayer(targetId)
  if (!target) return ctx.reply('❌ That player is not registered.')
  if (getPartyOf(targetId)) return ctx.reply(`❌ *${target.name}* is already in a party.`)
  if (party.invites.includes(targetId)) return ctx.reply(`📨 Already invited *${target.name}*!`)

  party.invites.push(targetId)

  await ctx.reply(
    `📨 *Party Invite Sent!*\n\n` +
    `👑 Leader: *${leader.name}*\n` +
    `📩 Invited: *${target.name}*\n\n` +
    `@${targetId.split('@')[0]} — Use *!party join* to accept!`
  )
}

// ── !party join ───────────────────────────────────
export async function cmdPartyJoin(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (getPartyOf(ctx.sender)) return ctx.reply('⚠️ Leave your current party first with *!party leave*')

  // Find party that invited them
  const partyId = Object.keys(parties).find(id => parties[id].invites.includes(ctx.sender))
  if (!partyId) return ctx.reply('❌ You don\'t have a pending party invite.\n_Ask the party leader to invite you first!_')

  const party = parties[partyId]
  if (party.members.length >= 4) {
    party.invites = party.invites.filter(id => id !== ctx.sender)
    return ctx.reply('⚠️ Sorry, that party is now full!')
  }

  party.invites = party.invites.filter(id => id !== ctx.sender)
  party.members.push(ctx.sender)
  playerParty[ctx.sender] = partyId
  player.party = partyId
  await savePlayer(player)

  const memberNames = party.members
    .map(id => getPlayer(id)?.name || id)
    .join(', ')

  await ctx.reply(
    `🎉 *Joined Party!*\n\n` +
    `👑 Leader: *${party.leaderName}*\n` +
    `👥 Members (${party.members.length}/4): ${memberNames}\n\n` +
    `Get ready for the dungeon! 🗡️`
  )
}

// ── !party leave ──────────────────────────────────
export async function cmdPartyLeave(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const party = getPartyOf(ctx.sender)
  if (!party) return ctx.reply('❌ You\'re not in a party.')

  if (player.inDungeon) return ctx.reply('⚠️ You can\'t leave while in a dungeon!')

  const wasLeader = party.leader === ctx.sender

  if (wasLeader && party.members.length > 1) {
    // Transfer leadership
    party.members = party.members.filter(id => id !== ctx.sender)
    party.leader = party.members[0]
    const newLeader = getPlayer(party.leader)
    party.leaderName = newLeader?.name || party.leader
    delete playerParty[ctx.sender]
    player.party = null
    await savePlayer(player)
    await ctx.reply(
      `👋 *${player.name}* left the party.\n` +
      `👑 New leader: *${party.leaderName}*`
    )
  } else if (wasLeader) {
    // Only member — disband
    disbandParty(party.id)
    await ctx.reply(`🔴 Party disbanded — you were the only member.`)
  } else {
    party.members = party.members.filter(id => id !== ctx.sender)
    delete playerParty[ctx.sender]
    player.party = null
    await savePlayer(player)
    await ctx.reply(`👋 *${player.name}* left the party.`)
  }
}

// ── !party info ───────────────────────────────────
export async function cmdPartyInfo(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const party = getPartyOf(ctx.sender)
  if (!party) return ctx.reply('❌ You\'re not in a party.\n_Create one with *!party create*_')

  let msg = `⚔️ *PARTY INFO*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  msg += `👑 Leader: *${party.leaderName}*\n`
  msg += `👥 Members: *${party.members.length}/4*\n\n`

  for (const memberId of party.members) {
    const m = getPlayer(memberId)
    if (!m) continue
    const isLeader = memberId === party.leader ? ' 👑' : ''
    const hpBar = Math.round((m.hp / m.maxHp) * 10)
    const hpVis = '█'.repeat(hpBar) + '░'.repeat(10 - hpBar)
    msg += `${isLeader ? '👑' : '🗡️'} *${m.name}* (Lv.${m.level} ${m.class})${isLeader}\n`
    msg += `   ❤️ [${hpVis}] ${m.hp}/${m.maxHp}\n`
    msg += `   ⚔️${m.str} 💨${m.agi} 🔮${m.int} 🛡️${m.def}\n\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `*!party invite @player* — Invite\n`
  msg += `*!party leave* — Leave party\n`
  msg += `*!partydungeon* — Enter dungeon together`

  await ctx.reply(msg)
}

// ── !party kick @player ───────────────────────────
export async function cmdPartyKick(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const party = getPartyOf(ctx.sender)
  if (!party) return ctx.reply('❌ Not in a party.')
  if (party.leader !== ctx.sender) return ctx.reply('❌ Only the leader can kick members.')

  const targetId = ctx.mentions?.[0]
  if (!targetId || targetId === ctx.sender) return ctx.reply('❓ Usage: *!party kick @player*')

  if (!party.members.includes(targetId)) return ctx.reply('❌ That player is not in your party.')

  const target = getPlayer(targetId)
  party.members = party.members.filter(id => id !== targetId)
  delete playerParty[targetId]
  if (target) { target.party = null; await savePlayer(target) }

  await ctx.reply(`🥾 *${target?.name || 'Player'}* has been kicked from the party.`)
}

// Export party utility for dungeon system
export { getPartyOf, parties, playerParty }
