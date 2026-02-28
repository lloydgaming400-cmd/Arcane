import { getPlayer, updatePlayer, incrementKillCount } from './database.js'

const TITLE_DEFINITIONS = [
    { id: 'goblin_hunter',    name: 'Goblin Hunter',       monster: 'goblin',    count: 100,   effect: '+5 ATK vs Goblins' },
    { id: 'goblin_slayer',    name: 'Slayer of Goblins',   monster: 'goblin',    count: 1000,  effect: '+15 ATK vs Goblins' },
    { id: 'dragon_slayer',    name: 'Dragon Slayer',       monster: 'dragon',    count: 100,   effect: '+10 ATK vs Dragons' },
    { id: 'dragonlord',       name: 'Dragonlord',          monster: 'dragon',    count: 1000,  effect: '+25 ATK vs Dragons' },
    { id: 'ghost_reaper',     name: 'Ghost Reaper',        monster: 'undead',    count: 500,   effect: '+8 ATK vs Undead' },
    { id: 'boss_hunter',      name: 'Boss Hunter',         type: 'boss',         count: 50,    effect: '+5% Boss DMG' },
    { id: 'legend_breaker',   name: 'Legend Breaker',      type: 'legendary_boss', count: 1,  effect: '+10% All DMG' },
    { id: 'cockroach',        name: 'The Cockroach',       type: 'deaths',       count: 100,   effect: 'Revive once with 1HP' },
    { id: 'the_bandit',       name: 'The Bandit',          type: 'robs',         count: 50,    effect: '+5% Rob success rate' },
    { id: 'arena_champion',   name: 'Arena Champion',      type: 'pvp_wins',     count: 100,   effect: '+10% PVP DMG' },
    { id: 'dungeon_sovereign',name: 'Dungeon Sovereign',   type: 'floor_100',    count: 1,     effect: 'Aura of Fear in dungeons' },
    { id: 'egg_collector',    name: 'Egg Collector',       type: 'eggs_found',   count: 10,    effect: '50% faster egg hatch' },
    { id: 'dragon_tamer',     name: 'Dragon Tamer',        type: 'dragon_hatched', count: 1,   effect: 'Dragon summon power +20%' },
]

export async function checkTitles(playerId, event, value = 1) {
    const player = await getPlayer(playerId)
    if (!player) return []

    const earned = []
    for (const title of TITLE_DEFINITIONS) {
        if (player.titles?.includes(title.id)) continue

        let qualifies = false

        if (title.monster && event === 'kill' && value === title.monster) {
            const count = await incrementKillCount(playerId, title.monster)
            if (count >= title.count) qualifies = true
        } else if (title.type && event === title.type) {
            const stats = player.stats || {}
            const current = (stats[title.type] || 0) + 1
            await updatePlayer(playerId, { stats: { ...stats, [title.type]: current } })
            if (current >= title.count) qualifies = true
        }

        if (qualifies) {
            const titles = [...(player.titles || []), title.id]
            await updatePlayer(playerId, { titles })
            earned.push(title)
        }
    }
    return earned
}

export function getTitleById(id) {
    return TITLE_DEFINITIONS.find(t => t.id === id)
}

export function formatTitleEarned(title) {
    return `
╔══════════════════════════════╗
║   🏆  NEW TITLE EARNED!      ║
╚══════════════════════════════╝

✦ *${title.name}* ✦

${title.effect}

Equip it with *!settitle ${title.name}*`
}
