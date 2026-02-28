// ═══════════════════════════════════════════════════════
//       🐉  YATORPHG — WORLD BOSS & BOSS SYSTEM  🐉
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer, addExp, addKill, getWorldBoss, setWorldBoss, updateWorldBoss, getAllPlayers } from '../lib/database.js'
import { generateBossIntro, generateBossPhaseChange, generateVictoryNarrative } from '../lib/gemini.js'
import { getAttackDamage, calculateCrit, gradeEmoji, checkTitleUnlocks } from '../lib/rpg-engine.js'
import { hpBar, battleStatus } from './rpg-combat.js'
import config from '../config.js'

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

const WORLD_BOSS_LIST = [
  {
    id: 'ragnaros',
    name: '🔥 Ragnaros the Fire Dragon',
    hp: 100000,
    maxHp: 100000,
    atk: 80,
    def: 30,
    grade: 'S',
    region: 'dragon_mountains',
    type: 'dragon',
    desc: 'An ancient fire dragon reborn from volcanic ash. Its breath melts steel.',
    phases: [
      { hpPct: 0.75, msg: '🔥 Ragnaros ignites — his scales glow WHITE HOT!' },
      { hpPct: 0.50, msg: '💀 PHASE 2: RAGNAROS TAKES TO THE SKIES! His ATK doubles!' },
      { hpPct: 0.25, msg: '💥 FINAL PHASE: APOCALYPSE FLAME — he attacks TWICE per round!' },
    ],
  },
  {
    id: 'bone_colossus',
    name: '💀 The Bone Colossus',
    hp: 80000,
    maxHp: 80000,
    atk: 70,
    def: 20,
    grade: 'S',
    region: 'ancient_ruins',
    type: 'undead',
    desc: 'Thousands of skeletal bodies fused into one unholy titan.',
    phases: [
      { hpPct: 0.70, msg: '🦴 The Colossus absorbs nearby bones — growing LARGER!' },
      { hpPct: 0.40, msg: '💀 PHASE 2: Necrotic shockwaves — the ground cracks!' },
      { hpPct: 0.15, msg: '⚡ DESPERATE PHASE: The Colossus unleashes BONE SHARDS in all directions!' },
    ],
  },
  {
    id: 'archfiend_belzarak',
    name: '😈 Archfiend Belzarak',
    hp: 90000,
    maxHp: 90000,
    atk: 90,
    def: 25,
    grade: 'S',
    region: 'demon_realm',
    type: 'fiend',
    desc: 'A lord of the nine hells who has breached the mortal plane.',
    phases: [
      { hpPct: 0.70, msg: '👿 Belzarak summons SHADOW FIENDS from the abyss!' },
      { hpPct: 0.45, msg: '💥 PHASE 2: HELLFIRE RAIN — all attacks now have AoE splash!' },
      { hpPct: 0.20, msg: '🔮 TRUE FORM REVEALED — Belzarak\'s power TRIPLES in raw fury!' },
    ],
  },
  {
    id: 'celestial_void',
    name: '✨ The Celestial Void',
    hp: 120000,
    maxHp: 120000,
    atk: 100,
    def: 40,
    grade: 'S',
    region: 'celestial_realm',
    type: 'celestial',
    desc: 'A tear in divine reality given malevolent consciousness.',
    phases: [
      { hpPct: 0.65, msg: '🌀 Reality warps — the Void splits into TWO targets!' },
      { hpPct: 0.35, msg: '💫 PHASE 2: ERASURE FIELD — 30% chance to negate all attacks!' },
      { hpPct: 0.10, msg: '👁️ THE VOID OPENS FULLY — its true magnitude revealed! All damage x2!' },
    ],
  },
]

