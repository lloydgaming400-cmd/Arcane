// ═══════════════════════════════════════════════════════
//          ⚔️  YATORPHG — COMBAT SYSTEM  ⚔️
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer, addExp, addKill } from '../lib/database.js'
import { getAttackDamage, calculateCrit, gradeEmoji, checkTitleUnlocks, SKILLS } from '../lib/rpg-engine.js'
import { generateVictoryNarrative, generateDeathNarrative } from '../lib/gemini.js'

const EXP_BY_GRADE  = { E: 15, D: 35, C: 70, B: 150, A: 300, S: 600 }
const GOLD_BY_GRADE = { E:{min:10,max:25}, D:{min:30,max:60}, C:{min:70,max:120}, B:{min:150,max:250}, A:{min:300,max:500}, S:{min:600,max:1000} }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

export function hpBar(cur, max) {
  const p = cur / max; const f = Math.round(p * 10)
  const c = p > 0.6 ? '🟩' : p > 0.3 ? '🟨' : '🟥'
  return `${c.repeat(f)}${'⬜'.repeat(10 - f)} ${cur}/${max}`
}
export function mpBar(cur, max) {
  const f = Math.round((cur / max) * 10)
  return `${'🟦'.repeat(f)}${'⬜'.repeat(10 - f)} ${cur}/${max}`
}

function findSkill(player, input) {
  const lower = input.toLowerCase().replace(/\s+/g, '_')
  const all = Object.values(SKILLS)
  return all.find(s => (s.id === lower || s.name.toLowerCase().replace(/\s+/g, '_') === lower) && player.skills.includes(s.id)) || null
}

export function battleStatus(player, bs) {
  const e = bs.enemy
  const pfx = bs.type === 'dungeon' ? `🗺️ *Floor ${bs.floor}* · Room ${bs.room}\n` : ''
  const peff = []; const eeff = []
  if (bs.playerEffects.defending) peff.push('🛡️ Defending')
  if (bs.playerEffects.poisonTurns > 0) peff.push(`☠️ Poisoned(${bs.playerEffects.poisonTurns})`)
  if (bs.playerEffects.buffStrTurns > 0) peff.push(`💪 STR+(${bs.playerEffects.buffStrTurns}t)`)
  if (bs.playerEffects.vanished) peff.push(`🌫️ Vanished(${bs.playerEffects.vanishTurns}t)`)
  if (bs.playerEffects.eagleEye > 0) peff.push(`👁️ EagleEye(${bs.playerEffects.eagleEye})`)
  if (bs.playerEffects.undying) peff.push(`🔮 Undying(${bs.playerEffects.undyingTurns}t)`)
  if (bs.playerEffects.shielded) peff.push('🔵 ManaShield')
  if (bs.playerEffects.divineShield > 0) peff.push(`✨ DivineShield(${bs.playerEffects.divineShield})`)
  if (bs.enemyEffects.stunned) eeff.push('⚡ Stunned')
  if (bs.enemyEffects.poisonTurns > 0) eeff.push(`☠️ Poisoned(${bs.enemyEffects.poisonTurns})`)
  if (bs.enemyEffects.cursed) eeff.push('🌑 Cursed')
  if (bs.enemyEffects.burnTurns > 0) eeff.push(`🔥 Burning(${bs.enemyEffects.burnTurns})`)
  if (bs.enemyEffects.deathMark) eeff.push('💀 DeathMark')
  if (bs.enemyEffects.plagueTurns > 0) eeff.push(`🦠 Plague(${bs.enemyEffects.plagueTurns})`)
  return `${pfx}━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *${player.name}*
❤️ HP: ${hpBar(player.hp, player.maxHp)}
💙 MP: ${mpBar(player.mp, player.maxMp)}
${peff.length ? peff.join('  ') + '\n' : ''}
${gradeEmoji(e.grade)}${e.isBoss ? '💀' : ''} *${e.name}* [${e.grade}]
❤️ HP: ${hpBar(e.hp, e.maxHp)}
${eeff.length ? eeff.join('  ') + '\n' : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━
⚔️ *!attack* · ✨ *!skill [name]* · 🛡️ *!defend*
🧪 *!item [name]* · 🏃 *!flee*`
}

