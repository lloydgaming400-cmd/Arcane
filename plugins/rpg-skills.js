// ═══════════════════════════════════════════════════════
//          ✨  YATORPHG — SKILLS SYSTEM  ✨
// ═══════════════════════════════════════════════════════
// cmdSkill (use skill in battle) lives in rpg-combat.js
export { cmdSkill } from './rpg-combat.js'
import { getPlayer, savePlayer } from '../lib/database.js'
import { SKILLS, getClass } from '../lib/rpg-engine.js'

// Get class skill unlock at each 5-level milestone
function getSkillUnlocksForLevel(classId, level) {
  const classSkills = Object.values(SKILLS).filter(s => s.class === classId)
  const starterCount = 3
  const unlockIndex = Math.floor(level / 5) - 1
  if (unlockIndex < 0 || unlockIndex >= classSkills.length - starterCount) return null
  return classSkills[starterCount + unlockIndex] || null
}

// ────────────────────────────────────────────────────
//  !skills — View your current skills
// ────────────────────────────────────────────────────
export async function cmdSkills(ctx) {
  const { reply, senderNumber } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)

  const classSkills = Object.values(SKILLS).filter(s => s.class === player.class)
  const learned = player.skills || []
  const nextUnlock = getSkillUnlocksForLevel(player.class, player.level + (5 - player.level % 5))

  const typeEmoji = { physical: '⚔️', magic: '🔮', buff: '💪', debuff: '🌑', heal: '💚', special: '✨', ultimate: '🌋' }

  const learnedList = learned.map(id => {
    const sk = SKILLS[id]
    if (!sk) return `• ${id.replace(/_/g, ' ')}`
    return `${sk.emoji} *${sk.name}* [${typeEmoji[sk.type] || '✨'}${sk.type}]
    MP: ${sk.mpCost} | ${sk.desc}`
  }).join('\n\n')

  const lockedList = classSkills.filter(s => !learned.includes(s.id)).map(s =>
    `🔒 *${s.name}* — _Unlocked at Level ${(classSkills.indexOf(s) + 1 - 3) * 5}_`
  ).join('\n')

  return reply(`╔══════════════════════════════════╗
║      ✨  YOUR SKILLS  ✨          ║
╚══════════════════════════════════╝

⚔️ *${player.name}* — ${getClass(player.class)?.name || player.class}
Level: ${player.level} | Skills: ${learned.length}/15
💙 MP: ${player.mp}/${player.maxMp}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 *LEARNED SKILLS (${learned.length})*

${learnedList || '_No skills learned yet_'}

${lockedList ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 *UPCOMING SKILLS*

${lockedList}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 New skill every *5 levels*
_Use in battle: *!skill [name]*_`)
}

// ────────────────────────────────────────────────────
//  !skillinfo [name] — Detailed skill info
// ────────────────────────────────────────────────────
export async function cmdSkillInfo(ctx) {
  const { reply, senderNumber, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply(`❌ Type *!register* first!`)
  if (!args[0]) return reply(`Usage: *!skillinfo [skill name]*\n_Example: !skillinfo fireball_`)

  const query = args.join(' ').toLowerCase().replace(/\s+/g, '_')
  const skill = Object.values(SKILLS).find(s => s.id === query || s.name.toLowerCase().replace(/\s+/g, '_') === query)

  if (!skill) return reply(`❌ Skill *${args.join(' ')}* not found!\n\nType *!skills* to see your skills.`)

  const owned = player.skills.includes(skill.id)
  const typeEmoji = { physical: '⚔️ Physical', magic: '🔮 Magic', buff: '💪 Buff', debuff: '🌑 Debuff', heal: '💚 Heal', special: '✨ Special', ultimate: '🌋 ULTIMATE' }

  return reply(`╔══════════════════════════════════╗
║     ${skill.emoji}  SKILL INFO  ${skill.emoji}             ║
╚══════════════════════════════════╝

*${skill.name}*
${owned ? '✅ You know this skill' : '🔒 Not yet learned'}

📋 *Type:* ${typeEmoji[skill.type] || skill.type}
💙 *MP Cost:* ${skill.mpCost}
⚔️ *Multiplier:* ${skill.mult > 0 ? `${skill.mult}x damage` : 'No direct damage'}
🏷️ *Class:* ${skill.class.charAt(0).toUpperCase() + skill.class.slice(1)}

📜 *Description:*
_${skill.desc}_

${skill.type === 'ultimate' ? '⚠️ *ULTIMATE* — Can only be used ONCE per dungeon run!' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Use in battle: !skill ${skill.name.toLowerCase()}_`)
}
