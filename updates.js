// Add posts here. Keep the newest date in YYYY-MM-DD format.
// Template:
// { date: 'YYYY-MM-DD', title: 'vX.Y.Z — Title', author: 'Squishtech Industries', body: `Intro.\n\nNEW\n• ...\n\nCHANGED\n• ...\n\nFIXED\n• ...\n\nKNOWN ISSUES\n• ...` },
window.STORE_UPDATES = [
  {
    date: '2026-10-02',
    title: 'v0.2.1 — A new look, and a way to tell us what broke',
    author: 'Squishtech Industries',
    body: `The third playtest build is out. There are no new kinds of case in this one, but nearly everything you look at has changed: the people, the furniture, the rooms, the notebook and the map. And you can now report a bug without leaving the game.

NEW
• Report a bug from inside the game: press F1 (or Esc → Report a bug), say what happened, and the game saves one file to your desktop with your words, a screenshot of what you were looking at, where you were in the case and the details of your PC. "Save and email it" opens your mail program addressed to us; attach the file and send. Nothing is sent unless you send it.

CHANGED
• New-look citizens: top-heavy voxel figures with five face shapes, layered hair or a hat, and coats in three cuts. They walk on real legs now instead of gliding, and so do passers-by and other detectives in co-op.
• New furniture everywhere: beds, couches, armchairs, tables and chairs in their own fabrics, woods and stone, proper kitchen cabinets, real toilets and glass shower cabins, and benches on the street.
• Bigger buildings, with rooms you can move about in: every lot is about a quarter larger, furniture keeps the floor in front of it clear, kitchens are rooms of their own and bathrooms are twice the size. Some buildings have switchback stairs.
• Glass can be shot out: windows, office glass walls, the glass in doors, shower cabins and the gun counter's case. It is put back after a few minutes.
• Chairs and stools slide out of the way when you walk into them, and go over when shot.
• Fire escapes reach the ground: let the ladder down from the landing (E) or shoot it down, then climb.
• Drawers and shower doors open (E), and so do windows (hold E at the blinds).
• The notebook reads as a case file: a record for the case, cards for the evidence, a Profile tab for each person, and labelled findings in the inventory.
• Accusing asks first: you see who, why and how much evidence you cite, and confirm, since a case can only be closed once.
• The wire: messages arrive at the top right as tagged, time-stamped slips, and the last few are listed under the clock when you raise your watch (Q).
• The map is a schematic, with street names, a scale bar and one mark each for you, front doors and the crime scene.
• A new case screen, a quieter pause menu, and a loading screen that keeps moving.
• The case opens at night: play starts at 22:00 on the day the body is found.
• A field of view slider in the settings (55° to 100°).

FIXED
• Kitchens too tight to walk through, toilets and showers standing in a bathroom's doorway, a slit into the stairwell seen from outside, a parapet standing inside the top of a stairwell, and carpets showing in the gap between storeys from the street.

KNOWN ISSUES
• A bug in the main menu or on the loading screen can't be reported with F1 yet, only once you are in a case.
• Saves from v0.2.0 may not rebuild as you left them: every building is larger and every room rearranged.
• Citizens don't use the lifts, and nobody reacts to gunfire yet.
• Bigger towns reuse the same four buildings, numbered.
• A loaded game always starts solo, even if it was saved in co-op.
• Other players can't see your cigarette.
• Co-op has still only been tested on one PC and a home network.

WHAT WE WANT TO HEAR
When something breaks or looks wrong, press F1 there and then and send us the file. Can you get around the new rooms without getting stuck on the furniture? And as ever: was the case fair?`,
  },
  {
    date: '2026-09-30',
    title: 'v0.2.0 — Save your case, grow the town',
    author: 'Squishtech Industries',
    body: `The second playtest build is out. You can save now, the town can grow to 5×5, flats have rooms, offices have cubicles, people mind their own lights and blinds, and a detective can finally have a smoke.

NEW
• Save and load: Esc → Save game (or F5), Load game on the main menu. Each case keeps its own slot plus a backup, and a save from a different build asks before it loads.
• Town size: pick the standard four-lot block or a bigger town up to 5×5 in case select, with more people and different cases. Bigger towns get car parks and a loading screen with a progress bar.
• Flats have rooms (bedrooms, bathrooms, kitchens, halls), furnished for what they are, from flophouse closets to a penthouse on the Marlowe's top floor.
• Office floors are cubicle farms, with glass-walled offices and ceiling fans.
• Light switches and blinds: people switch their own lights and open and shut their own blinds through the day. You can too: tap E on a window to cycle its blinds, or hold E to choose. Cupboards open as well.
• Handwriting you can tell apart (every hand has its own slant and ink, labelled Hand A, Hand B…), prints that tell you which items share a finger, and N on anyone for their page in your notebook.
• Murders happen in more places, and dumped weapons turn up in trash cans, storm drains, on fire escapes and on roofs.
• Morelies: office vending machines sell cigarettes. Smoke one over a clue in your inventory for a hint at where the trail goes next, or press C to light one up and look the part.
• First-person arms (your watch comes up on your wrist), three new guns (the Heavy Six revolver, the Mudskipper SMG and the MSSA rifle), and in co-op, detectives can now shoot each other.
• Passers-by from out of the district walk the sidewalks.
• An options screen with graphics presets, your own saved profiles, and display and audio settings.
• A new title and main menu: the name in neon, and an interrogation room behind the buttons.

CHANGED
• Faster: about two-thirds fewer shadow draws on the streets, hidden buildings aren't drawn, and distant buildings become simple stand-ins whose windows still light up room by room.
• People walk properly and step round you instead of through you.
• The game opens in borderless fullscreen and remembers if you'd rather play in a window (F11).
• Every model now wears the game's own textures, for one consistent look.

FIXED
• Ceiling lights floating over stairwells, door numbers on doors inside a flat, blinds that all moved together or slid off to the corner, glass front doors on flats, falling through the ground in car parks, crime-scene tape outside its doorway, corridor-shaped flats, being walled in by the gun counter, and lamp shadows flickering as you walked.

KNOWN ISSUES
• Citizens don't use the lifts, and nobody reacts to gunfire yet.
• Bigger towns reuse the same four buildings, numbered, and a 5×5 town takes about 17 seconds to load.
• A loaded game always starts solo, even if it was saved in co-op.
• Other players can't see your cigarette.
• Co-op has still only been tested on one PC and a home network.

WHAT WE WANT TO HEAR
Try a bigger town and tell us how it runs (F3 shows your frame rate). Did a Morelies hint help, or give too much away? And as ever: was the case fair?`,
  },
  {
    date: '2026-09-27',
    title: 'v0.1.0 — The first playtest',
    author: 'Squishtech Industries',
    body: `The first build of Off Record is out to playtesters. Thank you for taking a case.

WHAT'S IN THIS BUILD
• The block: four buildings (Harrow Apartments, the Marlowe Building with Dot's Diner, Lantern House with The Lantern bar, and Kessler's Grocery), dealt onto the town's four corners by each seed, with procedural upper floors and basements, working lifts in the taller buildings, fire escapes and roof access.
• The simulation: ~20 citizens with jobs, schedules, relationships, secrets, perception, fading memory and gossip, walking their days through the streets and buildings.
• Cases: simulated murders with four kinds of motive, physical evidence, fingerprints, handwriting, lying witnesses, and an accusation that needs the right suspect and at least two pieces of evidence that really point to them.
• Consequences: a new case follows every solved one; an unsolved killer strikes again after three days.
• Tools: notebook, inventory with 3D inspection and print dusting, city map, public directory, and a wristwatch to wait for the right hour.
• Firearms: seven guns and five calibres from Kessler's sporting counter, aim-down-sights, recoil, reloading, recorded gunshots.
• Co-op for up to four players.
• Title sequence, main menu, settings and credits; winter-neon streets with snow, wet reflective cobbles and neon.

KNOWN ISSUES
• Citizens glide rather than walk, pass through each other, and never use the lifts.
• Nobody reacts to gunfire yet.
• No first-person arms.
• Co-op has only been tested on one PC and a home network.

WHAT WE WANT TO HEAR
Was the case fair? Where did you get stuck? Did a witness say something that didn't add up? And your frame rate (press F3).`,
  },
];