function tickEffects(player, bs) {
  const log = []; const e = bs.enemy
  if (bs.playerEffects.poisonTurns > 0) { player.hp = Math.max(0, player.hp - 10); bs.playerEffects.poisonTurns--; log.push(`☠️ Poison hurts *${player.name}* for *10* dmg!`) }
  if (bs.playerEffects.buffStrTurns > 0) { bs.playerEffects.buffStrTurns--; if (!bs.playerEffects.buffStrTurns) { bs.playerEffects.buffStr = 0; log.push('💪 STR buff expired.') } }
  if (bs.playerEffects.vanishTurns > 0) { bs.playerEffects.vanishTurns--; if (!bs.playerEffects.vanishTurns) { bs.playerEffects.vanished = false; log.push('🌫️ Vanish expired.') } }
  if (bs.playerEffects.eagleEye > 0) bs.playerEffects.eagleEye--
  if (bs.playerEffects.undyingTurns > 0) { bs.playerEffects.undyingTurns--; if (!bs.playerEffects.undyingTurns) { bs.playerEffects.undying = false; log.push('🔮 Undying expired.') } }
  if (bs.playerEffects.berserkTurns > 0) { bs.playerEffects.berserkTurns--; if (!bs.playerEffects.berserkTurns) { bs.playerEffects.berserk = false; log.push('🔴 Berserk expired.') } }
  if (bs.playerEffects.ironWillTurns > 0) { bs.playerEffects.ironWillTurns--; if (!bs.playerEffects.ironWillTurns) { bs.playerEffects.ironWill = false; log.push('🗿 Iron Will expired.') } }
  if (bs.playerEffects.divineTurns > 0) { bs.playerEffects.divineTurns--; if (!bs.playerEffects.divineTurns) { bs.playerEffects.divineShield = 0; log.push('🛡️ Divine Shield expired.') } }
  if (bs.enemyEffects.poisonTurns > 0) { e.hp = Math.max(0, e.hp - 10); bs.enemyEffects.poisonTurns--; log.push(`☠️ Poison burns *${e.name}* for *10* dmg!`) }
  if (bs.enemyEffects.burnTurns > 0) { e.hp = Math.max(0, e.hp - 15); bs.enemyEffects.burnTurns--; log.push(`🔥 Burn deals *15* dmg to *${e.name}*!`) }
  if (bs.enemyEffects.plagueTurns > 0) { e.hp = Math.max(0, e.hp - 15); bs.enemyEffects.plagueTurns--; log.push(`🦠 Plague rots *${e.name}* for *15* dmg!`) }
  if (bs.enemyEffects.stunned) bs.enemyEffects.stunned = false
  if (bs.enemyEffects.cursedTurns > 0) { bs.enemyEffects.cursedTurns--; if (!bs.enemyEffects.cursedTurns) bs.enemyEffects.cursed = false }
  if (bs.enemyEffects.trapTurns > 0) { bs.enemyEffects.trapTurns--; if (!bs.enemyEffects.trapTurns) bs.enemyEffects.trapped = false }
  if (bs.allyActive && bs.allyTurns > 0) { e.hp = Math.max(0, e.hp - bs.allyDmg); bs.allyTurns--; log.push(`💀 Skeleton ally strikes for *${bs.allyDmg}* dmg!`); if (!bs.allyTurns) { bs.allyActive = false; log.push('☠️ Skeleton crumbles.') } }
  return log
}

