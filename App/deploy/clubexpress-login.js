// One-time (and occasional re-run) setup: opens the dedicated ClubExpress
// Chrome profile in a VISIBLE window so an officer can sign into ClubExpress by
// hand. Nothing else in this pipeline ever touches a login form -- the
// unattended sync reuses whatever session this leaves behind, and fails with a
// clear message when it lapses.
//
//   node deploy/clubexpress-login.js [eventUrl]
//
// IMPORTANT: sign in *in the window this opens*. It is a dedicated Chrome
// profile with its own cookie jar -- signing into ClubExpress in your everyday
// Chrome does not help it, and vice versa. The window looks like a stock Chrome
// because it is one; only the profile folder differs.
//
// This polls until it can actually SEE a working admin session (an Exports
// button on the event's Admin Panels page) and says so, rather than leaving you
// to guess whether it worked. Re-run it whenever the sync reports
// "ClubExpress session not logged in".
const { openContext, PROFILE_DIR, persistentCookies } = require("./clubexpress");

// Default matches the Setup tab's configured event URL. page_id MUST be 4055
// (Admin Panels); 4091 is the public event view and renders logged-out-looking
// even to an authenticated admin.
const DEFAULT_EVENT_URL =
  "https://www.etccwebsite.com/content.aspx?page_id=4055&club_id=313652&item_id=2897962";

// Checks the session the way the unattended sync does, on its own background
// page so the officer's tab is never navigated out from under them.
async function sessionIsLive(context, eventUrl) {
  const probe = await context.newPage();
  try {
    await probe.goto(eventUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (/action=login/i.test(probe.url())) return false;
    if (await probe.locator('input[type="password"]').count()) return false;
    const exports = await probe
      .locator('a:text-is("Exports"), button:text-is("Exports"), input[value="Exports" i]')
      .count();
    const byRole = await probe.getByRole("button", { name: /^\s*exports\s*$/i }).count();
    return exports > 0 || byRole > 0;
  } catch (_) {
    return false;
  } finally {
    await probe.close().catch(() => {});
  }
}

(async () => {
  const eventUrl = process.argv[2] || DEFAULT_EVENT_URL;
  console.log("Profile folder: " + PROFILE_DIR);
  console.log("Opening: " + eventUrl);
  console.log("");
  console.log("  >> Sign in IN THE WINDOW THAT JUST OPENED. <<");
  console.log("     It has its own cookie jar -- a login in your normal Chrome");
  console.log("     will not register here.");
  console.log("");
  console.log('  1. Sign into ClubExpress. Tick "Remember Me" so the session lasts.');
  console.log("  2. Wait for this console to print CONFIRMED (checked every 5s).");
  console.log("  3. Then close the window.");
  console.log("");

  const context = await openContext({ headless: false });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(eventUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => {
    console.error("Could not open the event page: " + e.message);
  });

  let closed = false;
  context.on("close", () => { closed = true; });

  // Keep polling for the WHOLE session rather than stopping at the first
  // success: an officer who signs in without "Remember Me", sees the warning
  // below and fixes it needs to watch the verdict flip to DURABLE. Bailing out
  // on first confirmation would leave them re-reading a stale warning with no
  // way to tell whether the retry took.
  //   live    = signed in and the Exports button is reachable (usable NOW)
  //   durable = a cookie with a real expiry exists (usable TOMORROW)
  let live = false;
  let durable = false;
  let lastVerdict = null;

  while (!closed) {
    await new Promise((r) => setTimeout(r, 5000));
    if (closed) break;

    live = await sessionIsLive(context, eventUrl);
    const durableCookies = live ? await persistentCookies(context).catch(() => []) : [];
    durable = durableCookies.length > 0;

    // Only speak when something actually changed, so a window left open for
    // ten minutes doesn't scroll the real message off the screen.
    const verdict = !live ? "out" : durable ? "durable" : "session-only";
    if (verdict === lastVerdict) continue;
    lastVerdict = verdict;

    console.log("");
    if (verdict === "out") {
      console.log("  Not signed in yet — still watching (checked every 5s).");
    } else if (verdict === "durable") {
      const soonest = new Date(Math.min(...durableCookies.map((c) => c.expires)) * 1000);
      console.log("  CONFIRMED — signed in, and the event's Exports button is visible.");
      console.log("  Session is DURABLE — persists until at least " + soonest.toLocaleString() + ".");
      console.log("  You can close the window now.");
    } else {
      // Being signed in RIGHT NOW is not the same as being signed in tomorrow.
      // Without a cookie carrying a real expiry this session dies with the
      // browser, and every unattended run after it reports "session not logged
      // in" -- so say so while the officer is still sitting in front of the
      // window and one tick-box away from fixing it.
      console.log("  Signed in, and the Exports button is visible —");
      console.log("  *** but this session will NOT survive closing the browser. ***");
      console.log('  ClubExpress issued only a temporary cookie, which means "Remember Me"');
      console.log('  was not ticked. The next scheduled run would report "ClubExpress');
      console.log('  session not logged in".');
      console.log("");
      console.log('  Fix: sign out, sign back in WITH "Remember Me" ticked, and wait for');
      console.log("  this to change to DURABLE before closing the window.");
    }
    console.log("");
  }

  if (durable) {
    console.log("Browser closed — durable session saved to the profile folder.");
    process.exit(0);
  }
  console.error("");
  if (live) {
    console.error("Browser closed with a TEMPORARY session only — ClubExpress issued no");
    console.error('cookie that outlives the browser, so the session is already gone.');
    console.error('Re-run this script and sign in with "Remember Me" ticked.');
  } else {
    console.error("Browser closed WITHOUT a confirmed session -- ClubExpress still looks");
    console.error("logged out to this profile. The unattended sync will fail until this");
    console.error("succeeds. Re-run this script and sign in inside the window it opens.");
  }
  process.exit(1);
})().catch((err) => {
  console.error("Login helper failed: " + err.message);
  process.exit(1);
});
