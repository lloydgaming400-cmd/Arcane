// ═══════════════════════════════════════════════════════
//          🏅  YATORPHG — TITLES SYSTEM  🏅
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'
import titlesData from '../data/titles.json' with { type: 'json' }

// ── !titles ───────────────────────────────────────────
export async function cmdTitles(ctx) {
  const { senderNumber, reply } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered.')

  const owned = player.titles || []

  if (!owned.length) {
    return reply(
`🏅 *TITLES*
━━━━━━━━━━━━━━━━━━━━━
You haven't earned any titles yet!

Titles are earned through achievements:
🗡️ Kill enough of a monster type
🏆 Defeat bosses
💀 Die many times (Cockroach title!)
⚔️ Win PVP battles
🥚 Find & hatch eggs
And much more...

Use *!achievements* to track your progress!`
    )
  }

  const active = player.equippedTitle

  let msg = `🏅 *YOUR TITLES*\n━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const titleId of owned) {
    const t = titlesData.find(t => t.id === titleId)
    if (!t) continue
    const isEquipped = active === titleId
    msg += `${isEquipped ? '✅' : '◻️'} *${t.name}*${isEquipped ? ' ← ACTIVE' : ''}\n`
    if (t.bonus) msg += `   📊 Bonus: _${t.bonus}_\n`
    msg += '\n'
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `*!settitle [name]* — Equip a title\n`
  msg += `You have *${owned.length}* title(s) collected.`

  await reply(msg)
}

// ── !settitle [name] ──────────────────────────────────
export async function cmdSetTitle(ctx) {
  const { senderNumber, reply, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered.')

  const owned = player.titles || []

  if (!args.length) {
    if (player.equippedTitle) {
      const current = titlesData.find(t => t.id === player.equippedTitle)
      return reply(`🏅 Current title: *${current?.name || player.equippedTitle}*\n\nUse *!settitle [name]* to change it.\nUse *!settitle none* to remove.`)
    }
    return reply(`❓ Usage: *!settitle [title name]*\nExample: *!settitle goblin hunter*\nUse *!titles* to see your titles.`)
  }

  const search = args.join(' ').toLowerCase()

  if (search === 'none' || search === 'remove' || search === 'clear') {
    player.equippedTitle = null
    await savePlayer(player)
    return reply(`✅ Title removed. You now appear without a title.`)
  }

  const title = titlesData.find(t =>
    t.id.includes(search.replace(/\s+/g,'_')) ||
    t.name.toLowerCase().includes(search)
  )

  if (!title) {
    return reply(`❌ Title "*${args.join(' ')}*" not found!\nUse *!titles* to see your titles.`)
  }

  if (!owned.includes(title.id)) {
    return reply(
`❌ You haven't earned *${title.name}* yet!

How to unlock it: _Check the requirement in *!achievements*_`
    )
  }

  player.equippedTitle = title.id
  await savePlayer(player)

  await reply(
`✅ *Title Equipped!*

You are now known as:
🏅 *${player.name} — ${title.name}*

${title.bonus ? `📊 Active Bonus: _${title.bonus}_` : ''}`
  )
}
