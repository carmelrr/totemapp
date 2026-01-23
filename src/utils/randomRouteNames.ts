// Random route names for SprayWall and Community Routes
// Creative climbing route names - English only for universal use

const ROUTE_NAMES: string[] = [
  // Animals & Creatures
  'Shadow Panther',
  'Golden Eagle',
  'Midnight Wolf',
  'Iron Gorilla',
  'Desert Scorpion',
  'Wall Spider',
  'Mountain Goat',
  'Crimson Viper',
  'Arctic Fox',
  'Thunder Hawk',
  'Silent Cobra',
  'Ghost Leopard',
  'Stone Grizzly',
  'Savage Honey Badger',
  'Electric Eel',
  'Phantom Shark',
  'Raging Bull',
  'Steel Rhino',
  'Cosmic Octopus',
  'Neon Jaguar',
  'Hungry Python',
  'Wild Mustang',
  'Frost Bear',
  'Venom Spider',
  'King Cobra',
  
  // Mythological & Fantasy
  'Dragon\'s Breath',
  'Phoenix Rising',
  'Titan\'s Grip',
  'Kraken\'s Reach',
  'Medusa\'s Gaze',
  'Hydra\'s Fury',
  'Griffin\'s Flight',
  'Minotaur\'s Maze',
  'Pegasus Dream',
  'Valkyrie\'s Edge',
  'Thor\'s Hammer',
  'Odin\'s Eye',
  'Loki\'s Trick',
  'Zeus\'s Wrath',
  'Poseidon\'s Trident',
  'Hades\'s Descent',
  'Cerberus Gate',
  'Unicorn Stampede',
  'Chimera Chase',
  'Banshee Scream',
  'Wizard\'s Staff',
  'Dark Sorcerer',
  'Elven Arrow',
  'Dwarf\'s Hammer',
  'Giant\'s Footstep',
  
  // Nature & Elements
  'Solar Flare',
  'Lunar Eclipse',
  'Storm Surge',
  'Avalanche',
  'Earthquake',
  'Volcanic Fury',
  'Frozen Waterfall',
  'Desert Mirage',
  'Lightning Strike',
  'Tsunami Wave',
  'Northern Lights',
  'Meteor Shower',
  'Crimson Sunset',
  'Dawn Patrol',
  'Twilight Zone',
  'Monsoon Madness',
  'Wildfire',
  'Blizzard',
  'Hurricane Force',
  'Supernova',
  'Electric Storm',
  'Acid Rain',
  'Magma Flow',
  'Ice Age',
  'Fire & Ice',
  
  // Action & Power
  'Full Send',
  'No Retreat',
  'Beast Mode',
  'Turbo Boost',
  'Power Surge',
  'Nitro Blast',
  'Maximum Effort',
  'Zero Gravity',
  'Warp Speed',
  'Hyperdrive',
  'Adrenaline Rush',
  'Overdrive',
  'Limit Breaker',
  'Final Push',
  'Last Stand',
  'Point Break',
  'Savage Mode',
  'Ultra Instinct',
  'Going Nuclear',
  'Critical Mass',
  'Full Throttle',
  'Red Line',
  'Terminal Velocity',
  'Breaking Point',
  'Total Chaos',
  
  // Climbing Specific
  'Crimp City',
  'Dyno Dynasty',
  'Sloper Madness',
  'Pinch Me',
  'Heel Hook Heaven',
  'Toe Hook Terror',
  'Campus King',
  'Flag Master',
  'Mantle Mayhem',
  'Deadpoint Dream',
  'Bat Hang',
  'Drop Knee',
  'Gaston Gang',
  'Undercling Underground',
  'Bicep Buster',
  'Finger Blaster',
  'Core Crusher',
  'Pump Factory',
  'Flash Zone',
  'Project X',
  'Crimpy Business',
  'Jug Life',
  'Beta Spray',
  'Slab Master',
  'Roof Runner',
  
  // Pop Culture & Fun
  'Pizza Time',
  'Coffee Break',
  'Monday Blues',
  'Friday Vibes',
  'WiFi Password',
  'Loading...',
  'Ctrl+Z',
  'Error 404',
  'Blue Screen',
  'Game Over',
  'Extra Life',
  'Cheat Code',
  'Final Boss',
  'Level Up',
  'Achievement Unlocked',
  'Speed Run',
  'No Save Point',
  'Rage Quit',
  'GG EZ',
  'Press F',
  'Alt+F4',
  'Buffer Overflow',
  'Infinite Loop',
  'Stack Overflow',
  'Syntax Error',
  
  // Abstract & Philosophical
  'Sweet Pain',
  'Beautiful Chaos',
  'Organized Mess',
  'Controlled Fall',
  'Graceful Struggle',
  'Silent Scream',
  'Calm Storm',
  'Dark Light',
  'Cold Fire',
  'Dry Rain',
  'Loud Silence',
  'Simple Complex',
  'Random Logic',
  'Planned Chaos',
  'Bitter Sweet',
  'Zen Mode',
  'Flow State',
  'Mind Over Matter',
  'Pure Grit',
  'Raw Power',
  'Crystal Clear',
  'Fuzzy Logic',
  'Empty Full',
  'Heavy Feather',
  'Solid Smoke',
  
  // Space & Cosmic
  'Black Hole',
  'Event Horizon',
  'Wormhole',
  'Nebula',
  'Pulsar',
  'Quasar',
  'Dark Matter',
  'Antimatter',
  'Cosmic Dust',
  'Star Cluster',
  'Galaxy Quest',
  'Interstellar',
  'Light Year',
  'Space Odyssey',
  'Orbital Decay',
  'Zero Point',
  'Singularity',
  'Big Bang',
  'Cosmic Ray',
  'Solar Wind',
  'Red Giant',
  'White Dwarf',
  'Neutron Star',
  'Gamma Burst',
  'Dark Energy',
  
  // Edgy & Bold
  'No Mercy',
  'Blood Moon',
  'Death Grip',
  'Bone Crusher',
  'Soul Stealer',
  'Mind Breaker',
  'Skull Crusher',
  'Nightmare Fuel',
  'Pain Train',
  'Fear Factor',
  'Grim Reaper',
  'Dark Knight',
  'Shadow Walker',
  'Night Stalker',
  'Ghost Protocol',
  'Venom',
  'Carnage',
  'Havoc',
  'Mayhem',
  'Chaos',
  'Anarchy',
  'Destroyer',
  'Annihilator',
  'Obliterator',
  'Terminator',
  
  // Movie/Music References
  'Enter Sandman',
  'Stairway Up',
  'Highway to Hell',
  'Sweet Dreams',
  'Purple Rain',
  'Smoke on Water',
  'Rock You',
  'Born to Run',
  'Eye of Tiger',
  'Don\'t Stop',
  'Take On Me',
  'Beat It',
  'Jump Around',
  'Let It Be',
  'Imagine',
  'Bohemian',
  'Thunderstruck',
  'Back in Black',
  'Sweet Victory',
  'Livin\' on Edge',
];

