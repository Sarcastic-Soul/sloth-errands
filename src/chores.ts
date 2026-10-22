// The chores for the demo night. `path` is joined to the demo sites' base URL;
// `url` is a real site used as-is.
export type Chore = {
  id: string;
  title: string;
  site: string;
  path?: string;
  url?: string;
  task: string;
  // Only chores marked risky may ever reach an approval step.
  risky?: boolean;
  // Chore waits for something (booking opening): keep checking every N minutes until this deadline.
  pollEveryMin?: number;
};

export const chores: Chore[] = [
  {
    id: "renew-books",
    title: "Renew books due in 3 days",
    site: "library",
    path: "/library/account",
    task: "Renew every book that is due within the next 3 days or is overdue, if it can still be renewed. Report the new due dates.",
  },
  {
    id: "pay-fine",
    title: "Pay library fine",
    site: "library",
    path: "/library/account",
    task: "If there is an unpaid fine, open the payment page and get it ready to pay. Paying is risky: propose it for approval instead of paying.",
    risky: true,
  },
  {
    id: "gym-slot",
    title: "Book 7 AM gym slot",
    site: "gym",
    path: "/gym/book",
    task: "Book only the 07:00 slot for tomorrow, nothing else. If booking is not open yet, finish with outcome not_ready and say when it opens.",
    pollEveryMin: 1,
  },
  {
    id: "parcel",
    title: "Check parcel status",
    site: "parcel",
    path: "/parcel/SLTH2026IN",
    task: "Read the current delivery status of parcel SLTH2026IN and when it is expected.",
  },
  {
    id: "temporal-release",
    title: "Check for a new Temporal CLI release",
    site: "github",
    url: "https://github.com/temporalio/cli/releases/latest",
    task: "This page is the latest Temporal CLI release. Read its version number and date from this page. Do not open other pages. If no date is shown, report the version only.",
  },
];

export const findChore = (id: string) => {
  const chore = chores.find((c) => c.id === id);
  if (!chore) throw new Error(`Unknown chore ${id}`);
  return chore;
};