function enemyAttack(player, bs) {
  const e = bs.enemy
  if (bs.enemyEffects.stunned || bs.enemyEffects.trapped) return `⚡ *${e.name}* is stunned and cannot act!`
  if (bs.playerEffects.vanished) return `🌫️ *${e.name}* swings wildly — you're invisible!`
  if (bs.playerEffects.divineShield > 0) { bs.playerEffects.divineShield--; return `✨ *Divine Shield* absorbs *${e.name}*'s attack!` }
  if (bs.playerEffects.shielded) { bs.playerEffects.shielded = false; return `🔵 *Mana Shield* blocks *${e.name}*'s attack!` }
  let dmg = e.atk + randInt(0, 5)
  if (bs.enemyEffects.cursed) dmg = Math.floor(dmg * 0.8)
  if (e.isBoss && e.hp < e.maxHp * 0.5) dmg = Math.floor(dmg * 1.3)
  let def = player.def + (bs.playerEffects.ironWill ? Math.floor(player.def * 0.4) : 0)
  let final = Math.max(1, dmg - Math.floor(def * 0.5))
  if (bs.playerEffects.defending) final = Math.floor(final * 0.5)
  if (bs.playerEffects.undying) { player.hp = Math.max(1, player.hp - final); return `🔮 *Undying* — ${e.name} deals *${final}* but you CANNOT DIE!` }
  player.hp = Math.max(0, player.hp - final)
  const crit = Math.random() < 0.1
  if (crit) { const extra = Math.floor(final * 0.5); player.hp = Math.max(0, player.hp - extra); return `💥 *${e.name}* lands a CRITICAL for *${final + extra}* dmg!` }
  return `🗡️ *${e.name}* attacks for *${final}* dmg!`
}

export async function handleVictory(player, bs, ctx) {
  const e = bs.enemy; const grade = e.grade || 'E'
  const expGain = e.isBoss ? EXP_BY_GRADE[grade] * 3 : (EXP_BY_GRADE[grade] || 15)
  const gr = GOLD_BY_GRADE[grade] || GOLD_BY_GRADE.E
  const goldGain = e.isBoss ? randInt(gr.min * 2, gr.max * 3) : randInt(gr.min, gr.max)
  const lootPool = ['health_potion', 'mana_potion', 'antidote', null, null, null, null]
  const loot = lootPool[randInt(0, lootPool.length - 1)]
  if (loot && player.inventory.length < 30) player.inventory.push(loot)
  player.gold += goldGain
  const monType = (e.index || e.name).toLowerCase().replace(/\s+/g, '_')
  if (!player.killCounts[monType]) player.killCounts[monType] = 0
  player.killCounts[monType]++
  player.mp = Math.min(player.maxMp, player.mp + Math.floor(player.maxMp * 0.1))
  const wasInDungeon = bs.type === 'dungeon'
  const floor = bs.floor; const room = bs.room
  player.inBattle = false; player.battleState = null
  const expResult = await addExp(player.id, expGain)
  const updatedPlayer = { ...expResult.player, gold: player.gold, inventory: player.inventory, inBattle: false, battleState: null, mp: player.mp, killCounts: player.killCounts }
  const newTitles = checkTitleUnlocks(updatedPlayer)
  await savePlayer(updatedPlayer)
  const lootMsg = loot ? `\n🎁 Item Drop: *${loot.replace(/_/g, ' ')}*` : ''
  const lvlMsg = expResult.leveledUp ? `\n\n🌟 *LEVEL UP! Now Level ${expResult.player.level}!*` : ''
  const titleMsg = newTitles.map(t => `\n🏅 *NEW TITLE: "${t.name}"!*`).join('')
  const narr = await generateVictoryNarrative(player.name, e.name, loot || 'gold')
  await ctx.reply(`╔══════════════════════════════════╗
║       ⚔️  VICTORY!  ⚔️            ║
╚══════════════════════════════════╝

${narr}

━━━━━━━━━━━━━━━━━━━━━━━━━
💀 *${e.name}* [${grade}] defeated!
💰 Gold earned: *+${goldGain}G*
⚡ EXP gained: *+${expGain}*${lootMsg}${lvlMsg}${titleMsg}
━━━━━━━━━━━━━━━━━━━━━━━━━
${wasInDungeon ? `🗺️ Floor ${floor} Room ${room} cleared!\nType *!dungeon* to continue.` : 'Type *!hunt* to fight again!'}`)
}

