// Dota 2 Asset CDN helper

// ดึงภาพ Hero Avatar ตาม ID หรือชื่อ
export const getHeroImageUrl = (heroName?: string, heroId?: number): string => {
    if (heroName && heroName.startsWith('http')) return heroName;

    // แปลงชื่อ hero format npc_dota_hero_xxx
    if (heroName && heroName.length > 0 && isNaN(Number(heroName))) {
        const clean = heroName.replace('npc_dota_hero_', '').toLowerCase().replace(/[^a-z0-9_]/g, '');
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${clean}.png`;
    }

    // Fallback กรณีมีแค่ heroId
    if (heroId) {
        const HERO_MAP: Record<number, string> = {
            1: 'antimage', 2: 'axe', 3: 'bane', 4: 'bloodseeker', 5: 'crystal_maiden',
            6: 'drow_ranger', 7: 'earthshaker', 8: 'juggernaut', 9: 'mirana', 10: 'morphling',
            11: 'nevermore', 12: 'phantom_lancer', 13: 'puck', 14: 'pudge', 15: 'razor',
            16: 'sand_king', 17: 'storm_spirit', 18: 'sven', 19: 'tiny', 20: 'vengefulspirit',
            21: 'windrunner', 22: 'zuus', 23: 'kunkka', 25: 'lina', 26: 'lion',
            27: 'shadow_shaman', 28: 'slardar', 29: 'tidehunter', 30: 'witch_doctor',
            31: 'lich', 32: 'riki', 33: 'enigma', 34: 'tinker', 35: 'sniper',
            36: 'necrolyte', 37: 'warlock', 38: 'beastmaster', 39: 'queenofpain',
            40: 'venomancer', 41: 'faceless_void', 42: 'skeleton_king', 43: 'death_prophet',
            44: 'phantom_assassin', 45: 'pugna', 46: 'templar_assassin', 47: 'viper',
            48: 'luna', 49: 'dragon_knight', 50: 'dazzle', 51: 'rattletrap', 52: 'leshrac',
            53: 'furion', 54: 'life_stealer', 55: 'dark_seer', 56: 'clinkz', 57: 'omniknight',
            58: 'enchantress', 59: 'huskar', 60: 'night_stalker', 61: 'broodmother',
            62: 'bounty_hunter', 63: 'weaver', 64: 'jakiro', 65: 'batrider', 66: 'chen',
            67: 'spectre', 68: 'ancient_apparition', 69: 'doom_bringer', 70: 'ursa',
            71: 'spirit_breaker', 72: 'gyrocopter', 73: 'alchemist', 74: 'invoker',
            75: 'silencer', 76: 'obsidian_destroyer', 77: 'lycan', 78: 'lone_druid',
            79: 'brewmaster', 80: 'shadow_demon', 81: 'chaos_knight', 82: 'meepo',
            83: 'treant', 84: 'ogre_magi', 85: 'undying', 86: 'rubick', 87: 'disruptor',
            88: 'nyx_assassin', 89: 'naga_siren', 90: 'keeper_of_the_light', 91: 'wisp',
            92: 'visage', 93: 'slark', 94: 'medusa', 95: 'troll_warlord', 96: 'centaur',
            97: 'magnataur', 98: 'shredder', 99: 'bristleback', 100: 'tusk',
            101: 'skywrath_mage', 102: 'abaddon', 103: 'elder_titan', 104: 'legion_commander',
            105: 'techies', 106: 'ember_spirit', 107: 'earth_spirit', 108: 'abyssal_underlord',
            109: 'terrorblade', 110: 'phoenix', 111: 'oracle', 112: 'winter_wyvern',
            113: 'arc_warden', 114: 'monkey_king', 119: 'dark_willow', 120: 'pangolier',
            121: 'grimstroke', 123: 'hoodwink', 126: 'void_spirit', 128: 'snapfire',
            129: 'mars', 135: 'dawnbreaker', 136: 'marci', 137: 'primal_beast', 138: 'muerta', 145: 'ringmaster'
        };
        const name = HERO_MAP[heroId];
        if (name) {
            return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${name}.png`;
        }
    }
    return '';
};

