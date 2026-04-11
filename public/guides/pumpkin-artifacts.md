# PumpkinArtifacts

## Install
- Put `PumpkinArtifacts-1.0.jar` in your server `plugins/` folder.
- Restart the server.

## Usage
Artifacts are special items that level up through gameplay.

Players obtain artifacts via commands, events, or loot systems. Each artifact gains experience from actions such as combat, mining, or ability usage.

As artifacts level up, they unlock abilities and increase in power. Abilities may trigger passively (on hit, on damage) or actively (right-click).

Artifacts store their data internally (level, XP, abilities), allowing progression to persist.

## Commands & permissions
- `/artifact give <player> <id>` — `pumpkin.artifacts.admin`
- `/artifact xp <player> <amount>` — `pumpkin.artifacts.admin`
- `/artifact info` — `pumpkin.artifacts.use`
