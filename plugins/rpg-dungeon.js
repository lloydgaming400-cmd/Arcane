// ═══════════════════════════════════════════════════════
//          🗺️  YATORPHG — DUNGEON SYSTEM  🗺️
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'
import { gradeEmoji, BOSSES, REGIONS } from '../lib/rpg-engine.js'
import { getRandomMonsterByCR, mapFloorToCR, scaleMonsterToFloor, mapCRToGrade } from '../lib/dnd-api.js'
import { generateDungeonRoom, generateMonsterIntro, generateBossIntro, generateBossPhaseChange } from '../lib/gemini.js'
import { handleVictory, handleDeath, battleStatus } from './rpg-combat.js'

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// Fresh battle state template
function freshEffects() {
  return {
    playerEffects: { defending:false, poisonTurns:0, buffStr:0, buffStrTurns:0, vanished:false, vanishTurns:0,
      eagleEye:0, undying:false, undyingTurns:0, berserk:false, berserkTurns:0, ironWill:false, ironWillTurns:0,
      shielded:false, divineShield:0, divineTurns:0, firstTurn:true },
    enemyEffects: { stunned:false, poisonTurns:0, cursed:false, cursedTurns:0, burnTurns:0, plagueTurns:0,
      deathMark:false, trapped:false, trapTurns:0 },
    allyActive:false, allyDmg:0, allyTurns:0, allyCount:0, ultimateUsed:false, turn:1
  }
}

// Get dungeon name for region
function getDungeonName(region) {
  const names = {
    starter_village: 'Beginner\'s Cavern', greenwood_forest: 'Greenwood Labyrinth',
    elven_kingdom: 'Elven Ruins', ancient_ruins: 'Tomb of the Forgotten',
    demon_realm: 'Inferno Pit', dragon_mountains: 'Dragon\'s Lair',
    shadow_abyss: 'Shadow Abyss', celestial_realm: 'Divine Sanctum'
  }
  return names[region] || 'Mystery Dungeon'
}

// Scale boss from bosses.json or create dynamic one
function getBossForFloor(floor, dungeonName) {
  // Every 10th floor has a boss; floor 100 is the legendary boss
  const BOSS_LIST = Object.values(BOSSES); const bossPool = BOSS_LIST.filter(b => !b.isFinal)
  const finalBoss = BOSS_LIST.find(b => b.isFinal)
  if (floor === 100 && finalBoss) {
    return {
      name: finalBoss.name, grade: 'S', isBoss: true, isFinal: true,
      hp: Math.floor(finalBoss.hp * (1 + floor / 100)), maxHp: Math.floor(finalBoss.hp * (1 + floor / 100)),
      atk: Math.floor(finalBoss.atk * (1 + floor / 100)), def: Math.floor(finalBoss.def || 15),
      index: 'final_boss', type: finalBoss.type || 'demon', phases: finalBoss.phases || 3
    }
  }
  const pick = bossPool[floor % bossPool.length] || bossPool[0]
  const scale = 1 + (floor / 50)
  return {
    name: pick.name, grade: floor >= 80 ? 'S' : floor >= 50 ? 'A' : floor >= 30 ? 'B' : 'C',
    isBoss: true, phases: pick.phases || (floor >= 50 ? 3 : 2),
    hp: Math.floor((pick.hp || 500) * scale), maxHp: Math.floor((pick.hp || 500) * scale),
    atk: Math.floor((pick.atk || 30) * scale), def: Math.floor((pick.def || 12) * scale),
    index: pick.id || 'boss', type: pick.type || 'monster'
  }
}