export async function handleDeath(player, bs, ctx) {
  const e = bs.enemy
  const goldLoss = Math.floor(player.gold * 0.1)
  player.gold = Math.max(0, player.gold - goldLoss)
  player.hp = Math.floor(player.maxHp * 0.3)
  player.inBattle = false; player.battleState = null
  if (!player.killCounts.deaths) player.killCounts.deaths = 0
  player.killCounts.deaths++
  const wasInDungeon = bs.type === 'dungeon'
  if (wasInDungeon) { player.dungeonFloor = player.dungeonCheckpoint || 1; player.inDungeon = false }
  await savePlayer(player)
  const narr = await generateDeathNarrative(player.name, e.name, bs.floor || 0)
  await ctx.reply(`╔══════════════════════════════════╗
║        💀  YOU DIED  💀           ║
╚══════════════════════════════════╝

${narr}

━━━━━━━━━━━━━━━━━━━━━━━━━
☠️ Slain by *${e.name}* [${e.grade}]
💰 Lost: *${goldLoss}G* (death penalty)
❤️ Revived with *${player.hp} HP*
${wasInDungeon ? `🗺️ Dungeon reset to Floor *${player.dungeonFloor}* (last checkpoint)` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━
_Rise again, hero. Your legend is not over._
Type *!dungeon* or *!hunt* to continue.`)
}

function calcSkillDmg(player, skill, bs, isUlt = false) {
  const stat = skill.type === 'magic' ? player.int : player.str
  const bonus = Math.floor(player.agi * 0.3)
  const defRed = Math.floor((bs.enemy.def || 5) * 0.3)
  let dmg = Math.floor((stat + bonus + randInt(0, 5)) * skill.mult) - defRed
  if (bs.playerEffects.berserk && skill.type === 'physical') dmg = Math.floor(dmg * 2)
  if (isUlt) dmg = Math.floor(dmg * 1.5)
  const isCrit = bs.playerEffects.eagleEye > 0 ? true : calculateCrit(player)
  if (isCrit && !isUlt) dmg = Math.floor(dmg * 1.75)
  return Math.max(1, dmg)
}

export async function cmdAttack(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (!player.inBattle || !player.battleState) return reply(`⚠️ You're not in combat!\nUse *!dungeon* or *!hunt* to find enemies.`)
  const bs = player.battleState; const e = bs.enemy
  bs.playerEffects.defending = false
  let atk = player.str + (bs.playerEffects.buffStr || 0) + randInt(0, 8)
  if (bs.playerEffects.berserk) atk = Math.floor(atk * 2)
  const isCrit = bs.playerEffects.eagleEye > 0 ? true : calculateCrit(player)
  let dmg = Math.max(1, atk - Math.floor((e.def || 5) * 0.4))
  if (isCrit) dmg = Math.floor(dmg * 1.75)
  if (bs.enemyEffects.deathMark) { dmg = Math.floor(dmg * 2); bs.enemyEffects.deathMark = false }
  e.hp = Math.max(0, e.hp - dmg)
  let log = `⚔️ *${player.name}* attacks *${e.name}* for *${dmg}* dmg!${isCrit ? '\n💥 *CRITICAL HIT!*' : ''}\n`
  if (e.hp <= 0) { player.battleState = bs; return await handleVictory(player, bs, ctx) }
  const ticks = tickEffects(player, bs)
  if (ticks.length) log += ticks.join('\n') + '\n'
  if (e.hp <= 0) { player.battleState = bs; return await handleVictory(player, bs, ctx) }
  log += enemyAttack(player, bs)
  bs.turn++; player.battleState = bs
  if (player.hp <= 0) return await handleDeath(player, bs, ctx)
  await savePlayer(player)
  await reply(`${log}\n\n${battleStatus(player, bs)}`)
}

export async function cmdDefend(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (!player.inBattle || !player.battleState) return reply(`⚠️ You're not in combat!`)
  const bs = player.battleState
  bs.playerEffects.defending = true
  const ticks = tickEffects(player, bs); const enemyMsg = enemyAttack(player, bs)
  bs.turn++; player.battleState = bs
  if (player.hp <= 0) return await handleDeath(player, bs, ctx)
  await savePlayer(player)
  await reply(`🛡️ *${player.name}* takes a defensive stance! Damage reduced 50%.\n\n${ticks.join('\n')}${ticks.length ? '\n' : ''}${enemyMsg}\n\n${battleStatus(player, bs)}`)
}

