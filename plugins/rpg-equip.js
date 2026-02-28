// ═══════════════════════════════════════════════
//       ⚔️  RPG EQUIP SYSTEM — PART 6
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'
import items from '../data/items.json' with { type: 'json' }

const SLOT_MAP = { weapon: '⚔️', armor: '🛡️', accessory: '💍' }

// ── !equip [item name] ──────────────────────────
export async function cmdEquip(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered. Use *!register*')

  const args = ctx.args?.join(' ')?.toLowerCase()
  if (!args) return ctx.reply('❓ Usage: *!equip [item name]*')

  // Find in inventory
  const entry = player.inventory.find(e => {
    const item = items[e.id]
    return item && item.name.toLowerCase().includes(args) && ['weapon','armor','accessory'].includes(item.type)
  })
  if (!entry) return ctx.reply(`❌ No equippable item matching "*${args}*" in your inventory.\n_Make sure you own it first!_`)

  const item = items[entry.id]
  const slot = item.type // weapon / armor / accessory
  const currentlyEquipped = player.equipped[slot]

  // Unequip old
  if (currentlyEquipped && currentlyEquipped !== item.id) {
    const old = items[currentlyEquipped]
    if (old) {
      // Remove old stat bonuses
      for (const stat of ['str','agi','int','def','lck']) {
        if (old[stat]) player[stat] = Math.max(0, player[stat] - old[stat])
      }
    }
  }

  // Equip new
  player.equipped[slot] = item.id
  for (const stat of ['str','agi','int','def','lck']) {
    if (item[stat]) player[stat] = Math.min(100, player[stat] + item[stat])
  }

  await savePlayer(player)

  const slotEmoji = SLOT_MAP[slot]
  let msg = `${slotEmoji} *${item.name}* equipped!\n\n`
  msg += `📊 *Stat changes:*\n`
  for (const [stat, label] of [['str','⚔️ STR'],['agi','💨 AGI'],['int','🔮 INT'],['def','🛡️ DEF'],['lck','🍀 LCK']]) {
    if (item[stat]) msg += `  ${label}: +${item[stat]}\n`
  }
  msg += `\n💬 _${item.desc}_`
  if (currentlyEquipped && currentlyEquipped !== item.id) {
    const old = items[currentlyEquipped]
    if (old) msg += `\n\n🔄 Unequipped: *${old.name}*`
  }

  await ctx.reply(msg)
}

// ── !unequip [slot or item name] ────────────────
export async function cmdUnequip(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const args = ctx.args?.join(' ')?.toLowerCase()
  if (!args) return ctx.reply('❓ Usage: *!unequip [weapon / armor / accessory]*')

  let slot = null
  if (args.includes('weapon') || args.includes('sword') || args.includes('blade') || args.includes('bow') || args.includes('staff')) slot = 'weapon'
  else if (args.includes('armor') || args.includes('cloak') || args.includes('plate') || args.includes('mail')) slot = 'armor'
  else if (args.includes('ring') || args.includes('amulet') || args.includes('pendant') || args.includes('accessory')) slot = 'accessory'
  else {
    // Try matching by item name in all slots
    for (const [s, id] of Object.entries(player.equipped)) {
      if (id && items[id] && items[id].name.toLowerCase().includes(args)) {
        slot = s; break
      }
    }
  }

  if (!slot) return ctx.reply(`❓ Specify a slot: *weapon*, *armor*, or *accessory*\nOr type the item's name.`)

  const currentId = player.equipped[slot]
  if (!currentId) return ctx.reply(`⚠️ No item equipped in *${slot}* slot.`)

  const item = items[currentId]
  if (item) {
    for (const stat of ['str','agi','int','def','lck']) {
      if (item[stat]) player[stat] = Math.max(0, player[stat] - item[stat])
    }
  }
  player.equipped[slot] = null
  await savePlayer(player)

  await ctx.reply(`✅ *${item?.name || currentId}* removed from *${slot}* slot.\n_Stats adjusted accordingly._`)
}

// ── !equipment (view equipped items) ────────────
export async function cmdEquipment(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const eq = player.equipped
  let msg = `⚔️ *${player.name}'s EQUIPMENT*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const [slot, emoji] of Object.entries(SLOT_MAP)) {
    const id = eq[slot]
    if (id && items[id]) {
      const item = items[id]
      msg += `${emoji} *${slot.toUpperCase()}*: ${item.emoji} ${item.name}\n`
      const statStr = ['str','agi','int','def','lck']
        .filter(s => item[s])
        .map(s => `+${item[s]} ${s.toUpperCase()}`)
        .join(', ')
      if (statStr) msg += `   └ ${statStr}\n`
    } else {
      msg += `${emoji} *${slot.toUpperCase()}*: _None_\n`
    }
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `📊 *Current Stats:*\n`
  msg += `⚔️ STR: ${player.str} | 💨 AGI: ${player.agi} | 🔮 INT: ${player.int}\n`
  msg += `🛡️ DEF: ${player.def} | 🍀 LCK: ${player.lck}\n`
  msg += `❤️ HP: ${player.hp}/${player.maxHp} | 💙 MP: ${player.mp}/${player.maxMp}\n`
  const total = player.str + player.agi + player.int + player.def + player.lck
  msg += `\n📈 *Total Stats: ${total}/500*`

  await ctx.reply(msg)
}
