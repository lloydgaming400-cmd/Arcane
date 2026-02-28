// ⚔️ REGISTER & PROFILE PLUGIN
import { createPlayer, getPlayer, playerExists, savePlayer } from '../lib/database.js'
import { CLASSES, RACES, getClass, getRace, getTotalStats } from '../lib/rpg-engine.js'
import { registerGroupForNPCs } from '../lib/npc-engine.js'
import config from '../config.js'

// Active registration sessions
const sessions = {}

// ─────────────────────────────────────────
//  !register — Start character creation
// ─────────────────────────────────────────
export async function cmdRegister(ctx) {
  const { reply, senderNumber, jid, isGroup } = ctx

  if (playerExists(senderNumber)) {
    const p = getPlayer(senderNumber)
    return reply(
`╔══════════════════════════════╗
║   ⚠️  ALREADY REGISTERED  ⚠️   ║
╚══════════════════════════════╝

*${p.name}*, you already walk this world.

Use *!profile* to view your character.
Use *!rename* to change your name.`)
  }

  // Register group for NPC messages
  if (isGroup) registerGroupForNPCs(jid)

  sessions[senderNumber] = { step: 'name' }

  return reply(
`╔════════════════════════════════════╗
║   ⚔️   WELCOME TO YATORPHG   ⚔️    ║
╚════════════════════════════════════╝

*A new soul awakens in this realm...*

The world is vast and dangerous. 
Dragons roam the mountains. Demons 
lurk in the shadows. Dungeon floors 
stretch a hundred levels deep.

You must forge your legend.

${config.divider}

📜 *STEP 1 OF 3 — YOUR NAME*

What shall the world call you?
Reply with your character's name.

_Example: reply with_ *Kael*`)
}

