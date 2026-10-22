// Demo sites the agent works on: a city library, a gym and a parcel tracker.
// They are props for the demo, so state lives in memory and resets on restart.
// Browserbase reaches them through a cloudflared tunnel (see scripts/tunnel.sh).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.DEMO_SITES_PORT ?? 4100);
// Gym booking for tomorrow opens this many minutes after the server starts,
// so the "wait until booking opens" chore can be shown without waiting until 06:00.
const GYM_OPENS_AFTER_MIN = Number(process.env.GYM_OPENS_AFTER_MIN ?? 3);
// The parcel page fails this many times before it answers, to show retries.
const PARCEL_FAILS = Number(process.env.PARCEL_FAILS ?? 2);

const LIBRARY_CARD = "20260042";
const LIBRARY_PIN = "1234";
const GYM_MEMBER = "anish@demo.gym";
const GYM_PASSWORD = "sloth";

const day = 24 * 60 * 60 * 1000;
const started = Date.now();
const gymOpensAt = started + GYM_OPENS_AFTER_MIN * 60 * 1000;

type Loan = { id: string; title: string; author: string; due: number; renewals: number };
const loans: Loan[] = [
  { id: "b1", title: "The Overstory", author: "Richard Powers", due: started + 2 * day, renewals: 0 },
  { id: "b2", title: "Klara and the Sun", author: "Kazuo Ishiguro", due: started - 5 * day, renewals: 2 },
  { id: "b3", title: "A Psalm for the Wild-Built", author: "Becky Chambers", due: started + 12 * day, renewals: 0 },
];
const fine = { id: "f1", amount: 50, reason: '"Klara and the Sun", 5 days late', paid: false };
const slots = ["06:00", "07:00", "08:00", "18:00", "19:00"].map((time) => ({
  time,
  left: time === "07:00" ? 2 : 6,
  bookedByYou: false,
}));
let parcelHits = 0;