// ── !worldboss ────────────────────────────────────────
export async function cmdWorldBoss(ctx) {
  const { senderNumber, reply } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered.')

  const wb = getWorldBoss()
  if (!wb) {
    return reply(
`🌍 *WORLD BOSS STATUS*

━━━━━━━━━━━━━━━━━━━━━
😴 *No world boss is active right now.*
━━━━━━━━━━━━━━━━━━━━━

World bosses spawn every *${config.worldBossSpawnHours} hours* in different regions.

_Check back soon — something ancient is stirring..._ 🔮

_Admins can spawn one with *!admin spawnboss*_`
    )
  }

  const hpPct = Math.floor((wb.hp / wb.maxHp) * 100)
  const participants = Object.keys(wb.damageDealt || {}).length
  const topDamage = Object.entries(wb.damageDealt || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, dmg], i) => {
      const p = getAllPlayers()?.[id]
      return `${['🥇','🥈','🥉'][i]} ${p?.name || id.slice(-6)}: *${dmg.toLocaleString()} dmg*`
    })
    .join('\n')

  await reply(
`🐉 *WORLD BOSS ACTIVE!*
━━━━━━━━━━━━━━━━━━━━━━━━
${gradeEmoji(wb.grade)} *${wb.name}*
━━━━━━━━━━━━━━━━━━━━━━━━

❤️ HP: ${hpBar(wb.hp, wb.maxHp)}
${hpPct}% remaining

⚔️ Participants: *${participants} warrior(s)*

🏆 *TOP DAMAGE:*
${topDamage || '_No damage dealt yet_'}

━━━━━━━━━━━━━━━━━━━━━━━━
📍 Location: *${wb.region?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}*

💥 Use *!bossfight* to attack!
🏆 Top damage dealer gets *5000G + 💎 Gems!*`
  )
}

// ── !bossfight ────────────────────────────────────────
export async function cmdBossFight(ctx) {
  const { senderNumber, reply } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered.')

  if (player.inDungeon) return reply(`🗺️ You're in a dungeon! Exit first with *!dungeon leave*.`)
  if (player.inBattle)  return reply(`⚔️ You're in a battle! Finish it first.`)
  if (player.inPvp)     return reply(`⚔️ Finish your PVP duel first.`)

  const wb = getWorldBoss()
  if (!wb || wb.hp <= 0) {
    return reply(`😴 No world boss is active right now!\nUse *!worldboss* to check status.`)
  }

  if (player.hp <= 0) {
    return reply(`💀 You're dead! Use a revive item or wait until your HP recovers.`)
  }

  // Calculate player's hit
  const base   = getAttackDamage(player)
  const isCrit = calculateCrit(player)
  let dmg = base + randInt(5, 20)
  if (isCrit) dmg = Math.floor(dmg * 2)

  // Apply title bonus
  if (player.equippedTitle === 'boss_hunter') dmg = Math.floor(dmg * 1.1)

  // Apply to boss
  wb.hp = Math.max(0, wb.hp - dmg)
  if (!wb.damageDealt) wb.damageDealt = {}
  wb.damageDealt[senderNumber] = (wb.damageDealt[senderNumber] || 0) + dmg

  // Boss hits back
  const bossDmg = Math.floor((wb.atk || 60) * 0.6) + randInt(0, 10)
  const playerDef = Math.floor(player.def * 0.5)
  const finalDmg  = Math.max(1, bossDmg - playerDef)
  player.hp = Math.max(0, player.hp - finalDmg)

  // Check phase transitions
  const hpPct = wb.hp / wb.maxHp
  let phaseMsg = ''
  if (wb.phases) {
    for (const phase of wb.phases) {
      if (hpPct <= phase.hpPct && !wb.triggeredPhases?.includes(phase.hpPct)) {
        phaseMsg = phase.msg
        if (!wb.triggeredPhases) wb.triggeredPhases = []
        wb.triggeredPhases.push(phase.hpPct)
        break
      }
    }
  }

  await savePlayer(player)

  // Boss defeated?
  if (wb.hp <= 0) {
    return await handleWorldBossDefeat(player, wb, dmg, isCrit, ctx)
  }

  await updateWorldBoss(wb)

  const critLine   = isCrit ? '\n💥 *CRITICAL HIT!*' : ''
  const playerDead = player.hp <= 0

  let msg =
`🌍 *WORLD BOSS ATTACK!*
━━━━━━━━━━━━━━━━━━━━━━━━
${gradeEmoji(wb.grade)} *${wb.name}*

⚔️ *${player.name}* deals *${dmg.toLocaleString()} dmg!*${critLine}
💥 *${wb.name}* retaliates for *${finalDmg} dmg!*

━━━━━━━━━━━━━━━━━━━━━━━━
👤 Your HP: ${hpBar(player.hp, player.maxHp)}
🐉 Boss HP: ${hpBar(wb.hp, wb.maxHp)}
💥 Your Total Damage: *${wb.damageDealt[senderNumber].toLocaleString()}*`

  if (phaseMsg) msg += `\n\n⚡ *PHASE CHANGE!*\n${phaseMsg}`

  if (playerDead) {
    player.hp = Math.floor(player.maxHp * 0.25)
    await savePlayer(player)
    msg += `\n\n💀 *YOU WERE KNOCKED BACK!*\nYou barely survive with 25% HP.`
  }

  await reply(msg)
}

