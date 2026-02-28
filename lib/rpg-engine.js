// ⚔️ RPG ENGINE — Core game logic
import config from '../config.js'
import { savePlayer, addExp, addKill, getRankBadge, updateWorldBoss, setWorldBoss, getWorldBoss, getAllPlayers } from './database.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadData(file) {
  return JSON.parse(readFileSync(join(__dirname, `../data/${file}`), 'utf8'))
}

export const CLASSES = loadData('classes.json')
export const RACES = loadData('races.json')
export const SKILLS = loadData('skills.json')
export const ITEMS = loadData('items.json')
export const REGIONS = loadData('regions.json')
export const BOSSES = loadData('bosses.json')
export const JOBS = loadData('jobs.json')
export const TITLES = loadData('titles.json')
export const EGGS = loadData('eggs.json')
export const QUESTS = loadData('quests.json')

export function getClass(id) { return CLASSES.find(c => c.id === id) }
export function getRace(id) { return RACES.find(r => r.id === id) }
export function getSkill(id) { return SKILLS.find(s => s.id === id) }
export function getItem(id) { return ITEMS.find(i => i.id === id) }
export function getRegion(id) { return REGIONS.find(r => r.id === id) }
export function getJob(id) { return JOBS.find(j => j.id === id) }

export function getTotalStats(player) {
  return player.str + player.agi + player.int + player.def + player.lck
}

export function getAttackDamage(player, skill = null) {
  const baseAtk = player.str + Math.floor(player.agi / 2)
  if (!skill) return baseAtk + Math.floor(Math.random() * 10)
  return Math.floor(eval(skill.damage.replace('str', player.str).replace('agi', player.agi).replace('int', player.int)))
}

export function getDefenseReduction(player) {
  return Math.floor(player.def * 0.5)
}

export function calculateCrit(player) {
  const critChance = 5 + Math.floor(player.lck / 5)
  return Math.random() * 100 < critChance
}

export function checkTitleUnlocks(player) {
  const newTitles = []
  const titles = loadData('titles.json')
  for (const title of titles) {
    if (player.titles.includes(title.id)) continue
    const req = title.requirement
    if (req.killType && (player.killCounts[req.killType] || 0) >= req.count) {
      newTitles.push(title)
      player.titles.push(title.id)
    }
    if (req.deaths && (player.killCounts.deaths || 0) >= req.deaths) {
      newTitles.push(title)
      player.titles.push(title.id)
    }
    if (req.level && player.level >= req.level) {
      newTitles.push(title)
      player.titles.push(title.id)
    }
  }
  return newTitles
}

export function gradeEmoji(grade) {
  const map = { E: '⬜', D: '🟩', C: '🟦', B: '🟨', A: '🟧', S: '🟥' }
  return map[grade] || '⬜'
}

export function rarityColor(rarity) {
  const map = { common: '⬜', uncommon: '🟩', rare: '🟦', legendary: '🟧', mythic: '🟥' }
  return map[rarity] || '⬜'
}

// World boss scheduler
export function startWorldBossScheduler(sock) {
  const intervalMs = config.worldBossSpawnHours * 60 * 60 * 1000
  setInterval(() => spawnWorldBoss(sock), intervalMs)
}

async function spawnWorldBoss(sock) {
  const worldBosses = [
    { name: '🐉 Ragnaros the Fire Dragon', hp: 100000, grade: 'S', region: 'dragon_mountains' },
    { name: '💀 The Bone Colossus', hp: 80000, grade: 'S', region: 'ancient_ruins' },
    { name: '😈 Archfiend Belzarak', hp: 90000, grade: 'S', region: 'demon_realm' },
  ]
  const boss = worldBosses[Math.floor(Math.random() * worldBosses.length)]
  await setWorldBoss({ ...boss, maxHp: boss.hp, damageDealt: {}, spawnedAt: Date.now() })
}
