/* =============================================================================
 * CONFIG — ported verbatim from VetteFestV4.xlsm's ConfigurationSheet.
 * Edit THIS to adapt the tool to a different event. No code changes needed.
 * (This is the data the old VBA read from named ranges + config tables.)
 *
 * Where Vette Fest differs from the sibling ETCC Car Show app — the two
 * workbooks share a pipeline but not a model, and every one of these is a
 * deliberate difference, not an omission:
 *   - Shirts have NO gender. 12 buckets (Free/Xtra x 6 sizes), not 24.
 *   - Admission is one of four priced activities (Single/Couple/Car Show
 *     Only/T-Shirt Only) rather than a single "Car Show Registration", and
 *     it's the admission that decides both the Reg Type column and the
 *     attendee count (a Couple is 2 people on one registration).
 *   - The free shirt's size lives on the ADMISSION ROW, in a different
 *     column per admission type, not on the registration row.
 *   - Reg # is a per-event sequence ("26-01"), not a club member number.
 *   - There is no sponsorship concept anywhere in the workbook.
 * ========================================================================== */
(function (root) {
  "use strict";

  // The 6 shirt sizes, in display order, with the size-suffix used in bucket
  // keys. `answer` is what ClubExpress puts in the free-shirt-size question's
  // answer column — deliberately NOT the same string as `label` ("XL" vs
  // "Extra Large"), which is why freeSizeMap below exists as its own table.
  var SIZES = [
    { key: "SM",   label: "Small",       answer: "SM" },
    { key: "MED",  label: "Medium",      answer: "MED" },
    { key: "LG",   label: "Large",       answer: "LG" },
    { key: "XLG",  label: "Extra Large", answer: "XL" },
    { key: "2XLG", label: "2XL",         answer: "2XL" },
    { key: "3XLG", label: "3XL",         answer: "3XL" }
  ];

  // The 2 shirt groups (matrix columns on the summary). Vette Fest shirts are
  // unisex — there is no Men's/Women's split anywhere in the workbook.
  var GROUPS = [
    { key: "Free", label: "Free" },
    { key: "Xtra", label: "Xtra" }
  ];

  // Build the 12 shirt buckets: { key, col, groupKey, sizeKey }.
  // key e.g. "FreeLG"  |  col (registration column header) e.g. "Free LG"
  var SHIRT_BUCKETS = [];
  GROUPS.forEach(function (g) {
    SIZES.forEach(function (s) {
      SHIRT_BUCKETS.push({
        key: g.key + s.key,
        col: g.label + " " + s.key,
        groupKey: g.key,
        sizeKey: s.key
      });
    });
  });

  // freeSizeMap: the answer string on the admission row -> Free bucket key.
  // Built from SIZES so a renamed size can never leave the two out of sync.
  var freeSizeMap = {};
  SIZES.forEach(function (s) { freeSizeMap[s.answer] = "Free" + s.key; });

  // The shipped default event title. Kept SEPARATE from CONFIG.title below
  // because app.js's ingestShows() overwrites `title` in place, so `title` is
  // whatever event is currently open — not a fallback you can fall back to.
  // Anything that needs "the name to use when no event is open" must read
  // defaultTitle, or it will quietly report the previously-opened event's
  // name instead. Deliberately carries no year.
  var DEFAULT_TITLE = "Vette Fest Registration List";

  var CONFIG = {
    // --- Variables (ConfigurationSheet: Variables table) ---
    // The LIVE event title: app.js's ingestShows() overwrites this with
    // "<event name> Registration List" the moment an event is opened, and
    // every report header, the Summary panel heading and the Excel export
    // read it from here (via state.result.meta.title). Before that — and in
    // the offline tool and the regression fixtures, where there is no
    // server-side registry to read a name from — it holds DEFAULT_TITLE.
    title: DEFAULT_TITLE,
    defaultTitle: DEFAULT_TITLE,

    // --- Reg Type column values ---
    // Unlike the car show app (where every CSV row is "Pre-Registered"), Reg
    // Type here IS the admission the registrant bought — see admissions below.
    showCancelled: true,          // keep Cancelled rows
    sortBy: "Reg Date",           // the workbook's RegistrationSheet is in registration order
    dateTimeColumn: "Date/Time",  // column used to match registrations <-> activities
    unitCost: 25,                 // Xtra shirt unit cost; qty = Activity Fee / unitCost

    // --- Reg # ---
    // "26-01", "26-02", ... — a per-event sequence in Reg Date order, with the
    // event year's last two digits as the prefix. Nothing to do with club
    // member numbers (which this event's export doesn't even keep — see
    // deleteColumns).
    regNumberPad: 2,

    // --- Validation (Event Specific Configuration) ---
    registrationValidColumn: "VF Last Name",
    activityValidColumn: "Activity Sequence Number",

    // --- Event-specific question -> canonical column names (post-rename) ---
    corvetteYearColumn: "Year",
    carJudgedColumn: "SHW",       // "is this car in the show?"  Yes/No
    beAJudgeColumn: "CSJ",        // "will you volunteer as a judge?"  Yes/No
    clubNameColumn: "Club Name",
    totalFeeColumn: "Total Fee",

    // --- Admissions (ConfigurationSheet: Activity Table, type "Activity") ---
    // Each registration buys exactly one of these; it sets both the Reg Type
    // column and the "#" (attendee) count. `freeShirtColumn` is the ACTIVITY
    // row column the free shirt's size comes from — Single and Couple ask the
    // question on different ClubExpress fields, and the two admissions that
    // don't ask it grant no free shirt at all.
    //
    // ORDER IS PRECEDENCE. A registration can carry more than one admission
    // row (the real 2026 data has someone with both Single and T-Shirt Only);
    // the first match in this list wins, so a paid admission always beats the
    // $0 T-Shirt Only one rather than the answer depending on CSV row order.
    admissions: [
      { title: "Couple Admission",       fee: 100, attendees: 2, freeShirtColumn: "VF Free TShirt Size Couple" },
      { title: "Single Admission",       fee: 90,  attendees: 1, freeShirtColumn: "VF Free TShirt Size Single" },
      { title: "Car Show Only Admission", fee: 55, attendees: 1, freeShirtColumn: null },
      { title: "T-Shirt Only Admission",  fee: 0,  attendees: 1, freeShirtColumn: null }
    ],

    // --- Column Rename Table (Old -> New) ---
    // NOTE the VF-prefixed event-question answers win over ClubExpress's own
    // "Last Name"/"First Name" account fields, which deleteColumns drops —
    // registrants routinely enter a couple's names ("Phil & Tammy") in the
    // event question while the account holds only one. buildRecord() deletes
    // before it renames so these can't collide.
    renameMap: {
      "VF Last Name": "Last Name",
      "VF First Names": "First Name(s)",
      "VF Corvette Club Name": "Club Name",
      "VF Corvette Year": "Year",
      "VF Corvette Color": "Color",
      "VF Corvette Model": "Model",
      "VF CarJudged": "SHW",
      "VF Judge": "CSJ",
      "Postal Code": "Zip",
      "Companion Count": "#",
      "Date/Time": "Reg Date",
      "Address 1": "Address"
    },

    // --- Delete Column Table ---
    deleteColumns: [
      "Sequence Number", "Primary Member?", "Trans. Ref. Num.", "Member Number",
      "Country", "Company", "Work Title", "Title", "Middle Initial", "Nickname",
      "Cell Phone", "Registrant Type", "Address 2", "Member?",
      "Last Name", "First Name",
      "VF Last Name Comments", "VF First Names Comments",
      "VF Corvette Club Name Comments", "VF Corvette Year Comments",
      "VF Corvette Model Comments", "VF Corvette Color Comments",
      "VF CarJudged Comments", "VF Judge Comments"
    ],

    // --- Final column order (matches the workbook's RegistrationSheet) ---
    // Shirt columns are appended programmatically (all 12, in SHIRT_BUCKETS
    // order). "Payment Type"/"Check #" have no CSV source — they exist so an
    // officer can record how a walk-up or mailed payment actually arrived,
    // and are filled in only by hand via the detail modal.
    baseColumnOrder: [
      "Reg #", "Last Name", "First Name(s)", "Reg Date", "Reg Type", "#",
      "Club Name", "Phone", "Email", "Address", "City", "State", "Zip",
      "Total Fee", "Payment Type", "Check #", "Status",
      "Year", "Gen", "Color", "Model", "SHW", "CSJ"
    ],

    // --- Free shirt: admission-row size answer -> bucket key ---
    freeSizeMap: freeSizeMap,

    // --- Shirt Item activity title -> bucket key ---
    // From the ConfigurationSheet's Activity Table rows of type "Item". The
    // "Free T-Shirt - *" titles aren't used by this event (the free shirt
    // comes off the admission row instead) but are configured in the workbook
    // and kept here so an event that DOES sell them that way just works.
    activityTitleToBucket: {
      "Free T-Shirt - Small":  "FreeSM",
      "Free T-Shirt - Medium": "FreeMED",
      "Free T-Shirt - Large":  "FreeLG",
      "Free T-Shirt - XL":     "FreeXLG",
      "Free T-Shirt - 2XL":    "Free2XLG",
      "Free T-Shirt - 3XL":    "Free3XLG",
      "Extra T-Shirt - Small":  "XtraSM",
      "Extra T-Shirt - Medium": "XtraMED",
      "Extra T-Shirt - Large":  "XtraLG",
      "Extra T-Shirt - XL":     "XtraXLG",
      "Extra T-Shirt - 2XL":    "Xtra2XLG",
      "Extra T-Shirt - 3XL":    "Xtra3XLG"
    },

    // --- Corvette Generation Table (year -> generation) ---
    corvetteGenerations: [
      { gen: "C1", from: 1953, to: 1962 },
      { gen: "C2", from: 1963, to: 1967 },
      { gen: "C3", from: 1968, to: 1982 },
      { gen: "C4", from: 1984, to: 1996 },
      { gen: "C5", from: 1997, to: 2004 },
      { gen: "C6", from: 2005, to: 2013 },
      { gen: "C7", from: 2014, to: 2019 },
      { gen: "C8", from: 2020, to: 2030 }
    ],

    // Derived tables (exposed for UI/logic):
    SIZES: SIZES,
    GROUPS: GROUPS,
    SHIRT_BUCKETS: SHIRT_BUCKETS
  };

  root.VetteFestConfig = CONFIG;
  if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
})(typeof globalThis !== "undefined" ? globalThis : this);
