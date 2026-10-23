# Evidence: recorded night run, 23 Oct 2026

Everything runs on one laptop, so this folder is the proof that it works.
The run below was started from the web app at 10:36 IST with demo pacing
(retries in seconds instead of 15 minutes) and a wake-up time 2 minutes later.
The browser work ran in Browserbase cloud browsers, reaching the local demo
sites through a cloudflared quick tunnel.

Night workflow: `night-2026-10-23-05-06-13`

## What each chore did (from the Temporal workflow state)

| Time (IST) | Chore | Log |
|---|---|---|
| 10:36:14 | all five | Started |
| 10:36:40 | Pay library fine | Held for your OK: confirm payment of the ₹50 fine |
| 10:36-10:37 | (worker) | Worker process stopped and started again while the fine was held. Nothing was lost. |
| 10:37:42 | Check parcel status | Site did not answer. Retry 1 of 5 at 10:38 |
| 10:38:04 | Renew books | Renewed "The Overstory"; new due date 8 Nov 2026 |
| 10:38:23 | Temporal CLI release | Found version v1.9.1 |
| 10:38:24 | Pay library fine | Sent the approval request to the phone (Auth0 CIBA, Guardian push) |
| 10:38:37 | Check parcel status | Site did not answer. Retry 2 of 5 at 10:39 |
| 10:38:59 | Pay library fine | Approved on the phone |
| 10:38:59 | Book 7 AM gym slot | Booked the 07:00 slot for tomorrow |
| 10:39:20 | Pay library fine | Paid the ₹50 fine |
| 10:40:21 | Check parcel status | Out for delivery, expected today by 6 PM |

## What actually changed on the demo sites (their own log)

- 10:37 parcel: tracking page failed (try 1)
- 10:37 library: renewed "The Overstory", new due date 8 Nov 2026
- 10:38 parcel: tracking page failed (try 2)
- 10:38 gym: booked the 07:00 slot for tomorrow
- 10:39 library: fine of ₹50 paid

## Browserbase sessions (one per agent step, replays need the account login)

- 05:06:19 UTC, 20s: https://www.browserbase.com/sessions/69e90dcb-c2ac-4fcc-8bc9-c42cbae539d7
- 05:06:43 UTC, 6s: https://www.browserbase.com/sessions/2573271b-993a-4170-98db-06f8c9d3156a
- 05:07:31 UTC, 9s: https://www.browserbase.com/sessions/6c6722b7-0442-4322-8564-6537f83acf7c
- 05:07:44 UTC, 19s: https://www.browserbase.com/sessions/1f8b855a-a419-4d07-aef0-5dbe3621bce9
- 05:08:07 UTC, 15s: https://www.browserbase.com/sessions/a1319981-9c47-42ac-aab1-774831bb759b
- 05:08:26 UTC, 8s: https://www.browserbase.com/sessions/a0960330-6390-47c1-a3e5-698a438c7473
- 05:08:39 UTC, 18s: https://www.browserbase.com/sessions/b77b45ed-1ab2-4fa8-9ae6-61992eb88dec
- 05:09:01 UTC, 17s: https://www.browserbase.com/sessions/fbd16113-d06e-425a-85e7-c8361eaff16b
- 05:09:23 UTC, 10s: https://www.browserbase.com/sessions/5fd03f70-04a1-4ca3-8444-2f8d833f22fa
- 05:10:09 UTC, 10s: https://www.browserbase.com/sessions/5805e4c2-c5ed-44ad-b8d6-63e1dfebc01a

## Video

- `night-run-full.mp4`: the whole run, from Start to every chore DONE (4 min 24 s, real time).
  The phone recording sits in the bottom right, lined up to the same clock: the Guardian push
  arrives at 10:38:24. The Guardian app blocks screen recording on its approve screen, so that
  part shows black, then "Success!".

## Screenshots

- `shots/temporal-list.png`: the night and its five child workflows
- `shots/temporal-night.png`: the parent workflow
- `shots/temporal-parcel-history.png`: two failed tries, timers, then success
- `shots/temporal-pay-fine-history.png`: held, approval polling, approved step
- `shots/temporal-gym-history.png`: the gym booking
- `shots/demo-admin-log.png`: what the demo sites recorded
