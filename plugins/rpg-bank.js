// ═══════════════════════════════════════════════
//       🏦  RPG BANK SYSTEM — PART 7
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'

const DAILY_INTEREST_RATE = 0.02   // 2% daily on banked gold
const MAX_LOAN_MULTIPLIER = 2      // borrow up to 2x bank balance
const LOAN_INTEREST_RATE  = 0.10   // 10% per day on loans
const LOAN_SEIZE_DAYS     = 7
const LOAN_BLACKLIST_DAYS = 14
const LOAN_BOUNTY_DAYS    = 30

// ── Helper: apply daily interest/loan penalties ─
export async function processDailyFinance(player) {
  const now = Date.now()
  const ONE_DAY = 86400000

  // Bank interest
  if (player.bankGold > 0 && player.lastInterest) {
    const daysPassed = Math.floor((now - player.lastInterest) / ONE_DAY)
    if (daysPassed > 0) {
      const interest = Math.floor(player.bankGold * DAILY_INTEREST_RATE * daysPassed)
      player.bankGold += interest
      player.lastInterest = now
    }
  } else if (!player.lastInterest) {
    player.lastInterest = now
  }

  // Loan penalties
  if (player.loan > 0 && player.loanDate) {
    const daysPassed = Math.floor((now - player.loanDate) / ONE_DAY)
    if (daysPassed > 0) {
      // Compound interest
      player.loan = Math.floor(player.loan * Math.pow(1 + LOAN_INTEREST_RATE, daysPassed))
      player.loanDate = now // reset from today

      // Seize gold at 7 days
      if (daysPassed >= LOAN_SEIZE_DAYS && player.gold > 0) {
        const seized = player.gold
        player.gold = 0
        // partial repayment
        player.loan = Math.max(0, player.loan - seized)
      }

      // Blacklist at 14 days
      if (daysPassed >= LOAN_BLACKLIST_DAYS) {
        player.loanBlacklisted = true
      }

      // Bounty at 30 days
      if (daysPassed >= LOAN_BOUNTY_DAYS) {
        player.bountyActive = true
      }
    }
  }

  await savePlayer(player)
  return player
}

// ── !bank ─────────────────────────────────────────
export async function cmdBank(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered. Use *!register*')

  // Apply daily finance on every bank visit
  await processDailyFinance(player)
  const updated = getPlayer(ctx.sender)

  let msg = `🏦 *FIRST BANK OF THE REALM*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  msg += `👤 Account Holder: *${updated.name}*\n\n`
  msg += `💰 *On Hand:* ${updated.gold.toLocaleString()}G\n`
  msg += `🏦 *Banked:* ${updated.bankGold.toLocaleString()}G\n`
  msg += `📈 *Daily Interest:* +${(updated.bankGold * DAILY_INTEREST_RATE).toFixed(0)}G/day\n\n`

  if (updated.loan > 0) {
    msg += `⚠️ *ACTIVE LOAN: ${updated.loan.toLocaleString()}G*\n`
    msg += `📊 Interest: 10%/day — *REPAY ASAP!*\n`
    if (updated.loanBlacklisted) msg += `🚫 *BLACKLISTED* — Repay to restore access\n`
    if (updated.bountyActive) msg += `💀 *BOUNTY ON YOUR HEAD!* Players can hunt you!\n`
    msg += `\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `*!deposit [amount]* — Store gold safely\n`
  msg += `*!withdraw [amount]* — Get gold out\n`
  msg += `*!loan [amount]* — Take a loan\n`
  msg += `*!repay [amount]* — Pay back loan`

  await ctx.reply(msg)
}

// ── !deposit [amount] ────────────────────────────
export async function cmdDeposit(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  if (player.loan > 0) {
    return ctx.reply(
      `🚫 *Cannot deposit while you have an unpaid loan!*\n` +
      `Outstanding loan: *${player.loan.toLocaleString()}G*\n\n` +
      `Use *!repay [amount]* to pay it back first.\n` +
      `_(This prevents cheating the loan system)_`
    )
  }

  const amount = parseInt(ctx.args?.[0])
  if (!amount || amount < 1) return ctx.reply('❓ Usage: *!deposit [amount]*\nExample: *!deposit 500*')

  if (amount > player.gold) {
    return ctx.reply(`❌ You only have *${player.gold.toLocaleString()}G* on hand!`)
  }

  player.gold -= amount
  player.bankGold += amount
  if (!player.lastInterest) player.lastInterest = Date.now()
  await savePlayer(player)

  await ctx.reply(
    `🏦 *Deposited!*\n\n` +
    `💰 Deposited: *${amount.toLocaleString()}G*\n` +
    `🏦 Bank Balance: *${player.bankGold.toLocaleString()}G*\n` +
    `💰 On Hand: *${player.gold.toLocaleString()}G*\n\n` +
    `_Earning 2% daily interest! 📈_`
  )
}

// ── !withdraw [amount] ───────────────────────────
export async function cmdWithdraw(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const amount = parseInt(ctx.args?.[0])
  if (!amount || amount < 1) return ctx.reply('❓ Usage: *!withdraw [amount]*')

  if (amount > player.bankGold) {
    return ctx.reply(`❌ Bank balance is only *${player.bankGold.toLocaleString()}G*!`)
  }

  player.bankGold -= amount
  player.gold += amount
  await savePlayer(player)

  await ctx.reply(
    `🏦 *Withdrawn!*\n\n` +
    `💰 Withdrew: *${amount.toLocaleString()}G*\n` +
    `🏦 Bank Balance: *${player.bankGold.toLocaleString()}G*\n` +
    `💰 On Hand: *${player.gold.toLocaleString()}G*\n\n` +
    `⚠️ _Gold on hand can be stolen in PVP! Stay safe._`
  )
}
