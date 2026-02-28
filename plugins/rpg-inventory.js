// ═══════════════════════════════════════════════
//        🎒  RPG INVENTORY SYSTEM — PART 6
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'
import items from '../data/items.json' with { type: 'json' }

const RARITY_EMOJI = {
  common: '⬜',
  uncommon: '🟩',
  rare: '🟦',
  epic: '🟪',
  legendary: '🟧',
  mythic: '🌟',
}

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic']

// ── !inventory ──────────────────────────────────
export async function cmdInventory(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ You are not registered! Use *!register* to begin your journey.')

  const inv = player.inventory
  if (!inv || inv.length === 0) {
    return ctx.reply(`🎒 *${player.name}'s Inventory*\n\n_Your bag is empty. Go loot something!_`)
  }

  // Group by type
  const grouped = { weapon: [], armor: [], accessory: [], consumable: [], quest: [], other: [] }
  for (const entry of inv) {
    const item = items[entry.id]
    if (!item) continue
    const type = item.type || 'other'
    grouped[type] = grouped[type] || []
    grouped[type].push({ ...item, qty: entry.qty || 1 })
  }

  const eq = player.equipped
  let msg = `🎒 *${player.name}'s INVENTORY*\n`
  msg += `💰 Gold: ${player.gold.toLocaleString()}G | 💎 Gems: ${player.gems}\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  const typeLabels = { weapon:'⚔️ WEAPONS', armor:'🛡️ ARMOR', accessory:'💍 ACCESSORIES', consumable:'🧪 CONSUMABLES', quest:'📜 QUEST ITEMS', other:'📦 OTHER' }

  for (const [type, typeItems] of Object.entries(grouped)) {
    if (!typeItems.length) continue
    msg += `*${typeLabels[type] || type.toUpperCase()}*\n`
    for (const item of typeItems) {
      const rar = RARITY_EMOJI[item.rarity] || '⬜'
      const equippedTag = (eq.weapon === item.id || eq.armor === item.id || eq.accessory === item.id) ? ' ✅*[EQUIPPED]*' : ''
      const qty = item.qty > 1 ? ` x${item.qty}` : ''
      msg += `${rar} ${item.emoji} *${item.name}*${qty}${equippedTag}\n`
      msg += `   └ ${item.desc}\n`
    }
    msg += '\n'
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `Total: *${inv.length}* item type(s)\n`
  msg += `Use *!equip [item name]* or *!inspect [item name]*`

  await ctx.reply(msg)
}

// ── !inspect [item] ─────────────────────────────
export async function cmdInspect(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered. Use *!register*')

  const args = ctx.args?.join(' ')?.toLowerCase()
  if (!args) return ctx.reply('❓ Usage: *!inspect [item name]*')

  const entry = player.inventory.find(e => {
    const item = items[e.id]
    return item && item.name.toLowerCase().includes(args)
  })
  if (!entry) return ctx.reply(`❌ You don't have an item matching "*${args}*"`)

  const item = items[entry.id]
  const rar = RARITY_EMOJI[item.rarity] || '⬜'
  const eq = player.equipped
  const isEquipped = eq.weapon === item.id || eq.armor === item.id || eq.accessory === item.id

  let msg = `${item.emoji} *${item.name}*\n`
  msg += `${rar} Rarity: *${item.rarity?.toUpperCase() || 'COMMON'}*\n`
  msg += `📦 Type: *${item.type?.toUpperCase()}*\n\n`
  msg += `📖 *${item.desc}*\n\n`

  if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
    msg += `📊 *STATS BONUS:*\n`
    if (item.str)  msg += `  ⚔️ STR +${item.str}\n`
    if (item.agi)  msg += `  💨 AGI +${item.agi}\n`
    if (item.int)  msg += `  🔮 INT +${item.int}\n`
    if (item.def)  msg += `  🛡️ DEF +${item.def}\n`
    if (item.lck)  msg += `  🍀 LCK +${item.lck}\n`
  }

  if (item.type === 'consumable') {
    if (item.effect === 'hp')  msg += `  💚 Restores *${item.value} HP*\n`
    if (item.effect === 'mp')  msg += `  💙 Restores *${item.value} MP*\n`
    if (item.effect === 'revive') msg += `  ✨ Revives with *${item.value}% HP*\n`
    if (item.effect === 'cure_poison') msg += `  💉 *Cures Poison*\n`
    if (item.effect?.startsWith('buff')) msg += `  ⚡ Battle buff: *+${item.value}* to stat\n`
  }

  msg += `\n💰 Market Value: *${item.price?.toLocaleString() || '?'}G*`
  if (isEquipped) msg += `\n✅ *Currently Equipped*`
  msg += `\n\nQuantity in bag: *x${entry.qty || 1}*`

  await ctx.reply(msg)
}