/**
 * Get a random route name
 * @returns A random route name
 */
export function getRandomRouteName(): string {
  const randomIndex = Math.floor(Math.random() * ROUTE_NAMES.length);
  return ROUTE_NAMES[randomIndex];
}

/**
 * Get multiple random route names (without duplicates)
 * @param count - Number of names to return
 * @returns Array of random route names
 */
export function getRandomRouteNames(count: number = 5): string[] {
  const names = [...ROUTE_NAMES];
  const result: string[] = [];
  
  for (let i = 0; i < Math.min(count, names.length); i++) {
    const randomIndex = Math.floor(Math.random() * names.length);
    result.push(names[randomIndex]);
    names.splice(randomIndex, 1); // Remove to avoid duplicates
  }
  
  return result;
}

/**
 * Get a random route name that's different from the current one
 * @param currentName - The current name to avoid
 * @returns A different random route name
 */
export function getNewRandomRouteName(currentName: string): string {
  // If somehow we only have one name, just return it
  if (ROUTE_NAMES.length <= 1) return ROUTE_NAMES[0] || 'Route';
  
  let newName = currentName;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (newName === currentName && attempts < maxAttempts) {
    const randomIndex = Math.floor(Math.random() * ROUTE_NAMES.length);
    newName = ROUTE_NAMES[randomIndex];
    attempts++;
  }
  
  return newName;
}
