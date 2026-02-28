// ═══════════════════════════════════════════
//       ⚔️  YATORPHG — MESSAGE HANDLER ⚔️
// ═══════════════════════════════════════════
import config from './config.js'
import { getPlayer } from './lib/database.js'
import { isOnCooldown, setCooldown } from './lib/cooldown.js'

// ── Import all plugins ───────────────────
import { cmdRegister, cmdProfile, cmdRename } from './plugins/rpg-register.js'
import { cmdAttack, cmdDefend, cmdFlee, cmdUseItem } from './plugins/rpg-combat.js'
import { cmdDungeon, cmdPartydungeon } from './plugins/rpg-dungeon.js'
import { cmdPvp } from './plugins/rpg-pvp.js'
import { cmdSkill, cmdSkills, cmdSkillInfo } from './plugins/rpg-skills.js'
import { cmdInventory, cmdDrop, cmdInspect, cmdUse } from './plugins/rpg-inventory.js'
import { cmdEquip, cmdUnequip } from './plugins/rpg-equip.js'
import { cmdShop, cmdBuy, cmdSell } from './plugins/rpg-shop.js'
import { cmdMarket, cmdList } from './plugins/rpg-market.js'
import { cmdBank, cmdDeposit, cmdWithdraw } from './plugins/rpg-bank.js'
import { cmdLoan, cmdRepay } from './plugins/rpg-loan.js'
import { cmdRob } from './plugins/rpg-rob.js'
import { cmdTrade } from './plugins/rpg-trade.js'
import { cmdParty } from './plugins/rpg-party.js'
import { cmdGuild } from './plugins/rpg-guild.js'
import { cmdQuest, cmdQuestList, cmdQuestAccept, cmdQuestComplete } from './plugins/rpg-quest.js'
import { cmdJobs, cmdJobApply, cmdWork, cmdJobResign } from './plugins/rpg-jobs.js'
import { cmdExplore, cmdTravel, cmdMap, cmdHunt } from './plugins/rpg-adventure.js'
import { cmdBossFight, cmdWorldBoss } from './plugins/rpg-boss.js'
import { cmdSummon, cmdSummons, cmdReleaseSummon } from './plugins/rpg-summon.js'
import { cmdEggs } from './plugins/rpg-eggs.js'
import { cmdTitles, cmdSetTitle } from './plugins/rpg-titles.js'
import { cmdAchievements } from './plugins/rpg-achievements.js'
import { cmdLeaderboard, cmdGoldRank } from './plugins/rpg-leaderboard.js'
import { cmdHelp, cmdClasses, cmdRaces, cmdLore, cmdRegions } from './plugins/rpg-help.js'
import { cmdAdmin } from './plugins/rpg-admin.js'

// ── Command map ──────────────────────────
const commands = {
  // Character
  register: cmdRegister,
  profile: cmdProfile,
  me: cmdProfile,
  rename: cmdRename,

  // Combat
  attack: cmdAttack,
  a: cmdAttack,
  defend: cmdDefend,
  d: cmdDefend,
  flee: cmdFlee,
  useitem: cmdUseItem,

  // Dungeon
  dungeon: cmdDungeon,
  partydungeon: cmdPartydungeon,
  pd: cmdPartydungeon,

  // PVP
  pvp: cmdPvp,
  duel: cmdPvp,

  // Skills
  skill: cmdSkill,
  s: cmdSkill,
  skills: cmdSkills,
  skillinfo: cmdSkillInfo,

  // Inventory
  inventory: cmdInventory,
  inv: cmdInventory,
  drop: cmdDrop,
  inspect: cmdInspect,
  use: cmdUse,

  // Equipment
  equip: cmdEquip,
  unequip: cmdUnequip,

  // Shop
  shop: cmdShop,
  buy: cmdBuy,
  sell: cmdSell,

  // Market
  market: cmdMarket,
  list: cmdList,

  // Bank
  bank: cmdBank,
  deposit: cmdDeposit,
  withdraw: cmdWithdraw,
  dep: cmdDeposit,
  with: cmdWithdraw,

  // Loan
  loan: cmdLoan,
  repay: cmdRepay,

  // Rob
  rob: cmdRob,
  steal: cmdRob,

  // Trade
  trade: cmdTrade,

  // Party
  party: cmdParty,

  // Guild
  guild: cmdGuild,

  // Quests
  quest: cmdQuest,
  questlist: cmdQuestList,
  questaccept: cmdQuestAccept,
  questcomplete: cmdQuestComplete,
  qc: cmdQuestComplete,

  // Jobs
  jobs: cmdJobs,
  jobapply: cmdJobApply,
  work: cmdWork,
  jobresign: cmdJobResign,

  // Adventure
  explore: cmdExplore,
  travel: cmdTravel,
  map: cmdMap,
  hunt: cmdHunt,

  // Bosses
  bossfight: cmdBossFight,
  bf: cmdBossFight,
  worldboss: cmdWorldBoss,
  wb: cmdWorldBoss,

  // Summons
  summon: cmdSummon,
  summons: cmdSummons,
  releasesummon: cmdReleaseSummon,

  // Eggs
  eggs: cmdEggs,
  myeggs: cmdEggs,

  // Titles
  titles: cmdTitles,
  settitle: cmdSetTitle,

  // Achievements
  achievements: cmdAchievements,
  ach: cmdAchievements,

  // Leaderboard
  leaderboard: cmdLeaderboard,
  lb: cmdLeaderboard,
  goldrank: cmdGoldRank,

  // Info
  help: cmdHelp,
  classes: cmdClasses,
  races: cmdRaces,
  lore: cmdLore,
  regions: cmdRegions,

  // Admin
  admin: cmdAdmin,
}

// ── Main handler ─────────────────────────
export async function handleMessage(sock, msg) {
  try {
    const jid = msg.key.remoteJid
    const isGroup = jid.endsWith('@g.us')
    const sender = isGroup
      ? msg.key.participant || msg.key.remoteJid
      : msg.key.remoteJid
    const senderNumber = sender.replace('@s.whatsapp.net', '').replace('@g.us', '')

    // Extract message text
    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      ''

    if (!body || !body.startsWith(config.botPrefix)) return

    const args = body.slice(config.botPrefix.length).trim().split(/\s+/)
    const cmd = args[0].toLowerCase()
    const text = args.slice(1).join(' ')

    if (!commands[cmd]) return

    const isOwner = senderNumber === config.ownerNumber

    // Build context object
    const ctx = {
      sock,
      msg,
      jid,
      sender,
      senderNumber,
      isGroup,
      isOwner,
      args: args.slice(1),
      text,
      cmd,
      prefix: config.botPrefix,
      reply: (text) => sock.sendMessage(jid, { text }, { quoted: msg }),
      replyImage: (url, caption) => sock.sendMessage(jid, { image: { url }, caption }, { quoted: msg }),
      replyImageBuffer: (buffer, caption) => sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg }),
    }

    // Run the command
    await commands[cmd](ctx)
  } catch (err) {
    console.error('Handler error:', err)
  }
}
