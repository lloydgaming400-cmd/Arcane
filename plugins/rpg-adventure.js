// ═══════════════════════════════════════════════════════
//          🌍  YATORPHG — ADVENTURE SYSTEM  🌍
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer, addExp, addKill } from '../lib/database.js'
import { isOnCooldown, setCooldown } from '../lib/cooldown.js'
import { generateExploreEvent, generateNPCMessage } from '../lib/gemini.js'
import { getRegion, gradeEmoji, checkTitleUnlocks, REGIONS } from '../lib/rpg-engine.js'
import { handleVictory, handleDeath, hpBar, battleStatus } from './rpg-combat.js'
import { getRandomMonsterByCR, mapFloorToCR, scaleMonsterToFloor, mapCRToGrade } from '../lib/dnd-api.js'
import config from '../config.js'

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randFloat(min, max) { return Math.random() * (max - min) + min }
function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

const EXPLORE_COOLDOWN = config.cooldowns.explore
const HUNT_COOLDOWN    = config.cooldowns.hunt

// ── Grade CR mapping for overworld ────────────────────
const GRADE_CR = {
  E: { min: 0,   max: 0.5 },
  D: { min: 1,   max: 2   },
  C: { min: 3,   max: 5   },
  B: { min: 6,   max: 9   },
  A: { min: 10,  max: 15  },
  S: { min: 16,  max: 24  },
}

// Fallback overworld monsters per grade
const FALLBACK_MONSTERS = {
  E: [{ name: 'Baby Slime', hit_points: 20, armor_class:[{value:8}],  challenge_rating: 0.25, type:'ooze'  },
      { name: 'Forest Rat',  hit_points: 12, armor_class:[{value:9}],  challenge_rating: 0.125,type:'beast' }],
  D: [{ name: 'Goblin',      hit_points: 35, armor_class:[{value:11}], challenge_rating: 0.25, type:'humanoid'},
      { name: 'Skeleton',    hit_points: 50, armor_class:[{value:12}], challenge_rating: 0.5,  type:'undead' }],
  C: [{ name: 'Orc Warrior', hit_points: 80, armor_class:[{value:13}], challenge_rating: 2,    type:'humanoid'},
      { name: 'Zombie Troll',hit_points: 95, armor_class:[{value:12}], challenge_rating: 3,    type:'undead' }],
  B: [{ name: 'Werewolf',    hit_points: 140,armor_class:[{value:15}], challenge_rating: 5,    type:'beast' },
      { name: 'Stone Golem', hit_points: 180,armor_class:[{value:16}], challenge_rating: 7,    type:'construct'}],
  A: [{ name: 'Demon Knight',hit_points: 220,armor_class:[{value:17}], challenge_rating: 11,   type:'fiend' },
      { name: 'Ancient Wyvern',hit_points:200,armor_class:[{value:16}],challenge_rating: 12,   type:'dragon'}],
  S: [{ name: 'Elder Dragon', hit_points:350,armor_class:[{value:19}], challenge_rating: 20,   type:'dragon'},
      { name: 'Demon Lord',   hit_points:400,armor_class:[{value:18}], challenge_rating: 22,   type:'fiend' }],
}

// Gold rewards for overworld fights
const GOLD_BY_GRADE = {
  E: {min:10,  max:25 },
  D: {min:30,  max:60 },
  C: {min:70,  max:120},
  B: {min:150, max:250},
  A: {min:300, max:500},
  S: {min:600, max:1000},
}
const EXP_BY_GRADE = { E:15, D:35, C:70, B:150, A:300, S:600 }

// Possible explore events
const EXPLORE_EVENT_TYPES = [
  'monster_encounter', 'monster_encounter', 'monster_encounter', // weighted higher
  'treasure_chest', 'herb_patch', 'mysterious_merchant',
  'ancient_statue', 'trap', 'hidden_passage', 'egg_found', 'nothing_special'
]

// Loot from treasure chests
const CHEST_LOOT = [
  { name: 'Iron Sword',    id: 'iron_sword',    type:'weapon', rarity:'common'   },
  { name: 'Leather Armor', id: 'leather_armor', type:'armor',  rarity:'common'   },
  { name: 'Health Potion', id: 'health_potion', type:'potion', rarity:'common'   },
  { name: 'Silver Blade',  id: 'silver_blade',  type:'weapon', rarity:'uncommon' },
  { name: 'Mage Robe',     id: 'mage_robe',     type:'armor',  rarity:'uncommon' },
  { name: 'Elixir',        id: 'elixir',        type:'potion', rarity:'rare'     },
  { name: 'Dragon Shard',  id: 'dragon_shard',  type:'material',rarity:'rare'   },
  { name: 'Shadow Blade',  id: 'shadow_blade',  type:'weapon', rarity:'legendary'},
]