// ── Fetch a monster from D&D API or use fallback ──────
async function fetchMonster(floor) {
  const crRange = mapFloorToCR(floor)
  let monster = await getRandomMonsterByCR(crRange.min, crRange.max)
  if (!monster) {
    // Fallback built-in monsters if API fails
    const fallbacks = [
      { name: 'Skeleton Warrior', hit_points: 50+floor*3, armor_class:[{value:12}], challenge_rating: crRange.min || 1, scaledATK: 10+floor },
      { name: 'Shadow Wraith', hit_points: 40+floor*2, armor_class:[{value:13}], challenge_rating: crRange.min || 1, scaledATK: 12+floor },
      { name: 'Stone Golem', hit_points: 80+floor*4, armor_class:[{value:15}], challenge_rating: crRange.max || 2, scaledATK: 15+floor },
      { name: 'Flame Imp', hit_points: 35+floor*2, armor_class:[{value:11}], challenge_rating: crRange.min || 1, scaledATK: 8+floor, type:'demon' },
      { name: 'Vampire Lord', hit_points: 90+floor*5, armor_class:[{value:14}], challenge_rating: crRange.max || 3, scaledATK: 18+floor, type:'undead' },
    ]
    monster = fallbacks[randInt(0, fallbacks.length - 1)]
  }
  return scaleMonsterToFloor(monster, floor)
}

// ── Start battle in dungeon ───────────────────────────
async function startDungeonBattle(player, monster, floor, room, dungeonName, ctx) {
  const isBossFloor = floor % 10 === 0

  let enemy
  if (isBossFloor) {
    enemy = getBossForFloor(floor, dungeonName)
  } else {
    enemy = {
      name: monster.name || 'Unknown Creature',
      hp: monster.hit_points || 50,
      maxHp: monster.hit_points || 50,
      atk: monster.scaledATK || 15,
      def: Math.floor((monster.armor_class?.[0]?.value || 10) * 0.5),
      grade: mapCRToGrade(monster.challenge_rating || 1),
      index: monster.index || monster.name?.toLowerCase().replace(/\s+/g, '_') || 'monster',
      isBoss: false, type: monster.type || 'beast'
    }
  }

  const effects = freshEffects()
  const bs = {
    active: true, type: 'dungeon', floor, room,
    enemy, ...effects
  }

  player.inBattle = true
  player.battleState = bs
  await savePlayer(player)

  // Get Gemini narration
  const cls = player.class || 'warrior'
  const roomNarr = await generateDungeonRoom(dungeonName, floor, isBossFloor ? 'boss' : 'monster', enemy.name, player.name, cls)
  const monsterLine = isBossFloor
    ? await generateBossIntro(enemy.name, 1, player.name)
    : await generateMonsterIntro(enemy.name, enemy.grade, floor)

  const encounterHeader = isBossFloor
    ? `╔══════════════════════════════════╗\n║    💀  BOSS ENCOUNTER!  💀        ║\n╚══════════════════════════════════╝`
    : `╔══════════════════════════════════╗\n║    👹  ENEMY ENCOUNTERED  👹      ║\n╚══════════════════════════════════╝`

  await ctx.reply(`${encounterHeader}

${roomNarr}

━━━━━━━━━━━━━━━━━━━━━━━━━━
*"${monsterLine}"*
━━━━━━━━━━━━━━━━━━━━━━━━━━

${battleStatus(player, bs)}`)
}

