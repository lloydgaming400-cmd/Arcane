// ═══════════════════════════════════════════════════════
//       🧙  YATORPHG — NPC ENGINE  🧙
// Updated full NPC engine with world-event awareness
// ═══════════════════════════════════════════════════════
import { getWorldBoss, getAllPlayers } from './database.js'
import { generateNPCMessage } from './gemini.js'
import npcsData from '../data/npcs.js'
import config from '../config.js'

let activeGroups = new Set()

function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// World event detector
function detectWorldEvent() {
  const wb = getWorldBoss()
  if (wb && wb.hp > 0) return `A world boss — ${wb.name} — is rampaging nearby!`

  const allPlayers = getAllPlayers() || {}
  const players = Object.values(allPlayers)
  const recent = players.filter(p => p && (Date.now() - (p.lastActive||0)) < 10*60*1000)
  if (recent.length > 3) return `${recent.length} adventurers are active in the world`
  if (players.some(p => p?.level >= 90)) return 'A legendary hero of incredible power walks the land'
  if (players.some(p => p?.inDungeon && p?.dungeonFloor >= 80)) return 'Someone is deep inside the 100-floor dungeon'
  return null
}

// Register a group to receive NPC messages
export function registerGroupForNPCs(jid) {
  activeGroups.add(jid)
}

// Start the NPC message loop
export function startNPCEngine(sock) {
  setInterval(async () => {
    if (!activeGroups.size) return

    for (const jid of activeGroups) {
      try {
        await sendRandomNPCMessage(sock, jid)
      } catch(e) {
        // silently ignore failed NPC messages
      }
    }
  }, config.npcMessageInterval || 8 * 60 * 1000)
}

async function sendRandomNPCMessage(sock, jid) {
  const npcs = Array.isArray(npcsData) ? npcsData : Object.values(npcsData)
  if (!npcs.length) return

  const npc = randPick(npcs)
  const worldEvent = detectWorldEvent()

  const message = await generateNPCMessage(
    npc.name,
    npc.type || 'traveler',
    npc.region || 'the world',
    worldEvent
  )

  if (!message) return

  const formatted = `${npc.emoji || '🧙'} *${npc.name}* _(${npc.region || 'Wanderer'})_:\n${message}`

  await sock.sendMessage(jid, { text: formatted })
}