// Eggs by region
const REGION_EGGS = {
  greenwood_forest: 'beast_egg',
  elven_kingdom:    'beast_egg',
  ancient_ruins:    'shadow_egg',
  demon_realm:      'shadow_egg',
  dragon_mountains: 'dragon_egg',
  shadow_abyss:     'shadow_egg',
  celestial_realm:  'celestial_egg',
}

// ── Start overworld battle ────────────────────────────
async function startOverworldBattle(player, regionId, ctx) {
  const region = REGIONS.find(r => r.id === regionId) || REGIONS[0]
  const grades = region.monsterGrades || ['E']
  const grade  = randPick(grades)

  // Try DnD API first, fallback to built-in
  let raw = null
  try {
    const cr = GRADE_CR[grade]
    raw = await getRandomMonsterByCR(cr.min, cr.max)
  } catch(e) { raw = null }
  if (!raw) raw = randPick(FALLBACK_MONSTERS[grade] || FALLBACK_MONSTERS.E)

  const level = player.level || 1
  const monster = {
    name:       raw.name,
    hp:         Math.max(20, raw.hit_points + level * 2),
    maxHp:      Math.max(20, raw.hit_points + level * 2),
    atk:        10 + level + randInt(0, 5),
    def:        Math.floor((raw.armor_class?.[0]?.value || 10) * 0.5),
    grade,
    index:      raw.index || raw.name.toLowerCase().replace(/\s+/g,'_'),
    isBoss:     false,
    type:       raw.type || 'beast',
  }

  const bs = {
    active: true, type: 'hunt', floor: 0, room: 0,
    enemy: monster,
    playerEffects: { defending:false, poisonTurns:0, buffStr:0, buffStrTurns:0, vanished:false, vanishTurns:0,
      eagleEye:0, undying:false, undyingTurns:0, berserk:false, berserkTurns:0, ironWill:false, ironWillTurns:0,
      shielded:false, divineShield:0, divineTurns:0, firstTurn:true },
    enemyEffects: { stunned:false, poisonTurns:0, cursed:false, cursedTurns:0, burnTurns:0, plagueTurns:0,
      deathMark:false, trapped:false, trapTurns:0 },
    allyActive:false, allyDmg:0, allyTurns:0, allyCount:0, ultimateUsed:false, turn:1
  }

  player.inBattle = true
  player.battleState = bs
  await savePlayer(player)

  await ctx.reply(
`╔══════════════════════════════════╗
║    🌍  ENCOUNTER!  🌍             ║
╚══════════════════════════════════╝

*You encounter a wild beast in ${region.name}!*

${gradeEmoji(grade)} *${monster.name}* [Grade ${grade}]
_A hostile creature blocks your path!_

${battleStatus(player, bs)}`
  )
}

// ── !hunt ─────────────────────────────────────────────
export async function cmdHunt(ctx) {
  const { senderNumber, reply } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered. Use *!register*')

  if (player.inBattle) return reply(`⚔️ You're already in battle!\nUse *!attack*, *!skill*, *!defend*, *!flee*`)
  if (player.inDungeon) return reply(`🗺️ You're in a dungeon! Use *!dungeon leave* first.`)
  if (player.inPvp) return reply(`⚔️ Finish your PVP duel first!`)

  const cd = isOnCooldown(senderNumber, 'hunt')
  if (cd) {
    const mins = Math.ceil(cd / 60000)
    return reply(`⏱️ *Hunt Cooldown!*\nYou need to rest for *${mins} more minute(s)*.`)
  }

  const region = REGIONS.find(r => r.id === player.region)
  if (!region) return reply(`❌ You're in an unknown region. Use *!travel [region]* to move.`)

  if (region.isSafeZone) {
    return reply(`⚠️ *${region.name}* is a safe zone — no monsters here!\nUse *!travel* to go somewhere dangerous.`)
  }

  setCooldown(senderNumber, 'hunt', HUNT_COOLDOWN)
  await startOverworldBattle(player, player.region, ctx)
}