// ────────────────────────────────────────────────────
//  !dungeon — Enter or continue dungeon
// ────────────────────────────────────────────────────
export async function cmdDungeon(ctx) {
  const { reply, senderNumber, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)

  // Handle !dungeon leave
  if (args[0] === 'leave' || args[0] === 'exit') {
    if (!player.inDungeon) return reply(`❌ You're not in a dungeon!`)
    if (player.inBattle) return reply(`⚠️ You must finish your current battle first!\n_Defeat the enemy or use *!flee*_`)
    player.inDungeon = false
    await savePlayer(player)
    return reply(`🚪 *${player.name}* exits the dungeon.\n_Progress saved at Floor ${player.dungeonFloor}._\nReturn anytime with *!dungeon*`)
  }

  // Already in battle
  if (player.inBattle) return reply(`⚔️ You're already in battle!\nUse *!attack*, *!skill*, *!defend*, *!flee*`)

  // Check if in PVP
  if (player.inPvp) return reply(`⚔️ You're in a PVP duel! Finish it first.`)

  // Loan block
  if (player.loan > 10000) return reply(`🚫 Your debt exceeds 10,000G!\nYou cannot enter dungeons until you *!repay* your loan.`)

  const dungeonName = getDungeonName(player.region)
  const region = REGIONS.find(r => r.id === player.region)
  const minLevel = region?.levelRange?.[0] || 1

  if (player.level < minLevel) return reply(`❌ This dungeon requires Level *${minLevel}*!\nYou are Level ${player.level}.\nTravel to a region suited for your level with *!travel*`)

  // Enter or continue dungeon
  if (!player.inDungeon) {
    // Start fresh run
    player.inDungeon = true
    player.dungeonFloor = player.dungeonCheckpoint || 1
    player.dungeonRoom = 1
    await savePlayer(player)
    await reply(`╔══════════════════════════════════╗
║    🗺️  DUNGEON ENTERED  🗺️        ║
╚══════════════════════════════════╝

*${player.name}* descends into the *${dungeonName}*...

📍 Starting at Floor *${player.dungeonFloor}*
${player.dungeonFloor > 1 ? `_(Continuing from checkpoint)_` : `_(Floor 1 — The Journey Begins)_`}

⚠️ _Type *!dungeon leave* to save and exit anytime._
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Generating encounter..._`)
    // Small delay then start first encounter
    setTimeout(async () => {
      const freshPlayer = getPlayer(senderNumber)
      if (freshPlayer && freshPlayer.inDungeon && !freshPlayer.inBattle) {
        const monster = await fetchMonster(freshPlayer.dungeonFloor)
        freshPlayer.dungeonRoom = 1
        await startDungeonBattle(freshPlayer, monster, freshPlayer.dungeonFloor, freshPlayer.dungeonRoom, dungeonName, ctx)
      }
    }, 1500)
    return
  }

  // Continue existing dungeon run (after winning a room)
  const floor = player.dungeonFloor
  const room = (player.dungeonRoom || 1) + 1

  // After 3 rooms, advance to next floor
  if (room > 3) {
    const newFloor = floor + 1

    if (newFloor > 100) {
      // DUNGEON COMPLETE!
      player.inDungeon = false; player.dungeonFloor = 1; player.dungeonCheckpoint = 0; player.dungeonRoom = 1
      player.gold += 5000; player.gems += 50
      if (!player.killCounts.dungeonsCleared) player.killCounts.dungeonsCleared = 0
      player.killCounts.dungeonsCleared++
      await savePlayer(player)
      return reply(`╔══════════════════════════════════╗
║   🏆  DUNGEON COMPLETE!!!  🏆     ║
╚══════════════════════════════════╝

*${player.name}* has conquered ALL 100 FLOORS!

💰 Bonus: *+5,000G*
💎 Bonus: *+50 Gems*
🏅 Glory and legend await you!

Type *!achievements* to check for new unlocks!`)
    }

    // Save checkpoint every 10 floors
    if (newFloor % 10 === 0) player.dungeonCheckpoint = newFloor
    player.dungeonFloor = newFloor
    player.dungeonRoom = 1

    // Heal 15% between floors
    player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * 0.15))
    player.mp = Math.min(player.maxMp, player.mp + Math.floor(player.maxMp * 0.15))
    await savePlayer(player)

    const checkpointMsg = newFloor % 10 === 0 ? `\n✅ *CHECKPOINT SAVED* at Floor ${newFloor}!` : ''
    await reply(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗺️ *Ascending to Floor ${newFloor}...*
❤️ HP +15% restored (${player.hp}/${player.maxHp})
💙 MP +15% restored (${player.mp}/${player.maxMp})${checkpointMsg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Generating next encounter..._`)
  } else {
    player.dungeonRoom = room
    await savePlayer(player)
    await reply(`🚪 *Entering Room ${room} of Floor ${floor}...*\n_Generating encounter..._`)
  }

  setTimeout(async () => {
    const freshPlayer = getPlayer(senderNumber)
    if (freshPlayer && freshPlayer.inDungeon && !freshPlayer.inBattle) {
      const monster = await fetchMonster(freshPlayer.dungeonFloor)
      await startDungeonBattle(freshPlayer, monster, freshPlayer.dungeonFloor, freshPlayer.dungeonRoom || 1, getDungeonName(freshPlayer.region), ctx)
    }
  }, 1500)
}

// ────────────────────────────────────────────────────
//  !hunt — Fight a monster in your current region
// ────────────────────────────────────────────────────
export async function cmdHunt(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (player.inBattle) return reply(`⚔️ You're already in battle! Finish it first.`)
  if (player.inDungeon) return reply(`🗺️ You're inside a dungeon! Finish or *!dungeon leave* first.`)
  if (player.inPvp) return reply(`⚔️ You're in a PVP duel!`)

  const region = REGIONS.find(r => r.id === player.region)
  const crRange = { min: Math.max(0, (player.level / 20) - 1), max: (player.level / 10) + 1 }
  const monster = await fetchMonster(player.level)
  const dungeonName = `${region?.name || 'Wilderness'} Hunt`

  const effects = freshEffects()
  const enemy = {
    name: monster.name || 'Wild Beast',
    hp: monster.hit_points || 50, maxHp: monster.hit_points || 50,
    atk: monster.scaledATK || 12, def: Math.floor((monster.armor_class?.[0]?.value || 8) * 0.5),
    grade: mapCRToGrade(monster.challenge_rating || 1),
    index: monster.index || 'beast', isBoss: false, type: monster.type || 'beast'
  }

  const bs = { active: true, type: 'hunt', floor: 0, room: 0, enemy, ...effects }
  player.inBattle = true; player.battleState = bs
  await savePlayer(player)

  const introLine = await generateMonsterIntro(enemy.name, enemy.grade, player.level)

  await reply(`╔══════════════════════════════════╗
║    🏹  HUNTING IN ${(region?.name || 'WILDS').toUpperCase().substring(0,10).padEnd(10)}  🏹   ║
╚══════════════════════════════════╝

*${player.name}* stalks through the wilderness...

A wild *${enemy.name}* appears! [${enemy.grade}]

*"${introLine}"*

${battleStatus(player, bs)}`)
}

// ────────────────────────────────────────────────────
//  !partydungeon — Party dungeon (stub for now)
// ────────────────────────────────────────────────────
export async function cmdPartydungeon(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (!player.party) return reply(`❌ You're not in a party!\nCreate one with *!party create* then *!party invite @player*`)
  return reply(`🗺️ *Party Dungeon* — Use *!dungeon* to enter.\n_All party members in the same region will join the fight!_`)
}

// ────────────────────────────────────────────────────
//  !explore — Random events in current region
// ────────────────────────────────────────────────────
export async function cmdExplore(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (player.inBattle) return reply(`⚔️ Finish your battle first!`)

  // Cooldown check (1 hour)
  const now = Date.now(); const cd = 60 * 60 * 1000
  if (player.lastExplore && (now - player.lastExplore) < cd) {
    const remaining = Math.ceil((cd - (now - player.lastExplore)) / 60000)
    return reply(`⏳ Explore cooldown: *${remaining} minutes* remaining.`)
  }

  const region = REGIONS.find(r => r.id === player.region)
  const events = [
    { type: 'treasure', weight: 20, gold: randInt(50, 200) },
    { type: 'monster', weight: 30 },
    { type: 'herb', weight: 15, item: 'antidote' },
    { type: 'ruins', weight: 10, item: 'mana_potion' },
    { type: 'nothing', weight: 15 },
    { type: 'egg', weight: 5 },
    { type: 'npc', weight: 5 }
  ]
  const roll = Math.random() * 100; let cumulative = 0; let picked = events[events.length - 1]
  for (const ev of events) { cumulative += ev.weight; if (roll < cumulative) { picked = ev; break } }

  player.lastExplore = now
  let resultMsg = ''

  switch (picked.type) {
    case 'treasure':
      player.gold += picked.gold
      resultMsg = `💰 *Found a hidden treasure chest!*\n+${picked.gold}G!`; break
    case 'monster':
      // Start a hunt encounter
      player.lastExplore = now; await savePlayer(player)
      return cmdHunt(ctx)
    case 'herb':
      if (player.inventory.length < 30) player.inventory.push(picked.item)
      resultMsg = `🌿 *Found an herb!*\nObtained: *${picked.item.replace(/_/g, ' ')}*`; break
    case 'ruins':
      if (player.inventory.length < 30) player.inventory.push(picked.item)
      resultMsg = `🏚️ *Discovered ancient ruins!*\nFound: *${picked.item.replace(/_/g, ' ')}*`; break
    case 'egg':
      if (player.eggs.length < 5) {
        player.eggs.push({ type: 'beast_egg', foundAt: now, region: player.region })
        resultMsg = `🥚 *Found a mysterious egg!*\nType *!eggs* to see your eggs.`
      } else resultMsg = `🥚 *You spot an egg, but your bag is full!*`; break
    case 'npc':
      resultMsg = `🧙 *A wandering traveler shares knowledge...*\n_+50 EXP from their tales._`
      await addExp(player.id, 50); break
    default:
      resultMsg = `🌫️ *You explore but find nothing of note.*\n_The ${region?.name || 'region'} is quiet today..._`
  }

  await savePlayer(player)
  await reply(`╔══════════════════════════════════╗
║    🌍  EXPLORING  🌍              ║
╚══════════════════════════════════╝

📍 *${region?.name || 'Unknown Region'}*

${resultMsg}

⏳ Explore cooldown: *1 hour*`)
}

// ────────────────────────────────────────────────────
//  !travel [region] — Travel to another region
// ────────────────────────────────────────────────────
export async function cmdTravel(ctx) {
  const { reply, senderNumber, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (player.inBattle) return reply(`⚔️ Finish your battle before traveling!`)
  if (player.inDungeon) return reply(`🗺️ Exit the dungeon first with *!dungeon leave*`)

  if (!args[0]) {
    const list = REGIONS.map((r, i) => `*${i+1}.* ${r.name} — Lv.${r.levelRange?.[0] || '?'}-${r.levelRange?.[1] || '?'}`).join('\n')
    return reply(`🗺️ *WORLD REGIONS*\n\n${list}\n\nUsage: *!travel [region name]*\n_Example: !travel demon realm_`)
  }

  const query = args.join(' ').toLowerCase()
  const target = REGIONS.find(r => r.name.toLowerCase().includes(query) || r.id.includes(query.replace(/\s+/g, '_')))
  if (!target) return reply(`❌ Region *${args.join(' ')}* not found!\nType *!travel* to see all regions.`)
  if (target.id === player.region) return reply(`📍 You're already in *${target.name}*!`)

  const minLv = target.levelRange?.[0] || 1
  if (player.level < minLv) return reply(`❌ *${target.name}* requires Level *${minLv}*!\nYou are Level ${player.level}.`)

  player.region = target.id; player.location = target.name
  player.inDungeon = false; player.dungeonFloor = 1; player.dungeonCheckpoint = 0
  await savePlayer(player)
  return reply(`✈️ *${player.name}* travels to *${target.name}*!

📍 Now in: *${target.name}*
⚔️ Monster Level Range: ${target.levelRange?.[0]||'?'}-${target.levelRange?.[1]||'?'}

_The air here feels different..._
Use *!dungeon* to explore the dungeon or *!hunt* to fight.`)
}

// ────────────────────────────────────────────────────
//  !map — View world map
// ────────────────────────────────────────────────────
export async function cmdMap(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  const mapLines = REGIONS.map(r => {
    const isHere = r.id === player.region
    const lock = player.level < (r.levelRange?.[0] || 1) ? '🔒' : '✅'
    return `${isHere ? '📍' : lock} *${r.name}*\n   Lv.${r.levelRange?.[0]||'?'}-${r.levelRange?.[1]||'?'} | ${r.description || ''}`
  }).join('\n\n')
  return reply(`╔══════════════════════════════════╗
║       🗺️  WORLD MAP  🗺️           ║
╚══════════════════════════════════╝

${mapLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 You are in: *${player.location}*
⚔️ Your Level: *${player.level}*

_Type *!travel [region]* to move_`)
}
