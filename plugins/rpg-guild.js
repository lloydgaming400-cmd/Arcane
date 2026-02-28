// ═══════════════════════════════════════════════
//       🏰  RPG GUILD SYSTEM — PART 8
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer, createGuild, getGuild, getGuildByName, updateGuild, getDB } from '../lib/database.js'

const GUILD_CREATE_COST = 5000
const GUILD_UPGRADE_COSTS = { 1: 10000, 2: 25000, 3: 60000, 4: 150000 }
const GUILD_WAR_COST = 3000
const GUILD_MAX_MEMBERS = { 1: 20, 2: 30, 3: 40, 4: 45, 5: 50 }

const GUILD_LEVEL_PERKS = {
  1: 'Basic guild, 20 members max',
  2: '🛒 Guild shop unlocked, 30 members',
  3: '🗺️ Guild dungeon unlocked, 40 members',
  4: '⚡ Guild buff system, 45 members',
  5: '🐉 Guild boss spawn, 50 members + exclusive title',
}

// ── !guild create [name] ──────────────────────────
export async function cmdGuildCreate(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (player.guild) return ctx.reply('⚠️ You\'re already in a guild! Leave first with *!guild leave*.')

  const name = ctx.args?.join(' ')?.trim()
  if (!name || name.length < 3) return ctx.reply('❓ Usage: *!guild create [name]*\nMin 3 characters.')
  if (name.length > 30) return ctx.reply('❌ Guild name too long (max 30 chars).')

  if (player.gold < GUILD_CREATE_COST) {
    return ctx.reply(
      `❌ Creating a guild costs *${GUILD_CREATE_COST.toLocaleString()}G*!\n` +
      `You have: *${player.gold.toLocaleString()}G*\n\n` +
      `_Grind more, future guild master!_ 💪`
    )
  }

  // Check name taken
  const existing = getGuildByName(name)
  if (existing) return ctx.reply(`❌ A guild named "*${name}*" already exists!`)

  player.gold -= GUILD_CREATE_COST
  const guild = await createGuild(ctx.sender, name)
  player.guild = guild.id
  player.guildRole = 'master'
  await savePlayer(player)

  await ctx.reply(
    `🏰 *GUILD FOUNDED!*\n\n` +
    `⚔️ *${guild.name}*\n` +
    `👑 Guild Master: *${player.name}*\n` +
    `👥 Members: 1/${GUILD_MAX_MEMBERS[1]}\n` +
    `🏆 Level: 1\n\n` +
    `💰 Cost paid: *${GUILD_CREATE_COST.toLocaleString()}G*\n\n` +
    `Invite members with *!guild invite @player*\n` +
    `Upgrade with *!guild upgrade* (needs ${GUILD_UPGRADE_COSTS[1].toLocaleString()}G)`
  )
}

// ── !guild join [name] ────────────────────────────
export async function cmdGuildJoin(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (player.guild) return ctx.reply('⚠️ You\'re already in a guild!')

  const name = ctx.args?.join(' ')?.trim()
  if (!name) return ctx.reply('❓ Usage: *!guild join [guild name]*')

  const guild = getGuildByName(name)
  if (!guild) return ctx.reply(`❌ No guild named "*${name}*" found.`)

  const maxMembers = GUILD_MAX_MEMBERS[guild.level] || 20
  if (guild.members.length >= maxMembers) {
    return ctx.reply(`❌ *${guild.name}* is full! (${guild.members.length}/${maxMembers} members)`)
  }

  guild.members.push(ctx.sender)
  await updateGuild(guild.id, { members: guild.members })
  player.guild = guild.id
  player.guildRole = 'member'
  await savePlayer(player)

  await ctx.reply(
    `🏰 *Joined ${guild.name}!*\n\n` +
    `👥 Members: *${guild.members.length}/${maxMembers}*\n` +
    `🏆 Guild Level: *${guild.level}*\n\n` +
    `Use *!guild info* to see guild details!`
  )
}

// ── !guild leave ──────────────────────────────────
export async function cmdGuildLeave(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (!player.guild) return ctx.reply('❌ You\'re not in a guild.')

  const guild = getGuild(player.guild)
  if (guild && guild.owner === ctx.sender) {
    return ctx.reply('❌ *Guild Masters cannot leave!*\nTransfer ownership or disband the guild first.\n_(!guild disband to dissolve it)_')
  }

  if (guild) {
    guild.members = guild.members.filter(id => id !== ctx.sender)
    await updateGuild(guild.id, { members: guild.members })
  }

  const guildName = guild?.name || 'your guild'
  player.guild = null
  player.guildRole = null
  await savePlayer(player)

  await ctx.reply(`👋 *${player.name}* has left *${guildName}*.`)
}

