// ═══════════════════════════════════════════════════════
//       ⚔️  YATORPHG — MAIN CONNECTION (UPDATED)  ⚔️
// ═══════════════════════════════════════════════════════
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import P from 'pino'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { initDatabase }           from './lib/database.js'
import { initGemini }             from './lib/gemini.js'
import { handleMessage }          from './handler.js'
import { startWorldBossScheduler }from './lib/rpg-engine.js'
import { startNPCEngine, registerGroupForNPCs } from './lib/npc-engine.js'
import config from './config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const logger = P({ level: 'silent' })

export async function startBot() {
  // Init database
  await initDatabase()
  console.log('✅ Database loaded')

  // Init Gemini
  initGemini()
  console.log('✅ Gemini AI ready')

  const { state, saveCreds } = await useMultiFileAuthState(
    join(__dirname, 'auth_info_baileys')
  )
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: true,
    browser: ['YatoRPG', 'Chrome', '1.0.0'],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\n⚔️ Scan the QR code above with WhatsApp!\n')
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)
          ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
          : true

      console.log('❌ Connection closed. Reconnecting:', shouldReconnect)
      if (shouldReconnect) await startBot()
    }

    if (connection === 'open') {
      console.log(`\n✅ YatoRPG Bot connected!\n`)

      // Start world boss spawn scheduler
      startWorldBossScheduler(sock)
      console.log(`⏰ World boss scheduler started (every ${config.worldBossSpawnHours}h)`)

      // Start NPC engine
      startNPCEngine(sock)
      console.log(`🧙 NPC engine started (every ${Math.floor((config.npcMessageInterval||480000)/60000)}min)`)

      // Send startup message to owner
      try {
        await sock.sendMessage(`${config.ownerNumber}@s.whatsapp.net`, {
          text:
`⚔️ *YatoRPG Bot Online!*
━━━━━━━━━━━━━━━━━━━━━
✅ Database ready
✅ Gemini AI ready
✅ World boss scheduler active
✅ NPC engine active

_Bot is fully operational!_`
        })
      } catch(e) { /* ignore */ }
    }
  })

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message) continue
      if (msg.key.fromMe)  continue

      // Auto-register groups for NPCs
      if (msg.key.remoteJid?.endsWith('@g.us')) {
        registerGroupForNPCs(msg.key.remoteJid)
      }

      await handleMessage(sock, msg)
    }
  })

  return sock
}
