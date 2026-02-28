// ═══════════════════════════════════════════════
//       ⚔️  YATORPHG — COOLDOWN ENGINE ⚔️
// ═══════════════════════════════════════════════
import NodeCache from 'node-cache'
const cache = new NodeCache()

export function isOnCooldown(userId, action) {
  return cache.has(`${userId}_${action}`)
}

// Alias for isOnCooldown (used by some plugins)
export function checkCooldown(userId, action) {
  const key = `${userId}_${action}`
  const has = cache.has(key)
  if (!has) return { onCooldown: false }
  const ttl = cache.getTtl(key)
  const remaining = ttl ? ttl - Date.now() : 0
  return {
    onCooldown: true,
    remaining: formatCooldown(remaining)
  }
}

export function setCooldown(userId, action, durationMs) {
  cache.set(`${userId}_${action}`, true, Math.floor(durationMs / 1000))
}

export function getCooldownRemaining(userId, action) {
  const ttl = cache.getTtl(`${userId}_${action}`)
  if (!ttl) return 0
  return ttl - Date.now()
}

export function formatCooldown(ms) {
  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
