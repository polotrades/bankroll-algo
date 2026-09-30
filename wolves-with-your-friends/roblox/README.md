# Wolves With Your Friends: Roblox game (Phase 1)

`WolvesWithYourFriends.rbxl` is a ready-to-open place file built from `src/` with [Rojo](https://rojo.space).

## Open and test it

1. In Roblox Studio: **File > Open from File** and pick `WolvesWithYourFriends.rbxl`.
2. **File > Publish to Roblox**. The AI and voice features only work in a published game.
3. **Game Settings > Communication**: turn on **Enable Microphone** (and voice chat).
4. In the Explorer select **VoiceChatService** and set **UseAudioApi** to **Enabled**.
5. **Game Settings > Places**: set the server size to **10**.
6. Press **Play**, or use **Test > Clients and Servers** with 2+ players to try Take Over Call.

If the AI text service isn't available to the game yet, clients fall back to canned lines automatically. Without a mic, players type in the Phone app.

## Put the real characters in

The NPCs (Receptionist, Security Guard, The Chairman) are placeholder blocks until you import the Blender models:

1. **File > Import 3D**, pick `../blender/export/Receptionist.fbx` (and `SecurityGuard.fbx`, `TheChairman.fbx`).
2. In **ServerStorage**, create a folder named **CharacterModels** and put the imported models in it, named `Receptionist`, `SecurityGuard` and `TheChairman`.
3. Play: the NPCs now use the real models. If one faces the wrong way, set `yaw = 90` (or 180 / -90) next to its `modelName` in `src/server/OfficeBuilder.lua`.

The same export also includes `RookieBroker`, `Intern`, `CryptoBro` and `CEO` for later, when they become playable characters.

## What works in Phase 1

- Floor 100 blockout: trading floor with 14 desk computers, conference room, CEO office, break room, elevator lobby with LED logo, floor-to-ceiling windows, skyline and moving traffic 700 studs below.
- Calls: a random desk rings (red lamp, "RING RING!" tag, NPCs shout the desk number). Run over and press **E** to answer. Unanswered calls jump to another desk after 8 seconds.
- **Take Over Call**: walk up to a coworker's desk and hold **F**. The AI client is told a new broker grabbed the phone.
- AI clients: 9 fictional personalities with their own voices. They remember the whole call (TextGenerator ContextToken), react to what you say, and only share their details once their interest reaches 60%.
- Voice: speak into your mic (MIC ON), and the client answers out loud in your headset. Typing always works too.
- Shark OS: boot screen, draggable windows, taskbar, status bar (Personal / Firm / Target / meeting countdown / clock).
- Apps: Phone, Account Opener ($250), TradeLink ($400), Penny Stock Order ($600), Script (optional pitch lines).
- Money: every deal pays Personal **and** Firm money. The daily target rises: $600, $1,400, $1,750, $2,600, ...
- 10-minute day, then the boss meeting: players are pulled to the conference room, Deal Replay shows 3 funny lines, everyone votes, and the winner gets $500.
- Target met: bonus, next day. Missed: YOU'RE FIRED, the room catches fire, then the Final Statement ranking.

## Not built yet (next phases)

Pick up / throw / ragdolls, throwable NPCs, weapons and Shark Mart, office events (raid, outage, celebrity...), rooftop club, bathrooms, playable custom characters (rigging), the main menu with private offices, and a ring sound (add a Creator Store sound id to `Config.RING_SOUND_ID`).

## Developing

`rojo serve` + the Rojo Studio plugin syncs `src/` live into Studio. `rojo build -o WolvesWithYourFriends.rbxl` rebuilds the place file.

| Folder | Runs on | What |
| --- | --- | --- |
| `src/shared` | both | Config, AI client personalities, deal apps, pitch scripts, remote events |
| `src/server` | server | Office builder, calls, AI, money, NPCs, day/meeting loop |
| `src/client` | each player | HUD, Shark OS desktop and apps, voice, meeting screens, traffic |
