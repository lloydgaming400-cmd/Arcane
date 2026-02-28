# ⚔️ YatoRPG Bot — Setup Guide

## 📱 Installing on Termux (Android)

```bash
# 1. Install Node.js
pkg update && pkg upgrade
pkg install nodejs git

# 2. Clone/copy the bot to your phone
# (copy the rpg-bot folder to your Termux home)

# 3. Install dependencies
cd rpg-bot
npm install

# 4. Add your Gemini API key
# Open config.js and replace PUT_YOUR_GEMINI_KEY_HERE with your key

# 5. Start the bot
node index.js

# 6. Scan the QR code with WhatsApp
```

## ⚙️ Config (config.js)
- `ownerNumber` — Your WhatsApp number (already set to 2347062301848)
- `geminiKey` — Your Google Gemini API key from aistudio.google.com

## 🎮 Commands
- `!register` — Create your character
- `!profile` — View your stats
- `!help` — All commands
- `!dungeon` — Enter a dungeon

## 📦 Parts Being Built
- ✅ Part 1: Core foundation
- ✅ Part 2: Database + AI engines
- ✅ Part 3: Data files (classes, races, items etc)
- ✅ Part 4: Register + Profile
- 🔄 Part 5: Combat + Dungeon system
- 🔄 Part 6: Inventory + Shop
- 🔄 Part 7: Bank + Economy
- 🔄 Part 8: Party + Guild + Quests + Jobs
- 🔄 Part 9: Adventure + World Bosses
- 🔄 Part 10: Summons + Eggs + Titles + NPC + Admin
