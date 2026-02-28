// ═══════════════════════════════════════════════════════
//       📖  YATORPHG — HELP & INFO SYSTEM  📖
// ═══════════════════════════════════════════════════════
import { getPlayer } from '../lib/database.js'
import { REGIONS, CLASSES, RACES } from '../lib/rpg-engine.js'

// ── !help ─────────────────────────────────────────────
export async function cmdHelp(ctx) {
  const { senderNumber, reply, args } = ctx

  const section = args[0]?.toLowerCase()

  if (section) {
    return await helpSection(section, ctx)
  }

  const player = getPlayer(senderNumber)
  const greeting = player ? `👤 *${player.name}* (Lv.${player.level})` : `_Register with *!register* to start!_`

  await reply(
`⚔️ *YATORPHG BOT*
${'═'.repeat(30)}

${greeting}

${'─'.repeat(30)}
📋 *COMMAND CATEGORIES:*

🧍 *!help character* — Profile, stats, register
⚔️ *!help combat* — Fighting, skills, dungeons
🗺️ *!help adventure* — Explore, travel, hunt
🏦 *!help economy* — Bank, shop, market, jobs
🤝 *!help social* — Party, guild, trade
📜 *!help quests* — Quests and daily tasks
🐾 *!help summons* — Summons and eggs
🏆 *!help rankings* — Titles, achievements, leaderboard

${'─'.repeat(30)}
⚡ *QUICK COMMANDS:*

!register — Create character
!profile  — View your stats
!dungeon  — Enter a dungeon
!explore  — Explore your region
!hunt     — Hunt nearby monsters
!shop     — View current region shop
!work     — Do your job
!help     — This menu

${'═'.repeat(30)}
_Prefix: *!* | Bot by YatoRPG_`)
}

async function helpSection(section, ctx) {
  const { reply } = ctx

  const sections = {
    character: `🧍 *CHARACTER COMMANDS*
━━━━━━━━━━━━━━━━━━━━━
*!register* — Create your character
*!profile* or *!me* — View your stats
*!rename [name]* — Change your name
*!classes* — View all classes
*!races* — View all races
*!skills* — Your learned skills
*!skillinfo [name]* — Info on a skill
*!titles* — Your earned titles
*!settitle [name]* — Equip a title
*!achievements* — Track your progress`,

    combat: `⚔️ *COMBAT COMMANDS*
━━━━━━━━━━━━━━━━━━━━━
*!dungeon* — Enter a dungeon
*!dungeon leave* — Exit dungeon (saves progress)
*!partydungeon* — Dungeon with your party

*In battle:*
*!attack* or *!a* — Attack enemy
*!skill [name]* or *!s [name]* — Use a skill
*!defend* or *!d* — Defend (reduce damage)
*!flee* — Try to escape
*!item [name]* — Use a consumable

*PVP:*
*!pvp @player* — Challenge to a duel`,

    adventure: `🗺️ *ADVENTURE COMMANDS*
━━━━━━━━━━━━━━━━━━━━━
*!hunt* — Hunt monsters (15min cooldown)
*!explore* — Explore region (30min cooldown)
*!travel [region]* — Move to a new region
*!map* — View the world map
*!worldboss* — Check active world boss
*!bossfight* — Attack the world boss`,

    economy: `🏦 *ECONOMY COMMANDS*
━━━━━━━━━━━━━━━━━━━━━
*!bank* — View bank balance
*!deposit [amount]* — Deposit gold
*!withdraw [amount]* — Withdraw gold
*!loan [amount]* — Take a loan
*!repay [amount]* — Repay loan
*!rob @player* — Rob another player

*!shop* — View region shop
*!buy [item]* — Buy an item
*!sell [item]* — Sell an item
*!market* — Player marketplace
*!list [item] [price]* — List on market

*!jobs* — View available jobs
*!jobapply [job]* — Apply for a job
*!work* — Do your job (2hr cooldown)
*!jobresign* — Quit your job`,

    social: `🤝 *SOCIAL COMMANDS*
━━━━━━━━━━━━━━━━━━━━━
*!party create* — Create a party
*!party invite @player* — Invite someone
*!party join* — Accept invite
*!party leave* — Leave party
*!party info* — View party

*!guild create [name]* — Create a guild (5000G)
*!guild join [name]* — Join a guild
*!guild leave* — Leave guild
*!guild info* — View guild
*!guild members* — View members
*!guild upgrade* — Upgrade guild hall
*!guild war @guild* — Declare guild war

*!trade @player [item]* — Trade with player`,

    quests: `📜 *QUEST COMMANDS*
━━━━━━━━━━━━━━━━━━━━━
*!questlist* — View available quests
*!quest* — View your active quests
*!questaccept [name]* — Accept a quest
*!questcomplete* — Complete a quest

Quest Types:
🌅 Daily — Reset every 24 hours
📅 Weekly — Reset every 7 days
📖 Story — Permanent, follow the lore`,

    summons: `🐾 *SUMMON COMMANDS*
━━━━━━━━━━━━━━━━━━━━━
*!summon* — View your summons
*!summon [name]* — Activate a summon
*!summons* — Same as !summon
*!releasesummon* — Dismiss active summon

*!eggs* — View your eggs
*!eggs incubate [name]* — Start hatching
*!eggs hatch [name]* — Hatch a ready egg

Egg Types:
🥚 Beast Egg — Any region
🔴 Dragon Egg — Dragon Mountains
⚫ Shadow Egg — Shadow Abyss
⭐ Celestial Egg — Celestial Realm
❓ Mystery Egg — Boss drops`,

    rankings: `🏆 *RANKING COMMANDS*
━━━━━━━━━━━━━━━━━━━━━
*!leaderboard* or *!lb* — Top players by level
*!goldrank* — Top players by gold
*!achievements* or *!ach* — Your achievements
*!titles* — Your earned titles
*!settitle [name]* — Equip a title`,
  }

  if (sections[section]) {
    return reply(sections[section])
  }

  await reply(`❌ Unknown section "*${section}*"\nUse *!help* to see all categories.`)
}