async function handleWorldBossDefeat(player, wb, lastDmg, wasCrit, ctx) {
  const { reply, sock, jid, msg: origMsg } = ctx
  const allPlayers = getAllPlayers() || {}

  // Rank participants by damage
  const rankings = Object.entries(wb.damageDealt || {})
    .sort((a, b) => b[1] - a[1])

  const topDealerId  = rankings[0]?.[0]
  const isTopDamager = topDealerId === ctx.senderNumber

  // Loot based on rank
  const baseGold = 1000
  const position = rankings.findIndex(([id]) => id === ctx.senderNumber) + 1
  const positionMultiplier = position === 1 ? 5 : position <= 3 ? 2.5 : 1
  const goldReward = Math.floor(baseGold * positionMultiplier)
  const gemReward  = position === 1 ? 5 : position <= 3 ? 2 : 0
  const expReward  = 2000

  player.gold += goldReward
  player.gems  = (player.gems || 0) + gemReward
  player.hp    = player.maxHp // Restore on boss kill

  // Kill tracking
  if (!player.killCounts) player.killCounts = {}
  player.killCounts.bossKills = (player.killCounts.bossKills || 0) + 1
  player.killCounts.legendaryBossKills = (player.killCounts.legendaryBossKills || 0) + 1
  const newTitles = checkTitleUnlocks(player)

  await addExp(ctx.senderNumber, expReward)
  await savePlayer(player)

  const critLine = wasCrit ? ' 💥 *CRITICAL HIT!*' : ''

  const victoryNarr = await generateVictoryNarrative(player.name, wb.name, `${goldReward}G + ${gemReward} Gems`)

  // Announce in group
  const rankBoard = rankings.slice(0, 5).map(([id, dmg], i) => {
    const p = allPlayers[id]
    return `${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${p?.name || id.slice(-6)}: *${dmg.toLocaleString()} dmg*`
  }).join('\n')

  const announcement =
`💥 *WORLD BOSS DEFEATED!*
${'═'.repeat(30)}

${gradeEmoji('S')} *${wb.name}* has fallen!
${victoryNarr}

${'═'.repeat(30)}
🏆 *FINAL DAMAGE RANKINGS:*
${'─'.repeat(28)}
${rankBoard}

${'═'.repeat(30)}
🏅 *TOP DAMAGE REWARD:*
💰 5,000G + 💎 5 Gems → *${allPlayers[topDealerId]?.name || 'Unknown'}*

_All participants receive EXP & Gold!_`

  // Send announcement
  try {
    await ctx.sock.sendMessage(ctx.jid, { text: announcement })
  } catch(e) { /* ignore if fails */ }

  // Clear world boss
  await setWorldBoss(null)

  let personalMsg =
`🎉 *YOUR REWARDS!*
━━━━━━━━━━━━━━━━━━━━━
📍 Rank: *#${position}*
⚔️ Last Hit: *${lastDmg.toLocaleString()} dmg*${critLine}

💰 Gold: *+${goldReward}G*
💎 Gems: *+${gemReward}*
⭐ EXP: *+${expReward}*
❤️ HP fully restored!`

  if (newTitles.length) personalMsg += `\n\n🏅 *TITLE UNLOCKED: ${newTitles[0].name}!*`

  await reply(personalMsg)
}

// ── Admin: Spawn World Boss ───────────────────────────
export async function spawnWorldBoss(sock, groupJid, bossId) {
  const boss = bossId
    ? WORLD_BOSS_LIST.find(b => b.id === bossId)
    : WORLD_BOSS_LIST[Math.floor(Math.random() * WORLD_BOSS_LIST.length)]

  if (!boss) return

  const bossData = {
    ...boss,
    hp: boss.maxHp,
    damageDealt: {},
    spawnedAt: Date.now(),
    triggeredPhases: [],
  }

  await setWorldBoss(bossData)

  const intro = await generateBossIntro(boss.name, 1, 'all adventurers')

  if (sock && groupJid) {
    await sock.sendMessage(groupJid, {
      text:
`🚨 *WORLD BOSS ALERT!* 🚨
${'═'.repeat(32)}

${gradeEmoji('S')} *${boss.name}* HAS APPEARED!

${intro}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Location: *${boss.region.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}*
❤️ HP: *${boss.maxHp.toLocaleString()}*
⚔️ Grade: *S — LEGENDARY*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💥 ALL ADVENTURERS — USE *!bossfight* TO ATTACK!
🏆 *Most damage = 5,000G + 💎 5 Gems reward!*
${'═'.repeat(32)}`
    })
  }
}