// ── !guild info ───────────────────────────────────
export async function cmdGuildInfo(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  let guildId = player.guild
  if (ctx.args?.length) {
    const guild = getGuildByName(ctx.args.join(' '))
    if (guild) guildId = guild.id
  }

  if (!guildId) return ctx.reply('❌ You\'re not in a guild.\n_Create one with *!guild create [name]*_')

  const guild = getGuild(guildId)
  if (!guild) return ctx.reply('❌ Guild not found.')

  const owner = getPlayer(guild.owner)
  const maxMembers = GUILD_MAX_MEMBERS[guild.level] || 20

  let msg = `🏰 *${guild.name.toUpperCase()}*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  msg += `🏆 Level: *${guild.level}/5*\n`
  msg += `👑 Master: *${owner?.name || 'Unknown'}*\n`
  msg += `👥 Members: *${guild.members.length}/${maxMembers}*\n`
  msg += `🏦 Guild Bank: *${(guild.bank || 0).toLocaleString()}G*\n`
  msg += `⚔️ Wars Won: *${guild.wins || 0}* | Lost: *${guild.losses || 0}*\n\n`
  msg += `✨ *Perks:*\n└ ${GUILD_LEVEL_PERKS[guild.level]}\n\n`

  // Show members
  const memberList = guild.members.slice(0, 10).map(id => {
    const m = getPlayer(id)
    const role = id === guild.owner ? '👑' : '🗡️'
    return m ? `${role} ${m.name} (Lv.${m.level})` : `🗡️ Unknown`
  }).join('\n')

  msg += `*Members:*\n${memberList}`
  if (guild.members.length > 10) msg += `\n_...and ${guild.members.length - 10} more_`

  msg += `\n\n━━━━━━━━━━━━━━━━━━━━━\n`
  if (guild.level < 5) {
    const nextCost = GUILD_UPGRADE_COSTS[guild.level]
    msg += `🔼 Upgrade to Lv.${guild.level + 1}: *${nextCost?.toLocaleString() || '?'}G*\n`
  }
  msg += `*!guild deposit [amount]* — Donate to guild bank`

  await ctx.reply(msg)
}

// ── !guild members ────────────────────────────────
export async function cmdGuildMembers(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player || !player.guild) return ctx.reply('❌ You\'re not in a guild.')

  const guild = getGuild(player.guild)
  if (!guild) return ctx.reply('❌ Guild not found.')

  let msg = `👥 *${guild.name} — MEMBERS (${guild.members.length})*\n━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const memberId of guild.members) {
    const m = getPlayer(memberId)
    if (!m) continue
    const role = memberId === guild.owner ? '👑 Master' : '🗡️ Member'
    msg += `*${m.name}*\n`
    msg += `   ${role} | Lv.${m.level} ${m.rank}\n`
    msg += `   ${m.class} | ${m.location}\n\n`
  }

  await ctx.reply(msg)
}

// ── !guild deposit [amount] ───────────────────────
export async function cmdGuildDeposit(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (!player.guild) return ctx.reply('❌ You\'re not in a guild.')

  const amount = parseInt(ctx.args?.[0])
  if (!amount || amount < 1) return ctx.reply('❓ Usage: *!guild deposit [amount]*')
  if (amount > player.gold) return ctx.reply(`❌ Not enough gold! You have *${player.gold.toLocaleString()}G*`)

  const guild = getGuild(player.guild)
  if (!guild) return ctx.reply('❌ Guild not found.')

  player.gold -= amount
  await updateGuild(guild.id, { bank: (guild.bank || 0) + amount })
  await savePlayer(player)

  await ctx.reply(
    `🏦 *Donated to Guild Bank!*\n\n` +
    `💰 Donated: *${amount.toLocaleString()}G*\n` +
    `🏦 Guild Bank: *${((guild.bank || 0) + amount).toLocaleString()}G*\n\n` +
    `_Thank you for supporting ${guild.name}!_ 🏰`
  )
}

