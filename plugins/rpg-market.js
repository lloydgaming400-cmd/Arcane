// ═══════════════════════════════════════════════
//     📦  RPG PLAYER MARKETPLACE — PART 6
// ═══════════════════════════════════════════════
import {
  getPlayer, savePlayer, getDB,
  addMarketListing, getMarketListings, removeMarketListing
} from '../lib/database.js'
import items from '../data/items.json' with { type: 'json' }

const RARITY_EMOJI = { common:'⬜', uncommon:'🟩', rare:'🟦', epic:'🟪', legendary:'🟧', mythic:'🌟' }

// ── !market ──────────────────────────────────────
export async function cmdMarket(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered. Use *!register*')

  const listings = getMarketListings()
  if (!listings.length) {
    return ctx.reply(
      `📦 *PLAYER MARKETPLACE*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `_The marketplace is empty right now..._\n\n` +
      `Be the first to list something!\n` +
      `*!list [item name] [price]* to sell your items`
    )
  }

  let msg = `📦 *PLAYER MARKETPLACE*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const listing of listings.slice(0, 15)) {
    const item = items[listing.itemId]
    if (!item) continue
    const rar = RARITY_EMOJI[item.rarity] || '⬜'
    const seller = listing.sellerName || 'Unknown'
    msg += `${rar} ${item.emoji} *${item.name}*`
    if (listing.qty > 1) msg += ` x${listing.qty}`
    msg += `\n`
    msg += `   💰 *${listing.price.toLocaleString()}G* — Seller: ${seller}\n`
    msg += `   🆔 ID: \`${listing.id}\`\n\n`
  }

  if (listings.length > 15) msg += `_...and ${listings.length - 15} more listings_\n\n`

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `💰 Your Gold: *${player.gold.toLocaleString()}G*\n\n`
  msg += `*!mktbuy [ID]* — Buy a listing\n`
  msg += `*!list [item name] [price]* — Sell your item\n`
  msg += `*!mylistings* — View your active listings`

  await ctx.reply(msg)
}

// ── !list [item name] [price] ───────────────────
export async function cmdList(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const args = ctx.args || []
  if (args.length < 2) return ctx.reply('❓ Usage: *!list [item name] [price]*\nExample: *!list iron sword 200*')

  const price = parseInt(args[args.length - 1])
  if (isNaN(price) || price < 1) return ctx.reply('❌ Invalid price. Must be a positive number.')

  const itemSearch = args.slice(0, -1).join(' ').toLowerCase()

  // Check active listing count (max 5 per player)
  const myListings = getMarketListings().filter(l => l.sellerId === ctx.sender)
  if (myListings.length >= 5) {
    return ctx.reply('⚠️ You already have *5 active listings* (max). Remove one first with *!unlist [ID]*.')
  }

  const idx = player.inventory.findIndex(e => {
    const item = items[e.id]
    return item && item.name.toLowerCase().includes(itemSearch)
  })
  if (idx === -1) return ctx.reply(`❌ No item matching "*${itemSearch}*" in your inventory.`)

  const item = items[player.inventory[idx].id]
  const eq = player.equipped
  if (eq.weapon === item.id || eq.armor === item.id || eq.accessory === item.id) {
    return ctx.reply(`⚠️ *${item.name}* is equipped! Unequip it first.`)
  }

  if (price < Math.floor(item.price * 0.1)) {
    return ctx.reply(`⚠️ Minimum listing price is *${Math.floor(item.price * 0.1)}G* (10% of market value).`)
  }

  // Remove from inventory
  if (player.inventory[idx].qty > 1) {
    player.inventory[idx].qty--
  } else {
    player.inventory.splice(idx, 1)
  }

  await addMarketListing({
    itemId: item.id,
    qty: 1,
    price,
    sellerId: ctx.sender,
    sellerName: player.name,
  })
  await savePlayer(player)

  await ctx.reply(
    `📦 *Listed on Marketplace!*\n\n` +
    `${item.emoji} *${item.name}*\n` +
    `💰 Listed for: *${price.toLocaleString()}G*\n\n` +
    `_Other players can now buy it with !mktbuy_`
  )
}

// ── !mktbuy [listing ID] ─────────────────────────
export async function cmdMktbuy(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const idArg = parseInt(ctx.args?.[0])
  if (!idArg) return ctx.reply('❓ Usage: *!mktbuy [listing ID]*\nFind IDs in *!market*')

  const listings = getMarketListings()
  const listing = listings.find(l => l.id === idArg)
  if (!listing) return ctx.reply(`❌ Listing *#${idArg}* not found. It may have been sold already.`)

  if (listing.sellerId === ctx.sender) {
    return ctx.reply('⚠️ You cannot buy your own listing! Use *!unlist [ID]* to remove it.')
  }

  if (player.gold < listing.price) {
    return ctx.reply(`💸 *Not enough gold!*\nThis listing costs *${listing.price.toLocaleString()}G*\nYou have: *${player.gold.toLocaleString()}G*`)
  }

  const item = items[listing.itemId]
  if (!item) return ctx.reply('❌ Item data not found. Contact an admin.')

  // Check if seller still exists and pay them
  const db = getDB()
  const seller = db.data.players[listing.sellerId]
  if (seller) {
    seller.gold += listing.price
    await savePlayer(seller)
  }

  // Give item to buyer
  const existing = player.inventory.find(e => e.id === item.id)
  if (existing) existing.qty = (existing.qty || 1) + 1
  else player.inventory.push({ id: item.id, qty: 1 })

  player.gold -= listing.price
  await savePlayer(player)
  await removeMarketListing(listing.id)

  await ctx.reply(
    `✅ *Purchase Successful!*\n\n` +
    `${item.emoji} *${item.name}* is now in your inventory!\n` +
    `💰 Paid: *${listing.price.toLocaleString()}G* to *${listing.sellerName}*\n` +
    `💰 Remaining: *${player.gold.toLocaleString()}G*`
  )
}

// ── !mylistings ──────────────────────────────────
export async function cmdMyListings(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const myListings = getMarketListings().filter(l => l.sellerId === ctx.sender)
  if (!myListings.length) {
    return ctx.reply(`📦 *Your Listings*\n\n_You have no active listings._\nUse *!list [item] [price]* to sell something!`)
  }

  let msg = `📦 *YOUR ACTIVE LISTINGS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`
  for (const l of myListings) {
    const item = items[l.itemId]
    if (!item) continue
    msg += `${item.emoji} *${item.name}* — *${l.price.toLocaleString()}G*\n`
    msg += `   🆔 ID: \`${l.id}\` | *!unlist ${l.id}* to cancel\n\n`
  }
  msg += `Total: *${myListings.length}/5* listing slots used`
  await ctx.reply(msg)
}

// ── !unlist [ID] ─────────────────────────────────
export async function cmdUnlist(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const idArg = parseInt(ctx.args?.[0])
  if (!idArg) return ctx.reply('❓ Usage: *!unlist [listing ID]*')

  const listings = getMarketListings()
  const listing = listings.find(l => l.id === idArg && l.sellerId === ctx.sender)
  if (!listing) return ctx.reply(`❌ Listing *#${idArg}* not found or not yours.`)

  // Return item
  const item = items[listing.itemId]
  if (item) {
    const existing = player.inventory.find(e => e.id === item.id)
    if (existing) existing.qty = (existing.qty || 1) + 1
    else player.inventory.push({ id: item.id, qty: 1 })
  }

  await removeMarketListing(listing.id)
  await savePlayer(player)

  await ctx.reply(`✅ Listing cancelled. *${item?.name || listing.itemId}* returned to your inventory.`)
}
