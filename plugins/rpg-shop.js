// ═══════════════════════════════════════════════
//       🛒  RPG SHOP SYSTEM — PART 6
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'
import items from '../data/items.json' with { type: 'json' }
import shops from '../data/shops.json' with { type: 'json' }

const RARITY_EMOJI = { common:'⬜', uncommon:'🟩', rare:'🟦', epic:'🟪', legendary:'🟧', mythic:'🌟' }

// Region → which shops are available there
const REGION_SHOPS = {
  starter_village:  ['general_store', 'potion_shop'],
  greenwood_forest: ['potion_shop', 'blacksmith'],
  elven_kingdom:    ['blacksmith', 'magic_shop', 'potion_shop'],
  ancient_ruins:    ['potion_shop'],
  demon_realm:      ['black_market', 'demon_forge', 'potion_shop'],
  dragon_mountains: ['dragon_forge', 'potion_shop'],
  shadow_abyss:     ['black_market', 'potion_shop'],
  celestial_realm:  ['divine_shop', 'potion_shop'],
}

function getRegionShops(region) {
  return REGION_SHOPS[region] || ['general_store', 'potion_shop']
}

// ── !shop ────────────────────────────────────────
export async function cmdShop(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered. Use *!register*')

  const regionShopIds = getRegionShops(player.region)
  const availableShops = regionShopIds.map(id => shops[id]).filter(Boolean)

  let msg = `🛒 *SHOPS IN ${player.location?.toUpperCase() || 'YOUR REGION'}*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const shop of availableShops) {
    msg += `${shop.emoji} *${shop.name}*\n`
    msg += `   Items: ${shop.items.length} available\n`
    msg += `   Type: *!shop ${shop.name.toLowerCase().replace(/\s+/g,'_')}* to browse\n\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `💰 Your Gold: *${player.gold.toLocaleString()}G*\n`
  msg += `\n📖 Commands:\n`
  msg += `*!buy [item name]* — buy an item\n`
  msg += `*!sell [item name]* — sell an item\n`
  msg += `*!shop [shop name]* — browse a specific shop`

  await ctx.reply(msg)
}

// View a specific shop's inventory
export async function cmdShopView(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const args = ctx.args?.join(' ')?.toLowerCase()
  if (!args) return cmdShop(ctx)

  const regionShopIds = getRegionShops(player.region)
  const shop = regionShopIds.map(id => shops[id]).find(s =>
    s && s.name.toLowerCase().includes(args)
  )

  if (!shop) return ctx.reply(`❌ No shop called "*${args}*" in your region.\nUse *!shop* to see what's available here.`)

  let msg = `${shop.emoji} *${shop.name.toUpperCase()}*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const itemId of shop.items) {
    const item = items[itemId]
    if (!item) continue
    const rar = RARITY_EMOJI[item.rarity] || '⬜'
    msg += `${rar} ${item.emoji} *${item.name}* — *${item.price?.toLocaleString() || '?'}G*\n`
    msg += `   └ ${item.desc}\n`
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `💰 Your Gold: *${player.gold.toLocaleString()}G*\n`
  msg += `*!buy [item name]* to purchase`

  await ctx.reply(msg)
}

// ── !buy [item name] ────────────────────────────
export async function cmdBuy(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (player.inDungeon) return ctx.reply('⚠️ You are in a dungeon! Exit first.')

  const args = ctx.args?.join(' ')?.toLowerCase()
  if (!args) return ctx.reply('❓ Usage: *!buy [item name]*')

  // Find item in available region shops
  const regionShopIds = getRegionShops(player.region)
  let foundItem = null
  for (const shopId of regionShopIds) {
    const shop = shops[shopId]
    if (!shop) continue
    for (const itemId of shop.items) {
      const item = items[itemId]
      if (item && item.name.toLowerCase().includes(args)) {
        foundItem = item; break
      }
    }
    if (foundItem) break
  }

  if (!foundItem) {
    return ctx.reply(`❌ No item called "*${args}*" is sold in *${player.location}*.\n_Travel to other regions to find different shops!_`)
  }

  if (player.gold < foundItem.price) {
    return ctx.reply(`💸 *Not enough gold!*\n*${foundItem.name}* costs *${foundItem.price.toLocaleString()}G*\nYou have: *${player.gold.toLocaleString()}G*\n\n_Grind more, adventurer!_ 🗡️`)
  }

  // Check if already in inventory
  const existing = player.inventory.find(e => e.id === foundItem.id)
  if (existing) {
    existing.qty = (existing.qty || 1) + 1
  } else {
    player.inventory.push({ id: foundItem.id, qty: 1 })
  }

  player.gold -= foundItem.price
  await savePlayer(player)

  await ctx.reply(
    `${foundItem.emoji} *Purchased!*\n\n` +
    `*${foundItem.name}* added to your inventory!\n` +
    `💰 Cost: *${foundItem.price.toLocaleString()}G*\n` +
    `💰 Remaining: *${player.gold.toLocaleString()}G*\n\n` +
    `_${foundItem.desc}_`
  )
}

// ── !sell [item name] ────────────────────────────
export async function cmdSell(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (player.inDungeon) return ctx.reply('⚠️ You are in a dungeon! Exit first.')

  const args = ctx.args?.join(' ')?.toLowerCase()
  if (!args) return ctx.reply('❓ Usage: *!sell [item name]*')

  const idx = player.inventory.findIndex(e => {
    const item = items[e.id]
    return item && item.name.toLowerCase().includes(args)
  })
  if (idx === -1) return ctx.reply(`❌ No item matching "*${args}*" in your inventory.`)

  const item = items[player.inventory[idx].id]
  const eq = player.equipped
  if (eq.weapon === item.id || eq.armor === item.id || eq.accessory === item.id) {
    return ctx.reply(`⚠️ *${item.name}* is equipped! Unequip it first.`)
  }

  const sellPrice = Math.floor((item.price || 50) * 0.5) // sell for 50%

  if (player.inventory[idx].qty > 1) {
    player.inventory[idx].qty--
  } else {
    player.inventory.splice(idx, 1)
  }
  player.gold += sellPrice
  await savePlayer(player)

  await ctx.reply(
    `💰 *Item Sold!*\n\n` +
    `${item.emoji} *${item.name}* sold for *${sellPrice.toLocaleString()}G*\n` +
    `_(Shops buy at 50% market value)_\n\n` +
    `💰 New balance: *${player.gold.toLocaleString()}G*`
  )
}
