// The playtests shown on the site, in the order shown. `slug` must match a key under [vars.GAMES] in
// portal/wrangler.toml. `page` is optional: a folder under games/ with a full page for that game.
// `art` is optional: an image under assets/; without one the card draws a title plate in `accent`.
window.SQT_GAMES = [
  {
    slug: 'offrecord',
    title: 'Off Record',
    tagline: 'A snowbound, neon-soaked city block where every citizen lives a full simulated life, and one of them is a killer.',
    tags: ['Detective', 'Immersive sim', 'Co-op 1–4'],
    accent: '#6fd5dc',
    art: 'assets/offrecord/screenshotstreets.PNG',
    page: 'games/offrecord/',
  },
  {
    slug: 'stonethrone',
    title: 'StoneThrone',
    tagline: 'A deep colony sim drawn in isometric pixel-art style, in a 3D world you can turn freely.',
    tags: ['Colony sim', 'Management', 'Simulation'],
    accent: '#d9a35b',
  },
  {
    slug: 'boredtodepth',
    title: 'Bored to Depth',
    tagline: 'Rule a dwarven hold, draw from the Deep Tarot, and dig for the Shinin’ Stone. Get too greedy, get too deep.',
    tags: ['Roguelite', 'Base building', 'Cards'],
    accent: '#c9734f',
  },
  {
    slug: 'nighthunt',
    title: 'Night Hunt',
    tagline: 'Take a contract at the hub and head out into the canyon after the herd.',
    tags: ['Hunting', 'Contracts'],
    accent: '#8f8ce0',
  },
  {
    slug: 'crowdcontrol',
    title: 'Crowd Control',
    tagline: 'A property-trading board game that is deliberately, gleefully unfair: every rule is resolved in code.',
    tags: ['Board game', 'Party', 'Local multiplayer'],
    accent: '#7fbf6a',
  },
];
