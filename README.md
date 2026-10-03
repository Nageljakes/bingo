# TJ Entertainment @ Beerbox Midrand - Live Pub Bingo Night

Interactive live pub and musical bingo web application hosted on GitHub Pages, inspired by the Beerbox Pub Quiz night.

Live URL: https://nageljakes.github.io/bingo/

## Highlights & Features

- Dual Host & Player Modes:
  - DJ Master Deck with animated 3D ball hopper, auto-call timer, master board matrix, and instant ticket claim verifier.
  - Detached HDMI Pub TV Display (tv.html) with zero-latency BroadcastChannel & localStorage real-time sync for big screens and projectors.
  - Digital Interactive Player Card with authentic colorful ink daubers, auto-daub toggle, and instant winning pattern alerts.
  - Mobile QR Code Player Join: Patrons scan the TV screen or DJ deck to instantly open their digital card on their phones.

- DJ Music Bingo Cue Deck:
  - Guessing Mode: DJ can hide song titles on pub TV screens so patrons sing along and guess before the DJ reveals the track.
  - 1-Click Track Copy & Quick Search to Spotify and YouTube Music.
  - Soundboard Suite: DJ airhorns, victory fanfares, suspense drumrolls, pop chimes, and wrong buzzers synthesized with Web Audio API.

- 3-Tier Progressive Rounds & Venue Manager:
  - Stage 1 (1 Line), Stage 2 (2 Lines), Stage 3 (Full House / Blackout) with customizable bar tabs, shooter rounds, and venue vouchers.
  - Pre-configured venue profiles (Beerbox Midrand, Thirsty Fox Fourways, Hudsons Hazelwood, Capital Craft Menlo Park) plus custom venue editor.

- 10 Rotating Game Sets:
  - Set 1: Classic 75-Ball Pub Bingo (Authentic British & South African rhyming calls)
  - Set 2: 90-Ball Traditional Pub & Club Bingo
  - Set 3: 80s Rock & Pop Hits Music Bingo
  - Set 4: 90s Dance, Pop & Singalongs
  - Set 5: 2000s Pop & Party Anthems
  - Set 6: Mzansi Hits & South African Braai Grooves
  - Set 7: Rock Legends & Stadium Bangers
  - Set 8: Blockbuster Movies & TV Theme Songs
  - Set 9: Pub Quiz Trivia Bingo
  - Set 10: Golden 70s Disco Fever & Motown

- A4 Print Center & Word Document Generator:
  - Printable player cards (2-up and 4-up) and host master tracker sheets in Microsoft Word (.docx) and in-browser print formats.

## Serverless Multi-Device Architecture (Zero Cost, No VM Link)

- 100% Static GitHub Pages Hosting:
  - Runs completely in client browsers with zero server setup, zero backend runtimes, and zero link or dependency on any private VM or paid server.

- Global Real-time Pub/Sub over Secure WebSockets (WSS):
  - Uses public community MQTT WebSocket brokers (EMQX Global and HiveMQ Public) with automatic broker failover.
  - DJ laptop publishes one lightweight message (<100 bytes) per ball draw, and the cloud broker multiplexes it across 100+ connected patron phones in under 50ms.
  - Patrons can be on different mobile data networks (Vodacom, MTN, Telkom) or pub Wi-Fi with client isolation. No shared physical network required.

- Hybrid Zero-Latency Local Fallback:
  - Dual-layer BroadcastChannel and localStorage listeners provide sub-millisecond sync for same-machine HDMI secondary displays even if internet connection drops.

- Room Code Session System:
  - DJ selects or generates a room code (e.g. BEERBOX, FOX24, or random 5-character code).
  - Patrons scan QR codes on pub TVs or tables to immediately join the live session.
  - Wireless Pub TV mode (tv.html?room=CODE) allows venue smart TVs to run detached displays without HDMI cables.

- Live Features:
  - Live Player Presence: Real-time counter of active players connected to the room.
  - Late-Join State Sync: Players joining mid-game automatically catch up with all previously drawn balls and active round rules.
  - Remote BINGO Buzzer: Patrons tap "SHOUT BINGO!" on their phone to trigger an instant audio alert and 1-click ticket verification on the DJ master deck and TV screen.
