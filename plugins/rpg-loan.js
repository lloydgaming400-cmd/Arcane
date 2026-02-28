// ═══════════════════════════════════════════════
//       💸  RPG LOAN SYSTEM — PART 7
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'

const MAX_LOAN_MULTIPLIER = 2
const MIN_LOAN = 100

// ── !loan [amount] ───────────────────────────────
export async function cmdLoan(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  // Already has a loan?
  if (player.loan > 0) {
    return ctx.reply(
      `⚠️ *You already have an active loan!*\n\n` +
      `Outstanding: *${player.loan.toLocaleString()}G*\n\n` +
      `Use *!repay [amount]* to pay it back.\n` +
      `Interest compounds at *10% per day!* Don't wait!`
    )
  }

  // Blacklisted?
  if (player.loanBlacklisted) {
    return ctx.reply(
      `🚫 *BANK BLACKLISTED*\n\n` +
      `You defaulted on a previous loan and are blacklisted from bank services.\n` +
      `Pay back your outstanding debt to restore access.\n\n` +
      `_Contact an admin or use !repay if you have funds._`
    )
  }

  const amount = parseInt(ctx.args?.[0])
  if (!amount || amount < MIN_LOAN) return ctx.reply(`❓ Usage: *!loan [amount]*\nMinimum loan: *${MIN_LOAN}G*`)

  const maxLoan = Math.max(500, player.bankGold * MAX_LOAN_MULTIPLIER)
  if (amount > maxLoan) {
    return ctx.reply(
      `❌ *Loan too large!*\n\n` +
      `Maximum you can borrow: *${maxLoan.toLocaleString()}G*\n` +
      `_(2x your bank balance of ${player.bankGold.toLocaleString()}G)_\n\n` +
      `Deposit more gold to access larger loans.`
    )
  }

  // Grant loan
  player.gold += amount
  player.loan = amount
  player.loanDate = Date.now()
  player.loanBlacklisted = false
  player.bountyActive = false
  await savePlayer(player)

  await ctx.reply(
    `💸 *LOAN APPROVED!*\n\n` +
    `💰 Received: *${amount.toLocaleString()}G*\n` +
    `📊 Interest: *10% per day*\n\n` +
    `⚠️ *WARNING — FORCED REPAYMENT:*\n` +
    `▸ Day 7 unpaid → your gold is seized\n` +
    `▸ Day 14 unpaid → bank blacklist\n` +
    `▸ Day 30 unpaid → bounty on your head\n\n` +
    `Use *!repay [amount]* to pay back. Don't be a deadbeat! 😤`
  )
}

// ── !repay [amount] ──────────────────────────────
export async function cmdRepay(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  if (player.loan <= 0) {
    return ctx.reply(`✅ You have *no outstanding loans!* You're debt-free! 🎉`)
  }

  const args = ctx.args?.[0]?.toLowerCase()
  let amount

  if (args === 'all' || args === 'full') {
    amount = player.loan
  } else {
    amount = parseInt(args)
    if (!amount || amount < 1) return ctx.reply('❓ Usage: *!repay [amount]* or *!repay all*')
  }

  if (amount > player.gold) {
    return ctx.reply(
      `❌ Not enough gold on hand!\n` +
      `You need: *${amount.toLocaleString()}G*\n` +
      `On hand: *${player.gold.toLocaleString()}G*\n\n` +
      `Use *!withdraw* to get gold from bank first.`
    )
  }

  const repaid = Math.min(amount, player.loan)
  player.gold -= repaid
  player.loan -= repaid

  const paidOff = player.loan <= 0
  if (paidOff) {
    player.loan = 0
    player.loanDate = null
    player.loanBlacklisted = false
    player.bountyActive = false
  }

  await savePlayer(player)

  let msg = `💰 *Loan Repayment Made!*\n\n`
  msg += `Paid: *${repaid.toLocaleString()}G*\n`
  msg += `On Hand: *${player.gold.toLocaleString()}G*\n`

  if (paidOff) {
    msg += `\n✅ *LOAN FULLY PAID OFF!*\n`
    msg += `You are debt-free and blacklist-cleared! 🎉\n`
    msg += `Bank deposits are now open again.`
  } else {
    msg += `Remaining Debt: *${player.loan.toLocaleString()}G*\n`
    msg += `\n⚠️ Keep paying before interest grows more!`
  }

  await ctx.reply(msg)
}
