# Wordwild

A learn-to-read adventure for 5-year-olds (iPad and iPhone). Kids learn phonics with Pip, blast words off on rockets, build words, teach Pip, read decodable books and hatch Wordling eggs.

## How it teaches
- **Systematic synthetic phonics**, assuming letter names are known: 7 worlds, 34 lessons, 62 graphemes plus 44 heart (tricky) words.
  - Worlds 1–4: s a t p i n … ow oi.
  - World 5 (Cloud Kingdom): consonant blends, two-part words, y saying "ee", -ing.
  - World 6 (Coral Reef): other spellings of known sounds (ay ou ea ie y oy ir er aw ew).
  - World 7 (Star Station): split vowels a‑e i‑e o‑e u‑e (shown as gold "magic e" tiles), wh, ph.
- **Decodable books and sentences**: 34 stories and about 150 sentences. `tools/build_content.mjs` refuses to build if any story or sentence word uses a sound not yet taught.
- **Lesson loop**: spaced review → meet new sounds → bubble pop → rocket blending (tap sounds, slide to blend, pick the picture) → syllable chop (two-part words) → word forge (spelling with sound boxes) → heart words → a word game → teach Pip (spot Pip's mistake) → a sentence game → story + question → egg hatch.
  - Word games (taking turns by lesson): Memory Match (word ↔ picture), Word Ladder (change one sound: cat → cot → cog), Spelling Detective (which spelling of a sound is in this word; always used when a lesson adds a new spelling).
  - Sentence games: Sentence Builder (word tiles in order, with the capital and full stop), Silly or Sensible?, Fix It! (Pip's missing capital/full stop), Dictation (hear a sentence and write it: pick words, spell one with sound tiles, choose the end mark), Finish My Sentence (pick and spell the last word, then hear your sentence).
- **Adaptive**: each sound and word has a spaced-repetition box; difficulty (number of choices, distractors, bubble speed) tracks recent accuracy to keep it near 85%. Mix-ups (e.g. b/d) feed the next warm-up.
- **Rewards**: gems, 19 collectable Wordlings (all with decodable names), hats for Pip, a library of finished books to re-read, and an arcade (Bubble Blitz, Rocket Read, Memory Match). There are no loot boxes or streak guilt, and a parent-set daily limit ends play with a gentle "Pip is sleepy" screen.
- **Grown-ups corner**: hold the ⚙️ for 2 seconds. It shows progress, a sound-mastery grid (tap to hear each sound), mix-ups and tricky words, the daily limit, music, skip-ahead and reset.

## Layout
- `app/`: the static web app (no build step). `js/data.js` holds the curriculum.
- `app/audio/`: voice clips. Words, sentences and Pip are synthesised by `tools/gen_audio.py` (Microsoft `en-AU-NatashaNeural`).
  The 62 pure letter sounds `p_*.mp3` are real recordings from Literacy Hub's "Phonemes and graphemes daily review" under **CC BY 4.0**. That licence is separate from the rest of Wordwild. See `THIRD_PARTY_NOTICES.md`, the in-game **Credits & licences** screen (on the title screen and in the grown-ups corner), and `app/licences/literacyhub-audio-manifest.json` for each clip's slide, media file and edits.
- `tools/`
  - `build_content.mjs`: validate the curriculum, generate Pip's mistakes and the audio manifest
  - `gen_audio.py`: render the synthesised audio (skips `p_*`)
  - `import_literacyhub.py`: install the letter sounds from the unpacked slide pack (`python -I tools/import_literacyhub.py <unzipped pptx dir>`). `pure_sounds.py` (the old generated sounds) is retired and refuses to overwrite the recordings.
  - `pptx_inspect.py`: list a slide pack's slides, notes and audio relationships
  - `qa_audio.py`: Whisper/phoneme listening check
  - `build_sw.mjs`: offline cache
  - `make_icons.py`: the app icons
- `tests/play.py`: automated WebKit (Safari engine) playthrough at iPhone and iPad sizes, with screenshots saved to `work/shots/`.
- `tests/credits.py`: the letter-sound mapping (each sound plays its own clip; clips match the manifest) and the credits screen on iPhone/iPad.
- `tests/worlds.py`: plays chosen lessons from every world (all activity types) at iPhone and iPad sizes, plus the Memory Match arcade; screenshots to `work/shots/worlds/`.

## Rebuild after changing content
```
node tools/build_content.mjs
.venv/Scripts/python.exe -I tools/gen_audio.py
node tools/build_sw.mjs
```

## Players and cloud save
- On first launch the child (or a grown-up) types a **name**, then makes a **4-digit secret code**. Progress then saves to the cloud automatically.
- Typing the same name and code on another iPad or iPhone carries on from the same place. Progress from two devices is merged, so nothing earned is lost.
- If there's no internet, "Play without saving" keeps progress on the device. Cloud save can be switched on later from the grown-ups corner.
- Storage: the Whisker Academy Supabase project, in `ww_saves` / `ww_hits` (`cloud/schema.sql`). The tables are locked: the public key can only call the `ww_*` functions.
  - Unlike Whisker, the secret code is checked on the server: the game sends a hash of name + code, and 5 wrong tries lock the name for 30 seconds.
- Each launch adds one anonymous row to `ww_hits`: a random device id, no names.
- Monitoring: the **Kids** tab in Hermes Control (`Documents/Projects/hermes-control`, `api/kids.py`) shows plays and players for Whisker Academy and Wordwild. It's reachable on the phone over Tailscale at https://dell.tail80c7e7.ts.net:8445/hermes/.