type Event = { at: number; site: string; text: string };
const events: Event[] = [];
const log = (site: string, text: string) => {
  events.push({ at: Date.now(), site, text });
  console.log(`[${site}] ${text}`);
};

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function page(title: string, css: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>*{box-sizing:border-box}body{margin:0}${css}</style></head><body>${body}</body></html>`;
}

const libraryCss = `
body{font-family:Georgia,serif;background:#f4efe6;color:#2b2620}
header{background:#3b2f25;color:#f4efe6;padding:18px 32px;display:flex;justify-content:space-between;align-items:center}
header a{color:#f4efe6}
main{max-width:860px;margin:32px auto;padding:0 20px}
table{width:100%;border-collapse:collapse;margin:12px 0 32px;background:#fbf8f2}
th,td{text-align:left;padding:12px;border-bottom:1px solid #d9cfbf}
th{font-family:system-ui,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#6b5f50}
button{font:inherit;padding:8px 16px;border:1px solid #3b2f25;background:#3b2f25;color:#f4efe6;cursor:pointer}
button.secondary{background:transparent;color:#3b2f25}
.overdue{color:#9b2c1c;font-weight:bold}
.box{background:#fbf8f2;border:1px solid #d9cfbf;padding:24px;max-width:420px}
label{display:block;margin:12px 0 4px;font-family:system-ui,sans-serif;font-size:14px}
input{font:inherit;padding:8px;width:100%;border:1px solid #b9ad9b}
.notice{background:#e7efd9;border:1px solid #9fb27c;padding:12px;margin-bottom:20px}`;

const gymCss = `
body{font-family:system-ui,sans-serif;background:#111614;color:#e9efe9}
header{padding:18px 32px;border-bottom:1px solid #2c3631;display:flex;justify-content:space-between}
header strong{color:#b6f25c;letter-spacing:.08em}
main{max-width:720px;margin:32px auto;padding:0 20px}
.slot{display:flex;justify-content:space-between;align-items:center;padding:16px;border:1px solid #2c3631;margin-bottom:10px}
.slot b{font-size:22px}
button{font:inherit;font-weight:600;padding:10px 18px;border:0;background:#b6f25c;color:#111614;cursor:pointer}
button:disabled{background:#2c3631;color:#7d8a83;cursor:not-allowed}
.box{border:1px solid #2c3631;padding:24px;max-width:420px}
label{display:block;margin:12px 0 4px;font-size:14px}
input{font:inherit;padding:8px;width:100%;background:#1b221f;color:#e9efe9;border:1px solid #2c3631}
.notice{border:1px solid #b6f25c;padding:12px;margin-bottom:20px}`;

const parcelCss = `
body{font-family:system-ui,sans-serif;background:#fff8ec;color:#2a2116}
main{max-width:640px;margin:48px auto;padding:0 20px}
h1{color:#c2410c}
ol{border-left:3px solid #c2410c;padding-left:20px}
li{margin-bottom:14px}`;

function cookies(req: IncomingMessage) {
  return Object.fromEntries(
    (req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=")).filter((p) => p.length === 2),
  ) as Record<string, string>;
}

async function form(req: IncomingMessage) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return Object.fromEntries(new URLSearchParams(raw));
}

function send(res: ServerResponse, status: number, html: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...headers });
  res.end(html);
}
const redirect = (res: ServerResponse, to: string, headers: Record<string, string> = {}) => {
  res.writeHead(303, { Location: to, ...headers });
  res.end();
};
const sessionCookie = (name: string) => `${name}=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;

function libraryLogin(error = "") {
  return page("City Library · Sign in", libraryCss, `
<header><strong>City Library</strong><span>Member services</span></header>
<main><h1>Sign in to your account</h1>
${error ? `<p class="overdue">${esc(error)}</p>` : ""}
<form class="box" method="post" action="/library/login">
<label for="card">Library card number</label><input id="card" name="card" autocomplete="username">
<label for="pin">PIN</label><input id="pin" name="pin" type="password" autocomplete="current-password">
<p><button type="submit">Sign in</button></p></form>
</main>`);
}

function libraryAccount(notice = "") {
  const rows = loans.map((l) => {
    const overdue = l.due < Date.now();
    const canRenew = l.renewals < 2;
    return `<tr><td><b>${esc(l.title)}</b><br>${esc(l.author)}</td>
<td class="${overdue ? "overdue" : ""}">${fmtDate(l.due)}${overdue ? " (overdue)" : ""}</td>
<td>${l.renewals} of 2</td>
<td>${canRenew
      ? `<form method="post" action="/library/renew"><input type="hidden" name="id" value="${l.id}"><button type="submit">Renew</button></form>`
      : "Renewal limit reached"}</td></tr>`;
  }).join("");
  const fines = fine.paid
    ? `<p>No fines. Thank you.</p>`
    : `<table><tr><th>Fine</th><th>Amount</th><th></th></tr>
<tr><td>${esc(fine.reason)}</td><td>₹${fine.amount}</td>
<td><a href="/library/fines/pay"><button type="button">Pay fine</button></a></td></tr></table>`;
  return page("City Library · My account", libraryCss, `
<header><strong>City Library</strong><a href="/library/logout">Sign out</a></header>
<main>${notice ? `<div class="notice">${esc(notice)}</div>` : ""}
<h1>My loans</h1><p>Today is ${fmtDate(Date.now())}.</p>
<table><tr><th>Book</th><th>Due</th><th>Renewals</th><th></th></tr>${rows}</table>
<h2>Fines</h2>${fines}</main>`);
}

function libraryPay() {
  return page("City Library · Pay fine", libraryCss, `
<header><strong>City Library</strong><a href="/library/account">Back to account</a></header>
<main><h1>Pay fine</h1>
<div class="box"><p>${esc(fine.reason)}</p><p style="font-size:28px">₹${fine.amount}</p>
<p>Paid from the card on file ending 4417.</p>
<form method="post" action="/library/fines/pay"><button type="submit">Confirm payment of ₹${fine.amount}</button></form>
<p><a href="/library/account"><button type="button" class="secondary">Cancel</button></a></p></div></main>`);
}

function gymLogin(error = "") {
  return page("IronLeaf Gym · Sign in", gymCss, `
<header><strong>IRONLEAF GYM</strong><span>Class booking</span></header>
<main><h1>Member sign in</h1>${error ? `<p>${esc(error)}</p>` : ""}
<form class="box" method="post" action="/gym/login">
<label for="email">Email</label><input id="email" name="email" autocomplete="username">
<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password">
<p><button type="submit">Sign in</button></p></form>
</main>`);
}

function gymBook(notice = "") {
  const open = Date.now() >= gymOpensAt;
  const list = slots.map((s) => `<div class="slot"><div><b>${s.time}</b><br>Open gym · ${s.left} spots left</div>
${s.bookedByYou
    ? "<span>Booked by you</span>"
    : `<form method="post" action="/gym/book"><input type="hidden" name="time" value="${s.time}">
<button type="submit" ${open && s.left > 0 ? "" : "disabled"}>${open ? "Book" : "Opens " + fmtTime(gymOpensAt)}</button></form>`}</div>`).join("");
  return page("IronLeaf Gym · Book", gymCss, `
<header><strong>IRONLEAF GYM</strong><a href="/gym/logout" style="color:#e9efe9">Sign out</a></header>
<main>${notice ? `<div class="notice">${esc(notice)}</div>` : ""}
<h1>Tomorrow's slots</h1>
<p>${open ? "Booking is open." : `Booking for tomorrow opens at ${fmtTime(gymOpensAt)}.`}</p>${list}</main>`);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const path = url.pathname;
  const c = cookies(req);
  try {
    if (path === "/") {
      return send(res, 200, page("Demo sites", parcelCss, `<main><h1>Demo sites</h1>
<p><a href="/library">City Library</a> · <a href="/gym">IronLeaf Gym</a> · <a href="/parcel/SLTH2026IN">Parcel tracking</a> · <a href="/admin">What happened</a></p></main>`));
    }

    // Library
    if (path === "/library" || path === "/library/account") {
      if (!c.lib_session) return send(res, 200, libraryLogin());
      return send(res, 200, libraryAccount(url.searchParams.get("notice") ?? ""));
    }
    if (path === "/library/login" && req.method === "POST") {
      const f = await form(req);
      if (f.card !== LIBRARY_CARD || f.pin !== LIBRARY_PIN) return send(res, 401, libraryLogin("Card number or PIN is wrong."));
      log("library", "Signed in");
      return redirect(res, "/library/account", { "Set-Cookie": sessionCookie("lib_session") });
    }
    if (path === "/library/logout") {
      return redirect(res, "/library", { "Set-Cookie": "lib_session=; Path=/; Max-Age=0" });
    }
    if (path === "/library/renew" && req.method === "POST") {
      if (!c.lib_session) return send(res, 401, libraryLogin("Please sign in."));
      const { id } = await form(req);
      const loan = loans.find((l) => l.id === id);
      if (!loan || loan.renewals >= 2) return redirect(res, "/library/account?notice=" + encodeURIComponent("That book cannot be renewed."));
      loan.due = Math.max(loan.due, Date.now()) + 14 * day;
      loan.renewals++;
      log("library", `Renewed "${loan.title}", new due date ${fmtDate(loan.due)}`);
      return redirect(res, "/library/account?notice=" + encodeURIComponent(`Renewed "${loan.title}". New due date ${fmtDate(loan.due)}.`));
    }
    if (path === "/library/fines/pay") {
      if (!c.lib_session) return send(res, 401, libraryLogin("Please sign in."));
      if (req.method === "POST") {
        if (fine.paid) return redirect(res, "/library/account?notice=" + encodeURIComponent("This fine is already paid."));
        fine.paid = true;
        log("library", `Fine of ₹${fine.amount} paid`);
        return redirect(res, "/library/account?notice=" + encodeURIComponent(`Payment of ₹${fine.amount} received.`));
      }
      if (fine.paid) return redirect(res, "/library/account");
      return send(res, 200, libraryPay());
    }

    // Gym
    if (path === "/gym" || path === "/gym/book") {
      if (!c.gym_session) return send(res, 200, gymLogin());
      if (req.method === "POST") {
        const { time } = await form(req);
        const slot = slots.find((s) => s.time === time);
        if (Date.now() < gymOpensAt) return send(res, 200, gymBook("Booking is not open yet."));
        if (!slot || slot.left === 0) return send(res, 200, gymBook("That slot is full."));
        if (slots.some((s) => s.bookedByYou)) return send(res, 200, gymBook("You already have a booking for tomorrow."));
        slot.left--;
        slot.bookedByYou = true;
        log("gym", `Booked the ${time} slot for tomorrow`);
        return send(res, 200, gymBook(`Booked: tomorrow at ${time}.`));
      }
      return send(res, 200, gymBook());
    }
    if (path === "/gym/login" && req.method === "POST") {
      const f = await form(req);
      if (f.email !== GYM_MEMBER || f.password !== GYM_PASSWORD) return send(res, 401, gymLogin("Email or password is wrong."));
      log("gym", "Signed in");
      return redirect(res, "/gym/book", { "Set-Cookie": sessionCookie("gym_session") });
    }
    if (path === "/gym/logout") {
      return redirect(res, "/gym", { "Set-Cookie": "gym_session=; Path=/; Max-Age=0" });
    }

    // Parcel tracking: no login, flaky on purpose
    if (path.startsWith("/parcel/")) {
      parcelHits++;
      if (parcelHits <= PARCEL_FAILS) {
        log("parcel", `Tracking page failed (try ${parcelHits})`);
        return send(res, 503, page("Service unavailable", parcelCss, "<main><h1>503</h1><p>Tracking is busy. Try again later.</p></main>"));
      }
      const id = esc(path.split("/")[2] ?? "");
      return send(res, 200, page(`Track ${id}`, parcelCss, `<main><h1>Parcel ${id}</h1>
<p><b>Status: Out for delivery</b>. Expected today by 6 PM.</p>
<ol><li>${fmtDate(started - day)} · Picked up, Bengaluru</li><li>${fmtDate(started)} · Arrived at Raipur hub</li>
<li>${fmtDate(Date.now())} · Out for delivery</li></ol></main>`));
    }

    if (path === "/admin") {
      if (url.searchParams.get("format") === "json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ events, loans, fine, slots, gymOpensAt }));
      }
      const rows = events.map((e) => `<li>${fmtTime(e.at)} · <b>${e.site}</b> · ${esc(e.text)}</li>`).join("");
      return send(res, 200, page("What happened", parcelCss, `<main><h1>What happened on the demo sites</h1><ol>${rows || "<li>Nothing yet.</li>"}</ol></main>`));
    }

    send(res, 404, page("Not found", parcelCss, "<main><h1>Not found</h1></main>"));
  } catch (err) {
    console.error(err);
    send(res, 500, "Server error");
  }
});

server.listen(PORT, () => {
  console.log(`Demo sites on http://localhost:${PORT} (gym booking opens ${fmtTime(gymOpensAt)})`);
});