// ── !explore ──────────────────────────────────────────
export async function cmdExplore(ctx) {
  const { senderNumber, reply } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered. Use *!register*')

  if (player.inBattle) return reply(`⚔️ Finish your battle first!`)
  if (player.inDungeon) return reply(`🗺️ Exit the dungeon first with *!dungeon leave*.`)
  if (player.inPvp)    return reply(`⚔️ Finish your PVP duel first!`)

  const cd = isOnCooldown(senderNumber, 'explore')
  if (cd) {
    const mins = Math.ceil(cd / 60000)
    return reply(`⏱️ *Explore Cooldown!*\nWait *${mins} more minute(s)* before exploring again.`)
  }

  setCooldown(senderNumber, 'explore', EXPLORE_COOLDOWN)

  const region = REGIONS.find(r => r.id === player.region) || REGIONS[0]
  const eventType = randPick(EXPLORE_EVENT_TYPES)

  // Gemini narrative
  const narrative = await generateExploreEvent(region.name, player.name, eventType.replace(/_/g,' '))

  if (eventType === 'monster_encounter') {
    await reply(`🌍 *Exploring ${region.name}...*\n\n${narrative}\n\n_A hostile creature appears!_`)
    return await startOverworldBattle(player, player.region, ctx)
  }

  if (eventType === 'treasure_chest') {
    const loot = randPick(CHEST_LOOT)
    const gold = randInt(50, 200)
    player.gold += gold
    player.inventory = player.inventory || []
    player.inventory.push({ ...loot, qty: 1 })
    await savePlayer(player)
    return reply(
`🌍 *Exploring ${region.name}...*

${narrative}

━━━━━━━━━━━━━━━━━━━━━
📦 *TREASURE CHEST FOUND!*
━━━━━━━━━━━━━━━━━━━━━

🔑 You pry it open and find:
⚔️ *${loot.name}* [${loot.rarity}]
💰 *${gold}G* in loose coins

_Items added to your inventory!_`
    )
  }

  if (eventType === 'herb_patch') {
    const herbs = randInt(2, 5)
    const gold  = herbs * randInt(10, 25)
    player.gold += gold
    await savePlayer(player)
    return reply(
`🌍 *Exploring ${region.name}...*

${narrative}

━━━━━━━━━━━━━━━━━━━━━
🌿 *HERB PATCH FOUND!*
━━━━━━━━━━━━━━━━━━━━━

You gather *${herbs} medicinal herbs*!
Sold to a nearby merchant for *${gold}G*.

💰 Gold: *+${gold}G*`
    )
  }

  if (eventType === 'egg_found') {
    const eggId = REGION_EGGS[player.region] || 'beast_egg'
    player.inventory = player.inventory || []
    player.inventory.push({ id: eggId, name: eggId.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), type:'egg', qty:1 })
    if (!player.killCounts) player.killCounts = {}
    player.killCounts.eggsFound = (player.killCounts.eggsFound || 0) + 1
    const newTitles = checkTitleUnlocks(player)
    await savePlayer(player)
    let msg = `🌍 *Exploring ${region.name}...*\n\n${narrative}\n\n━━━━━━━━━━━━━━━━━━━━━\n🥚 *EGG FOUND!*\n━━━━━━━━━━━━━━━━━━━━━\n\nYou discovered a *${eggId.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}*!\n_Use *!eggs* to manage your eggs._`
    if (newTitles.length) msg += `\n\n🏅 *TITLE UNLOCKED: ${newTitles[0].name}!*`
    return reply(msg)
  }

  if (eventType === 'trap') {
    const dmg = randInt(10, Math.floor(player.maxHp * 0.15))
    player.hp = Math.max(1, player.hp - dmg)
    await savePlayer(player)
    return reply(
`🌍 *Exploring ${region.name}...*

${narrative}

━━━━━━━━━━━━━━━━━━━━━
⚠️ *TRAP TRIGGERED!*
━━━━━━━━━━━━━━━━━━━━━

You step on a hidden trap!
💥 Lost *${dmg} HP* from the mechanism.

❤️ HP: *${player.hp}/${player.maxHp}*
_Use *!use health potion* to heal._`
    )
  }

  if (eventType === 'mysterious_merchant') {
    const gold = randInt(100, 400)
    player.gold += gold
    await savePlayer(player)
    return reply(
`🌍 *Exploring ${region.name}...*

${narrative}

━━━━━━━━━━━━━━━━━━━━━
🧙 *MYSTERIOUS MERCHANT!*
━━━━━━━━━━━━━━━━━━━━━

A hooded traveler offers you a deal.
You trade some trinkets for *${gold}G*!

💰 Gold: *+${gold}G*`
    )
  }

  if (eventType === 'ancient_statue') {
    const statChoices = ['str','agi','int','def','lck']
    const stat = randPick(statChoices)
    const boost = 1
    const cap = config.maxSingleStat || 100
    const total = (player.str||0)+(player.agi||0)+(player.int||0)+(player.def||0)+(player.lck||0)
    if (total < (config.maxStatTotal || 500)) {
      player[stat] = Math.min(cap, (player[stat]||10) + boost)
      await savePlayer(player)
      return reply(
`🌍 *Exploring ${region.name}...*

${narrative}

━━━━━━━━━━━━━━━━━━━━━
🗿 *ANCIENT STATUE!*
━━━━━━━━━━━━━━━━━━━━━

A mysterious power surges through you!
📈 *${stat.toUpperCase()} +${boost}*

_Permanent stat boost granted!_`
      )
    }
  }

  // Default: nothing or hidden passage
  const exp = randInt(10, 30)
  await addExp(senderNumber, exp)
  return reply(
`🌍 *Exploring ${region.name}...*

${narrative}

━━━━━━━━━━━━━━━━━━━━━
🗺️ *UNEVENTFUL JOURNEY*
━━━━━━━━━━━━━━━━━━━━━

You explore the area and learn from the land.
⭐ *+${exp} EXP* from the experience.`
  )
}

