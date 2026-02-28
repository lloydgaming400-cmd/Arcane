// ═══════════════════════════════════════════════════════
//          ⚔️  YATORPHG — PVP DUEL SYSTEM  ⚔️
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer, addExp } from '../lib/database.js'
import { battleStatus, handleVictory } from './rpg-combat.js'
import { gradeEmoji } from '../lib/rpg-engine.js'

const pvpChallenges = {}  // pending challenges: challenger -> target

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function freshEffects() {
  return {
    playerEffects: { defending:false, poisonTurns:0, buffStr:0, buffStrTurns:0, vanished:false, vanishTurns:0,
      eagleEye:0, undying:false, undyingTurns:0, berserk:false, berserkTurns:0, ironWill:false, ironWillTurns:0,
      shielded:false, divineShield:0, divineTurns:0, firstTurn:true },
    enemyEffects: { stunned:false, poisonTurns:0, cursed:false, cursedTurns:0, burnTurns:0, plagueTurns:0, deathMark:false, trapped:false, trapTurns:0 },
    allyActive:false, allyDmg:0, allyTurns:0, ultimateUsed:false, turn:1
  }
}

// ────────────────────────────────────────────────────
//  !pvp @player — Challenge someone to a duel
// ────────────────────────────────────────────────────
export async function cmdPvp(ctx) {
  const { reply, senderNumber, args, mentionedJids, isGroup } = ctx
  const challenger = getPlayer(senderNumber)
  if (!challenger) return reply(`❌ Type *!register* first!`)
  if (!isGroup) return reply(`⚔️ PVP can only be done in groups!`)
  if (challenger.inBattle) return reply(`⚔️ You're already in a battle!`)
  if (challenger.inDungeon) return reply(`🗺️ Exit the dungeon first!`)

  // Check for accept
  if (args[0] === 'accept') {
    const pending = Object.entries(pvpChallenges).find(([, t]) => t === senderNumber)
    if (!pending) return reply(`❌ No pending PVP challenge for you!`)
    const [challengerId] = pending
    const ch = getPlayer(challengerId)
    if (!ch) return reply(`❌ Challenger not found!`)
    if (ch.inBattle || ch.inDungeon) return reply(`❌ Challenger is busy now!`)
    // Start duel!
    delete pvpChallenges[challengerId]
    return startPvpDuel(ch, challenger, ctx)
  }

  // Send challenge
  const targetJid = mentionedJids?.[0]
  if (!targetJid) return reply(`Usage: *!pvp @player*\n_Challenge someone to a duel!_`)
  const targetId = targetJid.replace('@s.whatsapp.net', '').replace(/@.+/, '')
  if (targetId === senderNumber) return reply(`❌ You can't challenge yourself!`)

  const target = getPlayer(targetId)
  if (!target) return reply(`❌ That player hasn't registered! Tell them to type *!register*`)
  if (target.inBattle) return reply(`❌ *${target.name}* is already in a battle!`)
  if (target.inDungeon) return reply(`❌ *${target.name}* is inside a dungeon!`)

  pvpChallenges[senderNumber] = targetId
  // Challenge expires in 2 minutes
  setTimeout(() => { delete pvpChallenges[senderNumber] }, 120000)

  const levelDiff = Math.abs(challenger.level - target.level)
  const warningMsg = levelDiff > 20 ? `\n⚠️ Level gap: ${levelDiff} levels! Could be unfair.` : ''

  await reply(`╔══════════════════════════════════╗
║      ⚔️  PVP CHALLENGE!  ⚔️        ║
╚══════════════════════════════════╝

*${challenger.name}* (Lv.${challenger.level}) challenges *${target.name}* (Lv.${target.level}) to a duel!${warningMsg}

Stakes: *Winner takes ${randInt(50, 200)}G* from loser!

⏳ Challenge expires in 2 minutes.

@${targetId} — Type *!pvp accept* to fight!`)
}

async function startPvpDuel(challenger, defender, ctx) {
  // Build enemy data from defender's stats
  const totalAtk = challenger.str + Math.floor(challenger.agi * 0.5)
  const defAsEnemy = {
    name: `${defender.name} [Lv.${defender.level}]`,
    hp: defender.hp, maxHp: defender.maxHp,
    atk: defender.str + Math.floor(defender.agi * 0.5),
    def: defender.def, grade: getGradeFromLevel(defender.level),
    isBoss: false, isPvp: true, index: 'pvp_player', type: 'player',
    defenderId: defender.id
  }

  const effects = freshEffects()
  const bs = { active: true, type: 'pvp', floor: 0, room: 0, enemy: defAsEnemy, ...effects, pvpDefenderId: defender.id }

  challenger.inBattle = true; challenger.battleState = bs; challenger.inPvp = true
  defender.inPvp = true
  await savePlayer(challenger); await savePlayer(defender)

  await ctx.reply(`╔══════════════════════════════════╗
║       ⚔️  DUEL BEGINS!  ⚔️         ║
╚══════════════════════════════════╝

*${challenger.name}* VS *${defender.name}*!

${challenger.name}: ❤️ ${challenger.hp}/${challenger.maxHp} HP
${defender.name}: ❤️ ${defender.hp}/${defender.maxHp} HP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*${challenger.name}* — it's YOUR turn!

⚔️ *!attack* | ✨ *!skill [name]* | 🛡️ *!defend*
🧪 *!item [name]* | 🏃 *!flee*`)
}

function getGradeFromLevel(level) {
  if (level >= 80) return 'S'
  if (level >= 60) return 'A'
  if (level >= 40) return 'B'
  if (level >= 20) return 'C'
  if (level >= 10) return 'D'
  return 'E'
}