// ── !guild upgrade ────────────────────────────────
export async function cmdGuildUpgrade(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (!player.guild) return ctx.reply('❌ You\'re not in a guild.')

  const guild = getGuild(player.guild)
  if (!guild) return ctx.reply('❌ Guild not found.')
  if (guild.owner !== ctx.sender) return ctx.reply('❌ Only the Guild Master can upgrade!')

  if (guild.level >= 5) return ctx.reply('🏆 Your guild is already *MAX LEVEL!*\n_Nothing can stop you now._ 👑')

  const cost = GUILD_UPGRADE_COSTS[guild.level]
  if ((guild.bank || 0) < cost) {
    return ctx.reply(
      `❌ Not enough in guild bank!\n` +
      `Upgrade to Lv.${guild.level + 1} costs: *${cost.toLocaleString()}G*\n` +
      `Guild Bank: *${(guild.bank || 0).toLocaleString()}G*\n\n` +
      `Ask members to *!guild deposit* more!`
    )
  }

  const newLevel = guild.level + 1
  await updateGuild(guild.id, {
    level: newLevel,
    bank: (guild.bank || 0) - cost
  })

  await ctx.reply(
    `🎉 *GUILD UPGRADED!*\n\n` +
    `🏰 *${guild.name}*\n` +
    `🏆 Level: *${guild.level} → ${newLevel}*\n` +
    `💰 Cost: *${cost.toLocaleString()}G* from guild bank\n\n` +
    `✨ *New Perks Unlocked:*\n└ ${GUILD_LEVEL_PERKS[newLevel]}`
  )
}

// ── !guild rank ───────────────────────────────────
export async function cmdGuildRank(ctx) {
  const db = getDB()
  const allGuilds = Object.values(db.data.guilds || {})

  if (!allGuilds.length) return ctx.reply('🏰 No guilds have been created yet!')

  // Sort by level then bank
  allGuilds.sort((a, b) => (b.level - a.level) || (b.bank - a.bank))

  let msg = `🏰 *GUILD LEADERBOARD*\n━━━━━━━━━━━━━━━━━━━━━\n\n`
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']

  allGuilds.slice(0, 10).forEach((g, i) => {
    msg += `${medals[i] || `${i+1}.`} *${g.name}*\n`
    msg += `   🏆 Lv.${g.level} | 👥 ${g.members.length} members | ⚔️ ${g.wins || 0}W\n\n`
  })

  await ctx.reply(msg)
}

// ── !guild war [guild name] ───────────────────────
export async function cmdGuildWar(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (!player.guild) return ctx.reply('❌ You\'re not in a guild.')

  const guild = getGuild(player.guild)
  if (!guild || guild.owner !== ctx.sender) return ctx.reply('❌ Only the Guild Master can declare war.')

  const targetName = ctx.args?.join(' ')
  if (!targetName) return ctx.reply('❓ Usage: *!guild war [guild name]*')

  const target = getGuildByName(targetName)
  if (!target) return ctx.reply(`❌ No guild named "*${targetName}*" found.`)
  if (target.id === guild.id) return ctx.reply('😐 You can\'t declare war on your own guild...')

  if (player.gold < GUILD_WAR_COST) {
    return ctx.reply(`❌ Declaring war costs *${GUILD_WAR_COST.toLocaleString()}G*!\nYou have: *${player.gold.toLocaleString()}G*`)
  }

  player.gold -= GUILD_WAR_COST
  await savePlayer(player)

  await ctx.reply(
    `⚔️ *GUILD WAR DECLARED!*\n\n` +
    `🏰 *${guild.name}*\n` +
    `⚔️ vs\n` +
    `🏰 *${target.name}*\n\n` +
    `💰 Declaration fee: *${GUILD_WAR_COST.toLocaleString()}G* paid\n\n` +
    `_All members can now attack the rival guild's players in PVP for bonus rewards!_\n` +
    `_War lasts 24 hours — the guild with more kills wins!_`
  )
}

// ── !guild disband ────────────────────────────────
export async function cmdGuildDisband(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player || !player.guild) return ctx.reply('❌ Not in a guild.')

  const guild = getGuild(player.guild)
  if (!guild || guild.owner !== ctx.sender) return ctx.reply('❌ Only the Guild Master can disband.')

  const db = getDB()
  const guildName = guild.name
  for (const memberId of guild.members) {
    const m = db.data.players[memberId]
    if (m) { m.guild = null; m.guildRole = null; await savePlayer(m) }
  }
  delete db.data.guilds[guild.id]
  await db.write()

  await ctx.reply(`🏚️ *${guildName}* has been disbanded.\n_All members have been released._`)
}
