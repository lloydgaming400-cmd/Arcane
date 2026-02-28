import { GoogleGenerativeAI } from '@google/generative-ai'
import config from '../config.js'

let genAI
let model

export function initGemini() {
  genAI = new GoogleGenerativeAI(config.geminiKey)
  model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
}

async function ask(prompt) {
  if (!model) initGemini()
  try {
    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  } catch (err) {
    console.error('Gemini error:', err.message)
    return null
  }
}

export async function generateDungeonRoom(dungeonName, floor, roomType, monster, playerName, playerClass) {
  const prompt = `You are a dark fantasy dungeon master narrator for a WhatsApp RPG bot. 
Write a SHORT atmospheric dungeon room description (max 4 lines). 
Keep it dramatic and immersive. Use emojis sparingly.
Dungeon: ${dungeonName}, Floor: ${floor}/100, Room type: ${roomType}
Monster: ${monster || 'none'}, Player: ${playerName} (${playerClass})
Write ONLY the narrative.`
  return await ask(prompt) || `*The darkness thickens on Floor ${floor}...*\nSomething lurks ahead.`
}

export async function generateMonsterIntro(monsterName, grade, floor) {
  const prompt = `Dark fantasy monster dialogue for WhatsApp RPG.
ONE menacing line spoken by ${monsterName} (Grade ${grade}, Floor ${floor}).
Write ONLY the monster's dialogue.`
  return await ask(prompt) || `*"You dare enter my domain?!"*`
}

export async function generateBossIntro(bossName, phase, playerName) {
  const prompt = `Dark fantasy boss encounter for WhatsApp RPG (max 5 lines).
Boss: ${bossName}, Phase: ${phase}, Player: ${playerName}
Make it epic and terrifying. Use emojis. Write ONLY the narrative.`
  return await ask(prompt) || `*⚡ THE GROUND TREMBLES — ${bossName.toUpperCase()} AWAKENS!*`
}

export async function generateBossPhaseChange(bossName, phase, hpPercent) {
  const prompt = `RPG boss enters phase ${phase} at ${hpPercent}% HP. Boss: ${bossName}. 2 dramatic lines. Write ONLY the narrative.`
  return await ask(prompt) || `*💀 ${bossName} SCREAMS — A NEW POWER AWAKENS!*`
}

export async function generateLevelUpNarrative(playerName, newLevel, newRank) {
  const prompt = `Dark fantasy RPG level up (3 lines max). Player: ${playerName}, Level: ${newLevel}, Rank: ${newRank}. Write ONLY the narrative.`
  return await ask(prompt) || `✨ *${playerName} grows stronger!*`
}

export async function generateQuestNarrative(questName, questType, region) {
  const prompt = `Dark fantasy RPG quest briefing (4 lines max). Quest: ${questName}, Type: ${questType}, Region: ${region}. Write ONLY the quest narrative.`
  return await ask(prompt) || `*📜 A new quest awaits — venture forth!*`
}

export async function generateExploreEvent(region, playerName, eventType) {
  const prompt = `Dark fantasy RPG exploration event (3-4 lines). Region: ${region}, Player: ${playerName}, Event: ${eventType}. Write ONLY the event.`
  return await ask(prompt) || `*🌫️ The mist rolls in as you venture deeper...*`
}

export async function generateNPCMessage(npcName, npcType, region, worldEvent) {
  const prompt = `You are NPC ${npcName} (${npcType}) in ${region} in a dark fantasy RPG world.
Speak ONE short in-character message (2-3 lines) as if to the room.
World event: ${worldEvent || 'nothing special'}. Do NOT address any specific player.
Write ONLY the NPC message.`
  return await ask(prompt) || `*${npcName} glances around nervously...*\n"Strange things are afoot..."`
}

export async function generateVictoryNarrative(playerName, monsterName, loot) {
  const prompt = `Dark fantasy RPG victory (2-3 lines). ${playerName} defeated ${monsterName}. Loot: ${loot}. Write ONLY the narrative.`
  return await ask(prompt) || `⚔️ *${playerName} stands victorious!*`
}

export async function generateDeathNarrative(playerName, killerName, floor) {
  const prompt = `Dark fantasy RPG death (2-3 lines). ${playerName} defeated by ${killerName} on floor ${floor}. Write ONLY the narrative.`
  return await ask(prompt) || `💀 *${playerName} has fallen...*\nDarkness claims another soul.`
}

export async function generateWorkNarrative(playerName, jobName, jobLevel, goldEarned) {
  const prompt = `Dark fantasy RPG job completion (3 lines). Player: ${playerName}, Job: ${jobName} Lv${jobLevel}, Earned: ${goldEarned}G. Write ONLY the narrative.`
  return await ask(prompt) || `⚒️ *A hard day's work, well done ${playerName}.*`
}
