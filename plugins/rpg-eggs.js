// ═══════════════════════════════════════════════════════
//          🥚  YATORPHG — EGG SYSTEM  🥚
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'
import { checkTitleUnlocks } from '../lib/rpg-engine.js'
import eggsData   from '../data/eggs.json'   with { type: 'json' }
import summonsData from '../data/summons.json' with { type: 'json' }

function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// Hatch times in ms
const HATCH_TIMES = {
  beast:     1 * 60 * 60 * 1000,   // 1 hour
  dragon:    24 * 60 * 60 * 1000,  // 24 hours
  shadow:    12 * 60 * 60 * 1000,  // 12 hours
  celestial: 48 * 60 * 60 * 1000, // 48 hours
  mystery:   72 * 60 * 60 * 1000, // 72 hours
}

// Format ms to readable time
function formatTime(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── !eggs ─────────────────────────────────────────────
export async function cmdEggs(ctx) {
  const { senderNumber, reply, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered.')

  const cmd = args[0]?.toLowerCase()

  // Hatch a specific egg
  if (cmd === 'hatch') {
    return await hatchEgg(player, args.slice(1).join(' '), ctx)
  }

  // Incubate (start hatching timer)
  if (cmd === 'incubate') {
    return await incubateEgg(player, args.slice(1).join(' '), ctx)
  }

  // Default: show egg inventory
  const inventory  = player.inventory || []
  const eggs        = inventory.filter(i => i.type === 'egg')
  const incubating  = player.incubatingEggs || []

  if (!eggs.length && !incubating.length) {
    return reply(
`🥚 *YOUR EGGS*
━━━━━━━━━━━━━━━━━━━━━
You have no eggs!

How to find eggs:
🌍 *!explore* in any region
🗺️ Clear dungeon floors
🏆 Defeat world bosses

Different regions drop different eggs!
🌲 Forest → Beast Egg
🐉 Dragon Mountains → Dragon Egg
👁️ Shadow Abyss → Shadow Egg
✨ Celestial Realm → Celestial Egg`
    )
  }

  const now = Date.now()
  let msg = `🥚 *YOUR EGGS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`

  if (eggs.length) {
    msg += `📦 *IN INVENTORY:*\n`
    for (const egg of eggs) {
      const eData = eggsData[egg.id] || {}
      msg += `${eData.emoji || '🥚'} *${egg.name}* [${eData.rarity || 'common'}]\n`
      msg += `   _${eData.desc || ''}_\n`
      msg += `   Hatch time: *${formatTime(HATCH_TIMES[eData.hatchKey] || 3600000)}*\n\n`
    }
    msg += `_Use *!eggs incubate [egg name]* to start hatching!_\n\n`
  }

  if (incubating.length) {
    msg += `🔥 *INCUBATING:*\n`
    for (const inc of incubating) {
      const timeLeft = inc.hatchAt - now
      const eData    = eggsData[inc.eggId] || {}
      if (timeLeft <= 0) {
        msg += `${eData.emoji || '🥚'} *${inc.name}* — ✅ *READY TO HATCH!*\n`
        msg += `   _Use *!eggs hatch ${inc.name.toLowerCase()}*_\n\n`
      } else {
        const pct = Math.floor(((HATCH_TIMES[eData.hatchKey]||3600000) - timeLeft) / (HATCH_TIMES[eData.hatchKey]||3600000) * 100)
        msg += `${eData.emoji || '🥚'} *${inc.name}* — ⏱️ ${formatTime(timeLeft)} left [${pct}%]\n\n`
      }
    }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `*!eggs incubate [name]* — Start incubating\n`
  msg += `*!eggs hatch [name]* — Hatch a ready egg`

  await reply(msg)
}

async function incubateEgg(player, search, ctx) {
  if (!search) return ctx.reply(`❓ Usage: *!eggs incubate [egg name]*\nExample: *!eggs incubate beast egg*`)

  const inventory = player.inventory || []
  const eggIdx    = inventory.findIndex(i =>
    i.type === 'egg' && i.name.toLowerCase().includes(search.toLowerCase())
  )

  if (eggIdx === -1) {
    return ctx.reply(`❌ Egg "*${search}*" not found in your inventory!\nUse *!eggs* to see what you have.`)
  }

  const egg   = inventory[eggIdx]
  const eData = eggsData[egg.id] || {}

  // Check if already incubating this type
  player.incubatingEggs = player.incubatingEggs || []
  if (player.incubatingEggs.find(e => e.eggId === egg.id)) {
    return ctx.reply(`⚠️ You're already incubating a *${egg.name}*!`)
  }

  // Dragon Tamer title bonus (faster hatching)
  let hatchTime = HATCH_TIMES[eData.hatchKey] || 3600000
  if (player.equippedTitle === 'egg_collector') hatchTime = Math.floor(hatchTime * 0.75)
  if (player.equippedTitle === 'dragon_tamer' && eData.hatchKey === 'dragon') hatchTime = Math.floor(hatchTime * 0.5)
  if (player.job === 'dragon_tamer') hatchTime = Math.floor(hatchTime * 0.5)

  // Move egg from inventory to incubating
  inventory.splice(eggIdx, 1)
  player.inventory = inventory
  player.incubatingEggs.push({
    eggId:  egg.id,
    name:   egg.name,
    hatchAt: Date.now() + hatchTime,
  })
  await savePlayer(player)

  await ctx.reply(
`🔥 *INCUBATING EGG!*
━━━━━━━━━━━━━━━━━━━━━

${eData.emoji || '🥚'} *${egg.name}* is now warming up!

⏱️ Time to hatch: *${formatTime(hatchTime)}*
${hatchTime < HATCH_TIMES[eData.hatchKey] ? '✨ Bonus: Reduced hatch time from your title/job!' : ''}

_Come back and use *!eggs hatch ${egg.name.toLowerCase()}* when it's ready!_`
  )
}

async function hatchEgg(player, search, ctx) {
  if (!search) return ctx.reply(`❓ Usage: *!eggs hatch [egg name]*\nExample: *!eggs hatch dragon egg*`)

  player.incubatingEggs = player.incubatingEggs || []
  const eggIdx = player.incubatingEggs.findIndex(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  if (eggIdx === -1) {
    return ctx.reply(`❌ No incubating egg matching "*${search}*".\nUse *!eggs* to see your eggs.`)
  }

  const inc = player.incubatingEggs[eggIdx]
  const now = Date.now()
  if (inc.hatchAt > now) {
    const timeLeft = inc.hatchAt - now
    return ctx.reply(
`⏳ *Not ready yet!*

${eggsData[inc.eggId]?.emoji || '🥚'} *${inc.name}* needs *${formatTime(timeLeft)}* more to hatch.

_Patience, adventurer..._ 🌡️`
    )
  }

  // Hatch it!
  const eData  = eggsData[inc.eggId] || {}
  const possible = eData.possibleSummons || ['wolf_pup']
  const summonId = randPick(possible.filter(id => summonsData[id]) || ['wolf_pup'])
  const summon   = summonsData[summonId] || summonsData['wolf_pup']

  // Remove from incubating, add to summons
  player.incubatingEggs.splice(eggIdx, 1)
  player.summons = player.summons || []
  if (!player.summons.includes(summonId)) {
    player.summons.push(summonId)
  }

  // Kill tracking for titles
  if (!player.killCounts) player.killCounts = {}
  if (inc.eggId === 'dragon_egg') player.killCounts.dragonEggHatched = 1
  const newTitles = checkTitleUnlocks(player)

  await savePlayer(player)

  let msg =
`🥚 *EGG HATCHING!*
${'═'.repeat(30)}

The egg begins to crack...
🌡️ Heat rises... the shell splinters...

💥 *IT HATCHES!*

${'═'.repeat(30)}
${summon.emoji} *${summon.name}* appeared! [Grade ${summon.grade}]

_${summon.desc}_

━━━━━━━━━━━━━━━━━━━━━
⚔️ ATK: *${summon.atk}* | 🛡️ DEF: *${summon.def}* | ❤️ HP: *${summon.hp}*
✨ Skill: *${summon.skill}*
${summon.special ? `🌟 Special: *${summon.special.replace(/_/g,' ')}*` : ''}

_Use *!summon ${summon.name.toLowerCase()}* to activate it in battle!_`

  if (newTitles.length) {
    for (const t of newTitles) {
      msg += `\n\n🏅 *TITLE UNLOCKED!*\n✨ *${t.name}*\n_${t.bonus || ''}_`
    }
  }

  await ctx.reply(msg)
}