export async function cmdFlee(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (!player.inBattle || !player.battleState) return reply(`⚠️ You're not in combat!`)
  const bs = player.battleState
  if (bs.enemy.isBoss) return reply(`🚫 *You CANNOT flee from a Boss!*\n_Fight or die, hero._`)
  const fleeChance = 30 + player.agi
  if (Math.random() * 100 < fleeChance) {
    player.inBattle = false; player.battleState = null
    if (bs.type === 'dungeon') player.inDungeon = false
    await savePlayer(player)
    return reply(`🏃 *${player.name}* escapes into the shadows!\n_You live to fight another day..._`)
  }
  const enemyMsg = enemyAttack(player, bs); bs.turn++; player.battleState = bs
  if (player.hp <= 0) return await handleDeath(player, bs, ctx)
  await savePlayer(player)
  return reply(`💨 *${player.name}* tries to flee but fails!\n\n${enemyMsg}\n\n${battleStatus(player, bs)}`)
}

export async function cmdUseItem(ctx) {
  const { reply, senderNumber, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (!player.inBattle || !player.battleState) return reply(`⚠️ You're not in combat!`)
  if (!args[0]) return reply(`Usage: *!item [item name]*\n_Example: !item health potion_`)
  const bs = player.battleState
  const itemName = args.join(' ').toLowerCase().replace(/\s+/g, '_')
  const idx = player.inventory.indexOf(itemName)
  if (idx === -1) return reply(`❌ You don't have *${args.join(' ')}* in your inventory!\nType *!inventory* to check.`)
  let result = ''
  if (itemName === 'health_potion') { const h = 100; player.hp = Math.min(player.maxHp, player.hp + h); result = `🧪 *Health Potion* — Restored *${h} HP*` }
  else if (itemName === 'mega_health') { const h = 300; player.hp = Math.min(player.maxHp, player.hp + h); result = `🧪 *Mega Health* — Restored *${h} HP*` }
  else if (itemName === 'elixir_of_life') { player.hp = player.maxHp; result = `✨ *Elixir of Life* — HP fully restored!` }
  else if (itemName === 'mana_potion') { const m = 80; player.mp = Math.min(player.maxMp, player.mp + m); result = `🔵 *Mana Potion* — Restored *${m} MP*` }
  else if (itemName === 'mega_mana') { player.mp = player.maxMp; result = `🔵 *Mega Mana* — MP fully restored!` }
  else if (itemName === 'antidote') { bs.playerEffects.poisonTurns = 0; result = `💊 *Antidote* — Poison cured!` }
  else if (itemName === 'revival_stone') { const h = Math.floor(player.maxHp * 0.5); player.hp = Math.min(player.maxHp, player.hp + h); result = `💎 *Revival Stone* — Restored *${h} HP*` }
  else return reply(`❌ *${args.join(' ')}* cannot be used in battle!`)
  player.inventory.splice(idx, 1)
  const ticks = tickEffects(player, bs); const enemyMsg = enemyAttack(player, bs)
  bs.turn++; player.battleState = bs
  if (player.hp <= 0) return await handleDeath(player, bs, ctx)
  await savePlayer(player)
  await reply(`${result}\n\n${ticks.join('\n')}${ticks.length ? '\n' : ''}${enemyMsg}\n\n${battleStatus(player, bs)}`)
}

export async function cmdSkill(ctx) {
  const { reply, senderNumber, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (!player.inBattle || !player.battleState) return reply(`⚠️ You're not in combat!\n\nStart a fight with *!dungeon* or *!hunt*`)
  if (!args[0]) return reply(`Usage: *!skill [name]*\n\nYour skills:\n${player.skills.map(s => `• ${s.replace(/_/g, ' ')}`).join('\n')}\n\nType *!skills* for full details.`)
  const bs = player.battleState; const e = bs.enemy
  const skill = findSkill(player, args.join(' '))
  if (!skill) return reply(`❌ Skill *${args.join(' ')}* not found!\n\nYour skills:\n${player.skills.map(s => `• ${s.replace(/_/g, ' ')}`).join('\n')}`)
  if (player.mp < skill.mpCost) return reply(`❌ Not enough MP! Need *${skill.mpCost} MP* (you have *${player.mp} MP*)\n\n💡 Use *!item mana potion*`)
  if (skill.type === 'ultimate' && bs.ultimateUsed) return reply(`⚡ *${skill.name}* already used this dungeon! (One ultimate per run)`)
  player.mp -= skill.mpCost; bs.playerEffects.defending = false
  let log = `${skill.emoji} *${player.name}* uses *${skill.name}*!\n`
  const S = skill.id

  if (['slash','power_strike','whirlwind','chain_lightning','meteor','star_fall','arrow_rain','multi_shot'].includes(S)) {
    const dmg = calcSkillDmg(player, skill, bs); e.hp -= dmg; log += `Deals *${dmg}* damage!`
  } else if (S === 'shield_bash' || S === 'blizzard' || S === 'death_coil' || S === 'titan_slam') {
    const dmg = calcSkillDmg(player, skill, bs); e.hp -= dmg; bs.enemyEffects.stunned = true; log += `Deals *${dmg}* damage and stuns!`
  } else if (S === 'battle_cry') {
    bs.playerEffects.buffStr = Math.floor(player.str * 0.2); bs.playerEffects.buffStrTurns = 3; log += `STR boosted 20% for 3 turns!`
  } else if (S === 'berserk') {
    bs.playerEffects.berserk = true; bs.playerEffects.berserkTurns = 3; player.def = Math.floor(player.def * 0.5); log += `ATK doubled, DEF halved for 3 turns!`
  } else if (S === 'iron_will') {
    bs.playerEffects.ironWill = true; bs.playerEffects.ironWillTurns = 2; log += `Damage taken -40% for 2 turns!`
  } else if (S === 'war_shout') {
    bs.enemyEffects.cursed = true; bs.enemyEffects.cursedTurns = 2; e.atk = Math.floor(e.atk * 0.7); log += `Enemy ATK -30% for 2 turns!`
  } else if (S === 'godlike_rage' || S === 'omega_burst' || S === 'storm_of_arrows' || S === 'heavens_judgement') {
    bs.ultimateUsed = true; const dmg = calcSkillDmg(player, skill, bs, true); e.hp -= dmg; log += `🌋 *ULTIMATE* deals *${dmg}* DEVASTATING damage!`
  } else if (S === 'fireball') {
    const dmg = calcSkillDmg(player, skill, bs); e.hp -= dmg; bs.enemyEffects.burnTurns = 2; log += `Deals *${dmg}* damage and sets on FIRE!`
  } else if (S === 'ice_shard') {
    const dmg = calcSkillDmg(player, skill, bs); e.hp -= dmg; e.atk = Math.floor(e.atk * 0.7); log += `Deals *${dmg}* damage and slows enemy!`
  } else if (S === 'mana_shield') {
    bs.playerEffects.shielded = true; log += `Next attack is absorbed!`
  } else if (S === 'backstab') {
    const m = bs.turn === 1 ? skill.mult * 2 : skill.mult; const dmg = calcSkillDmg(player, {...skill, mult: m}, bs)
    e.hp -= dmg; log += `Deals *${dmg}* damage${bs.turn === 1 ? ' (FIRST TURN BONUS!)' : ''}!`
  } else if (S === 'poison_blade') {
    const dmg = calcSkillDmg(player, skill, bs); e.hp -= dmg; bs.enemyEffects.poisonTurns = 3; log += `Deals *${dmg}* dmg + poisons for 3 turns!`
  } else if (S === 'shadow_step') {
    bs.playerEffects.eagleEye = 1; log += `Next attack is guaranteed CRIT!`
  } else if (S === 'shadow_clone') {
    bs.playerEffects.shielded = true; log += `Clone will absorb the next hit!`
  } else if (S === 'death_mark') {
    bs.enemyEffects.deathMark = true; log += `${e.name} is marked — next hit deals 200% dmg!`
  } else if (S === 'vanish') {
    bs.playerEffects.vanished = true; bs.playerEffects.vanishTurns = 2; log += `Invisible for 2 turns!`
  } else if (S === 'assassinate') {
    bs.ultimateUsed = true
    if (e.hp < e.maxHp * 0.3 && !e.isBoss) { e.hp = 0; log += `*INSTAKILL EXECUTION!*` }
    else { const dmg = calcSkillDmg(player, skill, bs, true); e.hp -= dmg; log += `Deals *${dmg}* damage! (Need < 30% HP for instakill)` }
  } else if (S === 'eagle_eye') {
    bs.playerEffects.eagleEye = 3; log += `Next 3 attacks guaranteed CRIT!`
  } else if (S === 'trap') {
    bs.enemyEffects.trapped = true; bs.enemyEffects.trapTurns = 1; const dmg = Math.floor(player.agi * 1.2); e.hp -= dmg; log += `Deals *${dmg}* dmg + enemy skips next turn!`
  } else if (S === 'snipe') {
    const dmg = Math.max(1, Math.floor(player.agi * 2.5 + player.str * 0.5)); e.hp -= dmg; log += `TRUE DAMAGE *${dmg}* ignoring all armor!`
  } else if (S === 'holy_strike') {
    const m = e.type === 'undead' ? skill.mult * 2 : skill.mult; const dmg = calcSkillDmg(player, {...skill, mult: m}, bs); e.hp -= dmg; log += `Deals *${dmg}* holy dmg${e.type === 'undead' ? ' (UNDEAD BONUS!)' : ''}!`
  } else if (S === 'heal') {
    const h = Math.floor(player.maxHp * 0.3); player.hp = Math.min(player.maxHp, player.hp + h); log += `Restores *${h} HP*!`
  } else if (S === 'divine_shield') {
    bs.playerEffects.divineShield = 3; bs.playerEffects.divineTurns = 3; log += `Blocks next 3 attacks!`
  } else if (S === 'smite') {
    const m = e.type === 'demon' ? skill.mult * 2 : skill.mult; const dmg = calcSkillDmg(player, {...skill, mult: m}, bs); e.hp -= dmg; log += `Deals *${dmg}* lightning dmg${e.type === 'demon' ? ' (DEMON BONUS!)' : ''}!`
  } else if (S === 'resurrection') {
    const h = Math.floor(player.maxHp * 0.5); player.hp = Math.min(player.maxHp, player.hp + h); log += `Divine power restores *${h} HP*!`
  } else if (S === 'soul_drain') {
    const dmg = calcSkillDmg(player, skill, bs); e.hp -= dmg; const drain = Math.floor(dmg * 0.5); player.hp = Math.min(player.maxHp, player.hp + drain); log += `Deals *${dmg}* dmg and steals *${drain} HP*!`
  } else if (S === 'raise_dead') {
    bs.allyActive = true; bs.allyDmg = Math.floor(player.int * 0.5); bs.allyTurns = 3; log += `Skeleton warrior joins for 3 turns!`
  } else if (S === 'curse') {
    bs.enemyEffects.cursed = true; bs.enemyEffects.cursedTurns = 3; e.atk = Math.floor(e.atk * 0.8); e.def = Math.floor(e.def * 0.8); log += `${e.name}'s all stats -20% for 3 turns!`
  } else if (S === 'army_of_dead') {
    bs.allyActive = true; bs.allyDmg = Math.floor(player.int * 0.8); bs.allyTurns = 5; log += `5 skeletons rise and will fight for 5 turns!`
  } else if (S === 'plague') {
    bs.enemyEffects.plagueTurns = 5; log += `${e.name} infected! 15 dmg/turn for 5 turns!`
  } else if (S === 'undying') {
    bs.ultimateUsed = true; bs.playerEffects.undying = true; bs.playerEffects.undyingTurns = 3; log += `*IMMORTAL* for 3 turns! You cannot die!`
  } else {
    const dmg = calcSkillDmg(player, skill, bs); e.hp -= dmg; log += `Deals *${dmg}* damage!`
  }

  e.hp = Math.max(0, e.hp)
  if (e.hp <= 0) { player.battleState = bs; return await handleVictory(player, bs, ctx) }
  const ticks = tickEffects(player, bs)
  if (e.hp <= 0) { player.battleState = bs; return await handleVictory(player, bs, ctx) }
  const enemyMsg = enemyAttack(player, bs)
  if (ticks.length) log += '\n' + ticks.join('\n')
  log += '\n' + enemyMsg
  bs.turn++; bs.playerEffects.firstTurn = false; player.battleState = bs
  if (player.hp <= 0) return await handleDeath(player, bs, ctx)
  await savePlayer(player)
  await reply(`${log}\n\n${battleStatus(player, bs)}`)
}