// ── !classes ──────────────────────────────────────────
export async function cmdClasses(ctx) {
  const { reply } = ctx

  let msg = `⚔️ *AVAILABLE CLASSES*\n━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const c of CLASSES) {
    msg += `${c.emoji || '⚔️'} *${c.name}*\n`
    msg += `   📖 ${c.description || 'A mighty class.'}\n`
    msg += `   📊 STR:${c.baseStats?.str||10} | AGI:${c.baseStats?.agi||10} | INT:${c.baseStats?.int||10} | DEF:${c.baseStats?.def||10}\n`
    msg += `   🌟 Starter skills: _${(c.starterSkills||[]).join(', ')}_\n\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `_Choose wisely when you *!register*!_`

  await reply(msg)
}

// ── !races ────────────────────────────────────────────
export async function cmdRaces(ctx) {
  const { reply } = ctx

  let msg = `🧝 *AVAILABLE RACES*\n━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const r of RACES) {
    msg += `${r.emoji || '🧑'} *${r.name}*\n`
    msg += `   📖 ${r.description || 'An ancient race.'}\n`
    msg += `   📊 Bonus: _${r.bonusDesc || 'No bonus'}_\n\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `_Your race gives passive bonuses throughout the game!_`

  await reply(msg)
}

// ── !lore ─────────────────────────────────────────────
export async function cmdLore(ctx) {
  await ctx.reply(
`📖 *WORLD LORE*
${'═'.repeat(30)}

*In the Age of Fractured Realms...*

The world was once whole — a single landmass of harmony. Then the God-Beast Primordial shattered the celestial sphere, splitting reality into eight distinct regions, each governed by a different power.

The *Starter Village* remains neutral — a haven for those beginning their journey. Beyond its walls:

🌲 The *Greenwood Forest* — where nature spirits grant power to those who respect the wild

🧝 The *Elven Kingdom* — ancient elves guard forbidden magic from outsiders

💀 *Ancient Ruins* — a civilization swallowed by the undead, their treasures still lie unclaimed

🔥 *Demon Realm* — Archfiend Belzarak rules the hellfire wastes; demons serve or are devoured

🐉 *Dragon Mountains* — the last stronghold of true dragons; their eggs are worth more than kingdoms

👁️ *Shadow Abyss* — the realm between life and death; reality itself dissolves here

✨ *Celestial Realm* — the divine sphere above the clouds, where god-beasts and angels reside

${'─'.repeat(30)}
*Your quest:* Reach the Celestial Realm.
Defeat the Transcendent One.
Become legend.

_Use *!regions* for detailed region info._`)
}

// ── !regions ──────────────────────────────────────────
export async function cmdRegions(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  const current = player?.region

  let msg = `🌍 *ALL REGIONS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const r of REGIONS) {
    const isHere = r.id === current
    msg += `${isHere ? '📍' : '🌐'} *${r.name}*${isHere ? ' ← YOU' : ''}\n`
    msg += `   📏 Levels ${r.levelRange[0]}-${r.levelRange[1]}\n`
    msg += `   👹 Grades: ${r.monsterGrades.join(', ')}\n`
    msg += `   📖 _${r.description.slice(0, 60)}..._\n\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `_Use *!travel [region]* to explore a new area!_`

  await reply(msg)
}