// ─────────────────────────────────────────
//  Handle registration steps via before()
// ─────────────────────────────────────────
export async function handleRegistrationStep(ctx) {
  const { reply, senderNumber, msg } = ctx
  const text = ctx.text || msg.message?.conversation || ''
  const session = sessions[senderNumber]
  if (!session || !text) return false

  // Step 1: Set name
  if (session.step === 'name') {
    const name = text.trim()
    if (name.length < 2 || name.length > 20) {
      return reply(`❌ Name must be between 2-20 characters. Try again.`)
    }
    if (!/^[a-zA-Z0-9 _'-]+$/.test(name)) {
      return reply(`❌ Name can only contain letters, numbers, spaces, hyphens and apostrophes.`)
    }

    session.name = name
    session.step = 'class'

    const classList = CLASSES.map((c, i) =>
      `*${i + 1}.* ${c.name}\n    _${c.description}_\n    ┗ Role: ${c.role}`
    ).join('\n\n')

    return reply(
`╔════════════════════════════════════╗
║      ⚔️  CHARACTER CREATION  ⚔️     ║
╚════════════════════════════════════╝

*Welcome, ${name}!*

${config.divider}

📜 *STEP 2 OF 3 — CHOOSE YOUR CLASS*

${classList}

${config.divider}
Reply with the *number* of your class.`)
  }

  // Step 2: Set class
  if (session.step === 'class') {
    const idx = parseInt(text.trim()) - 1
    if (isNaN(idx) || idx < 0 || idx >= CLASSES.length) {
      return reply(`❌ Invalid choice. Reply with a number between 1 and ${CLASSES.length}.`)
    }

    session.classId = CLASSES[idx].id
    session.step = 'race'

    const raceList = RACES.map((r, i) =>
      `*${i + 1}.* ${r.name}\n    _${r.description}_\n    ┗ Bonus: ${r.passiveBonus}`
    ).join('\n\n')

    return reply(
`╔════════════════════════════════════╗
║      ⚔️  CHARACTER CREATION  ⚔️     ║
╚════════════════════════════════════╝

*Class chosen:* ${CLASSES[idx].name} ✅

${config.divider}

📜 *STEP 3 OF 3 — CHOOSE YOUR RACE*

${raceList}

${config.divider}
Reply with the *number* of your race.`)
  }

  // Step 3: Set race and finalize
  if (session.step === 'race') {
    const idx = parseInt(text.trim()) - 1
    if (isNaN(idx) || idx < 0 || idx >= RACES.length) {
      return reply(`❌ Invalid choice. Reply with a number between 1 and ${RACES.length}.`)
    }

    const raceId = RACES[idx].id
    const classId = session.classId
    const name = session.name

    const cls = getClass(classId)
    const race = getRace(raceId)

    // Create player
    const player = await createPlayer(senderNumber, name, classId, raceId)

    // Apply class base stats
    player.str = cls.baseStats.str + race.bonusStats.str
    player.agi = cls.baseStats.agi + race.bonusStats.agi
    player.int = cls.baseStats.int + race.bonusStats.int
    player.def = cls.baseStats.def + race.bonusStats.def
    player.lck = cls.baseStats.lck + race.bonusStats.lck
    player.maxHp = cls.baseHP
    player.hp = cls.baseHP
    player.maxMp = cls.baseMP
    player.mp = cls.baseMP
    player.skills = cls.starterSkills
    player.activeSkills = cls.starterSkills

    await savePlayer(player)
    delete sessions[senderNumber]

    return reply(
`╔════════════════════════════════════╗
║   🌟  YOUR LEGEND BEGINS  🌟       ║
╚════════════════════════════════════╝

*A new hero has entered the realm!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *NAME:* ${name}
⚔️ *CLASS:* ${cls.name}
🧬 *RACE:* ${race.name}
🏅 *RANK:* 🪨 Peasant
📍 *LOCATION:* 🏘️ Starter Village
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❤️ HP: ${player.maxHp}  |  💙 MP: ${player.maxMp}
💪 STR: ${player.str}  |  ⚡ AGI: ${player.agi}
🧠 INT: ${player.int}  |  🛡️ DEF: ${player.def}
🍀 LCK: ${player.lck}

💰 Starting Gold: 500G
💎 Starting Gems: 10

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎒 *STARTER SKILLS:*
${cls.starterSkills.map(s => `  • ${s.replace(/_/g, ' ')}`).join('\n')}

✨ *RACE BONUS:* ${race.passiveBonus}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Your adventure awaits, ${name}.*
Type *!help* to see all commands.
Type *!dungeon* to begin your first raid.

⚠️ _Beware — this world shows no mercy._`)
  }

  return false
}

// ─────────────────────────────────────────
//  !profile — View character stats
// ─────────────────────────────────────────
export async function cmdProfile(ctx) {
  const { reply, senderNumber, args } = ctx

  let targetNumber = senderNumber
  // Allow viewing others with @mention
  if (args[0] && args[0].startsWith('@')) {
    targetNumber = args[0].replace('@', '') + '@s.whatsapp.net'
    targetNumber = targetNumber.replace('@s.whatsapp.net@s.whatsapp.net', '@s.whatsapp.net').replace('@s.whatsapp.net', '')
  }

  const player = getPlayer(targetNumber) || getPlayer(senderNumber)
  if (!player) {
    return reply(
`╔══════════════════════════╗
║   ❌  NOT REGISTERED  ❌   ║
╚══════════════════════════╝

You haven't created a character yet!
Type *!register* to begin your legend.`)
  }

  const cls = getClass(player.class)
  const race = getRace(player.race)
  const xpNeeded = player.level * 200
  const xpBar = buildXPBar(player.exp, xpNeeded)
  const hpBar = buildHPBar(player.hp, player.maxHp)
  const mpBar = buildMPBar(player.mp, player.maxMp)
  const totalStats = getTotalStats(player)
  const statBar = buildStatBar(totalStats, 500)

  const equippedWeapon = player.equipped.weapon ? `🗡️ ${player.equipped.weapon}` : '🗡️ Bare Hands'
  const equippedArmor = player.equipped.armor ? `🛡️ ${player.equipped.armor}` : '🛡️ Cloth Rags'
  const equippedAcc = player.equipped.accessory ? `💍 ${player.equipped.accessory}` : '💍 None'

  const titleDisplay = player.title ? `✦ *${player.title}* ✦` : '_(No title equipped)_'
  const guildDisplay = player.guild ? `🏰 ${player.guild}` : '_(No guild)_'
  const jobDisplay = player.job ? `💼 ${player.job} (Lv ${player.jobLevel})` : '_(Unemployed)_'
  const summonDisplay = player.activeSummon ? `🐾 ${player.activeSummon}` : '_(None)_'

  return reply(
`╔══════════════════════════════════════╗
║       ⚔️  CHARACTER PROFILE  ⚔️       ║
╚══════════════════════════════════════╝

${titleDisplay}

👤 *${player.name}*
${cls?.name || '?'} · ${race?.name || '?'}

🏅 *RANK:* ${player.rank} ${getRankBadgeEmoji(player.rank)}
📊 *LEVEL:* ${player.level}
${xpBar} ${player.exp}/${xpNeeded} XP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 *HP:* ${player.hp}/${player.maxHp}
${hpBar}
🔵 *MP:* ${player.mp}/${player.maxMp}
${mpBar}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ *COMBAT STATS*
💪 STR: ${player.str.toString().padEnd(5)} ⚡ AGI: ${player.agi}
🧠 INT: ${player.int.toString().padEnd(5)} 🛡️ DEF: ${player.def}
🍀 LCK: ${player.lck}

📊 Total Stats: ${totalStats}/500
${statBar}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *ECONOMY*
🪙 Gold: ${player.gold.toLocaleString()}G
💎 Gems: ${player.gems}
🏦 Bank: ${player.bankGold.toLocaleString()}G
${player.loan > 0 ? `⚠️ Loan Debt: ${player.loan.toLocaleString()}G` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎒 *EQUIPMENT*
${equippedWeapon}
${equippedArmor}
${equippedAcc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌍 *WORLD*
📍 Location: ${player.location}
${guildDisplay}
${jobDisplay}
🐾 Summon: ${summonDisplay}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 *Titles Earned:* ${player.titles.length}
🎖️ *Achievements:* ${player.achievements.length}
☠️ *Total Kills:* ${Object.values(player.killCounts).reduce((a, b) => a + b, 0)}`)
}

// ─────────────────────────────────────────
//  !rename — Change character name
// ─────────────────────────────────────────
export async function cmdRename(ctx) {
  const { reply, senderNumber, text } = ctx

  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ You haven't registered yet! Type *!register*`)

  if (!text) return reply(
`*!rename [new name]*

_Example:_ !rename Shadowblade`)

  const newName = text.trim()
  if (newName.length < 2 || newName.length > 20)
    return reply(`❌ Name must be 2-20 characters.`)

  const oldName = player.name
  player.name = newName
  await savePlayer(player)

  return reply(
`╔══════════════════════════════╗
║     ✅  NAME CHANGED  ✅      ║
╚══════════════════════════════╝

*${oldName}* is now known as...

⚔️ *${newName}* ⚔️

_The world whispers your new name._`)
}

// ─────────────────────────────────────────
//  UI Helpers
// ─────────────────────────────────────────
function buildXPBar(current, max) {
  const filled = Math.round((current / max) * 10)
  return '⬛'.repeat(filled) + '⬜'.repeat(10 - filled)
}

function buildHPBar(current, max) {
  const pct = current / max
  const filled = Math.round(pct * 10)
  const color = pct > 0.6 ? '🟩' : pct > 0.3 ? '🟨' : '🟥'
  return color.repeat(filled) + '⬜'.repeat(10 - filled)
}

function buildMPBar(current, max) {
  const filled = Math.round((current / max) * 10)
  return '🟦'.repeat(filled) + '⬜'.repeat(10 - filled)
}

function buildStatBar(current, max) {
  const filled = Math.round((current / max) * 10)
  return '🟧'.repeat(filled) + '⬜'.repeat(10 - filled)
}

function getRankBadgeEmoji(rank) {
  const badges = {
    Peasant: '🪨', Adventurer: '🗡️', Veteran: '⚔️', Elite: '🛡️',
    Champion: '👑', Legend: '🌟', Mythic: '💎', Transcendent: '🔱',
  }
  return badges[rank] || '🪨'
}
