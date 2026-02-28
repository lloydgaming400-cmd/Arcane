import { getPlayer } from '../lib/database.js'
import { getRank } from '../lib/rpg-engine.js'
import { hpBar, mpBar, expBar, formatNumber } from '../lib/simple.js'
import classData from '../data/classes.json' with { type: 'json' }
import raceData from '../data/races.json' with { type: 'json' }
import { getTitleById } from '../lib/titles-engine.js'

async function handler(ctx) {
    const { senderNum, args, reply } = ctx
    const targetId = args[0]?.replace(/[^0-9]/g, '') || senderNum
    const player = await getPlayer(targetId)

    if (!player) return reply(`⚠️ That player doesn't exist or hasn't registered.`)

    const rank = getRank(player.level)
    const clsInfo = classData[player.class] || {}
    const raceInfo = raceData[player.race] || {}
    const title = player.title ? getTitleById(player.title) : null
    const totalStats = player.str + player.agi + player.int + player.def + player.lck
    const equip = player.equipment || {}
    const weapon = equip.weapon || 'None'
    const armor = equip.armor || 'None'
    const accessory = equip.accessory || 'None'

    const locationName = player.region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    reply(
`╔══════════════════════════════════╗
║       ⚔️  ADVENTURER PROFILE      ║
╚══════════════════════════════════╝

${title ? `✦ *"${title.name}"*\n` : ''}${rank.badge} *${player.name}*
${clsInfo.emoji || '⚔️'} ${player.class.charAt(0).toUpperCase() + player.class.slice(1)}  •  ${raceInfo.emoji || '🧑'} ${raceInfo.name || player.race}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
📊 *LEVEL & RANK*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
🎖️ Rank: ${rank.badge} *${rank.name}*
⚡ Level: *${player.level}*
${expBar(player.exp, player.expNeeded)}
EXP: ${formatNumber(player.exp)} / ${formatNumber(player.expNeeded)}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
💪 *VITALS*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
${hpBar(player.hp, player.maxHp)}
${mpBar(player.mp, player.maxMp)}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
📈 *STATS* (Total: ${totalStats}/500)
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
⚔️ STR: ${player.str.toString().padStart(3)}  •  🏃 AGI: ${player.agi}
🔮 INT: ${player.int.toString().padStart(3)}  •  🛡️ DEF: ${player.def}
🍀 LCK: ${player.lck.toString().padStart(3)}  •  📍 ${locationName}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
💰 *WEALTH*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
💰 Gold: ${formatNumber(player.gold)}G
🏦 Bank: ${formatNumber(player.bank)}G
💎 Gems: ${player.gems}
${player.loan > 0 ? `⚠️ Loan: ${formatNumber(player.loan)}G` : ''}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
🗡️ *EQUIPMENT*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
⚔️ Weapon: ${weapon}
🛡️ Armor: ${armor}
💍 Accessory: ${accessory}
🐾 Summon: ${player.activeSummon || 'None'}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
🏰 *SOCIAL*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
🏰 Guild: ${player.guild || 'None'}
💼 Job: ${player.job ? `${player.job} (Lv${player.jobLevel})` : 'Unemployed'}
🏆 Titles: ${player.titles?.length || 0}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
📜 *BATTLE RECORD*
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
💀 Total Kills: ${formatNumber(player.stats?.totalKills || 0)}
🏛️ Dungeons: ${player.stats?.dungeonsCleared || 0}
👿 Bosses: ${player.stats?.bossesKilled || 0}
⚔️ PVP: ${player.stats?.pvpWins || 0}W / ${player.stats?.pvpLosses || 0}L
☠️ Deaths: ${player.stats?.deathCount || 0}`)
}

handler.command = /^(profile|stats|me|p)$/i
export default handler