// ── !drop [item] ────────────────────────────────
export async function cmdDrop(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const args = ctx.args?.join(' ')?.toLowerCase()
  if (!args) return ctx.reply('❓ Usage: *!drop [item name]*')

  const idx = player.inventory.findIndex(e => {
    const item = items[e.id]
    return item && item.name.toLowerCase().includes(args)
  })
  if (idx === -1) return ctx.reply(`❌ No item matching "*${args}*" in your bag.`)

  const item = items[player.inventory[idx].id]
  const eq = player.equipped
  if (eq.weapon === item.id || eq.armor === item.id || eq.accessory === item.id) {
    return ctx.reply(`⚠️ *${item.name}* is currently equipped! Unequip it first with *!unequip*.`)
  }

  if (player.inventory[idx].qty > 1) {
    player.inventory[idx].qty--
  } else {
    player.inventory.splice(idx, 1)
  }

  await savePlayer(player)
  await ctx.reply(`🗑️ You dropped *${item.emoji} ${item.name}*.\n_Gone forever... unless someone else picks it up._`)
}

// ── !use [item] ──────────────────────────────────
export async function cmdUse(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const args = ctx.args?.join(' ')?.toLowerCase()
  if (!args) return ctx.reply('❓ Usage: *!use [item name]*')

  const idx = player.inventory.findIndex(e => {
    const item = items[e.id]
    return item && item.name.toLowerCase().includes(args) && item.type === 'consumable'
  })
  if (idx === -1) return ctx.reply(`❌ No usable consumable matching "*${args}*".`)

  const item = items[player.inventory[idx].id]
  let result = ''

  if (item.effect === 'hp') {
    const healed = Math.min(item.value, player.maxHp - player.hp)
    player.hp = Math.min(player.maxHp, player.hp + item.value)
    result = `💚 Restored *${healed} HP!* (${player.hp}/${player.maxHp})`
  } else if (item.effect === 'mp') {
    const restored = Math.min(item.value, player.maxMp - player.mp)
    player.mp = Math.min(player.maxMp, player.mp + item.value)
    result = `💙 Restored *${restored} MP!* (${player.mp}/${player.maxMp})`
  } else if (item.effect === 'cure_poison') {
    if (player.battleState?.poison) {
      player.battleState.poison = false
      result = `💉 *Poison cured!* You feel the venom drain away.`
    } else {
      result = `💉 You're not poisoned — item saved.`
    }
  } else if (item.effect === 'revive') {
    return ctx.reply(`⚠️ *${item.name}* can only be used when you die in battle — it auto-activates!`)
  } else {
    return ctx.reply(`⚠️ *${item.name}* can only be used during battle with *!item [name]*.`)
  }

  // Consume
  if (player.inventory[idx].qty > 1) {
    player.inventory[idx].qty--
  } else {
    player.inventory.splice(idx, 1)
  }

  await savePlayer(player)
  await ctx.reply(`${item.emoji} *${item.name}* used!\n${result}`)
}