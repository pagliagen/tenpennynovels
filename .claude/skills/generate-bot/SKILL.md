---
name: generate-bot
description: Create a chat bot for a location. Use when you need to add an NPC that answers players in a location chat (bot-service), or populate a location with characters.
user-invocable: true
---

## Overview
Add a bot to `bot-service/`: a game character (owned by the `system-bot` user) plus a bot sheet (persona + psychology) and a mapping to a location. The bot answers with a local LLM (Ollama) in that location's chat only.

## Usage Pattern
/generate-bot [location_name] [description]

Parameters:
- **location_name**: name of the location (e.g. "Ten Bells Public House")
- **description**: who the bot is (role, age, temperament) — you turn it into a persona and a psychological sheet

Example:
- /generate-bot "Ten Bells Public House" "una cameriera sbrigativa, vedova, che sa tutto del quartiere"

## Alternativa: dal gestionale
Con `ENABLE_BOT_CHARACTERS=true`, `ENABLED_SERVICES=character-bot` e il gateway acceso, il tab **Bot** di «Gestione Personaggi» fa tutto questo da sé: scegli la location, descrivi il bot, correggi la bozza, «Crea bot» (personaggio, `bots/<nome>.json` e `mapping.json`, con ricarica automatica). I passi sotto restano validi per fare a mano o per rapporti e atteggiamenti.

## Steps

1. **Find the location** (`/manage-db tenpennynovels`): `db.locations.findOne({ name: '...' }, { _id: 1, slug: 1, positions: 1 })`.
2. **Define the bot** in `BOT_CHARACTERS` in `scripts/seeders/seeders/BotCharacterSeeder.ts`:
   - character fields (name, gender, age, appearance...) — no location: the association lives in `mapping.json`;
   - `persona`: 5-8 sentences in Italian, second person ("Sei..."), role, temperament, how they treat strangers, what they know and share. No proper names of other characters.
   - `psyche`: Big Five 1-100 (`ocean` O C E A N), Enneagram (`type`, `fear`, `desire`), baseline mood `pad` (p, a, d in -1..1). See `bot-service/README.md` for how numbers become behaviour.
3. **Run the seeder**: `cd scripts/seeders && npm run seed:dev:bots` (idempotent). It prints the full `bots/<name>.json` with the new `characterId`.
4. **Save** that JSON as `bot-service/bots/<name>.json` and add `{ "locationId": "<_id>", "botId": "<characterId>" }` to `bot-service/mapping.json` (one bot per location).
5. **Restart** `bot-service` (`npm run bot-service:dev`) and try it: `cd bot-service && npm run simulate -- <locationId> "Buonasera" Tester Ingresso`.

## Prerequisites
- User `system-bot` seeded (`seed:dev:users`) and `BOT_SERVICE_SECRET` set (see `bot-service/README.md`).
- Ollama running with the model in `bot-service/.env` (`OLLAMA_MODEL`, default `gemma4:12b`).
- `ENABLED_SERVICES` in `bot-service/.env` includes `character-bot` (empty = no service starts; the bot lives in `bot-service/src/character-bot/`).