// ── !travel [region] ──────────────────────────────────
export async function cmdTravel(ctx) {
  const { senderNumber, reply, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered. Use *!register*')

  if (player.inBattle) return reply(`⚔️ Finish your battle before travelling!`)
  if (player.inDungeon) return reply(`🗺️ Exit the dungeon first with *!dungeon leave*.`)
  if (player.inPvp)    return reply(`⚔️ Finish your PVP duel first!`)

  const dest = args.join(' ').toLowerCase().trim()
  if (!dest) return reply(`❓ Usage: *!travel [region name]*\nExample: *!travel greenwood forest*\nUse *!map* to see all regions.`)

  const target = REGIONS.find(r =>
    r.id.includes(dest.replace(/\s+/g,'_')) ||
    r.name.toLowerCase().includes(dest)
  )

  if (!target) {
    return reply(`❌ Region "*${dest}*" not found!\nUse *!map* to see all regions.`)
  }

  if (target.id === player.region) {
    return reply(`⚠️ You're already in *${target.name}*!`)
  }

  // Level check
  const minLevel = target.levelRange[0]
  if (player.level < minLevel) {
    return reply(
`❌ *Too Dangerous!*

*${target.name}* requires *Level ${minLevel}+*
Your level: *${player.level}*

_Train more before venturing here._`
    )
  }

  const prevRegion = REGIONS.find(r => r.id === player.region)?.name || player.region
  player.region   = target.id
  player.location = target.name
  // Heal a bit on travel
  player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.1))
  await savePlayer(player)

  await reply(
`🗺️ *TRAVELLING...*

*${prevRegion}* → *${target.name}*

━━━━━━━━━━━━━━━━━━━━━
${target.name}
━━━━━━━━━━━━━━━━━━━━━

${target.description}

📊 Monster Grades: *${target.monsterGrades.join(', ')}*
📏 Level Range: *${target.levelRange[0]}-${target.levelRange[1]}*
${target.isSafeZone ? '✅ *SAFE ZONE* — No monsters here' : '⚠️ *DANGER ZONE* — Monsters lurk here'}

❤️ HP: *${player.hp}/${player.maxHp}* _(+10% travel recovery)_

_Use *!explore* or *!hunt* to find monsters!_`
  )
}

// ── !map ──────────────────────────────────────────────
export async function cmdMap(ctx) {
  const { senderNumber, reply } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered. Use *!register*')

  const level = player.level
  const currentRegion = REGIONS.find(r => r.id === player.region)

  let msg = `🗺️ *WORLD MAP*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const r of REGIONS) {
    const isHere  = r.id === player.region
    const locked  = level < r.levelRange[0]
    const icon    = isHere ? '📍' : locked ? '🔒' : '🌐'
    const status  = isHere ? ' ← *YOU ARE HERE*' : locked ? ` _(Lv.${r.levelRange[0]}+)_` : ''

    msg += `${icon} *${r.name}*${status}\n`
    if (!locked || isHere) {
      msg += `   Lv.${r.levelRange[0]}-${r.levelRange[1]} | ${r.monsterGrades.join('/')} Grades\n`
    }
    msg += '\n'
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `📍 Your Location: *${currentRegion?.name || 'Unknown'}*\n`
  msg += `⚔️ Your Level: *${level}*\n\n`
  msg += `_Use *!travel [region]* to move_`

  await reply(msg)
}