// ดึงภาพ Item Icon จาก Steam CDN (รองรับทั้งชื่อและ Item ID ทั่วไป)
export const getItemImageUrl = (itemId?: number | string): string => {
    if (!itemId || itemId === 0 || itemId === '0') return '';

    if (typeof itemId === 'string' && isNaN(Number(itemId))) {
        const clean = itemId.replace('item_', '');
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${clean}.png`;
    }

    // ID แมพไอเทมหลักของ Dota 2
    const ITEM_MAP: Record<number, string> = {
        1: 'blink', 2: 'blades_of_attack', 3: 'broadsword', 4: 'chainmail', 5: 'claymore',
        6: 'helm_of_iron_will', 7: 'javelin', 8: 'mithril_hammer', 9: 'platemail', 10: 'quarterstaff',
        11: 'quelling_blade', 12: 'ring_of_protection', 13: 'gauntlets', 14: 'slippers', 15: 'mantle',
        16: 'branches', 17: 'belt_of_strength', 18: 'boots_of_elves', 19: 'robe', 20: 'circlet',
        29: 'boots', 30: 'gem', 31: 'cloak', 32: 'talisman_of_evasion', 34: 'magic_stick',
        36: 'magic_wand', 38: 'clarity', 39: 'flask', 40: 'dust', 41: 'bottle', 42: 'ward_observer',
        43: 'ward_sentry', 44: 'tango', 46: 'tpscroll', 48: 'travel_boots', 50: 'phase_boots',
        63: 'power_treads', 65: 'hand_of_midas', 67: 'oblivion_staff', 69: 'pers', 71: 'poor_mans_shield',
        73: 'bracer', 75: 'wraith_band', 77: 'null_talisman', 79: 'mekansm', 81: 'vladmir',
        86: 'buckler', 88: 'ring_of_basilius', 90: 'pipe', 92: 'urn_of_shadows', 94: 'headdress',
        96: 'sheepstick', 98: 'orchid', 100: 'cyclone', 102: 'force_staff', 104: 'dagon',
        106: 'necronomicon', 108: 'ultimate_scepter', 110: 'refresher', 112: 'assault', 114: 'heart',
        116: 'black_king_bar', 117: 'aegis', 119: 'shivas_guard', 121: 'bloodstone', 123: 'sphere',
        125: 'vanguard', 127: 'blade_mail', 129: 'soul_booster', 131: 'hood_of_defiance', 133: 'rapier',
        135: 'monkey_king_bar', 137: 'radiance', 139: 'butterfly', 141: 'greater_crit', 143: 'basher',
        145: 'bfury', 147: 'manta', 149: 'lesser_crit', 151: 'armlet', 152: 'invis_sword', 154: 'sange_and_yasha',
        156: 'satanic', 158: 'mjollnir', 160: 'skadi', 162: 'sange', 164: 'helm_of_the_dominator',
        166: 'maelstrom', 168: 'desolator', 170: 'yasha', 172: 'mask_of_madness', 174: 'diffusal_blade',
        176: 'ethereal_blade', 178: 'soul_ring', 180: 'arcane_boots', 181: 'orb_of_venom', 182: 'stout_shield',
        185: 'ancient_janggo', 187: 'medallion_of_courage', 188: 'smoke_of_deceit', 190: 'veil_of_discord',
        206: 'rod_of_atos', 208: 'abyssal_blade', 210: 'heavens_halberd', 212: 'ring_of_aquila', 214: 'tranquil_boots',
        215: 'shadow_amulet', 216: 'glimmer_cape', 218: 'solar_crest', 220: 'travel_boots_2', 226: 'lotus_orb',
        229: 'solar_crest', 231: 'guardian_greaves', 232: 'octarine_core', 235: 'moon_shard', 236: 'silver_edge',
        247: 'moon_shard', 249: 'silver_edge', 250: 'bloodthorn', 252: 'echo_sabre', 254: 'glimmer_cape',
        259: 'aeon_disk', 261: 'kaya', 263: 'refresher_shard', 265: 'hurricane_pike', 267: 'spirit_vessel',
        271: 'holy_locket', 273: 'kaya_and_sange', 277: 'yasha_and_kaya', 279: 'ring_of_tarrasque', 609: 'aghanims_shard'
    };

    const name = ITEM_MAP[Number(itemId)];
    if (name) {
        return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${name}.png`;
    }
    return '';
};