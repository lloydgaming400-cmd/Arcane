// ═══════════════════════════════════════════
//         ⚔️  YATORPHG BOT — CONFIG ⚔️
// ═══════════════════════════════════════════

const config = {
  // ── Bot Identity ──────────────────────────
  botName: '⚔️ YatoRPG',
  botPrefix: '!',
  botVersion: '1.0.0',

  // ── Owner ─────────────────────────────────
  ownerNumber: '2347062301848',
  ownerName: 'The Architect',

  // ── API Keys ──────────────────────────────
  geminiKey: 'AIzaSyCPzYEsOuIHKX32boPjR0TuSXshIRwTtEA',

  // ── Free APIs (no key needed) ─────────────
  dndApiBase: 'https://www.dnd5eapi.co/api',
  open5eBase: 'https://api.open5eapi.com/v1',

  // ── Gameplay Settings ─────────────────────
  startingGold: 500,
  startingGems: 10,
  maxPartySize: 4,
  maxGuildMembers: 50,
  dungeonFloors: 100,
  checkpointEvery: 10,
  worldBossSpawnHours: 6,
  maxActiveQuests: 5,
  maxActiveSkills: 15,
  maxStatTotal: 500,
  maxHP: 2000,
  maxMP: 1000,
  maxSingleStat: 100,

  // ── Cooldowns (ms) ────────────────────────
  cooldowns: {
    work: 2 * 60 * 60 * 1000,        // 2 hours
    explore: 30 * 60 * 1000,         // 30 mins
    hunt: 15 * 60 * 1000,            // 15 mins
    rob: 60 * 60 * 1000,             // 1 hour
    daily: 24 * 60 * 60 * 1000,      // 24 hours
    claimInterest: 24 * 60 * 60 * 1000,
  },

  // ── Economy ───────────────────────────────
  bankInterestRate: 0.02,            // 2% daily
  loanInterestRate: 0.10,            // 10% per day
  loanMaxMultiplier: 2,              // borrow up to 2x bank balance
  loanSeizureDays: 7,
  loanBlacklistDays: 14,
  loanBountyDays: 30,
  guildCreationCost: 5000,
  robSuccessChance: 0.45,            // 45% chance to succeed
  robStealPercent: 0.15,
  robFailLosePercent: 0.10,
  robJailMinutes: 30,
  deathGoldPenaltyPercent: 0.10,

  // ── XP Formula ────────────────────────────
  // EXP needed = level * 200
  xpFormula: (level) => level * 200,

  // ── NPC Message Interval (ms) ─────────────
  npcMessageInterval: 8 * 60 * 1000, // NPCs talk every 8 mins

  // ── Styling ───────────────────────────────
  divider: '━━━━━━━━━━━━━━━━━━━━━━━',
  thinDivider: '─────────────────────',
  doubleDivider: '══════════════════════',
}

export default config
