# Sloth Errands: design directions

User: one person. At night on a laptop they list chores and go to bed. In the morning, on their phone,
they read what happened and tap Approve or Deny on the one risky step. The screen mocked in every
option is the same: the "Tonight" view (4 demo chores, night log) next to the morning approval card.

## Option 1: Night Ledger
- Feel: a small hotel's night-desk log book. Ruled paper, entries written in order, nothing shouts.
- Fonts: Fraunces (display, big serif date) + Manrope (body). Phosphor regular.
- Color: warm paper `#f3eee3`, brown-black ink `#2b2620`, one accent moss green `#4d6a37`.
- Layout: left masthead column with the date, right a ruled ledger table. Phone card sits like a slip tucked into the book.
- Must NOT look like: a SaaS dashboard, cards with shadows, a to-do app.

## Option 2: Bedside Lamp
- Feel: the room at 2 AM with one warm lamp on. Dark, quiet, easy on tired eyes.
- Fonts: Space Grotesk (display, times and headings) + IBM Plex Sans (body). Phosphor regular.
- Color: warm charcoal `#1c1916` (brown, not navy), warm off-white text `#ece3d3`, one accent lamp amber `#e6a03a`.
- Layout: a vertical timeline of the night from 22:00 to 07:30, chores pinned at their times. Big plain headline.
- Must NOT look like: a neon "dev" dark theme, navy and cyan, glowing blobs.

## Option 3: Departure Board
- Feel: a Swiss railway timetable. Chores leave at set times like trains; delays are shown plainly.
- Fonts: Archivo (display, tight and bold) + JetBrains Mono (times, codes). Phosphor regular.
- Color: cool off-white `#f0f0eb`, ink `#1b1c1e`, one accent signal red-orange `#e0401b`.
- Layout: strict grid table "Departures tonight" with time, chore, site, status columns. Approval card is a ticket.
- Must NOT look like: a generic table component, rounded cards, a soft pastel app.
