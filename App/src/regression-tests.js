/* regression-tests.js — assertions against the frozen synthetic fixture,
 * shared by the Node CLI (test/run-tests.js) and the in-app Developer ->
 * Run Regression Tests screen, so both stay in sync automatically instead
 * of drifting apart as two hand-copied assertion lists.
 *
 * Fixture scenario (test/fixtures/*.csv, fabricated — no real member info),
 * five registrations chosen to cover every branch generate() has:
 *   27-01 Sample  — Couple, free XL, one $25 Extra Large, judged, volunteer
 *   27-02 Bower   — Single, free SM, no club, no car year
 *   27-03 Crane   — Single AND T-Shirt Only on one registration (admission
 *                   precedence), free LG, unpaid status
 *   27-04 Doyle   — Car Show Only: no free shirt at all, and a 1983 car year
 *                   that falls in the real gap between C3 and C4
 *   27-05 Ellis   — Couple with the free-size question left blank, plus a
 *                   $50 Extra XL row that has to count as TWO shirts
 *
 * NOTE: UI-only behavior is exercised by hand in the app (detail-modal
 * autosave, zoom, the event picker's buttons, the T-Shirt Order email
 * composer). This file covers the logic layer and the Excel round-trip only.
 */
(function (root) {
  "use strict";
  var LOGIC = root.VetteFestLogic ||
    (typeof require !== "undefined" ? require("./logic.js") : null);
  var EXCEL = root.VetteFestExcel ||
    (typeof require !== "undefined" ? require("./excel.js") : null);
  var CONFIG = root.VetteFestConfig ||
    (typeof require !== "undefined" ? require("./config.js") : null);

  function eq(results, actual, expected, label) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ label: label, ok: ok, expected: expected, actual: actual });
  }

  // Logic-layer assertions (generate()) against the fixture. Returns
  // { out, results } — callers needing the Excel round-trip too pass `out`
  // into excelAssertionList so generate() only runs once.
  function assertionList(reg, act) {
    var results = [];
    var out = LOGIC.generate(reg, act, { regFileName: "registration.csv", actFileName: "activity.csv" });

    eq(results, out.ok, true, "generate ok");
    eq(results, out.summary.registrations, 5, "Registrations = 5");
    // 2 (Couple) + 1 (Single) + 1 (Single, not the T-Shirt Only) + 1 (Car
    // Show Only) + 2 (Couple) — the whole point of the admission table.
    eq(results, out.summary.attendees, 7, "Attendees = 7 (couples count as 2)");
    eq(results, out.summary.funds, 510, "Funds = 510");
    eq(results, out.summary.judges, 2, "Judges = 2 (CSJ = Yes)");

    // Exactly one message: the 1983 car year, which really does fall between
    // C3 (…1982) and C4 (1984…). Everything else must be silent — notably
    // Car Show Only granting no free shirt, and Ellis's blank size answer.
    eq(results, out.messages.length, 1, "one message");
    eq(results, /1983/.test(out.messages[0] || ""), true, "the message is the 1983 year gap");

    // ---- Reg # -------------------------------------------------------------
    var regNums = out.registrations.map(function (r) { return r["Reg #"]; });
    eq(results, regNums, ["27-01", "27-02", "27-03", "27-04", "27-05"],
      "Reg # is a zero-padded sequence prefixed with the event year");
    // Assigned in Reg Date order, which is also the row order.
    eq(results, out.registrations[0]["Last Name"], "Sample", "first row is the earliest registration");
    eq(results, out.registrations[4]["Last Name"], "Ellis", "last row is the latest registration");

    // ---- names come from the VF event questions, not the account ----------
    // Every fixture row's ClubExpress account surname is "Account"; the event
    // question carries the real one, and the couples' joint first names.
    eq(results, out.registrations[0]["First Name(s)"], "Alice & Andy",
      "First Name(s) comes from VF First Names, not the account's First Name");
    var accountNames = out.registrations.filter(function (r) { return r["Last Name"] === "Account"; });
    eq(results, accountNames.length, 0, "no row kept the account Last Name");

    // ---- admissions --------------------------------------------------------
    var regTypes = out.registrations.map(function (r) { return r["Reg Type"]; });
    eq(results, regTypes,
      ["Couple Admission", "Single Admission", "Single Admission", "Car Show Only Admission", "Couple Admission"],
      "Reg Type is the admission bought");
    var crane = byName(out, "Crane");
    eq(results, crane["Reg Type"], "Single Admission",
      "a registration with two admissions takes the higher-precedence one, not the CSV's first");
    eq(results, crane["#"], 1, "…and its attendee count too");
    var counts = {};
    out.summary.admissions.forEach(function (a) { counts[a.title] = a.count; });
    eq(results, counts, {
      "Couple Admission": 2, "Single Admission": 2,
      "Car Show Only Admission": 1, "T-Shirt Only Admission": 0
    }, "admission tally (the losing T-Shirt Only is not double-counted)");

    // ---- shirts ------------------------------------------------------------
    var s = out.summary.shirtTotals;
    eq(results, s.FreeXLG, 1, "Free XLG = 1 (Sample's couple free shirt, answered 'XL')");
    eq(results, s.FreeSM, 1, "Free SM = 1 (Bower's single free shirt)");
    eq(results, s.FreeLG, 1, "Free LG = 1 (Crane's single free shirt)");
    eq(results, s.XtraLG, 1, "Xtra LG = 1 ($25 = one shirt)");
    eq(results, s.XtraXLG, 2, "Xtra XLG = 2 (one $50 row = two shirts)");
    var nonZero = Object.keys(s).filter(function (k) { return s[k] !== 0; }).sort();
    eq(results, nonZero, ["FreeLG", "FreeSM", "FreeXLG", "XtraLG", "XtraXLG"].sort(),
      "only those 5 shirt buckets non-zero");
    // The two admissions that ask no size question grant no shirt, and a
    // blank answer grants none either — both silent, neither an error.
    eq(results, shirtTotalFor(byName(out, "Doyle"), out), 0, "Car Show Only gets no free shirt");
    eq(results, shirtTotalFor(byName(out, "Ellis"), out), 2, "a blank free-size answer adds no free shirt");
    // 12 buckets, not the car show app's 24 — Vette Fest shirts are unisex.
    eq(results, out.shirtColumns.length, 12, "12 shirt columns (no gender split)");
    eq(results, out.shirtColumns.indexOf("Free XLG") !== -1, true, "shirt columns are named 'Free XLG' style");

    // ---- generations / car show / clubs -----------------------------------
    var c6 = genOf(out, "C6"), c8 = genOf(out, "C8");
    eq(results, c6.atEvent, 1, "C6 At Event = 1 (Sample, 2010)");
    eq(results, c6.inCarShow, 1, "C6 In Car Show = 1 (SHW Yes)");
    eq(results, c8.atEvent, 2, "C8 At Event = 2 (Crane 2022, Ellis 2021)");
    eq(results, c8.inCarShow, 1, "C8 In Car Show = 1 (only Crane's SHW is Yes)");
    var others = out.summary.gens.filter(function (g) {
      return g.gen !== "C6" && g.gen !== "C8" && (g.atEvent || g.inCarShow);
    });
    eq(results, others.length, 0, "no other generations populated (1983 and the blank year land nowhere)");
    eq(results, out.summary.clubs, [
      { name: "Sample Club", attendees: 5 },
      { name: "Other Club", attendees: 1 },
      { name: "Unknown", attendees: 1 }
    ], "club tally counts attendees, and a blank club becomes Unknown");

    // ---- per-row field handling -------------------------------------------
    var sample = byName(out, "Sample");
    eq(results, sample["Phone"], "(555) 555-0100", "phone formatted");
    eq(results, byName(out, "Bower")["Phone"], "(555) 555-0101", "a leading 1 is stripped before formatting");
    eq(results, sample["Gen"], "C6", "Gen derived from the car year");
    eq(results, sample["SHW"], "Yes", "SHW carried through the rename from VF CarJudged");
    eq(results, sample["CSJ"], "Yes", "CSJ carried through the rename from VF Judge");
    eq(results, sample["Zip"], "37900", "Postal Code renamed to Zip");
    eq(results, sample["Club Name"], "Sample Club", "VF Corvette Club Name renamed to Club Name");
    eq(results, byName(out, "Crane")["Status"], "Not paid in time limit", "a non-Paid status is preserved verbatim");
    eq(results, byName(out, "Ellis")["Status"], "Cancelled", "cancelled rows are kept (showCancelled = true)");
    // Payment Type / Check # exist for hand-entry only — nothing in either
    // CSV feeds them, so a fresh import must leave them blank.
    eq(results, sample["Payment Type"], "", "Payment Type starts blank (no CSV source)");
    eq(results, sample["Check #"], "", "Check # starts blank (no CSV source)");

    // ---- the event year drives the Reg # prefix ---------------------------
    var forced = LOGIC.generate(reg, act, { eventYear: 2031 });
    eq(results, forced.registrations[0]["Reg #"], "31-01",
      "an explicit eventYear overrides the date-derived Reg # prefix");
    eq(results, out.meta.eventYear, 2027, "eventYear falls back to the earliest registration's year");

    validationAssertions(results, reg, act);
    regNumberAssertions(results);
    multiShowAssertions(results);

    return { out: out, results: results };
  }

  function byName(out, last) {
    return out.registrations.filter(function (r) { return r["Last Name"] === last; })[0] || {};
  }
  function genOf(out, gen) {
    return out.summary.gens.filter(function (g) { return g.gen === gen; })[0];
  }
  function shirtTotalFor(rec, out) {
    return out.shirtColumns.reduce(function (sum, c) { return sum + (Number(rec[c]) || 0); }, 0);
  }

  // The two "is this even the right file?" guards. Officers export two
  // similarly-named CSVs from ClubExpress and swapping them is the single
  // easiest mistake to make, so both must fail loudly rather than produce a
  // plausible-looking empty result.
  function validationAssertions(results, reg, act) {
    var empty = LOGIC.generate([], [], {});
    eq(results, empty.ok, false, "an empty registration file fails");

    var wrongReg = LOGIC.generate([{ "Some Other Column": 1 }], [], {});
    eq(results, wrongReg.ok, false, "a file without the VF Last Name column is rejected");
    eq(results, /VF Last Name/.test(wrongReg.messages[0]), true, "…and says which column is missing");

    // The activity file's guard only fires when activity rows are present —
    // running with no activity export at all is legitimate (the workbook's
    // ProcessActivityExportDataFlag), it just leaves every admission unmatched.
    var swapped = LOGIC.generate(reg, reg, {});
    eq(results, swapped.ok, false, "handing it the registration file twice is rejected");

    var noAct = LOGIC.generate(reg, [], {});
    eq(results, noAct.ok, true, "no activity file at all still generates");
    eq(results, noAct.summary.attendees, 0, "…but nothing has an admission, so attendees = 0");
    eq(results, noAct.messages.length, 6, "…and every row reports its missing admission (plus the 1983 year)");
  }

  function regNumberAssertions(results) {
    var n = LOGIC.regNumber;
    eq(results, n(2026, 1), "26-01", "regNumber pads to two digits");
    eq(results, n(2026, 70), "26-70", "regNumber leaves two digits alone");
    eq(results, n(2026, 100), "26-100", "regNumber does not truncate past the pad width");
    eq(results, n("2027", 3), "27-03", "regNumber accepts a string year");
  }

  // The show-year contract. The server re-validates every year it receives
  // (deploy/lib.php's vettefest_valid_year) — this copy is what lets the UI
  // reject a typo before the round trip, and what pins the shape down.
  function multiShowAssertions(results) {
    var valid = LOGIC.validShowYear;
    eq(results, valid("2026"), "2026", "show year: a plain four-digit year is accepted");
    eq(results, valid(2026), "2026", "show year: a number is accepted and normalized to a string");
    eq(results, valid("  2026  "), "2026", "show year: surrounding whitespace is trimmed");
    eq(results, valid(""), null, "show year: empty is rejected");
    eq(results, valid(null), null, "show year: null is rejected");
    eq(results, valid(undefined), null, "show year: undefined is rejected");
    eq(results, valid("20x6"), null, "show year: non-digits are rejected");
    eq(results, valid("202"), null, "show year: three digits are rejected");
    eq(results, valid("20266"), null, "show year: five digits are rejected");
    // The path-traversal shapes specifically — data/<year>/ is built by
    // string concatenation server-side, so these must never survive.
    eq(results, valid("../2026"), null, "show year: a relative path is rejected");
    eq(results, valid("2026/.."), null, "show year: a trailing path segment is rejected");
    eq(results, valid("2026 2027"), null, "show year: two years are rejected");

    var title = LOGIC.showRegistrationTitle;
    eq(results, title({ year: 2026, name: "2026 Vette Fest" }), "2026 Vette Fest Registration List",
      "event title: derived from the event's name");
    eq(results, title({ year: 2027, name: "  2027 Vette Fest  " }), "2027 Vette Fest Registration List",
      "event title: the name is trimmed");
    eq(results, title(null), CONFIG.defaultTitle, "event title: falls back to the shipped default with no event");
    eq(results, title({ year: 2026, name: "" }), CONFIG.defaultTitle, "event title: falls back when the name is blank");

    // The fallback must be CONFIG.defaultTitle, never CONFIG.title. app.js's
    // ingestShows() overwrites CONFIG.title in place with the open event's
    // name, so a fallback reading `title` would label an unnamed event with
    // the PREVIOUSLY opened one's name. This simulates that mutation, which
    // is also exactly the state the in-app Developer > Run Regression Tests
    // screen runs in — it is only reachable with an event already open, so a
    // fallback bug here would show up on every real run and never in Node.
    var savedTitle = CONFIG.title;
    CONFIG.title = "2026 Vette Fest Registration List";
    eq(results, title(null), CONFIG.defaultTitle,
      "event title: the fallback ignores an already-mutated CONFIG.title");
    eq(results, /(19|20)[0-9]{2}/.test(CONFIG.defaultTitle), false,
      "CONFIG.defaultTitle carries no hardcoded year (it's the fallback; ingestShows sets the real one)");
    CONFIG.title = savedTitle;
  }

  // Excel export round-trip (build a workbook, reload it, check shape).
  function excelAssertionList(out, ExcelJS) {
    var results = [];
    return Promise.resolve().then(function () {
      var wb = EXCEL.build(ExcelJS, out);
      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      var wb2 = new ExcelJS.Workbook();
      return wb2.xlsx.load(buf).then(function () { return wb2; });
    }).then(function (wb2) {
      var reg = wb2.getWorksheet("RegistrationSheet");
      var sum = wb2.getWorksheet("SummarySheet");
      var msg = wb2.getWorksheet("MessageSheet");
      eq(results, !!reg, true, "RegistrationSheet exists");
      eq(results, !!sum, true, "SummarySheet exists");
      eq(results, !!msg, true, "MessageSheet exists (the fixture has one message)");
      eq(results, reg.getCell(1, 1).value, out.meta.title, "title row A1");
      eq(results, reg.getCell(2, 1).value, "Reg #", "header A2 = Reg #");
      eq(results, reg.getCell(3, 1).value, "27-01", "first data row carries the generated Reg #");
      eq(results, reg.actualRowCount, 7, "reg sheet has 7 rows (title + header + 5 fixture rows)");
      eq(results, !!reg.autoFilter, true, "autofilter set");
      eq(results, reg.views[0].state, "frozen", "frozen panes");
      var feeCol = out.columns.indexOf("Total Fee") + 1;
      var sawMoney = false;
      reg.eachRow(function (row) { var c = row.getCell(feeCol); if (c.numFmt && /\$/.test(c.numFmt)) sawMoney = true; });
      eq(results, sawMoney, true, "Total Fee column has $ number format");
      var shirtColsInExcel = out.shirtColumns.filter(function (c) { return out.columns.indexOf(c) !== -1; });
      eq(results, shirtColsInExcel.length, 12, "Excel export still has all 12 shirt columns");
      return results;
    });
  }

  var API = { assertionList: assertionList, excelAssertionList: excelAssertionList };
  root.VetteFestRegressionTests = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
