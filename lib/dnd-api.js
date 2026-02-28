// ⚔️ DND API — Monster & Spell fetcher
import axios from 'axios'
import config from '../config.js'
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 3600 })

async function fetchDnD(endpoint) {
  const cached = cache.get(endpoint)
  if (cached) return cached
  try {
    const { data } = await axios.get(`${config.dndApiBase}${endpoint}`)
    cache.set(endpoint, data)
    return data
  } catch { return null }
}

async function fetchOpen5e(endpoint) {
  const cached = cache.get('o5e_' + endpoint)
  if (cached) return cached
  try {
    const { data } = await axios.get(`${config.open5eBase}${endpoint}`)
    cache.set('o5e_' + endpoint, data)
    return data
  } catch { return null }
}

export async function getMonsterByName(name) {
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  return await fetchDnD(`/monsters/${slug}`)
}

export async function getRandomMonsterByCR(minCR, maxCR) {
  const all = await fetchDnD('/monsters')
  if (!all?.results) return null
  const filtered = all.results.filter(m => {
    const cr = parseFloat(m.challenge_rating || 0)
    return cr >= minCR && cr <= maxCR
  })
  if (!filtered.length) return null
  const pick = filtered[Math.floor(Math.random() * filtered.length)]
  return await getMonsterByName(pick.index)
}

export async function getSpell(name) {
  const slug = name.toLowerCase().replace(/\s+/g, '-')
  return await fetchDnD(`/spells/${slug}`)
}

export async function getAllSpells() {
  return await fetchDnD('/spells')
}

export function mapCRToGrade(cr) {
  const n = parseFloat(cr)
  if (n <= 0.5) return 'E'
  if (n <= 2) return 'D'
  if (n <= 5) return 'C'
  if (n <= 10) return 'B'
  if (n <= 17) return 'A'
  return 'S'
}

export function mapFloorToCR(floor) {
  if (floor <= 20) return { min: 0, max: 2 }
  if (floor <= 40) return { min: 1, max: 5 }
  if (floor <= 60) return { min: 4, max: 9 }
  if (floor <= 80) return { min: 8, max: 14 }
  return { min: 13, max: 30 }
}

export function scaleMonsterToFloor(monster, floor) {
  const scale = 1 + (floor / 100)
  return {
    ...monster,
    hit_points: Math.floor((monster.hit_points || 50) * scale),
    armor_class: Math.floor((monster.armor_class?.[0]?.value || 10) * Math.min(scale, 1.5)),
    scaledATK: Math.floor(10 * scale),
    grade: mapCRToGrade(monster.challenge_rating),
  }
}
