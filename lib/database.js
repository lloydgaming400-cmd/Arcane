// ═══════════════════════════════════════════
//       ⚔️  YATORPHG — DATABASE ENGINE ⚔️
// ═══════════════════════════════════════════
import { JSONFilePreset } from 'lowdb/node'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../database/players.json')

let db

const defaultDB = {
  players: {},
  guilds: {},
  market: [],
  worldBoss: null,
  globalStats: {
    totalPlayers: 0,
    totalBossKills: 0,
    totalDungeonsCleared: 0,
  },
}

export async function initDatabase() {
  db = await JSONFilePreset(dbPath, defaultDB)
  await db.read()
}

export function getDB() {
  return db
}

// ── Player Defaults ──────────────────────
export function newPlayer(name, classId, raceId, senderNumber) {
  return {
    id: senderNumber,
    name,
    class: classId,
    race: raceId,
    title: '',
    level: 1,
    exp: 0,
    rank: 'Peasant',

    // Stats
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    str: 10,
    agi: 10,
    int: 10,
    def: 10,
    lck: 10,

    // Economy
    gold: 500,
    gems: 10,
    bankGold: 0,
    loan: 0,
    loanDate: null,
    loanBlacklisted: false,
    bountyActive: false,
    jailUntil: null,

    // Location
    region: 'starter_village',
    location: 'Starter Village',

    // Combat state
    inDungeon: false,
    dungeonId: null,
    dungeonFloor: 0,
    dungeonCheckpoint: 0,
    inBattle: false,
    battleState: null,
    inPvp: false,

    // Inventory
    inventory: [],
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },

    // Skills
    skills: [],
    activeSkills: [],

    // Social
    party: null,
    guild: null,
    guildRole: null,

    // Job
    job: null,
    jobLevel: 0,
    jobExp: 0,

    // Quests
    activeQuests: [],
    completedQuests: [],

    // Summons
    summons: [],
    activeSummon: null,

    // Eggs
    eggs: [],

    // Titles & achievements
    titles: [],
    achievements: [],
    killCounts: {},

    // Timestamps
    lastWork: null,
    lastExplore: null,
    lastHunt: null,
    lastRob: null,
    lastDaily: null,
    lastInterest: null,
    registeredAt: Date.now(),
  }
}

// ── Player CRUD ──────────────────────────
export async function createPlayer(senderNumber, name, classId, raceId) {
  await db.read()
  db.data.players[senderNumber] = newPlayer(name, classId, raceId, senderNumber)
  db.data.globalStats.totalPlayers++
  await db.write()
  return db.data.players[senderNumber]
}

export function getPlayer(senderNumber) {
  return db.data.players[senderNumber] || null
}

export async function updatePlayer(senderNumber, updates) {
  await db.read()
  if (!db.data.players[senderNumber]) return null
  Object.assign(db.data.players[senderNumber], updates)
  await db.write()
  return db.data.players[senderNumber]
}

export async function savePlayer(player) {
  await db.read()
  db.data.players[player.id] = player
  await db.write()
}

export function playerExists(senderNumber) {
  return !!db.data.players[senderNumber]
}

export function getAllPlayers() {
  return Object.values(db.data.players)
}

// ── EXP & Leveling ───────────────────────
export async function addExp(senderNumber, amount) {
  await db.read()
  const player = db.data.players[senderNumber]
  if (!player) return null

  player.exp += amount
  const xpNeeded = player.level * 200
  let leveledUp = false
  let newSkills = []

  while (player.exp >= player.level * 200) {
    player.exp -= player.level * 200
    player.level++
    leveledUp = true

    // Stat growth on level up (capped at 100 per stat, 500 total)
    const totalStats = player.str + player.agi + player.int + player.def + player.lck
    if (totalStats < 500) {
      const gainPoints = 5
      let distributed = 0
      const stats = ['str', 'agi', 'int', 'def', 'lck']
      for (const stat of stats) {
        if (distributed >= gainPoints) break
        if (player[stat] < 100) {
          player[stat] += 1
          distributed++
        }
      }
    }

    // HP/MP growth
    player.maxHp = Math.min(2000, 100 + (player.level * 19))
    player.maxMp = Math.min(1000, 50 + (player.level * 9.5))
    player.hp = player.maxHp
    player.mp = player.maxMp

    // Update rank
    player.rank = getRank(player.level)

    // Unlock skill every 5 levels
    if (player.level % 5 === 0) {
      newSkills.push(`Level ${player.level} Skill Unlock`)
    }
  }

  await db.write()
  return { player, leveledUp, newSkills }
}

export function getRank(level) {
  if (level >= 100) return 'Transcendent'
  if (level >= 80) return 'Mythic'
  if (level >= 65) return 'Legend'
  if (level >= 50) return 'Champion'
  if (level >= 35) return 'Elite'
  if (level >= 20) return 'Veteran'
  if (level >= 10) return 'Adventurer'
  return 'Peasant'
}

export function getRankBadge(rank) {
  const badges = {
    Peasant: '🪨',
    Adventurer: '🗡️',
    Veteran: '⚔️',
    Elite: '🛡️',
    Champion: '👑',
    Legend: '🌟',
    Mythic: '💎',
    Transcendent: '🔱',
  }
  return badges[rank] || '🪨'
}

// ── Kill Count & Titles ──────────────────
export async function addKill(senderNumber, monsterType) {
  await db.read()
  const player = db.data.players[senderNumber]
  if (!player) return

  if (!player.killCounts[monsterType]) player.killCounts[monsterType] = 0
  player.killCounts[monsterType]++

  await db.write()
  return player.killCounts[monsterType]
}

// ── Guild CRUD ───────────────────────────
export async function createGuild(ownerId, name) {
  await db.read()
  const id = name.toLowerCase().replace(/\s+/g, '_')
  db.data.guilds[id] = {
    id,
    name,
    owner: ownerId,
    members: [ownerId],
    level: 1,
    bank: 0,
    exp: 0,
    createdAt: Date.now(),
    wins: 0,
    losses: 0,
  }
  await db.write()
  return db.data.guilds[id]
}

export function getGuild(id) {
  return db.data.guilds[id] || null
}

export function getGuildByName(name) {
  const id = name.toLowerCase().replace(/\s+/g, '_')
  return db.data.guilds[id] || null
}

export async function updateGuild(id, updates) {
  await db.read()
  Object.assign(db.data.guilds[id], updates)
  await db.write()
}

// ── Market ───────────────────────────────
export async function addMarketListing(listing) {
  await db.read()
  db.data.market.push({ ...listing, id: Date.now(), listedAt: Date.now() })
  await db.write()
}

export function getMarketListings() {
  return db.data.market || []
}

export async function removeMarketListing(id) {
  await db.read()
  db.data.market = db.data.market.filter(l => l.id !== id)
  await db.write()
}

// ── World Boss ───────────────────────────
export async function setWorldBoss(boss) {
  await db.read()
  db.data.worldBoss = boss
  await db.write()
}

export function getWorldBoss() {
  return db.data.worldBoss
}

export async function updateWorldBoss(updates) {
  await db.read()
  Object.assign(db.data.worldBoss, updates)
  await db.write()
}
