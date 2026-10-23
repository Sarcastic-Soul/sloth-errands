---
title: Sloth Errands: an agent that does my web chores while I sleep, and asks before it pays
published: false
tags: devchallenge, hf26challenge, ai, opensource
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19).*

## What I Built

I have a list of small web chores that I keep forgetting. Renew the library books before they go overdue. Book the 7 AM gym slot the moment booking opens. Check where my parcel is. See if a tool I use shipped a new release. Pay that ₹50 library fine.

None of these are hard. They are just annoying, and most of them have to happen at a certain time, usually when I'm asleep or busy.

**Sloth Errands** does them overnight. Before bed I tick tonight's chores on a board that looks like a train station's departure board, and go to sleep. An agent built on an open-weight model works through them in cloud browsers:

- **Safe chores finish on their own.** Renewing a book, booking a slot, reading a status.
- **Slow chores wait.** If the gym booking is not open yet, it checks again later. If the parcel site is down, it waits and retries. It doesn't give up at the first error.
- **Risky steps are held for me.** The agent can get all the way to the "Confirm payment of ₹50" button, but it can't click it. That step goes on hold until my wake-up time. Then my phone gets an Auth0 Guardian push, I tap Approve, and only then does the agent do exactly that one step.

So the lazy person here is me, and anyone like me who keeps getting late fees for things a robot could have done at 2 AM. The safety part is what makes me trust it enough to be lazy.

![The board with the fine held for approval](https://raw.githubusercontent.com/Sarcastic-Soul/sloth-errands/main/docs/held.png)

## Demo

<!-- TODO: video link -->

The video is one real, uncut night run, sped up only by demo pacing (retries every 20 seconds instead of every 15 minutes, wake-up in 2 minutes instead of 7 hours). In it you can see:

1. Five chores leave the station at 10:36.
2. The fine is held as a ticket on the right: "Confirm payment of the ₹50 library fine?"
3. While it is held, I kill the worker process and start it again. The board doesn't notice. The held chore is still held, because its state lives in Temporal, not in my process.
4. The parcel tracker fails twice (on purpose). The row shows "DELAYED, try 2/5" and then turns DONE.
5. At wake-up time my phone gets the Guardian push. I approve it, and 20 seconds later the fine is paid.

![Guardian push arriving on the phone](https://raw.githubusercontent.com/Sarcastic-Soul/sloth-errands/main/docs/phone-push.png)

Since it all runs on my laptop, I kept receipts. The demo sites keep their own log of what was actually changed, and the repo's [`evidence/`](https://github.com/Sarcastic-Soul/sloth-errands/tree/main/evidence) folder has the full timeline, the Temporal history screenshots and the Browserbase session list from the recorded run.

## Code

{% embed https://github.com/Sarcastic-Soul/sloth-errands %}

## How I Built It

**The model: gpt-oss.** The agent runs on OpenAI's open-weight `gpt-oss-120b`, served by Groq. The small page actions (find this button, click it) run on `gpt-oss-20b`. Both are free on Groq's free tier, which shaped a lot of choices below.

**The agent: Mastra.** A Mastra `Agent` gets the chore ("renew every book due in the next 3 days") and five tools:

- `open_page` and `read_page` to look around
- `do_on_page` to click or fill something
- `propose_risky_action` to describe a step it is not allowed to take
- `finish` to report done, not ready yet, needs approval, or failed

The interesting rule is in `do_on_page`. Before any action runs, it is checked against a list of commit words: confirm, pay now, purchase, delete, unsubscribe, cancel my membership and so on. If it matches, the click is refused and the agent is told to propose it instead. That rule is in code, not in the prompt, so a confused model can't talk its way past it. When I approve, the agent gets a fresh run where only that one approved action is allowed.

**The browser: Stagehand on Browserbase.** Each site has its own saved Browserbase context, so I log in once (a script fills the demo login by CSS selector) and every later run is already signed in. The model never sees a password. Browserbase also keeps a replay of every session, which is a nice way to check what the agent clicked at 2 AM. My demo sites run on localhost, so a cloudflared quick tunnel gives the cloud browsers a way in.

**The waiting: Temporal.** This is the part that makes it "slow and steady". Each night is a `nightWorkflow` that starts one child `choreWorkflow` per chore:

- A site that is down is retried by the workflow itself with a doubling gap, and each retry is written to the chore's log so the board can show it.
- A chore that is "not ready" (booking not open) sleeps and checks again.
- A held step waits until wake-up time with a durable timer, then asks for approval. A CIBA push lives for 5 minutes at most, so if I sleep through it, the workflow asks again a bit later, and gives up without paying after a deadline.

All of this is just `await sleep()` and `await condition()` in plain TypeScript, and it survives the worker crashing, which I show in the video.

**The approval: Auth0 for AI Agents.** The web app uses Auth0 to sign me in. The morning question uses Auth0's Client-Initiated Backchannel Authentication (CIBA): the workflow calls `/bc-authorize` with my user ID and a short binding message ("Pay INR 50 library fine..."). Auth0 sends the Guardian push, and the workflow polls the token endpoint until I approve, deny, or it expires. The board also has Approve and Deny buttons, which send a Temporal signal after checking that the run is mine.

**The board.** Next.js 16 with Tailwind. I wanted it to look like a station departure board: each chore is a departure with a time, a status (ON TIME, DELAYED, HELD FOR YOU, DONE) and announcements underneath. A held step shows up as a ticket you can approve or deny.

Some problems I hit:

- **Groq's free tier allows about 8,000 tokens a minute.** A GitHub release page is huge. I cut pages down to the `main` element and 2,500 characters, ran one chore step at a time, and moved Stagehand to the smaller model.
- **A retry that forgot what it did.** One run renewed a book, hit the rate limit, and the retry looked at the page and reported "nothing to renew". The book had been renewed by the first try. Now a retry is told that an earlier try may have partly done the chore.
- **The model didn't know what year it was.** It does now: today's date goes into the instructions.
- **Changing workflow code while a workflow is running** breaks Temporal's replay. Lesson learned the hard way: finish or end old runs before you change the workflow code.

## Why Does Open Innovation Matter?

An agent that clicks around websites overnight makes a lot of model calls for very little value each. "Is the gym booking open yet?" every 15 minutes, all night, for a whole month. With an open-weight model, that loop costs nothing on a free tier today, and if the free tier goes away I can run the same model somewhere else, or on my own hardware, without rewriting the agent. A closed API would make me count calls and hope the price and the model stay the same.

It also matters for trust. This agent holds my logins and can reach a payment button. I can read every line of the stack that sits between the model and that button: Mastra, Stagehand, the Temporal SDK. The safety rule that blocks risky clicks is ten lines in my own repo, not a setting behind someone else's dashboard. Open models and open frameworks let me put the guard rails where I can see them.

## The Lazy Payoff

Five chores, one tap. I approved one push on my phone, and everything else was done by the time I looked at the board. Real-world timing (15-minute retries and polls, a wake-up time in the morning) is one setting away from the demo pacing in the video.

## Prize Categories

- **Browserbase:** every chore runs in a Browserbase browser through Stagehand, with saved contexts for logins and session replays as an audit trail.
- **Temporal:** nights and chores are workflows; retries, polling, the wait until wake-up time and the approval are all durable, and the run survives a worker restart.
- **Auth0 for AI Agents:** Auth0 signs users in to the agent's web app, and risky actions wait for the user's approval through CIBA and a Guardian push.
- **Mastra:** the chore agent is a Mastra agent with tools that wrap the browser and enforce the approval rule.
