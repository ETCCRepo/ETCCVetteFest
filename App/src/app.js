/* app.js — DOM wiring and rendering for the hosted site. Globals:
 * VetteFestConfig, VetteFestLogic, Papa, ExcelJS (ExcelJS/Papa are only
 * exercised here via the Developer > Run Regression Tests round-trip, see
 * runRegressionTests()). */
(function () {
  "use strict";
  var CONFIG = window.VetteFestConfig;
  var LOGIC = window.VetteFestLogic;

  var state = {
    reg: null,   // { name, rows }
    act: null,   // { name, rows }
    result: null,
    sortCol: null,
    sortDir: 1,
    search: "",
    // Every status is on by default, unlike the sibling car show app. The
    // workbook's Summary sheet counts every registration it imported
    // regardless of payment state, and the officers reconcile this app's
    // Summary against that sheet — so the out-of-the-box numbers have to
    // match it. Unticking Not Paid is a deliberate act, not the default.
    statusFilter: { paid: true, notpaid: true, cancelled: true, empty: true },
    inShowFilter: false, // Registration toolbar's "In Show" checkbox — only rows with SHW = Yes
    judgeFilter: false, // Registration toolbar's "Judge" checkbox — only rows with CSJ = Yes

    // ---- Events (one per year) ----
    // The app holds a completely separate dataset per event year, stored
    // server-side under data/<year>/. index.php inlines the registry and
    // which event (if any) this session has open via ingestShows(). Until an
    // event is open, renderViews() shows the Events picker and nothing else.
    shows: [],            // [{ year, name, status, created }], newest year first
    currentShow: null,    // the event THIS session has open, or null
    publicShowYear: null, // the event marked "current" in the registry
    showsError: null,     // last shows.php failure, shown on the picker
    showsBusy: false,     // a shows.php call is in flight
    showPendingDelete: null, // event awaiting delete confirmation, or null

    tab: "sum",
    detailRow: null,  // registration row currently shown in the detail modal, or null

    // Event flyer — METADATA only ({ exists, mime, name, uploadedAt }), filled
    // by ingestFlyer() from index.php's boot script. The bytes live server-side
    // and are fetched from SITE_CONFIG.flyerApiUrl only when actually needed
    // (the Setup tab's preview link, the Reports tab's Print Flyer).
    flyer: { exists: false },
    flyerUploading: false,
    flyerError: null,

    // The History tab's log — one entry per import ATTEMPT ({ timestamp,
    // regRows, actRows, source, eventUrl, outcome, error, logFile }) in FILE
    // order (oldest first); buildHistoryView() reverses it for display. Filled
    // by ingestImportHistory() from index.php's boot script and refreshed by
    // refreshShowData() on every tab select. Recorded server-side at
    // import time (see vettefest_record_import_history() in lib.php and
    // import-schedule.php's mark_run for failures), not client-side, so it
    // stays accurate regardless of which import path an officer used.
    // Entries written before the CarShow-parity port carry 'importedAt'
    // instead of 'timestamp' — historyTimestamp() below reads either.
    importHistory: [],
    historySelected: {},      // timestamp -> true, for the History tab's row checkboxes
    deleteHistoryConfirm: null, // "selected" | "all" | null — which delete is awaiting confirmation

    // Setup tab > Import Schedule — separate save state from the Settings
    // modal's (saveAppSettings), since this is its own small per-event JSON
    // rather than the general app-settings save. Auto-saves per field, same
    // idea as the Settings modal — see saveImportScheduleSettings().
    importScheduleSaving: false,
    importScheduleError: null,
    importScheduleSaved: false,
    // Setup tab > Import Schedule > "Import Now" — brief inline status text
    // for one specific click, polled via import-schedule.php's 'status'.
    importRequestStatus: null,
    // Setup tab > Import Schedule > "View Logs" — server-archived log files
    // (see logs.php); logsList is null until first opened/loaded, then an array.
    logsPanelOpen: false,
    logsList: null,
    logsLoading: false,
    logsError: null,
    // Setup tab > Import Schedule > persisted "Last run" status (see
    // import-schedule.php's mark_start/mark_run/run_status actions).
    runStatus: null,

    // Setup tab > Backups — "Backup Now" (backup.php), its auto-backup
    // schedule, and the permanent run log. See requestBackupNow() etc. below.
    backupRunning: false,
    backupRunStatus: null,
    backupSchedule: null,
    backupScheduleSaving: false,
    backupScheduleError: null,
    backupScheduleSaved: false,
    backupsPanelOpen: false,
    backupsList: null,
    backupsLoading: false,
    backupsError: null,
    deleteBackupConfirm: null, // timestamp of the backup log entry pending delete confirm, or null
    deleteBackupError: null,   // e.g. "it's the only backup left" — shown in the confirm modal

    // Setup tab > Backups > per-row "↺ Restore" — see openRestoreConfirm()
    // etc. below. restoreConfirm holds the timestamp of the backup log entry
    // being restored (or null); restoreYears is that specific backup's
    // contents (get_backup_years), loaded fresh each time the modal opens
    // since it's a property of the FILE, not of app state.
    restoreConfirm: null,
    restoreYears: null,
    restoreYearsLoading: false,
    restoreYearsError: null,
    restoreScope: "",  // "" = everything; else one of restoreYears[].year
    restoreRunning: false,
    restoreError: null,

    zoom: 1,          // table zoom level (1 = 100%); lets all columns fit without scrolling
    zoomAutoFitDone: false, // the table defaults to "Fit" once per session (not on every
                             // tab switch, so a manual zoom choice sticks)

    menuOpen: false,      // hamburger drawer
    settingsOpen: false,  // Settings full-page screen
    testsPageOpen: false, // Regression Tests full-page screen (Developer menu)
    testResults: null,    // { results: [{label, ok, expected, actual}], passed, failed } | null
    testRunning: false,
    testOnlyErrors: false,

    developerLoginOpen: false, // "Developer Login" full-page screen
    developerVerifying: false, // password check in flight
    developerUnlocked: false,  // password verified this page load — reveals the Developer submenu
    developerError: null,

    changelogOpen: false,
    changelogLoading: false,
    changelogError: null,
    changelogMeta: null,
    changelogCommits: null,

    appSettings: {          // filled by ingestAppSettings(); see app-settings.php. Defaults
                             // here are a fallback for the brief window before that hook
                             // runs — app-settings.php's own $defaults is the real source.
      tshirtVendorEmail: "",
      tshirtOrderSubject: "ETCC Vette Fest — T-Shirt Order",
      // Setup tab > Import Schedule (see lib.php's vettefest_settings_defaults()).
      eventUrl: "",
      autoImportEnabled: false,
      autoImportTimes: [],
      autoImportIntervalHours: 0,
      autoImportStartDate: "",
      autoImportEndDate: ""
    },
    appSettingsSaving: false,
    appSettingsError: null,
    appSettingsSaved: false,

    tshirtOrderPageOpen: false, // T-Shirts tab > "T-Shirt Order Form" full-page screen
    emailTo: "",
    emailSubject: "",
    emailBody: "",
    emailCc: "",
    emailBcc: "",
    emailSending: false,
    emailSendError: null,
    emailSent: false,

    deletedCsvKeys: {},   // csvRegKey(rec) -> true, for rows removed via the Registration
                           // tab's checkbox/bulk-delete — filled by
                           // ingestDeletedRegistrations(); excluded in regenerate(), so
                           // they stay gone across reloads and re-imports too
    csvOverrides: {},     // csvRegKey(rec) -> patch object, for rows edited via the detail
                           // modal — filled by ingestRegistrationOverrides(); re-applied on
                           // top of a fresh parse in regenerate(), so edits survive a
                           // re-import (see registration-overrides.php)
    regSelected: {},      // rowKey(r) -> true, for the Registration tab's row checkboxes
    deleteRegSelectedOpen: false,
    regDeleteSyncError: null,
    detailEditError: null
  };

  // Populated in init() from window.__vettefestSite, which deploy/index.php
  // injects in the very first inline script, before app.js runs. Read inside
  // init() rather than at module-load time, since init() is what's guaranteed
  // to run after every inline script in the document, including that one.
  var SITE_CONFIG = {};

  // Setup tab > Import Schedule > "Import Now" polling timer handle — plain
  // module-level rather than in state, since it's a live setInterval handle
  // (not renderable data) that must survive every re-render.
  var importRequestPollTimer = null;

  var NUMERIC_BASE = { "Total Fee": 1, "Year": 1, "#": 1 };
  var CURRENCY_COLS = { "Total Fee": 1 };
  var DATE_COLS = { "Reg Date": 1 };
  // These headers are far wider than their data ("Yes"/"No", a digit or two) —
  // force-wrapping them shrinks the column to fit the data, not the label.
  var NARROW_HEADER_COLS = { "Payment Type": 1 };

  // The one currency formatter every money value in this app goes through —
  // always 2 decimals, comma-grouped over 999, so no field shows a bare
  // "$845" next to another showing "$845.00".
  function fmtMoney(v) { return v === "" || v == null ? "" : "$" + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // Reuses LOGIC.formatPhone — the same function generate() already runs CSV
  // phones through — so there's one implementation and one regression-tested
  // set of rules. On a CSV row this is a harmless no-op re-format.
  function fmtPhone(v) { return v == null || v === "" ? v : LOGIC.formatPhone(v); }
  // "Reg Date" arrives from ClubExpress as an unpadded, seconds-included
  // string ("3/7/2026 8:15:00 AM") — reformat it so it lines up with every
  // other date/time the app shows.
  function fmtCsvDate(v) {
    if (v == null || v === "") return v;
    var d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return fmtDate(d);
  }
  function isShirtCol(c) { return state.result && state.result.shirtColumns.indexOf(c) !== -1; }
  function isNumericCol(c) { return NUMERIC_BASE[c] || isShirtCol(c); }

  // ---------- status filter ----------
  // ClubExpress "Status" values collapse into 4 buckets: an exact
  // "Paid"/"Cancelled" match, blank, or anything else as Not Paid (covers
  // "Not paid in time limit", "Open", etc.).
  var STATUS_BUCKETS = [
    { key: "paid", label: "Paid" },
    { key: "notpaid", label: "Not Paid" },
    { key: "cancelled", label: "Cancelled" },
    { key: "empty", label: "Empty" }
  ];
  function classifyStatus(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "empty";
    var low = s.toLowerCase();
    if (low === "cancelled") return "cancelled";
    if (low === "paid") return "paid";
    return "notpaid";
  }

  // ---------- shirts: 12 sparse columns collapsed into one summary column ----------
  var SHIRTS_COL = "__shirts";
  // Every shirt bucket this row has 1+ of, as { label, qty } — used by both
  // the table's compact summary cell and the detail modal's breakdown.
  function shirtSummaryParts(row) {
    var parts = [];
    CONFIG.SHIRT_BUCKETS.forEach(function (b) {
      var qty = Number(row[b.col]) || 0;
      if (qty > 0) parts.push({ label: b.col, qty: qty });
    });
    return parts;
  }
  function shirtSummaryText(row) {
    return shirtSummaryParts(row).map(function (p) { return p.label + (p.qty > 1 ? " ×" + p.qty : ""); }).join(", ");
  }
  function shirtTotal(row) {
    return shirtSummaryParts(row).reduce(function (sum, p) { return sum + p.qty; }, 0);
  }

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  // A money input always shown with a "$" prefix, so every dollar figure an
  // officer types looks like currency, not a bare number.
  // Returns { input, wrap } — append wrap, read/write input as usual.
  function moneyInput(attrs) {
    attrs = attrs || {};
    attrs.type = attrs.type || "number";
    if (attrs.type === "number") {
      attrs.step = attrs.step || "0.01";
      attrs.min = attrs.min || "0";
    }
    attrs.placeholder = attrs.placeholder || "0.00";
    attrs.style = (attrs.style ? attrs.style + "; " : "") + "padding-left:20px; width:100%";
    var input = el("input", attrs);
    var wrap = el("div", { style: "position:relative; flex:1" }, [
      el("span", { style: "position:absolute; left:8px; top:50%; transform:translateY(-50%); color:#666", text: "$" }),
      input
    ]);
    return { input: input, wrap: wrap };
  }

  function debounce(fn, delay) {
    var timeoutId = null;
    return function () {
      var args = arguments, context = this;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(function () { fn.apply(context, args); }, delay);
    };
  }

  // generatedAt defaults to "now", but callers with a real known ingestion
  // time — index.php's boot script, replaying the CSVs it stored on this page
  // load — pass it explicitly so "CSVs loaded:" reflects when the export
  // actually happened, not whenever a visitor opens the page.
  function regenerate(generatedAt) {
    if (!state.reg) { state.result = null; renderViews(); return; }
    state.result = LOGIC.generate(state.reg.rows, state.act ? state.act.rows : [], {
      regFileName: state.reg.name,
      actFileName: state.act ? state.act.name : "",
      generatedAt: generatedAt || new Date(),
      // The open event's year decides the Reg # prefix. Without it,
      // generate() would guess from the earliest registration date — right
      // nearly always, but wrong for an event whose sign-ups open in the
      // previous calendar year.
      eventYear: state.currentShow ? state.currentShow.year : null
    });
    // Exclude rows removed via bulk-delete, then re-apply any detail-modal
    // field edits. generate() has no notion of either, so both run against
    // its fresh output every time.
    if (state.result.ok) {
      state.result.registrations = state.result.registrations
        .filter(function (r) { return !state.deletedCsvKeys[csvRegKey(r)]; })
        .map(function (r) {
          var patch = state.csvOverrides[csvRegKey(r)];
          return patch ? applyRecordPatch(r, patch) : r;
        });
    }
    state.sortCol = null; state.sortDir = 1;
    renderViews();
  }

  // Stable identity for a registration row across re-exports. Deliberately
  // NOT built from Reg #: that's a sequence generate() re-derives from row
  // order on every load, so the same string can mean a different person after
  // someone earlier is deleted. Reg Date (the transaction's own timestamp)
  // plus the name is stable for the same person's same registration across
  // exports, and distinct between different people.
  function csvRegKey(rec) {
    var raw = String(rec["Reg Date"] || "") + "_" + String(rec["Last Name"] || "") + "_" + String(rec["First Name(s)"] || "");
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function rowKey(r) { return csvRegKey(r); }

  // Merges an edit patch onto a copy of a record, recomputing Gen if Year was
  // part of the patch (Gen is derived, never directly editable — see
  // EDITABLE_FIELDS). Shared by regenerate() (re-applying a persisted edit on
  // every load) and the detail modal's Save handler (building the
  // just-edited record to show immediately, before the next reload).
  function applyRecordPatch(rec, patch) {
    var merged = {};
    Object.keys(rec).forEach(function (k) { merged[k] = rec[k]; });
    Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
    if (Object.prototype.hasOwnProperty.call(patch, "Year")) {
      merged["Gen"] = LOGIC.genFromYear(LOGIC.toInt(patch["Year"]));
    }
    return merged;
  }

  // ---------- views ----------
  function renderViews() {
    var app = $("#app");
    app.innerHTML = "";

    // The Events picker is the landing screen: every session starts here and
    // stays here until an event is opened. Nothing below this point makes
    // sense without one — every tab reads data belonging to a specific year,
    // and index.php deliberately ships none of it until one is selected.
    if (!state.currentShow) {
      app.appendChild(buildShowsPage());
      renderDeleteShowConfirm();
      return;
    }

    app.appendChild(buildTabs());

    // The T-Shirts, Reports, Setup and History tabs handle their own empty
    // states, so they work before any CSV pair has been imported.
    if (state.tab === "tsh") { app.appendChild(buildTshirtView()); return; }
    if (state.tab === "reports") { app.appendChild(buildReportsView()); return; }
    if (state.tab === "setup") { app.appendChild(buildSetupView()); return; }
    if (state.tab === "history") { app.appendChild(buildHistoryView()); return; }

    if (!state.result) {
      app.appendChild(el("div", { class: "empty-state" },
        ["No registration data loaded yet — use the Setup tab → Import Registrations to load the first CSV export."]));
      return;
    }
    if (!state.result.ok) {
      app.appendChild(el("div", { class: "panel" }, [
        el("h3", { text: "Could not generate" }),
        el("ul", { class: "messages" }, state.result.messages.map(function (m) { return el("li", { text: m }); }))
      ]));
      return;
    }
    if (state.tab === "reg") app.appendChild(buildLoadedInfo());
    if (state.tab === "reg" && state.regDeleteSyncError) {
      app.appendChild(el("div", { class: "messages", style: "margin-bottom:10px" }, [state.regDeleteSyncError]));
    }
    app.appendChild(state.tab === "reg" ? buildRegToolbar() : buildSummaryToolbar());
    app.appendChild(state.tab === "reg" ? buildRegView() : buildSummaryView());
  }

  function buildTabs() {
    var mk = function (id, label) {
      var t = el("div", { class: "tab" + (state.tab === id ? " active" : ""), text: label });
      t.addEventListener("click", function () {
        state.tab = id;
        renderViews();
        // Every tab re-pulls the event's data on selection — a scheduled or
        // manual import (or another officer's edit) that landed after this
        // page was opened should show up without a full reload, on whichever
        // tab you're looking at, not just History/Setup.
        refreshShowData();
        // Setup tab additionally needs the persisted "Last run" status,
        // which isn't part of the general event-data refresh above.
        if (id === "setup") { loadRunStatus(); loadBackupSchedule(); }
      });
      return t;
    };
    return el("div", { class: "tabs no-print" },
      [mk("sum", "Summary"), mk("reg", "Registration"), mk("tsh", "T-Shirts"), mk("reports", "Reports"), mk("setup", "Setup"), mk("history", "History")]);
  }

  // ---------- Events picker (the landing screen, shown before the tabs) ----------
  // Opening an event is a full page load (?year=NNNN) rather than a
  // client-side swap: index.php re-inlines every dataset from scratch on each
  // request, so a reload gets the new year's data with no chance of one
  // event's records lingering in memory alongside another's.

  // The header bar and browser tab both name the event that's open, so it's
  // obvious at a glance which year is being edited — the single most
  // important thing to get wrong now that there's more than one. Both fall
  // back to the plain product name on the picker, where nothing is open.
  // build.js ships that plain name as the static markup, so this only ever
  // needs to write over it.
  function applyShowTitle() {
    var year = state.currentShow ? String(state.currentShow.year) : "";
    var h1 = document.querySelector("header.app h1");
    if (h1) h1.textContent = year ? year + " Vette Fest Manager" : "Vette Fest Manager";
    document.title = year ? year + " ETCC Vette Fest — Registration" : "ETCC Vette Fest — Registration";
  }

  function openShow(year) { location.href = "?year=" + encodeURIComponent(year); }
  function closeShow() { location.href = "?year="; }

  // Every mutation goes through shows.php and then adopts the list it
  // returns, rather than patching state locally. The registry is tiny, these
  // actions are rare and deliberate, and a wrong local guess would show the
  // officer an event that doesn't exist (or hide one that does).
  function pushShowAction(payload, onDone) {
    if (!SITE_CONFIG.showsApiUrl) return;
    state.showsBusy = true;
    state.showsError = null;
    renderViews();
    fetch(SITE_CONFIG.showsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (r) {
      state.showsBusy = false;
      if (!r.ok || !r.data || !r.data.ok) {
        state.showsError = (r.data && r.data.error) || "That did not work — please try again.";
        renderViews();
        return;
      }
      state.shows = Array.isArray(r.data.shows) ? r.data.shows : [];
      state.publicShowYear = r.data.current ? String(r.data.current) : null;
      renderViews();
      if (onDone) onDone(r.data);
    }).catch(function () {
      state.showsBusy = false;
      state.showsError = "Could not reach the server — check your connection and try again.";
      renderViews();
    });
  }

  function createShow() {
    var year = prompt("What year is this Vette Fest?", String(new Date().getFullYear()));
    if (year === null) return;
    year = LOGIC.validShowYear(year);
    if (year === null) {
      state.showsError = "Enter a four-digit year, for example 2027.";
      renderViews();
      return;
    }
    var name = prompt("Name for this event:", year + " Vette Fest");
    if (name === null) return;
    // Land straight in the new event rather than making the officer click it —
    // creating one is only ever a prelude to working in it.
    pushShowAction({ action: "create", year: year, name: String(name).trim() }, function () {
      openShow(year);
    });
  }

  function renameShow(show) {
    var name = prompt("Name for this event:", show.name || "");
    if (name === null || !String(name).trim()) return;
    pushShowAction({ action: "rename", year: show.year, name: String(name).trim() });
  }

  // Archiving is presentational — it labels the row. An archived event is NOT
  // read-only, because a past event's records still get corrected after the fact.
  function setShowStatus(show, archived) {
    pushShowAction({ action: archived ? "archive" : "unarchive", year: show.year });
  }

  // Which event the registry considers "current". Nothing public writes into
  // a Vette Fest event (there are no public forms here, unlike the car show
  // app), so this is purely the default an officer lands on — but it's still
  // worth being explicit about which year is the live one.
  function setCurrentShow(show) {
    pushShowAction({ action: "set_current", year: show.year });
  }

  function confirmDeleteShow(show) { state.showPendingDelete = show; renderViews(); }
  function cancelDeleteShow() { state.showPendingDelete = null; state.showsError = null; renderViews(); }
  function deleteShow(show, devPassword) {
    pushShowAction({ action: "delete", year: show.year, devPassword: devPassword }, function () {
      state.showPendingDelete = null;
      renderViews();
    });
  }

  function buildShowsPage() {
    var kids = [];

    var newBtn = el("button", { class: "btn primary" }, ["+ New Vette Fest"]);
    newBtn.addEventListener("click", createShow);
    if (state.showsBusy) newBtn.setAttribute("disabled", "disabled");
    kids.push(el("div", { class: "shows-head" }, [
      el("h3", { text: "Vette Fest Events" }),
      el("span", { class: "spacer" }),
      newBtn
    ]));

    if (state.showsError && !state.showPendingDelete) {
      kids.push(el("div", { class: "messages", style: "margin-bottom:10px" }, [state.showsError]));
    }

    if (!state.shows.length) {
      kids.push(el("div", { class: "empty-state" },
        ["No events yet — click + New Vette Fest to set up the first one."]));
      return el("div", { class: "panel shows-panel" }, kids);
    }

    var head = el("tr", {}, [
      el("th", { text: "Event" }),
      el("th", { text: "Status" }),
      el("th", { text: "Current" }),
      el("th", { text: "" })
    ]);

    var rows = state.shows.map(function (s) {
      var year = String(s.year);
      var archived = s.status === "archived";
      var isCurrent = state.publicShowYear === year;

      var nameLink = el("a", { class: "show-open", href: "#", text: s.name || (year + " Vette Fest") });
      nameLink.addEventListener("click", function (e) { e.preventDefault(); openShow(year); });

      var statusBadge = el("span", {
        class: "badge " + (archived ? "badge-muted" : "badge-ok"),
        text: archived ? "ARCHIVED" : "ACTIVE"
      });

      var currentCell;
      if (isCurrent) {
        currentCell = el("span", { class: "badge badge-accent", text: "CURRENT" });
      } else {
        currentCell = el("button", { class: "btn btn-sm" }, ["Make current"]);
        currentCell.addEventListener("click", function () { setCurrentShow(s); });
        if (state.showsBusy) currentCell.setAttribute("disabled", "disabled");
      }

      var openBtn = el("button", { class: "btn btn-sm" }, ["Open"]);
      openBtn.addEventListener("click", function () { openShow(year); });
      var renameBtn = el("button", { class: "btn btn-sm" }, ["Rename"]);
      renameBtn.addEventListener("click", function () { renameShow(s); });
      var archiveBtn = el("button", { class: "btn btn-sm" }, [archived ? "Unarchive" : "Archive"]);
      archiveBtn.addEventListener("click", function () { setShowStatus(s, !archived); });
      var deleteBtn = el("button", { class: "btn btn-sm btn-warn" }, ["Delete"]);
      deleteBtn.addEventListener("click", function () { confirmDeleteShow(s); });
      if (state.showsBusy) {
        [renameBtn, archiveBtn, deleteBtn].forEach(function (b) { b.setAttribute("disabled", "disabled"); });
      }

      return el("tr", {}, [
        el("td", {}, [nameLink]),
        el("td", {}, [statusBadge]),
        el("td", {}, [currentCell]),
        el("td", { class: "show-actions" }, [openBtn, renameBtn, archiveBtn, deleteBtn])
      ]);
    });

    kids.push(el("table", { class: "grid shows-grid" }, [
      el("thead", {}, [head]),
      el("tbody", {}, rows)
    ]));
    kids.push(el("div", { class: "shows-note" }, [
      "Each event keeps its own registrations, edits and settings — nothing is shared between years."
    ]));

    return el("div", { class: "panel shows-panel" }, kids);
  }

  // Deleting an event throws away a whole year of records and cannot be
  // undone, so it takes the Developer password — the stronger of the app's
  // two credentials. The server checks it too (shows.php); this is not the
  // gate, just where it's asked.
  function renderDeleteShowConfirm() {
    var host = $("#confirmHost");
    if (!host) return;
    host.innerHTML = "";
    var show = state.showPendingDelete;
    if (!show) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", cancelDeleteShow);
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: "Delete " + (show.name || show.year) + "?" }),
      el("span", { class: "spacer" }),
      closeBtn
    ]);

    var pw = el("input", { type: "password", placeholder: "Developer password", autocomplete: "off" });
    var yesBtn = el("button", { class: "btn primary", style: "background:var(--warn);border-color:var(--red-dark)" },
      ["Yes, Delete This Event"]);
    yesBtn.addEventListener("click", function () { deleteShow(show, pw.value); });
    var noBtn = el("button", { class: "btn" }, ["Cancel"]);
    noBtn.addEventListener("click", cancelDeleteShow);
    if (state.showsBusy) yesBtn.setAttribute("disabled", "disabled");
    pw.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); deleteShow(show, pw.value); }
    });

    var body = el("div", { class: "modal-body" }, [
      el("p", {}, ["This permanently deletes every registration and edit for " +
        (show.name || show.year) + ". This cannot be undone."]),
      el("p", {}, ["Enter the Developer password to confirm:"]),
      pw
    ]);
    if (state.showsError) {
      body.appendChild(el("div", { class: "messages", style: "margin-top:10px" }, [state.showsError]));
    }
    body.appendChild(el("div", { class: "settings-actions" }, [yesBtn, noBtn]));

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", cancelDeleteShow);
    host.appendChild(backdrop);
    pw.focus();
  }

  // CSVs are (re)ingested synchronously right before regenerate() runs, so
  // meta.generatedAt doubles as "when the currently-loaded CSVs were loaded".
  function buildLoadedInfo() {
    return el("div", { class: "loadedinfo" }, ["CSVs loaded: " + fmtDate(state.result.meta.generatedAt)]);
  }

  function buildRegToolbar() {
    var search = el("input", { type: "search", placeholder: "Search name, club, email…", value: state.search });
    search.addEventListener("input", function () { state.search = search.value; renderRegBody(); });

    var inShowCb = el("input", { type: "checkbox" }); inShowCb.checked = state.inShowFilter;
    inShowCb.addEventListener("change", function () { state.inShowFilter = inShowCb.checked; renderRegBody(); });
    var judgeCb = el("input", { type: "checkbox" }); judgeCb.checked = state.judgeFilter;
    judgeCb.addEventListener("change", function () { state.judgeFilter = judgeCb.checked; renderRegBody(); });
    var statusGroup = el("span", { class: "statusgroup" }, [
      el("span", { class: "hint" }, ["Status:"])
    ].concat(STATUS_BUCKETS.map(function (b) {
      var cb = el("input", { type: "checkbox" }); cb.checked = state.statusFilter[b.key];
      cb.addEventListener("change", function () { state.statusFilter[b.key] = cb.checked; renderRegBody(); });
      return el("label", {}, [cb, document.createTextNode(" " + b.label)]);
    })).concat([el("label", { title: "Only cars entered in the show (SHW = Yes)" },
      [inShowCb, document.createTextNode(" In Show")])])
      .concat([el("label", { title: "Only registrants who volunteered to judge (CSJ = Yes)" },
      [judgeCb, document.createTextNode(" Judge")])]));

    var prn = el("button", { class: "btn" }, ["🖨 Print"]);
    prn.addEventListener("click", printRegistration);

    var xls = el("button", { class: "btn" }, ["⬇ Excel"]);
    xls.addEventListener("click", exportExcel);

    var delBtn = el("button", { class: "btn", id: "regDeleteBtn", disabled: "disabled" }, ["🗑 Delete"]);
    delBtn.addEventListener("click", openDeleteRegSelectedConfirm);

    var zoomOut = el("button", { class: "btn", title: "Zoom out" }, ["−"]);
    zoomOut.addEventListener("click", function () { setZoom(state.zoom - 0.1); });
    var zoomIn = el("button", { class: "btn", title: "Zoom in" }, ["+"]);
    zoomIn.addEventListener("click", function () { setZoom(state.zoom + 0.1); });
    var zoomFit = el("button", { class: "btn", title: "Shrink just enough to fit every column on screen" }, ["Fit"]);
    zoomFit.addEventListener("click", fitZoom);
    var zoomLabel = el("span", { class: "count", text: Math.round(state.zoom * 100) + "%" });
    var zoomGroup = el("span", { class: "zoomgroup" }, [zoomOut, zoomLabel, zoomIn, zoomFit]);

    var count = el("span", { class: "count", id: "rowcount" });
    return el("div", { class: "toolbar no-print" },
      [search, statusGroup, count, el("span", { class: "spacer" }), zoomGroup, xls, delBtn, prn]);
  }
  function buildSummaryToolbar() {
    var xls = el("button", { class: "btn" }, ["⬇ Excel"]);
    xls.addEventListener("click", exportExcel);
    return el("div", { class: "toolbar no-print" }, [el("span", { class: "spacer" }), xls]);
  }

  // ---------- Excel export ----------
  // The full dataset, not the filtered view: the export stands in for the
  // workbook this app replaced, and that workbook always held everything.
  function exportExcel() {
    if (!state.result || !state.result.ok) return;
    var wb = window.VetteFestExcel.build(ExcelJS, state.result);
    wb.xlsx.writeBuffer().then(function (buf) {
      var blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var url = URL.createObjectURL(blob);
      var a = el("a", { href: url, download: (state.result.meta.title || "VetteFest") + ".xlsx" });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  // ---------- print ----------
  // The on-screen table collapses 12 shirt columns into one summary column
  // and only shows what's currently sorted/searched — printing should still
  // give a complete paper record, so this builds a separate print-only table.
  function clearPrintHost() { var host = $("#printHost"); if (host) host.innerHTML = ""; }

  // Shared logo + centered title header, and a report-date footer, used by
  // every print report below so they all look like one consistent document.
  // Real "Page n of m" numbering isn't something the app can compute —
  // browsers don't expose a total page count to print CSS/JS — so that's left
  // to the browser's own print dialog "Headers and footers" option.
  function buildPrintHeader(title) {
    var headerLogo = $("header.app img.hdr-logo");
    var kids = [];
    if (headerLogo) kids.push(el("img", { src: headerLogo.src, class: "print-logo", alt: "ETCC Logo" }));
    kids.push(el("h2", { text: title }));
    return el("div", { class: "print-report-head" }, kids);
  }
  function buildPrintFooter() {
    return el("div", { class: "print-report-foot", text: "Report Date: " + fmtDate(new Date()) });
  }

  function printRegistration() {
    var host = $("#printHost");
    host.innerHTML = "";
    // Every column except the 12 individual shirt buckets, which are replaced
    // by the same "Shirts" summary column the on-screen table uses.
    var cols = state.result.columns.filter(function (c) { return !isShirtCol(c); });
    var headerLabels = cols.concat(["Shirts"]);
    var thead = el("thead", {}, [el("tr", {}, headerLabels.map(function (c) { return el("th", {}, [c]); }))]);
    var tbody = el("tbody", {}, visibleRows().map(function (r) {
      var cells = cols.map(function (c) {
        var v = CURRENCY_COLS[c] ? fmtMoney(r[c]) : DATE_COLS[c] ? fmtCsvDate(r[c]) : r[c];
        return el("td", {}, [v == null ? "" : String(v)]);
      });
      cells.push(el("td", { class: "shirtsum" }, [shirtSummaryText(r)]));
      return el("tr", {}, cells);
    }));
    host.appendChild(buildPrintHeader(state.result.meta.title));
    host.appendChild(el("table", { class: "grid" }, [thead, tbody]));
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // Base (non-shirt) columns, plus one "Shirts" summary column standing in for
  // the 12 individual buckets (almost always zero) — this is what shrinks the
  // table enough to avoid horizontal scrolling for most rows. The Excel export
  // is unaffected and still lists every bucket, since that detail matters for
  // ordering shirts even though it's noise on screen.
  function visibleColumns() {
    var base = state.result.columns.filter(function (c) { return !isShirtCol(c); });
    base.push(SHIRTS_COL);
    return base;
  }

  function buildRegView() {
    var cols = visibleColumns();
    var thead = el("thead"), htr = el("tr");

    var selectAllCb = el("input", { type: "checkbox", id: "regSelectAll", title: "Select all" });
    selectAllCb.addEventListener("change", function () { toggleSelectAllReg(selectAllCb.checked); });
    htr.appendChild(el("th", { class: "no-print" + pinnedClass(0) }, [selectAllCb]));

    cols.forEach(function (c, idx) {
      var label = c === SHIRTS_COL ? "Shirts" : c;
      var arrow = state.sortCol === c ? (state.sortDir === 1 ? " ▲" : " ▼") : "";
      var th = el("th", { class: (c === SHIRTS_COL ? "shirtsum" : (isNumericCol(c) ? "num" : "")) +
          (NARROW_HEADER_COLS[c] ? " narrow-hdr" : "") + pinnedClass(idx + 1) },
        [label, el("span", { class: "arrow", text: arrow })]);
      if (c === "SHW") th.title = "In the car show";
      if (c === "CSJ") th.title = "Volunteered to be a judge";
      th.addEventListener("click", function () {
        if (state.sortCol === c) state.sortDir = -state.sortDir; else { state.sortCol = c; state.sortDir = 1; }
        renderViews();
      });
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    // zoom goes on the TABLE, never on .tablewrap. `zoom` rescales the
    // element's own lengths, so a zoomed .tablewrap renders its max-height at
    // zoom x the authored value — at the ~60% fit-zoom this picks on a wide
    // screen that silently cut the visible table (and the row count with it)
    // to 60% of what the CSS asked for, differently on every screen width.
    // See updatePinnedOffsets()'s note: this is the same "zoom rescales
    // lengths" trap. .tablewrap.fill (styles.css) is what actually makes the
    // table fill the remaining viewport, on desktop and iPad alike.
    var table = el("table", { class: "grid", style: "zoom:" + state.zoom }, [thead, el("tbody", { id: "regbody" })]);
    var wrap = el("div", { class: "tablewrap fill" }, [table]);
    setTimeout(function () {
      renderRegBody();
      if (!state.zoomAutoFitDone) { state.zoomAutoFitDone = true; fitZoom(); }
    }, 0);
    return wrap;
  }

  // ---------- pinned columns (checkbox + Reg # + names stay visible while scrolling) ----------
  // Each pinned cell is `position: sticky`; every one after the first needs
  // its `left` set to the summed rendered width of the pinned cells before
  // it, or they'd all sit at left:0 and overlap each other.
  var PINNED_COUNT = 4; // checkbox, Reg #, Last Name, First Name(s)
  function pinnedClass(idx) {
    return idx < PINNED_COUNT ? " pinned pin-" + (idx + 1) : "";
  }
  function updatePinnedOffsets() {
    var table = $(".tablewrap table.grid");
    var headRow = table && table.querySelector("thead tr");
    if (!headRow) return;
    // getBoundingClientRect is in post-zoom (visual) px; the `zoom` CSS
    // property re-scales inline-style lengths too, so divide back out or the
    // offset would be applied twice.
    var offset = 0;
    for (var i = 0; i < PINNED_COUNT; i++) {
      var cell = headRow.children[i];
      if (!cell) break;
      var cells = table.querySelectorAll(".pin-" + (i + 1));
      for (var j = 0; j < cells.length; j++) cells[j].style.left = offset + "px";
      offset += cell.getBoundingClientRect().width / state.zoom;
    }
  }

  // ---------- zoom ----------
  function setZoom(z) {
    state.zoom = Math.max(0.3, Math.min(1.5, z));
    renderViews();
  }
  // Measure how wide the table naturally wants to be vs. how much room is
  // actually available, and pick a zoom level that makes every column fit —
  // instead of making the user guess a percentage via the +/− buttons.
  // The zoom lives on the table (see buildRegView), so measure and restore it
  // there — .tablewrap itself is never zoomed.
  function fitZoom() {
    var wrap = $(".tablewrap");
    var table = wrap && wrap.querySelector("table.grid");
    if (!wrap || !table) return;
    var availableWidth = wrap.clientWidth; // the unzoomed scroll container
    var priorZoom = table.style.zoom;
    table.style.zoom = "1"; // measure at true scale, independent of current zoom
    var naturalWidth = table.scrollWidth;
    table.style.zoom = priorZoom;
    if (!naturalWidth) return;
    setZoom(availableWidth / naturalWidth);
  }

  function allRegistrations() {
    return state.result ? state.result.registrations : [];
  }

  // ---------- Registration tab row selection + bulk delete ----------
  function selectedRegKeys() { return Object.keys(state.regSelected); }
  function setRegSelected(key, checked) {
    if (checked) state.regSelected[key] = true; else delete state.regSelected[key];
  }
  function toggleSelectAllReg(checked) {
    visibleRows().forEach(function (r) { setRegSelected(rowKey(r), checked); });
    renderRegBody();
  }
  function openDeleteRegSelectedConfirm() {
    if (!selectedRegKeys().length) return;
    state.deleteRegSelectedOpen = true;
    renderDeleteRegSelectedConfirm();
  }
  function closeDeleteRegSelectedConfirm() { state.deleteRegSelectedOpen = false; renderDeleteRegSelectedConfirm(); }

  // A CSV-derived row has no per-row server record to delete — instead its
  // csvRegKey() is added to state.deletedCsvKeys and persisted to
  // deleted-registrations.json, and regenerate() excludes any matching key
  // from every future parse, including a fresh re-import that still contains
  // the same row.
  function deleteSelectedReg() {
    var keys = selectedRegKeys();
    keys.forEach(function (key) { state.deletedCsvKeys[key] = true; });
    if (keys.length && state.result && state.result.ok) {
      state.result.registrations = state.result.registrations.filter(function (r) {
        return !state.deletedCsvKeys[csvRegKey(r)];
      });
      pushDeletedRegistrationsToServer(keys);
    }
    state.regSelected = {};
    renderViews();
  }
  function pushDeletedRegistrationsToServer(keys) {
    if (!SITE_CONFIG.deletedRegistrationsApiUrl) return;
    fetch(SITE_CONFIG.deletedRegistrationsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", keys: keys })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.regDeleteSyncError = null;
    }).catch(function () {
      state.regDeleteSyncError = "Could not save that deletion to the server — it'll reappear if the page is reloaded before this succeeds. Check your connection and try again.";
      renderViews();
    });
  }
  // Persists a row's detail-modal edit. Fire-and-forget — the local state and
  // table already reflect the edit immediately; a failure here just means it
  // could revert on the next reload if not retried.
  function pushRegistrationOverrideToServer(key, patch) {
    if (!SITE_CONFIG.registrationOverridesApiUrl) return;
    fetch(SITE_CONFIG.registrationOverridesApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", key: key, patch: patch })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.detailEditError = null;
    }).catch(function () {
      state.detailEditError = "Could not save that edit to the server — it'll revert if the page is reloaded before this succeeds. Check your connection and try again.";
      renderViews();
    });
  }
  function pushRegistrationOverrideDeleteToServer(key) {
    if (!SITE_CONFIG.registrationOverridesApiUrl) return;
    fetch(SITE_CONFIG.registrationOverridesApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", key: key })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.detailEditError = null;
    }).catch(function () {
      state.detailEditError = "Could not clear that row's edits on the server — they'll come back if the page is reloaded before this succeeds. Check your connection and try again.";
      renderViews();
    });
  }
  function renderDeleteRegSelectedConfirm() {
    var host = $("#confirmHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.deleteRegSelectedOpen) return;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeDeleteRegSelectedConfirm);
    var count = selectedRegKeys().length;
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: "Delete " + count + " Registration" + (count === 1 ? "" : "s") + "?" }),
      el("span", { class: "spacer" }), closeBtn
    ]);

    var yesBtn = el("button", { class: "btn primary", style: "background:var(--warn);border-color:var(--red-dark)" }, ["Yes, Delete"]);
    yesBtn.addEventListener("click", function () { closeDeleteRegSelectedConfirm(); deleteSelectedReg(); });
    var noBtn = el("button", { class: "btn" }, ["Cancel"]);
    noBtn.addEventListener("click", closeDeleteRegSelectedConfirm);

    var body = el("div", { class: "modal-body" }, [
      el("p", {}, ["This removes the " + count + " selected registration" + (count === 1 ? "" : "s") +
        " from this event going forward — including from a later CSV re-import that still " +
        "contains the same row. Reg numbers are re-sequenced on the next import. This cannot " +
        "be undone from the app."]),
      el("div", { class: "settings-actions" }, [yesBtn, noBtn])
    ]);

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeDeleteRegSelectedConfirm);
    host.appendChild(backdrop);
  }

  function sortedRows() {
    var rows = allRegistrations().slice();
    if (state.sortCol) {
      var c = state.sortCol, dir = state.sortDir;
      if (c === SHIRTS_COL) {
        rows.sort(function (a, b) { return (shirtTotal(a) - shirtTotal(b)) * dir; });
        return rows;
      }
      var num = isNumericCol(c);
      var isDate = !!DATE_COLS[c];
      rows.sort(function (a, b) {
        var av = a[c], bv = b[c];
        if (num) { av = av === "" || av == null ? -Infinity : Number(av); bv = bv === "" || bv == null ? -Infinity : Number(bv); return (av - bv) * dir; }
        if (isDate) {
          var ad = av ? new Date(av).getTime() : NaN, bd = bv ? new Date(bv).getTime() : NaN;
          ad = isNaN(ad) ? -Infinity : ad; bd = isNaN(bd) ? -Infinity : bd;
          return (ad - bd) * dir;
        }
        av = String(av == null ? "" : av).toLowerCase(); bv = String(bv == null ? "" : bv).toLowerCase();
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
      });
    }
    return rows;
  }

  // The exact set of rows currently on screen, in order — shared by the table
  // body, the Summary tab, the reports and the detail modal's Prev/Next, so
  // everything follows the same sort/search state.
  function visibleRows() {
    var cols = visibleColumns();
    var q = state.search.trim().toLowerCase();
    return sortedRows().filter(function (r) {
      // "In Show" and "Judge" answer "which cars/registrants", independent of
      // payment Status — a car entered in the show or a judge volunteer is
      // relevant regardless of whether that registration is Paid/Not
      // Paid/Cancelled/Empty, so these two bypass the Status filter entirely
      // rather than being ANDed with it.
      if (state.inShowFilter || state.judgeFilter) {
        if (state.inShowFilter && String(r[CONFIG.carJudgedColumn]).trim().toLowerCase() !== "yes") return false;
        if (state.judgeFilter && String(r[CONFIG.beAJudgeColumn]).trim().toLowerCase() !== "yes") return false;
      } else if (!state.statusFilter[classifyStatus(r["Status"])]) {
        return false;
      }
      if (!q) return true;
      return cols.some(function (c) {
        var v = c === SHIRTS_COL ? shirtSummaryText(r) : r[c];
        return String(v == null ? "" : v).toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  function renderRegBody() {
    if (state.tab !== "reg") return;
    var body = $("#regbody"); if (!body) return;
    var cols = visibleColumns();
    var rows = visibleRows();
    var frag = document.createDocumentFragment();
    rows.forEach(function (r) {
      var key = rowKey(r);
      var tr = el("tr");
      tr.title = "Click for full details";
      tr.addEventListener("click", function () { openDetail(r); });

      var cb = el("input", { type: "checkbox" });
      cb.checked = !!state.regSelected[key];
      cb.addEventListener("click", function (e) { e.stopPropagation(); });
      cb.addEventListener("change", function () { setRegSelected(key, cb.checked); renderRegBody(); });
      tr.appendChild(el("td", { class: "no-print" + pinnedClass(0) }, [cb]));

      cols.forEach(function (c, idx) {
        var v, cls = "";
        if (c === "Email" && r[c]) {
          var mailLink = el("a", { href: "mailto:" + r[c], text: r[c] });
          mailLink.addEventListener("click", function (e) { e.stopPropagation(); });
          tr.appendChild(el("td", { class: pinnedClass(idx + 1).trim() }, [mailLink]));
          return;
        }
        if (c === SHIRTS_COL) { cls = "shirtsum"; v = shirtSummaryText(r); }
        else if (CURRENCY_COLS[c]) { cls = "num"; v = fmtMoney(r[c]); }
        else if (DATE_COLS[c]) { v = fmtCsvDate(r[c]); }
        else if (c === "Phone") { v = fmtPhone(r[c]); }
        else if (isNumericCol(c)) { cls = "num"; v = r[c]; v = v == null ? "" : v; }
        else { v = r[c]; }
        cls += pinnedClass(idx + 1);
        tr.appendChild(el("td", { class: cls.trim(), text: v == null ? "" : String(v) }));
      });
      frag.appendChild(tr);
    });
    body.innerHTML = "";
    body.appendChild(frag);
    updatePinnedOffsets();
    var rc = $("#rowcount");
    if (rc) rc.textContent = rows.length + " of " + allRegistrations().length + " rows shown";
    var selectAllCb = $("#regSelectAll");
    if (selectAllCb) {
      var visibleKeys = rows.map(rowKey);
      var selectedVisible = visibleKeys.filter(function (k) { return state.regSelected[k]; });
      selectAllCb.checked = visibleKeys.length > 0 && selectedVisible.length === visibleKeys.length;
      selectAllCb.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleKeys.length;
    }
    var delBtn = $("#regDeleteBtn");
    if (delBtn) {
      var n = selectedRegKeys().length;
      delBtn.textContent = "🗑 Delete" + (n ? " (" + n + ")" : "");
      if (n) delBtn.removeAttribute("disabled"); else delBtn.setAttribute("disabled", "disabled");
    }
  }

  // ---------- detail modal ----------
  // Click any row to see every field for that one registration without
  // scrolling — grouped into readable sections instead of the table's 30+
  // side-by-side columns.
  var DETAIL_SECTIONS = [
    { title: "Registration", cols: ["Reg Date", "Reg Type", "#", "Status", "Total Fee", "Payment Type", "Check #"] },
    { title: "Contact", cols: ["Phone", "Email", "Address", "City", "State", "Zip"] },
    { title: "Corvette", cols: ["Year", "Gen", "Model", "Color", "SHW", "CSJ"] }
  ];
  // Reg #, Reg Date, Reg Type and Gen are deliberately excluded: all four are
  // system/derived values. Gen recomputes automatically if Year changes (see
  // applyRecordPatch); Reg Type comes from the admission the registrant
  // actually bought, and "#" is editable right next to it for the cases where
  // an officer needs to correct a head count. Shirts stay read-only too — a
  // 12-bucket editor is a separate, bigger task than these plain fields.
  var EDITABLE_FIELDS = {
    "Last Name": 1, "First Name(s)": 1, "Club Name": 1, "#": 1,
    "Status": 1, "Total Fee": 1, "Payment Type": 1, "Check #": 1,
    "Phone": 1, "Email": 1, "Address": 1, "City": 1, "State": 1, "Zip": 1,
    "Year": 1, "Model": 1, "Color": 1, "SHW": 1, "CSJ": 1
  };
  var INT_EDIT_FIELDS = { "#": 1, "Year": 1 };
  var NUM_EDIT_FIELDS = { "Total Fee": 1 };
  var YES_NO_FIELDS = { "SHW": 1, "CSJ": 1 };

  function openDetail(row) { state.detailRow = row; state.detailEditError = null; renderDetailModal(); }
  function closeDetail() { state.detailRow = null; state.detailEditError = null; renderDetailModal(); }
  function stepDetail(dir) {
    var list = visibleRows(), i = list.indexOf(state.detailRow);
    if (i === -1) return;
    var next = list[i + dir];
    if (next) { state.detailRow = next; state.detailEditError = null; renderDetailModal(); }
  }

  // Builds one <li> for column c — always editable for EDITABLE_FIELDS,
  // read-only otherwise. Registers editable inputs on fieldEls so
  // saveDetailEdit() can read every field back out at Save time.
  function detailFieldItem(r, c, fieldEls) {
    if (EDITABLE_FIELDS[c]) {
      var input;
      if (YES_NO_FIELDS[c]) {
        input = el("select", {});
        ["No", "Yes"].forEach(function (v) {
          var o = el("option", { value: v, text: v });
          if (String(r[c]) === v) o.setAttribute("selected", "selected");
          input.appendChild(o);
        });
      } else if (c === "Payment Type") {
        var currentPT = r[c] == null ? "" : String(r[c]);
        input = el("select", {});
        [["", "— none —"], ["Cash", "Cash"], ["Check", "Check"], ["Credit Card", "Credit Card"]].forEach(function (pair) {
          var o = el("option", { value: pair[0], text: pair[1] });
          if (pair[0] === currentPT) o.setAttribute("selected", "selected");
          input.appendChild(o);
        });
      } else if (c === "Status") {
        var current = r[c] == null ? "" : String(r[c]);
        // "Not paid in time limit" is ClubExpress's own wording and shows up
        // verbatim in real exports — offered here so re-selecting it after an
        // edit doesn't quietly rewrite it to something else.
        var opts = ["Paid", "Not Paid", "Not paid in time limit", "Cancelled"];
        if (current && opts.indexOf(current) === -1) opts.unshift(current);
        input = el("select", {});
        opts.forEach(function (v) {
          var o = el("option", { value: v, text: v });
          if (v === current) o.setAttribute("selected", "selected");
          input.appendChild(o);
        });
      } else if (NUM_EDIT_FIELDS[c]) {
        var moneyField = moneyInput({ type: "text", value: r[c] == null ? "" : String(r[c]) });
        fieldEls[c] = moneyField.input;
        return li(c, "", moneyField.wrap);
      } else {
        input = el("input", { type: "text", value: r[c] == null ? "" : String(r[c]) });
      }
      fieldEls[c] = input;
      return li(c, "", input);
    }
    var v = CURRENCY_COLS[c] ? fmtMoney(r[c]) : DATE_COLS[c] ? fmtCsvDate(r[c]) : r[c];
    return li(c, v == null || v === "" ? "—" : String(v));
  }

  // targetRow is the record these fieldEls were rendered for, captured at
  // render time — NOT re-read from state.detailRow when the save actually
  // fires. The autosave below is debounced 1500ms, so a Prev/Next step (or a
  // close) can land first; resolving the row late would write the record the
  // user had been editing on top of whichever one is selected when the timer
  // fires. Since the patch carries every editable field, that would silently
  // overwrite a whole registration with another's data.
  function saveDetailEdit(fieldEls, targetRow) {
    var r = targetRow || state.detailRow;
    if (!r) return;
    var patch = {};
    Object.keys(EDITABLE_FIELDS).forEach(function (c) {
      var input = fieldEls[c];
      if (!input) return;
      var raw = input.value;
      if (INT_EDIT_FIELDS[c]) patch[c] = LOGIC.toInt(raw);
      else if (NUM_EDIT_FIELDS[c]) patch[c] = LOGIC.toNum(raw);
      else patch[c] = raw.trim();
    });

    // The row has no per-row server record of its own, so persist just the
    // patch, keyed by the row's stable identity (see csvRegKey/regenerate()).
    var key = csvRegKey(r);
    state.csvOverrides[key] = patch;
    pushRegistrationOverrideToServer(key, patch);
    var merged = applyRecordPatch(r, patch);
    if (state.result && state.result.ok) {
      state.result.registrations = state.result.registrations.map(function (row) {
        return csvRegKey(row) === key ? merged : row;
      });
    }
    // Only re-point/redraw the modal when it's still showing the row we just
    // saved — a late autosave for a row the user has already stepped away
    // from must persist, but must not yank the modal back to it.
    if (state.detailRow === r) {
      state.detailRow = merged;
      renderDetailModal();
    }
    if (state.tab === "reg") renderRegBody();
  }

  // Throws away every stored edit for this row and rebuilds it from the CSV.
  function revertDetailOverride() {
    var r = state.detailRow;
    if (!r) return;
    var key = csvRegKey(r);
    delete state.csvOverrides[key];
    pushRegistrationOverrideDeleteToServer(key);
    closeDetail();
    // Preserve the existing "CSVs loaded:" stamp — this is a re-derive of
    // already-loaded data, not a fresh import.
    regenerate(state.result && state.result.meta ? state.result.meta.generatedAt : null);
  }

  function deleteDetailRow() {
    var r = state.detailRow;
    if (!r) return;
    var key = csvRegKey(r);
    state.deletedCsvKeys[key] = true;
    pushDeletedRegistrationsToServer([key]);
    if (state.result && state.result.ok) {
      state.result.registrations = state.result.registrations.filter(function (row) {
        return !state.deletedCsvKeys[csvRegKey(row)];
      });
    }
    closeDetail();
    renderViews();
  }

  function renderDetailModal() {
    var host = $("#detailHost");
    if (!host) return;
    host.innerHTML = "";
    var r = state.detailRow;
    if (!r) return;
    var list = visibleRows(), i = list.indexOf(r);
    var fieldEls = {};

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeDetail);
    var prevBtn = el("button", { class: "btn" }, ["‹ Prev"]);
    if (i <= 0) prevBtn.setAttribute("disabled", "disabled");
    prevBtn.addEventListener("click", function () { stepDetail(-1); });
    var nextBtn = el("button", { class: "btn" }, ["Next ›"]);
    if (i === -1 || i >= list.length - 1) nextBtn.setAttribute("disabled", "disabled");
    nextBtn.addEventListener("click", function () { stepDetail(1); });

    var name = (r["Last Name"] || "") + (r["First Name(s)"] ? ", " + r["First Name(s)"] : "");
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: (r["Reg #"] ? r["Reg #"] + "  " : "") + (name || "Registration") }),
      el("span", { class: "count", text: i > -1 ? (i + 1) + " of " + list.length : "" }),
      prevBtn, nextBtn, closeBtn
    ]);

    var body = el("div", { class: "modal-body" }, [
      el("ul", { class: "meta-list" }, [
        li("Reg #", r["Reg #"] || "—"),
        detailFieldItem(r, "Last Name", fieldEls),
        detailFieldItem(r, "First Name(s)", fieldEls),
        detailFieldItem(r, "Club Name", fieldEls)
      ])
    ]);
    DETAIL_SECTIONS.forEach(function (sec) {
      var cols = sec.cols.filter(function (c) { return state.result.columns.indexOf(c) !== -1; });
      var items = cols.map(function (c) { return detailFieldItem(r, c, fieldEls); });
      if (items.length) body.appendChild(el("div", { class: "modal-section" },
        [el("h4", { text: sec.title }), el("ul", { class: "meta-list" }, items)]));
    });

    var parts = shirtSummaryParts(r);
    var shirtItems = parts.length ? parts.map(function (p) { return li(p.label, String(p.qty)); })
      : [el("li", { class: "hint", text: "No shirts on this registration." })];
    body.appendChild(el("div", { class: "modal-section" },
      [el("h4", { text: "Shirts" }), el("ul", { class: "meta-list" }, shirtItems)]));

    var autoSaveDetail = debounce(function () { saveDetailEdit(fieldEls, r); }, 1500);
    Object.keys(fieldEls).forEach(function (key) {
      fieldEls[key].addEventListener("input", autoSaveDetail);
      fieldEls[key].addEventListener("change", autoSaveDetail);
    });

    var saveBtn = el("button", { class: "btn primary" }, ["Save"]);
    saveBtn.addEventListener("click", function () { saveDetailEdit(fieldEls, r); });
    var cancelBtn = el("button", { class: "btn" }, ["Cancel"]);
    cancelBtn.addEventListener("click", closeDetail);
    var actions = [saveBtn, cancelBtn];
    // Only meaningful for a row that actually has stored edits.
    if (state.csvOverrides[csvRegKey(r)]) {
      var revertBtn = el("button", { class: "btn" }, ["Revert to CSV"]);
      revertBtn.addEventListener("click", revertDetailOverride);
      actions.push(revertBtn);
    }
    var delBtn = el("button", { class: "btn", style: "color:var(--warn)" }, ["Delete"]);
    delBtn.addEventListener("click", deleteDetailRow);
    actions.push(delBtn);
    // Actions live directly under the header and scroll-pin with it, so Save /
    // Revert / Delete stay reachable on a long record without scrolling to the
    // bottom. The error sits in the same pinned block, next to the buttons that
    // cause it.
    var actionBar = el("div", { class: "detail-actions" }, [el("div", { class: "settings-actions" }, actions)]);
    if (state.detailEditError) actionBar.appendChild(el("div", { class: "form-error" }, [state.detailEditError]));
    var pinned = el("div", { class: "modal-pinned" }, [head, actionBar]);

    var modal = el("div", { class: "modal" }, [pinned, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeDetail);
    host.appendChild(backdrop);
  }

  // ---------- summary ----------
  // Laid out to mirror the workbook's SummarySheet section for section
  // (Registration / Shirts / Car Show / Clubs). Always computed from the full
  // dataset, independent of the Registration tab's search/status/In Show/
  // Judge filters — those narrow what an officer is looking at over there,
  // not what actually happened at the event.
  function buildSummaryView() {
    var s = LOGIC.summarizeRecords(allRegistrations(), CONFIG);
    var m = state.result.meta;
    var container = el("div", { class: "view" });

    var statusCls = m.errorCount === 0 ? "status good" : "status warn";
    container.appendChild(el("div", { class: "panel" }, [
      el("h3", { text: m.title }),
      el("ul", { class: "meta-list" }, [
        li("Generated", fmtDate(m.generatedAt) + "  —  ", el("span", { class: statusCls, text: m.statusMessage })),
        li("Registration file", m.regFileName + "  (" + m.regRows + " rows)"),
        li("Activity file", m.actFileName ? m.actFileName + "  (" + m.actRows + " rows)" : "— none loaded —"),
        li("Registrations", String(s.registrations))
      ])
    ]));

    // The workbook's three headline figures, in its order.
    container.appendChild(el("div", { class: "cards" }, [
      card("Attendees", s.attendees),
      card("Registrations", s.registrations),
      card("Funds", fmtMoney(s.funds))
    ]));

    container.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "cards stat-cards" }, [
        el("div", { class: "stat-card" }, [
          el("div", { class: "stat-card-head", text: "Shirts" }),
          shirtMatrix(s.shirtTotals)
        ]),
        el("div", { class: "stat-card" }, [
          el("div", { class: "stat-card-head", text: "Admissions" }),
          admissionMatrix(s)
        ])
      ])
    ]));

    var clubRows = s.clubs.map(function (c) {
      return el("tr", {}, [el("td", { class: "lbl", text: c.name }), el("td", { text: String(c.attendees) })]);
    });
    container.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "cards stat-cards" }, [
        el("div", { class: "stat-card" }, [
          el("div", { class: "stat-card-head", text: "Car Show" }),
          el("div", { style: "margin-bottom:8px" }, ["Judges volunteering: " + s.judges]),
          genMatrix(s)
        ]),
        el("div", { class: "stat-card" }, [
          el("div", { class: "stat-card-head", text: "Clubs" }),
          el("table", { class: "matrix" }, [
            el("thead", {}, [el("tr", {}, [el("th", { class: "lbl", text: "Club" }), el("th", { text: "Attendees" })])]),
            el("tbody", {}, clubRows)
          ])
        ])
      ])
    ]));

    if (state.result.messages.length) {
      container.appendChild(el("div", { class: "panel" }, [
        el("h3", { text: "Messages (" + state.result.messages.length + ")" }),
        el("ul", { class: "messages" }, state.result.messages.map(function (x) { return el("li", { text: x }); }))
      ]));
    }
    return container;
  }
  function li(k, v, extra) {
    var kids = [el("span", { class: "k", text: k }), document.createTextNode(v)];
    if (extra) kids.push(extra);
    return el("li", {}, kids);
  }
  function card(k, v) { return el("div", { class: "card" }, [el("div", { class: "k", text: k }), el("div", { class: "v", text: String(v) })]); }

  // Size × Free/Xtra, with a row-wise Total column and a column-wise Total
  // footer row. Shared by the Summary tab, the T-Shirts tab and the printed
  // Summary report, so all three present the same figures the same way.
  function shirtMatrix(totals) {
    var C = CONFIG;
    var head = el("tr", {}, [el("th", { class: "lbl", text: "Size" })].concat(
      C.GROUPS.map(function (g) { return el("th", { text: g.label }); })
    ).concat([el("th", { text: "Total" })]));

    var colTotals = C.GROUPS.map(function () { return 0; });
    var grand = 0;
    var bodyRows = C.SIZES.map(function (sz) {
      var rowTotal = 0;
      var cells = [el("td", { class: "lbl", text: sz.label })];
      C.GROUPS.forEach(function (g, i) {
        var v = totals[g.key + sz.key] || 0;
        colTotals[i] += v;
        rowTotal += v;
        cells.push(el("td", { class: v ? "" : "z", text: String(v) }));
      });
      grand += rowTotal;
      cells.push(el("td", { class: rowTotal ? "" : "z", text: String(rowTotal) }));
      return el("tr", {}, cells);
    });
    var footCells = [el("td", { class: "lbl", text: "Total" })];
    colTotals.forEach(function (t) { footCells.push(el("td", { style: "font-weight:600", text: String(t) })); });
    footCells.push(el("td", { style: "font-weight:600", text: String(grand) }));
    bodyRows.push(el("tr", {}, footCells));

    return el("table", { class: "matrix" }, [el("thead", {}, [head]), el("tbody", {}, bodyRows)]);
  }

  // Which admission each registration bought, and what it brought in — the
  // breakdown behind the Attendees and Funds cards above.
  function admissionMatrix(s) {
    var head = el("tr", {}, [
      el("th", { class: "lbl", text: "Admission" }), el("th", { text: "Fee" }),
      el("th", { text: "Count" }), el("th", { text: "Attendees" })
    ]);
    var totalCount = 0, totalAttendees = 0;
    var rows = s.admissions.map(function (a) {
      var attendees = a.count * a.attendees;
      totalCount += a.count;
      totalAttendees += attendees;
      return el("tr", {}, [
        el("td", { class: "lbl", text: a.title }),
        el("td", { text: fmtMoney(a.fee) }),
        el("td", { class: a.count ? "" : "z", text: String(a.count) }),
        el("td", { class: attendees ? "" : "z", text: String(attendees) })
      ]);
    });
    rows.push(el("tr", {}, [
      el("td", { class: "lbl", text: "Total" }),
      el("td", { text: "" }),
      el("td", { style: "font-weight:600", text: String(totalCount) }),
      el("td", { style: "font-weight:600", text: String(totalAttendees) })
    ]));
    return el("table", { class: "matrix" }, [el("thead", {}, [head]), el("tbody", {}, rows)]);
  }

  function genMatrix(s) {
    var head = el("tr", {}, [
      el("th", { class: "lbl", text: "Generation" }), el("th", { text: "Years" }),
      el("th", { text: "At Event" }), el("th", { text: "In Car Show" })
    ]);
    var totalAtEvent = 0, totalInCarShow = 0;
    var body = s.gens.map(function (g) {
      totalAtEvent += g.atEvent;
      totalInCarShow += g.inCarShow;
      return el("tr", {}, [
        el("td", { class: "lbl", text: g.gen }),
        el("td", { text: g.from + "–" + g.to }),
        el("td", { class: g.atEvent ? "" : "z", text: String(g.atEvent) }),
        el("td", { class: g.inCarShow ? "" : "z", text: String(g.inCarShow) })
      ]);
    });
    body.push(el("tr", {}, [
      el("td", { class: "lbl", text: "Total" }),
      el("td", { text: "" }),
      el("td", { style: "font-weight:600", text: String(totalAtEvent) }),
      el("td", { style: "font-weight:600", text: String(totalInCarShow) })
    ]));
    return el("table", { class: "matrix" }, [el("thead", {}, [head]), el("tbody", {}, body)]);
  }

  // ---------- T-Shirts tab ----------
  // Shirt totals scoped to registrations whose Status classifies as "paid" —
  // shared by the on-screen "needed for the event" matrix and the order
  // email, so both agree on what "how many shirts do we actually order"
  // means: don't count someone who never completed payment. Deliberately NOT
  // filtered by the Registration tab's own status checkboxes, which default
  // to showing everything.
  function paidShirtTotals() {
    var paidRows = allRegistrations().filter(function (r) { return classifyStatus(r["Status"]) === "paid"; });
    return LOGIC.summarizeRecords(paidRows, CONFIG).shirtTotals;
  }

  // Plain text (not HTML) — vettefest_send_mail() only sends text/plain, and
  // a plain-text preview is trivially exact: what's shown is byte-for-byte
  // what gets sent, with no separate HTML-rendering path to drift from it.
  function buildTshirtOrderEmailBody() {
    var totals = paidShirtTotals();
    var title = state.result && state.result.ok ? state.result.meta.title : CONFIG.title;
    var lines = [title.replace(/ Registration List$/, "") + " — T-Shirt Order", ""];
    lines.push("SHIRT COUNTS (paid registrations, by size)");
    var grand = 0;
    CONFIG.SIZES.forEach(function (sz) {
      var parts = CONFIG.GROUPS.map(function (g) {
        var v = totals[g.key + sz.key] || 0;
        grand += v;
        return g.label + ": " + v;
      });
      var rowTotal = CONFIG.GROUPS.reduce(function (sum, g) { return sum + (totals[g.key + sz.key] || 0); }, 0);
      lines.push("  " + sz.label + " — " + parts.join(", ") + "  (total " + rowTotal + ")");
    });
    lines.push("");
    lines.push("TOTAL SHIRTS: " + grand);
    return lines.join("\n");
  }

  function sendTshirtOrderEmail() {
    if (!SITE_CONFIG.sendTshirtOrderEmailApiUrl) return;
    if (!state.emailTo) {
      state.emailSendError = "No recipient set — type a To address, or add one in Developer > Settings first.";
      renderTshirtOrderPage();
      return;
    }
    state.emailSending = true;
    state.emailSendError = null;
    state.emailSent = false;
    renderTshirtOrderPage();
    fetch(SITE_CONFIG.sendTshirtOrderEmailApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: state.emailTo, subject: state.emailSubject, body: state.emailBody, cc: state.emailCc, bcc: state.emailBcc })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.emailSending = false;
        if (r.ok && r.data && r.data.ok) state.emailSent = true;
        else state.emailSendError = (r.data && r.data.error) || "Send failed.";
        renderTshirtOrderPage();
      })
      .catch(function () {
        state.emailSending = false;
        state.emailSendError = "Could not send — check your connection and try again.";
        renderTshirtOrderPage();
      });
  }

  function buildTshirtView() {
    var wrap = el("div", { class: "view tshirt-view" });

    if (state.result && state.result.ok) {
      wrap.appendChild(el("div", { class: "panel" }, [
        el("div", { class: "cards stat-cards" }, [
          el("div", { class: "stat-card" }, [
            el("div", { class: "stat-card-head", text: "Shirts Needed For Event" }),
            el("div", { style: "font-size:11px; color:var(--muted); margin:-6px 0 8px",
              text: "Paid registrations only — ignores the Registration tab's status filters" }),
            shirtMatrix(paidShirtTotals())
          ])
        ])
      ]));
    } else {
      wrap.appendChild(el("div", { class: "empty-state" },
        ["No registration data loaded yet — import a CSV pair to see shirt counts."]));
    }

    var orderBtn = el("button", { class: "btn primary" }, ["📧 T-Shirt Order Form"]);
    orderBtn.addEventListener("click", openTshirtOrderPage);
    var reportBtn = el("button", { class: "btn" }, ["📊 T-Shirt Report"]);
    reportBtn.addEventListener("click", printTshirtReport);
    wrap.appendChild(el("div", { class: "panel" }, [
      el("div", { class: "settings-actions" }, [orderBtn, reportBtn])
    ]));

    return wrap;
  }

  function printTshirtReport() {
    if (!state.result || !state.result.ok) return;
    var host = $("#printHost");
    host.innerHTML = "";

    var paidRecs = allRegistrations().filter(function (r) {
      return classifyStatus(r["Status"]) === "paid" && shirtTotal(r) > 0;
    }).sort(function (a, b) {
      var aLast = String(a["Last Name"] || "").toLowerCase();
      var bLast = String(b["Last Name"] || "").toLowerCase();
      if (aLast !== bLast) return aLast < bLast ? -1 : 1;
      var aFirst = String(a["First Name(s)"] || "").toLowerCase();
      var bFirst = String(b["First Name(s)"] || "").toLowerCase();
      return aFirst < bFirst ? -1 : aFirst > bFirst ? 1 : 0;
    });
    var rows = paidRecs.map(function (r) {
      return el("tr", {}, [
        el("td", { text: r["Reg #"] || "—" }),
        el("td", { text: r["Last Name"] || "—" }),
        el("td", { text: r["First Name(s)"] || "—" }),
        el("td", { text: shirtSummaryText(r) || "—" })
      ]);
    });

    host.appendChild(buildPrintHeader("T-Shirt Report"));
    host.appendChild(el("table", { class: "grid report-table centered-report-table" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "Reg #" }), el("th", { text: "Last Name" }),
        el("th", { text: "First Name(s)" }), el("th", { text: "Shirts" })
      ])]),
      el("tbody", {}, rows)
    ]));
    host.appendChild(el("div", { class: "panel", style: "margin-top:14px; max-width:420px" }, [
      el("div", { class: "stat-card-head", text: "Totals" }),
      shirtMatrix(paidShirtTotals())
    ]));
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // ---------- Page banner helper (shared by all full-page overlays) ----------
  // Single-line banner: Back button + logo on the left, "Vette Fest Manager"
  // (plus an optional pageTitle sub-line naming the specific screen) centered
  // — grid layout so the title stays centered regardless of the left
  // content's width. printCallback is optional; when given, a "🖨 Print"
  // button appears in the banner's upper-right corner.
  function buildPageBanner(closeCallback, pageTitle, printCallback) {
    var headerLogo = $("header.app img.hdr-logo");
    var logoImg = headerLogo ? el("img", { src: headerLogo.src, style: "height:40px" }) : null;
    var leftKids = [];
    if (closeCallback) {
      var closeBtn = el("button", { class: "btn" }, ["← Back"]);
      closeBtn.addEventListener("click", closeCallback);
      leftKids.push(closeBtn);
    }
    if (logoImg) leftKids.push(logoImg);
    var centerKids = [el("h2", { text: "Vette Fest Manager", style: "margin: 0" })];
    if (pageTitle) centerKids.push(el("h3", { text: pageTitle, style: "margin: 4px 0 0; color: var(--muted); font-weight: 600" }));
    var rightKids = [];
    if (printCallback) {
      var printBtn = el("button", { class: "btn" }, ["🖨 Print"]);
      printBtn.addEventListener("click", printCallback);
      rightKids.push(printBtn);
    }
    return el("div", { class: "api-page-head", style: "display: grid; grid-template-columns: 1fr auto 1fr; align-items: center" }, [
      el("div", { style: "display: flex; align-items: center; gap: 10px; justify-self: start" }, leftKids),
      el("div", { style: "justify-self: center; text-align: center" }, centerKids),
      el("div", { style: "justify-self: end" }, rightKids)
    ]);
  }

  // ---------- T-Shirt Order Form (full-page screen) ----------
  function openTshirtOrderPage() {
    if (!state.emailTo) state.emailTo = state.appSettings.tshirtVendorEmail || "";
    if (!state.emailSubject) state.emailSubject = state.appSettings.tshirtOrderSubject || "ETCC Vette Fest — T-Shirt Order";
    if (!state.emailBody) state.emailBody = buildTshirtOrderEmailBody();
    state.tshirtOrderPageOpen = true;
    renderTshirtOrderPage();
  }
  function closeTshirtOrderPage() { state.tshirtOrderPageOpen = false; renderTshirtOrderPage(); }

  function renderTshirtOrderPage() {
    var host = $("#tshirtOrderHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.tshirtOrderPageOpen) return;

    var head = buildPageBanner(closeTshirtOrderPage, "T-Shirt Order Form");
    var body = el("div", { class: "api-page-inner" });

    var toInput = el("input", { type: "text", value: state.emailTo || "", placeholder: "email@example.com" });
    toInput.addEventListener("input", function () { state.emailTo = toInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "To" }), toInput]));
    if (!state.emailTo) {
      body.appendChild(el("div", { class: "form-error", text: "No Vendor Email set — add one in Developer > Settings > T-Shirt Vendor, or type a recipient above." }));
    }

    var subjectInput = el("input", { type: "text", value: state.emailSubject || "" });
    subjectInput.addEventListener("input", function () { state.emailSubject = subjectInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Subject" }), subjectInput]));

    var ccInput = el("input", { type: "text", value: state.emailCc || "", placeholder: "email@example.com" });
    ccInput.addEventListener("input", function () { state.emailCc = ccInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "CC" }), ccInput]));

    var bccInput = el("input", { type: "text", value: state.emailBcc || "", placeholder: "email@example.com" });
    bccInput.addEventListener("input", function () { state.emailBcc = bccInput.value; });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "BCC" }), bccInput]));

    var rebuildBtn = el("button", { class: "btn" }, ["↻ Rebuild from current data"]);
    rebuildBtn.addEventListener("click", function () {
      state.emailBody = buildTshirtOrderEmailBody();
      renderTshirtOrderPage();
    });

    var bodyTextarea = el("textarea", { rows: "24", style: "width:100%; font-family:monospace; font-size:13px; padding:8px; border:1px solid #ccc; resize:vertical" });
    bodyTextarea.value = state.emailBody || "";
    bodyTextarea.addEventListener("input", function () { state.emailBody = bodyTextarea.value; });
    body.appendChild(el("div", { class: "form-group" }, [
      el("label", { text: "Message Body (editable):" }),
      bodyTextarea,
      el("div", { class: "settings-actions" }, [rebuildBtn])
    ]));

    var sendBtn = el("button", { class: "btn primary" }, [state.emailSending ? "Sending…" : "Send"]);
    if (state.emailSending || !state.emailTo) sendBtn.setAttribute("disabled", "disabled");
    sendBtn.addEventListener("click", sendTshirtOrderEmail);
    var actionRow = el("div", { class: "settings-actions" }, [sendBtn]);
    if (state.emailSent) actionRow.appendChild(el("div", { class: "test-summary good", text: "Sent!" }));
    if (state.emailSendError) actionRow.appendChild(el("div", { class: "form-error", text: state.emailSendError }));
    body.appendChild(actionRow);

    var page = el("div", { class: "api-page" }, [head, el("div", { class: "api-page-body" }, [body])]);
    host.appendChild(page);
  }

  // ---------- Reports tab ----------
  // A launcher straight into print preview — no intermediate on-screen page,
  // each button just builds its report into #printHost and calls
  // window.print() directly.
  function buildReportsView() {
    var summaryBtn = el("button", { class: "btn" }, ["📊 Vette Fest Summary Report"]);
    summaryBtn.addEventListener("click", printSummaryReport);
    var regBtn = el("button", { class: "btn" }, ["📋 Registration Report"]);
    regBtn.addEventListener("click", printRegistrationReport);
    var showBtn = el("button", { class: "btn" }, ["🏁 Car Show Report"]);
    showBtn.addEventListener("click", printCarShowReport);
    var tshirtBtn = el("button", { class: "btn" }, ["👕 T-Shirt Report"]);
    tshirtBtn.addEventListener("click", printTshirtReport);
    var flyerBtn = el("button", { class: "btn" }, ["🖼️ Print Flyer"]);
    if (!state.flyer || !state.flyer.exists) flyerBtn.setAttribute("disabled", "disabled");
    flyerBtn.addEventListener("click", printFlyer);
    var buttonCol = el("div", { class: "settings-actions", style: "flex-direction: column; align-items: flex-start" },
      [summaryBtn, regBtn, showBtn, tshirtBtn, flyerBtn]);
    var row = el("div", { class: "reports-row" }, []);
    if (window.__vettefestReportsBanner) {
      row.appendChild(el("img", { src: window.__vettefestReportsBanner, class: "reports-banner", alt: "Reports" }));
    }
    row.appendChild(buttonCol);
    return el("div", { class: "view reports-view" }, [
      el("div", { class: "panel" }, [el("h3", { text: "Reports" }), row])
    ]);
  }

  // ---------- Setup tab ----------
  // The "load data into this event" actions plus the import automation,
  // mirroring the sibling CarShow app's Setup tab:
  //   - Import Flyer — the event's marketing flyer (image or PDF), uploaded
  //     straight to flyer.php here and then printable from the Reports tab.
  //   - Import Schedule — the ClubExpress Event URL, an "Import Now" button,
  //     the auto-import schedule, and the archived run logs. The by-hand
  //     registrations-import.php upload form used to be linked here too (a
  //     "Manual" subsection) but was removed at the user's request — Import
  //     Now covers that case now. The page itself is untouched and still
  //     reachable directly if anyone bookmarked it.
  // Every server endpoint here is session-gated (you're already logged in to
  // see this), so the tab itself carries no extra password.

  function buildSetupView() {
    var wrap = el("div", { class: "view setup-view" });

    // --- Import Flyer ---
    var flyerPanel = el("div", { class: "panel" }, [el("h3", { text: "Import Flyer" })]);
    flyerPanel.appendChild(el("div", { class: "hint", style: "margin-bottom:10px" },
      ["Upload the event flyer (JPG, PNG, GIF, WebP or PDF, up to 12 MB). Once uploaded it can be printed " +
       "from the Reports tab."]));

    if (state.flyer && state.flyer.exists) {
      var current = el("div", { class: "hint", style: "margin-bottom:10px" }, [
        "Current flyer: " + (state.flyer.name || "flyer") +
        (state.flyer.uploadedAt ? " — uploaded " + fmtDate(state.flyer.uploadedAt) : "") + ". ",
        el("a", { href: SITE_CONFIG.flyerApiUrl || "#", target: "_blank", rel: "noopener" }, ["View current flyer"])
      ]);
      flyerPanel.appendChild(current);
    } else {
      flyerPanel.appendChild(el("div", { class: "hint", style: "margin-bottom:10px" },
        ["No flyer has been uploaded for this event yet."]));
    }

    var fileInput = el("input", { type: "file", accept: "image/jpeg,image/png,image/gif,image/webp,application/pdf" });
    var uploadBtn = el("button", { class: "btn primary" }, [state.flyerUploading ? "Uploading…" : "⬆ Upload Flyer"]);
    if (state.flyerUploading) uploadBtn.setAttribute("disabled", "disabled");
    uploadBtn.addEventListener("click", function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) { state.flyerError = "Choose a file first."; renderViews(); return; }
      uploadFlyer(f);
    });
    flyerPanel.appendChild(el("div", { class: "form-row" }, [fileInput]));
    flyerPanel.appendChild(el("div", { class: "settings-actions" }, [uploadBtn]));
    if (state.flyerError) {
      flyerPanel.appendChild(el("div", { class: "form-error", text: state.flyerError }));
    }
    wrap.appendChild(flyerPanel);

    wrap.appendChild(buildImportScheduleSection());
    wrap.appendChild(buildBackupsSection());
    return wrap;
  }

  // Setup tab > Backups — "Backup Now" (backup.php action=run, synchronous —
  // see requestBackupNow() above) plus a permanent, color-coded log of every
  // run (green = success, red = failure), same row-coloring idea as
  // .test-list li.pass/.fail in styles.css. Distinct from the Import
  // Schedule's own log-of-sync-runs above: this is the app's *data*
  // (registrations, overrides, app settings, the flyer, etc. — see
  // backup.php's own header comment) being snapshotted, not ClubExpress
  // imports.
  function buildBackupsSection() {
    var runBtn = el("button", { type: "button", class: "btn primary" }, ["💾 Backup Now"]);
    if (state.backupRunning) runBtn.setAttribute("disabled", "disabled");
    runBtn.addEventListener("click", requestBackupNow);
    var runRow = el("div", { style: "display:flex; align-items:center; gap:10px" }, [runBtn]);
    if (state.backupRunStatus) {
      var isFailed = state.backupRunStatus.indexOf("Failed") === 0;
      var isSucceeded = state.backupRunStatus.indexOf("Succeeded") === 0;
      var statusStyle = isFailed ? "color:var(--warn)" : (isSucceeded ? "color:var(--good)" : "");
      runRow.appendChild(el("span", { class: "count", style: statusStyle }, [state.backupRunStatus]));
    }

    var toggleBtn = el("button", { type: "button", class: "btn", style: "font-size:12px; padding:4px 10px" },
      [state.backupsPanelOpen ? "▲ Hide Logs" : "📂 View Logs"]);
    toggleBtn.addEventListener("click", toggleBackupsPanel);

    var kids = [
      el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "" }), runRow]),
      el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: "Backup Log" }),
        el("div", {}, [toggleBtn])
      ])
    ];

    if (state.backupsPanelOpen) {
      if (state.backupsLoading) {
        kids.push(el("div", { class: "hint" }, ["Loading…"]));
      } else if (state.backupsError) {
        kids.push(el("div", { class: "form-error" }, [state.backupsError]));
      } else if (state.backupsList && state.backupsList.length) {
        var rows = state.backupsList.slice().reverse();
        kids.push(el("table", { class: "grid", style: "margin-top:8px" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { text: "Run" }), el("th", { text: "Trigger" }), el("th", { text: "Status" }), el("th", { text: "Details" }), el("th", { text: "" })
          ])]),
          el("tbody", {}, rows.map(function (r) {
            var ok = r.status === "success";
            var rowClass = ok ? "backup-row-ok" : "backup-row-fail";
            var triggerLabel = r.reason === "auto" ? "Auto" : r.reason === "restore" ? "Restore" : r.reason === "pre-restore" ? "Pre-Restore" : "Manual";
            var details;
            if (r.reason === "restore") {
              // A restore row's own "backup file" is the source it restored
              // FROM, which may since have been purged — no download/restore
              // link for the row itself, just a record of what happened.
              var scopeLabel = (r.scope && r.scope !== "all") ? (" [event: " + (r.scopeName || r.scope) + "]") : " [everything]";
              details = ok
                ? el("span", {}, ["Restored from " + (r.restoredFrom || "unknown") + scopeLabel + " (" + (r.filesWritten || 0) + " files)"])
                : el("span", { text: "Restore from " + (r.restoredFrom || "unknown") + " failed: " + (r.error || "Unknown error") });
            } else if (ok) {
              var kb = Math.max(1, Math.round((r.sizeBytes || 0) / 1024));
              var link = el("a", {
                href: SITE_CONFIG.backupApiUrl + "?action=download&name=" + encodeURIComponent(r.fileName),
                target: "_blank", rel: "noopener", text: r.fileName
              });
              details = el("span", {}, [link, document.createTextNode(" — " + (r.fileCount || 0) + " files, " + kb + " KB")]);
            } else {
              details = el("span", { text: r.error || "Unknown error" });
            }
            // Restore is only offered for a row that still has a real file on
            // disk (a successful backup or pre-restore snapshot, not a
            // "restore" record row itself, which has no file of its own).
            var canRestore = ok && r.reason !== "restore" && r.fileName;
            var actionBtns = [];
            if (canRestore) {
              var restoreBtn = el("button", { type: "button", class: "btn", style: "font-size:12px; padding:2px 8px; margin-right:4px", title: "Restore from this backup" }, ["↺ Restore"]);
              restoreBtn.addEventListener("click", function () { openRestoreConfirm(r.timestamp); });
              actionBtns.push(restoreBtn);
            }
            var deleteBtn = el("button", { type: "button", class: "btn btn-warn", style: "font-size:12px; padding:2px 8px", title: "Delete this backup" }, ["🗑"]);
            deleteBtn.addEventListener("click", function () { openDeleteBackupConfirm(r.timestamp); });
            actionBtns.push(deleteBtn);
            return el("tr", { class: rowClass }, [
              el("td", { text: r.timestamp ? fmtDate(r.timestamp) : "" }),
              el("td", { text: triggerLabel }),
              el("td", { text: ok ? "✅ Success" : "❌ Failed" }),
              el("td", {}, [details]),
              el("td", { style: "white-space:nowrap" }, actionBtns)
            ]);
          }))
        ]));
      } else if (state.backupsList) {
        kids.push(el("div", { class: "hint" }, ["No backups recorded yet."]));
      }
    }

    return el("div", { class: "panel", style: "margin-top:16px" }, [
      el("h3", { text: "Backups" }),
      el("div", { class: "hint", style: "margin-bottom:10px" }, [
        "Zips the app's live data (registrations, overrides, app settings, the flyer, import history, etc.) " +
        "into a dated file kept on the server, for point-in-time recovery independent of the live JSON files. " +
        "Only the newest 30 backup files are kept on disk; this log is kept permanently, even for a purged or failed run."
      ]),
      el("div", {}, kids),
      buildAutoBackupFields()
    ]);
  }

  // Setup tab > Backups > auto-backup schedule — enable checkbox + active
  // date range, same UX as the Import Schedule's own auto-import settings
  // (see buildImportScheduleSection() above). The actual daily trigger is
  // server-side (lib.php's vettefest_backup_auto_check(), piggybacked on the
  // Import Schedule's existing ~15-minute poll) — this only edits the
  // settings it reads.
  function buildAutoBackupFields() {
    var s = state.backupSchedule || { enabled: false, startDate: "", endDate: "", lastAutoRunDate: "" };

    var enableCb = el("input", { type: "checkbox" }); enableCb.checked = !!s.enabled;
    var startDateInput = el("input", { type: "date", value: s.startDate || "" });
    var endDateInput = el("input", { type: "date", value: s.endDate || "" });

    // Auto-save: both fields save themselves (no Save button) on change —
    // same idea as the Setup tab's Import Schedule autosave above.
    function autoSaveBackupSchedule() {
      saveBackupSchedule({
        enabled: enableCb.checked,
        startDate: startDateInput.value,
        endDate: endDateInput.value
      });
    }
    enableCb.addEventListener("change", autoSaveBackupSchedule);
    startDateInput.addEventListener("change", autoSaveBackupSchedule);
    endDateInput.addEventListener("change", autoSaveBackupSchedule);

    var saveStatus = [];
    if (state.backupScheduleSaving) saveStatus.push(el("span", { class: "count" }, ["Saving…"]));
    else if (state.backupScheduleSaved) saveStatus.push(el("span", { class: "count", style: "color:var(--good)" }, ["Saved."]));
    if (state.backupScheduleError) saveStatus.push(el("div", { class: "form-error" }, [state.backupScheduleError]));

    var lastRunLine = s.lastAutoRunDate
      ? el("div", { class: "hint", style: "margin-top:4px" }, ["Last automatic backup: " + s.lastAutoRunDate + "."])
      : null;

    var fields = [
      el("div", { class: "hint", style: "margin:10px 0" }, [
        "Runs once a day at midnight (America/New_York), only while enabled and within the active dates below " +
        "— piggybacked on the same ~15-minute heartbeat the Import Schedule uses, so it takes effect within a " +
        "few minutes of midnight, not instantly."
      ]),
      el("div", { class: "form-row" }, [
        el("label", {}, [enableCb, document.createTextNode(" Enable automatic backups")])
      ]),
      el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: "Active dates" }),
        el("div", { style: "display:flex; gap:8px; align-items:center" }, [
          startDateInput, document.createTextNode("to"), endDateInput
        ])
      ])
    ];
    if (saveStatus.length) fields.push(el("div", { class: "settings-actions" }, saveStatus));
    if (lastRunLine) fields.push(lastRunLine);

    return el("div", { style: "margin-top:14px; padding-top:14px; border-top:1px solid var(--line)" }, fields);
  }

  // Setup tab > Import Schedule > "Log Directory" — server-archived run logs
  // (logs.php), browsable from any machine logged into the site rather than
  // only the one that ran the import. Purged after 7 days — see logs.php's
  // VETTEFEST_LOG_PURGE_DAYS.
  function buildLogDirectoryField() {
    var toggleBtn = el("button", { type: "button", class: "btn btn-sm" },
      [state.logsPanelOpen ? "▲ Hide Logs" : "📂 View Logs"]);
    toggleBtn.addEventListener("click", toggleLogsPanel);

    var kids = [
      el("div", {}, [toggleBtn]),
      el("div", { class: "setup-hint" }, [
        "Each import run's log is archived here — viewable from anywhere, purged automatically after 7 days."
      ])
    ];

    if (state.logsPanelOpen) {
      if (state.logsLoading) {
        kids.push(el("div", { class: "hint" }, ["Loading…"]));
      } else if (state.logsError) {
        kids.push(el("div", { class: "form-error" }, [state.logsError]));
      } else if (state.logsList && state.logsList.length) {
        kids.push(el("table", { class: "grid", style: "margin-top:8px" }, [
          el("thead", {}, [el("tr", {}, [el("th", { text: "Log" }), el("th", { text: "Saved" }), el("th", { text: "Size" })])]),
          el("tbody", {}, state.logsList.map(function (f) {
            var link = el("a", {
              href: SITE_CONFIG.logsApiUrl + "&action=get&name=" + encodeURIComponent(f.name),
              target: "_blank", rel: "noopener", text: f.name
            });
            return el("tr", {}, [
              el("td", {}, [link]),
              el("td", { text: f.mtime ? fmtDate(new Date(f.mtime)) : "" }),
              el("td", { text: Math.max(1, Math.round(f.size / 1024)) + " KB" })
            ]);
          }))
        ]));
      } else if (state.logsList) {
        kids.push(el("div", { class: "hint" }, ["No logs archived yet (or all have aged past the 7-day retention window)."]));
      }
    }

    return el("div", {}, kids);
  }

  // Setup tab > Import Schedule > persisted "Last run" line — reads
  // state.runStatus (fetched by loadRunStatus() on Setup-tab select). Distinct
  // from the Import Now button's own ephemeral status text: this reflects
  // whichever run happened most recently (manual or scheduled), and survives
  // page reloads.
  function buildLastRunLine() {
    var rs = state.runStatus;
    if (!rs || !rs.startedAt) {
      return el("div", { class: "hint", style: "margin-bottom:10px" }, ["Last run: none recorded yet."]);
    }
    var reasonText = rs.reason === "manual" ? "Import Now"
      : (rs.reason && rs.reason.indexOf("scheduled:") === 0 ? "scheduled " + rs.reason.slice("scheduled:".length) : (rs.reason || ""));
    var parts = ["Last run: started " + fmtDate(new Date(rs.startedAt)) + (reasonText ? " (" + reasonText + ")" : "")];
    var style = "margin-bottom:10px";
    if (!rs.completedAt) {
      parts.push(" — still running, or the scheduled task didn't get a chance to report completion.");
    } else if (rs.status === "failed") {
      parts.push(" — ❌ Failed at " + fmtDate(new Date(rs.completedAt)) + (rs.error ? ": " + rs.error : "") + ".");
      style += "; color:var(--warn)";
    } else {
      parts.push(" — ✅ Succeeded at " + fmtDate(new Date(rs.completedAt)) + ".");
      style += "; color:var(--good)";
    }
    return el("div", { style: style }, [parts.join("")]);
  }

  // Setup tab > Import Schedule — the ClubExpress event URL (read by
  // deploy/sync-registrations.js via import-schedule.php's 'check', instead of
  // a hardcoded URL that goes stale every year), an "Import Now" button, and an auto-import schedule
  // (enable checkbox, one or more daily times, and an optional active-date
  // range). None of this runs anything itself — see import-schedule.php's
  // header comment and requestImportNow()/saveImportScheduleSettings() for how
  // it actually reaches a scheduled task on an officer's machine, which is the
  // only thing that can drive a real ClubExpress export.
  function buildImportScheduleSection() {
    var s = state.appSettings;

    var eventUrlInput = el("input", { type: "text", value: s.eventUrl || "", placeholder: "https://www.etccwebsite.com/content.aspx?...&item_id=..." });

    var importNowBtn = el("button", { type: "button", class: "btn primary" }, ["▶ Import Now"]);
    importNowBtn.addEventListener("click", requestImportNow);
    var importNowRow = el("div", { style: "display:flex; align-items:center; gap:10px" }, [importNowBtn]);
    if (state.importRequestStatus) {
      var isFailed = state.importRequestStatus.indexOf("Failed at ") === 0;
      var isSucceeded = state.importRequestStatus.indexOf("Succeeded at ") === 0;
      var statusStyle = isFailed ? "color:var(--warn)" : (isSucceeded ? "color:var(--good)" : "");
      importNowRow.appendChild(el("span", { class: "count", style: statusStyle }, [state.importRequestStatus]));
    }

    var enableCb = el("input", { type: "checkbox" }); enableCb.checked = !!s.autoImportEnabled;

    var startDateInput = el("input", { type: "date", value: s.autoImportStartDate || "" });
    var endDateInput = el("input", { type: "date", value: s.autoImportEndDate || "" });

    // Auto-save: every field below saves the whole schedule (no Save button)
    // as soon as it changes — same idea as the Settings modal's
    // autoSaveSettings(), a full patch built fresh from every field's current
    // DOM value every time, so one changed field can't clobber the others.
    // Text fields save on blur (so a value isn't half-typed mid-save);
    // checkbox/select/date fields save on change, since that's their natural
    // "the user just committed a value" event.
    function autoSaveImportSchedule() {
      var times = Array.prototype.map.call(timesWrap.querySelectorAll("input[type=time]"), function (i) { return i.value; })
        .filter(function (v) { return v; });
      saveImportScheduleSettings({
        eventUrl: eventUrlInput.value.trim(),
        autoImportEnabled: enableCb.checked,
        autoImportTimes: times,
        autoImportIntervalHours: Number(intervalSel.value),
        autoImportStartDate: startDateInput.value,
        autoImportEndDate: endDateInput.value
      });
    }
    eventUrlInput.addEventListener("blur", autoSaveImportSchedule);
    enableCb.addEventListener("change", autoSaveImportSchedule);
    startDateInput.addEventListener("change", autoSaveImportSchedule);
    endDateInput.addEventListener("change", autoSaveImportSchedule);

    // One <input type=time> per configured daily run time — plain DOM
    // add/remove rather than tracking a parallel array in state, since
    // autoSaveImportSchedule() reads every row's current value straight off
    // the DOM. Removing a row saves immediately (nothing else would ever
    // fire for a row that's no longer there to blur); a newly added blank
    // row only saves once it's given a value, since autoSaveImportSchedule()
    // filters out empty times anyway.
    var timesWrap = el("div", {});
    function addTimeRow(value) {
      var input = el("input", { type: "time", value: value || "" });
      input.addEventListener("change", autoSaveImportSchedule);
      var removeBtn = el("button", { type: "button", class: "btn", style: "padding:4px 10px" }, ["✕"]);
      var row = el("div", { style: "display:flex; gap:6px; margin-bottom:6px; align-items:center" }, [input, removeBtn]);
      removeBtn.addEventListener("click", function () {
        timesWrap.removeChild(row);
        autoSaveImportSchedule();
      });
      timesWrap.appendChild(row);
    }
    (s.autoImportTimes || []).forEach(function (t) { addTimeRow(t); });
    var addTimeBtn = el("button", { type: "button", class: "btn btn-sm" }, ["+ Add Time"]);
    addTimeBtn.addEventListener("click", function () { addTimeRow(""); });

    // "Every N hours, on the hour" — a simpler alternative (or addition) to
    // picking explicit times one at a time. 0 = off. Active alongside any
    // explicit times above, not instead of them — see import-schedule.php's
    // 'check' action, which unions both into one slot list.
    var intervalSel = el("select", {});
    [
      [0, "Off"], [1, "Every hour"], [2, "Every 2 hours"], [3, "Every 3 hours"],
      [4, "Every 4 hours"], [6, "Every 6 hours"], [8, "Every 8 hours"], [12, "Every 12 hours"]
    ].forEach(function (opt) {
      var o = el("option", { value: String(opt[0]), text: opt[1] });
      if (Number(s.autoImportIntervalHours) === opt[0]) o.setAttribute("selected", "selected");
      intervalSel.appendChild(o);
    });
    intervalSel.addEventListener("change", autoSaveImportSchedule);

    var saveStatus = [];
    if (state.importScheduleSaving) saveStatus.push(el("span", { class: "count" }, ["Saving…"]));
    else if (state.importScheduleSaved) saveStatus.push(el("span", { class: "count", style: "color:var(--good)" }, ["Saved."]));
    if (state.importScheduleError) saveStatus.push(el("div", { class: "form-error" }, [state.importScheduleError]));

    var rows = [
      el("h3", { text: "Import Schedule" }),
      el("div", { class: "hint", style: "margin-bottom:10px" }, [
        "Controls the automation that pulls fresh ClubExpress data. A web page can't drive ClubExpress " +
        "itself, so the work is done by a Windows scheduled task on an officer's machine that checks in " +
        "here every ~15 minutes — Import Now and scheduled times take effect within a few minutes, not instantly."
      ]),
      buildLastRunLine(),
      el("div", { class: "form-row sched" }, [
        el("span", { class: "form-label", text: "Scheduled Task" }),
        el("div", {}, [
          el("div", { class: "setup-hint" }, [
            "The poller is the Windows Task Scheduler task \"vettefest-sync-registrations\", running " +
            "deploy/sync-registrations.js — a different thing from the \"Last run\" line above, which only " +
            "reflects an actual import attempt (most checks find nothing due and leave no trace). To see " +
            "whether the poller itself is alive, open Task Scheduler on that machine and check the task's " +
            "Last Run Time and Last Run Result (0 = fine). If an import reports \"ClubExpress session not " +
            "logged in\", run deploy/clubexpress-login.js there and sign in with Remember Me ticked."
          ])
        ])
      ]),
      el("div", { class: "form-row sched" }, [el("span", { class: "form-label", text: "Event URL" }), eventUrlInput]),
      el("div", { class: "form-row sched" }, [
        el("span", { class: "form-label", text: "Log Directory" }),
        buildLogDirectoryField()
      ]),
      el("div", { class: "form-row sched" }, [el("span", { class: "form-label", text: "" }), importNowRow]),
      el("div", { class: "form-row sched" }, [
        el("label", {}, [enableCb, document.createTextNode(" Enable automatic imports")])
      ]),
      el("div", { class: "form-row sched" }, [
        el("span", { class: "form-label", text: "Active dates" }),
        el("div", { style: "display:flex; gap:8px; align-items:center" }, [
          startDateInput, document.createTextNode("to"), endDateInput
        ])
      ]),
      el("div", { class: "form-row sched" }, [
        el("span", { class: "form-label", text: "Times" }),
        el("div", {}, [timesWrap, addTimeBtn])
      ]),
      el("div", { class: "form-row sched" }, [
        el("span", { class: "form-label", text: "Interval" }),
        el("div", {}, [
          intervalSel,
          el("div", { class: "setup-hint" }, ["Runs alongside any Times above, not instead of them."])
        ])
      ])
    ];
    if (saveStatus.length) rows.push(el("div", { class: "settings-actions" }, saveStatus));

    return el("div", { class: "panel", style: "margin-top:16px" }, rows);
  }

  // ---------- History tab ----------
  // Read-only log of every registration-data import ATTEMPT for this event
  // (registrations-upload.php's CLI path and registrations-import.php's
  // browser path each append a success entry; import-schedule.php's mark_run
  // appends a failure one). Newest first, since that's almost always the entry
  // someone wants to check ("did today's import actually happen?").

  // Entries written before the CarShow-parity port used 'importedAt' as the
  // key; everything since uses 'timestamp'. One accessor so every read site
  // (display, selection identity, delete) agrees on which to use.
  function historyTimestamp(r) { return (r && (r.timestamp || r.importedAt)) || null; }

  function buildHistoryView() {
    var rows = state.importHistory.slice().reverse();
    // Prune stale selections (e.g. after a delete, or a fresh reload changed
    // which timestamps exist) so a leftover checked box can't silently
    // target an entry that isn't shown anymore.
    var liveTimestamps = {};
    rows.forEach(function (r) { var ts = historyTimestamp(r); if (ts) liveTimestamps[ts] = true; });
    Object.keys(state.historySelected).forEach(function (ts) { if (!liveTimestamps[ts]) delete state.historySelected[ts]; });

    var body;
    var toolbar = null;
    if (!rows.length) {
      body = el("div", { class: "empty-state" }, ["No imports recorded yet — this fills in the next time a CSV pair is imported via the Setup tab."]);
    } else {
      var selectedCount = selectedHistoryTimestamps().length;
      var selectAllCb = el("input", { type: "checkbox" });
      selectAllCb.checked = rows.length > 0 && selectedCount === rows.length;
      selectAllCb.addEventListener("change", function () {
        rows.forEach(function (r) { var ts = historyTimestamp(r); if (ts) toggleHistorySelected(ts, selectAllCb.checked); });
        renderViews();
      });

      var deleteSelectedBtn = el("button", { class: "btn btn-warn" }, ["🗑 Delete Selected" + (selectedCount ? " (" + selectedCount + ")" : "")]);
      if (!selectedCount) deleteSelectedBtn.setAttribute("disabled", "disabled");
      deleteSelectedBtn.addEventListener("click", function () { openDeleteHistoryConfirm("selected"); });
      var deleteAllBtn = el("button", { class: "btn btn-warn" }, ["🗑 Delete All"]);
      deleteAllBtn.addEventListener("click", function () { openDeleteHistoryConfirm("all"); });
      toolbar = el("div", { class: "settings-actions", style: "margin-bottom:10px" }, [deleteSelectedBtn, deleteAllBtn]);

      var table = el("table", { class: "grid" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", {}, [selectAllCb]),
          el("th", { text: "" }),
          el("th", { text: "Log" }),
          el("th", { text: "Imported" }),
          el("th", { text: "Registrations" }),
          el("th", { text: "Activities" }),
          el("th", { text: "Source" }),
          el("th", { text: "Event URL" })
        ])]),
        el("tbody", {}, rows.map(function (r) {
          var ts = historyTimestamp(r);
          var failed = r.outcome === "failed";
          var outcomeCell = el("td", {
            title: failed ? ("Failed" + (r.error ? ": " + r.error : "")) : "Succeeded",
            style: "text-align:center"
          }, [failed ? "❌" : "✅"]);

          var cb = el("input", { type: "checkbox" });
          cb.checked = !!(ts && state.historySelected[ts]);
          cb.addEventListener("change", function () { toggleHistorySelected(ts, cb.checked); renderViews(); });
          var selectCell = el("td", { style: "text-align:center" }, [cb]);

          // Right next to the outcome icon (not squeezed past a long Event
          // URL column at the far right) so it's actually noticeable —
          // labeled with its own header rather than blank.
          var logCell;
          if (r.logFile && SITE_CONFIG.logsApiUrl) {
            // Logs are archived server-side (logs.php) — viewable by anyone
            // logged into the site, not just the machine that ran the
            // import. Purged after 7 days.
            var logLink = el("a", {
              class: "btn btn-sm",
              href: SITE_CONFIG.logsApiUrl + "&action=get&name=" + encodeURIComponent(r.logFile),
              title: "View log (" + r.logFile + ")",
              target: "_blank", rel: "noopener"
            }, ["📄 Log"]);
            logCell = el("td", { style: "text-align:center; white-space:nowrap" }, [logLink]);
          } else {
            logCell = el("td", { style: "text-align:center; color:var(--muted)" }, ["—"]);
          }

          return el("tr", {}, [
            selectCell,
            outcomeCell,
            logCell,
            el("td", { text: ts ? fmtDate(new Date(ts)) : "" }),
            el("td", { text: String(r.regRows != null ? r.regRows : "—") }),
            el("td", { text: String(r.actRows != null ? r.actRows : "—") }),
            el("td", { text: r.source === "cli" ? "Scheduled sync" : "Manual upload" }),
            el("td", { style: "max-width:260px; white-space:normal; overflow-wrap:break-word; word-break:break-all" }, [r.eventUrl || "—"])
          ]);
        }))
      ]);
      body = el("div", { class: "tablewrap" }, [table]);
    }
    return el("div", { class: "view history-view" }, [
      el("div", { class: "panel" }, [
        el("h3", { text: "Import History" }),
        toolbar,
        body
      ].filter(Boolean))
    ]);
  }

  // ---------- Setup/History tab server calls ----------

  // Setup tab > Import Schedule's own save — same app-settings.php endpoint
  // and patch shape as saveAppSettings(), but a SEPARATE function rather than
  // reusing it (their state fields — importScheduleSaving/etc. vs.
  // appSettingsSaving/etc. — are read by different parts of the Setup tab).
  // Like saveAppSettings, this deliberately skips re-rendering until the
  // request settles: it's wired to every field's blur/change (see
  // autoSaveImportSchedule() above), which fire while someone might still be
  // tabbing through several fields — a synchronous full renderViews() would
  // tear down and rebuild every input on the page mid-Tab, stranding
  // keystrokes on a DOM node the browser already forgot about.
  function saveImportScheduleSettings(patch) {
    Object.keys(patch).forEach(function (k) { state.appSettings[k] = patch[k]; });
    state.importScheduleSaving = true;
    state.importScheduleError = null;
    state.importScheduleSaved = false;
    if (!SITE_CONFIG.appSettingsApiUrl) { state.importScheduleSaving = false; renderViews(); return; }
    fetch(SITE_CONFIG.appSettingsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", settings: patch })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.importScheduleSaving = false;
      state.importScheduleSaved = true;
      renderViews();
    }).catch(function () {
      state.importScheduleSaving = false;
      state.importScheduleError = "Could not save — check your connection and try again.";
      renderViews();
    });
  }

  // Setup tab > Import Schedule > "Import Now" — leaves a request flag
  // (import-schedule.php action=request) for the Windows scheduled task
  // (deploy/sync-registrations.js) on an officer's machine to pick up on its
  // next poll. This endpoint cannot
  // itself drive a browser through ClubExpress, so there's an inherent delay —
  // the status text says so rather than implying anything happens instantly.
  function requestImportNow() {
    if (!SITE_CONFIG.importScheduleApiUrl) return;
    stopImportRequestPolling();
    state.importRequestStatus = "Requesting…";
    renderViews();
    fetch(SITE_CONFIG.importScheduleApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request" })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok) {
          state.importRequestStatus = "Requested — the next scheduled check will run the import.";
          startImportRequestPolling(r.data.requestedAt);
        } else {
          state.importRequestStatus = "Could not request an import — please try again.";
        }
        renderViews();
      }).catch(function () {
        state.importRequestStatus = "Could not request an import — check your connection and try again.";
        renderViews();
      });
  }

  // Polls import-schedule.php's 'status' action every 30s until the scheduled
  // task marks THIS specific request handled (comparing handledAt to the
  // requestedAt this click produced, not just "handledAt is set", so a stale
  // handledAt from a PRIOR click can't be mistaken for this one having run).
  // Capped at 40 attempts (~20 minutes) so a page left open indefinitely
  // doesn't poll forever if something's stuck.
  function stopImportRequestPolling() {
    if (importRequestPollTimer) { clearInterval(importRequestPollTimer); importRequestPollTimer = null; }
  }
  function startImportRequestPolling(requestedAt) {
    var attempts = 0;
    importRequestPollTimer = setInterval(function () {
      attempts++;
      if (attempts > 40) { stopImportRequestPolling(); return; }
      fetch(SITE_CONFIG.importScheduleApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" })
      }).then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.ok && data.handledAt && (!requestedAt || new Date(data.handledAt) >= new Date(requestedAt))) {
            var when = fmtDate(new Date(data.handledAt));
            state.importRequestStatus = data.lastStatus === "failed"
              ? "Failed at " + when + (data.lastError ? ": " + data.lastError : "") + " — see the History tab or the archived log."
              : "Succeeded at " + when + ".";
            stopImportRequestPolling();
            loadRunStatus();
            renderViews();
          }
        }).catch(function () { /* transient network hiccup — keep polling, don't surface it */ });
    }, 30000);
  }

  // Setup tab > Import Schedule > persisted "Last run" status — fetched on
  // Setup-tab select, and again whenever an Import Now click's own polling
  // resolves, so both status lines update together.
  function loadRunStatus() {
    if (!SITE_CONFIG.importScheduleApiUrl) return;
    fetch(SITE_CONFIG.importScheduleApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run_status" })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok) {
          state.runStatus = r.data.runStatus || null;
          if (state.tab === "setup") renderViews();
        }
      }).catch(function () { /* keep showing whatever's already loaded */ });
  }

  // Setup tab > Backups > "Backup Now" (backup.php action=run) — zips the
  // live data server-side and appends one entry to backup-history.json.
  // Unlike requestImportNow() above, this isn't a request for something
  // else to pick up later — the server does the whole thing synchronously
  // and this resolves with the real outcome, so there's no polling.
  function requestBackupNow() {
    if (!SITE_CONFIG.backupApiUrl || state.backupRunning) return;
    state.backupRunning = true;
    state.backupRunStatus = "Running…";
    renderViews();
    fetch(SITE_CONFIG.backupApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run" })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.backupRunning = false;
        if (r.ok && r.data && r.data.ok && r.data.entry) {
          var e = r.data.entry;
          var kb = Math.max(1, Math.round((e.sizeBytes || 0) / 1024));
          state.backupRunStatus = "Succeeded — " + (e.fileCount || 0) + " files, " + kb + " KB.";
          if (state.backupsList !== null) state.backupsList.push(e);
        } else {
          state.backupRunStatus = "Failed" + (r.data && r.data.error ? ": " + r.data.error : " — please try again.");
        }
        renderViews();
      }).catch(function () {
        state.backupRunning = false;
        state.backupRunStatus = "Failed — check your connection and try again.";
        renderViews();
      });
  }

  // Setup tab > Backups > auto-backup schedule — loads/saves backup.php's
  // get_schedule/save_schedule actions. Same shape as
  // saveImportScheduleSettings() below but its own small JSON (not part of
  // per-event app-settings.json), since backups aren't scoped to one event.
  function loadBackupSchedule() {
    if (!SITE_CONFIG.backupApiUrl) return;
    fetch(SITE_CONFIG.backupApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_schedule" })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok && r.data.schedule) {
          state.backupSchedule = r.data.schedule;
          if (state.tab === "setup") renderViews();
        }
      }).catch(function () { /* keep showing whatever's already loaded */ });
  }
  // Deliberately no renderViews() before the fetch — this is wired to
  // enableCb/startDateInput/endDateInput's change events (autoSaveBackupSchedule()
  // above), same reason saveImportScheduleSettings() skips it: a synchronous
  // full re-render mid-interaction would tear down and rebuild every input on
  // the page.
  function saveBackupSchedule(settings) {
    if (!SITE_CONFIG.backupApiUrl) return;
    state.backupScheduleSaving = true;
    state.backupScheduleError = null;
    state.backupScheduleSaved = false;
    fetch(SITE_CONFIG.backupApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action: "save_schedule" }, settings))
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.backupScheduleSaving = false;
        if (r.ok && r.data && r.data.ok && r.data.schedule) {
          state.backupSchedule = r.data.schedule;
          state.backupScheduleSaved = true;
        } else {
          state.backupScheduleError = "Could not save.";
        }
        renderViews();
      }).catch(function () {
        state.backupScheduleSaving = false;
        state.backupScheduleError = "Could not save — check your connection.";
        renderViews();
      });
  }

  // Setup tab > Backups > "View Logs" (backup.php action=list) — same
  // toggle/load pattern as toggleLogsPanel()/loadLogsList() below, against
  // the permanent backup-history.json log instead of the purged sync logs.
  function toggleBackupsPanel() {
    state.backupsPanelOpen = !state.backupsPanelOpen;
    if (state.backupsPanelOpen && state.backupsList === null) {
      loadBackupsList();
      return; // loadBackupsList() already re-renders
    }
    renderViews();
  }
  function loadBackupsList() {
    if (!SITE_CONFIG.backupApiUrl) return;
    state.backupsLoading = true;
    state.backupsError = null;
    renderViews();
    fetch(SITE_CONFIG.backupApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.backupsLoading = false;
        if (r.ok && r.data && r.data.ok) {
          state.backupsList = r.data.history || [];
        } else {
          state.backupsError = "Could not load the backup log.";
        }
        renderViews();
      }).catch(function () {
        state.backupsLoading = false;
        state.backupsError = "Could not load the backup log — check your connection.";
        renderViews();
      });
  }

  // Setup tab > Backups > per-row "🗑" delete — removes one backup-history.json
  // entry and its zip file (if any). Same confirm-modal shape as
  // openDeleteHistoryConfirm()/closeDeleteHistoryConfirm()/performDeleteHistory()
  // elsewhere in this file, but keyed to a single timestamp rather than a
  // selected/all mode — there's no bulk-select UI for this log. backup.php's
  // 'delete' action refuses to remove the very last backup file on the
  // server (see its own comment); that error surfaces here rather than
  // silently no-op'ing.
  function openDeleteBackupConfirm(timestamp) {
    state.deleteBackupConfirm = timestamp;
    state.deleteBackupError = null;
    renderDeleteBackupConfirm();
  }
  function closeDeleteBackupConfirm() {
    state.deleteBackupConfirm = null;
    state.deleteBackupError = null;
    renderDeleteBackupConfirm();
  }
  function performDeleteBackup() {
    var timestamp = state.deleteBackupConfirm;
    if (!timestamp || !SITE_CONFIG.backupApiUrl) return;
    fetch(SITE_CONFIG.backupApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", timestamp: timestamp })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok && Array.isArray(r.data.history)) {
          state.backupsList = r.data.history;
          state.deleteBackupConfirm = null;
          state.deleteBackupError = null;
          renderDeleteBackupConfirm();
          renderViews();
        } else {
          state.deleteBackupError = (r.data && r.data.error) || "Could not delete — please try again.";
          renderDeleteBackupConfirm();
        }
      }).catch(function () {
        state.deleteBackupError = "Could not delete — check your connection.";
        renderDeleteBackupConfirm();
      });
  }
  function renderDeleteBackupConfirm() {
    var host = $("#confirmHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.deleteBackupConfirm) return;

    var entry = (state.backupsList || []).filter(function (r) { return r.timestamp === state.deleteBackupConfirm; })[0];
    var label = entry && entry.fileName ? entry.fileName : (entry && entry.timestamp ? fmtDate(entry.timestamp) : "this backup");

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeDeleteBackupConfirm);
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: "Delete this backup?" }),
      el("span", { class: "spacer" }), closeBtn
    ]);

    var yesBtn = el("button", { class: "btn primary", style: "background:var(--warn);border-color:var(--red-dark)" }, ["Yes, Delete"]);
    yesBtn.addEventListener("click", performDeleteBackup);
    var noBtn = el("button", { class: "btn" }, ["Cancel"]);
    noBtn.addEventListener("click", closeDeleteBackupConfirm);

    var bodyKids = [
      el("p", {}, ["Delete " + label + "? This removes both the log entry and the zip file on the server (if it hasn't already aged out). This can't be undone."]),
      el("div", { class: "settings-actions" }, [yesBtn, noBtn])
    ];
    if (state.deleteBackupError) bodyKids.push(el("div", { class: "form-error" }, [state.deleteBackupError]));

    var body = el("div", { class: "modal-body" }, bodyKids);
    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeDeleteBackupConfirm);
    host.appendChild(backdrop);
  }

  // Setup tab > Backups > per-row "↺ Restore" — modeled on
  // SilentAuctionManager's restoreBackupEntry(), adapted to this app's own
  // modal convention (SAM uses prompt()/confirm()/alert() for this rare,
  // high-stakes action rather than building modal markup for it; this app
  // already has a modal system for every other confirm, including one that
  // asks for the Developer password — renderDeleteShowConfirm() — so this
  // reuses that shape instead of introducing a different UI pattern for one
  // feature). Opening the modal loads this SPECIFIC backup's contents
  // (get_backup_years) fresh every time, since which events it contains is a
  // property of the file, not something worth caching in app state.
  function openRestoreConfirm(timestamp) {
    state.restoreConfirm = timestamp;
    state.restoreYears = null;
    state.restoreYearsError = null;
    state.restoreScope = "";
    state.restoreError = null;
    loadRestoreYears(timestamp); // sets restoreYearsLoading and renders itself
  }
  function closeRestoreConfirm() {
    state.restoreConfirm = null;
    state.restoreYears = null;
    state.restoreYearsError = null;
    state.restoreScope = "";
    state.restoreError = null;
    renderRestoreConfirm();
  }
  function loadRestoreYears(timestamp) {
    if (!SITE_CONFIG.backupApiUrl) return;
    state.restoreYearsLoading = true;
    renderRestoreConfirm();
    fetch(SITE_CONFIG.backupApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_backup_years", timestamp: timestamp })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.restoreYearsLoading = false;
        // The modal may have been closed (or reopened on a different row)
        // while this was in flight — ignore a stale response.
        if (state.restoreConfirm !== timestamp) return;
        if (r.ok && r.data && r.data.ok) {
          state.restoreYears = r.data.years || [];
        } else {
          state.restoreYearsError = (r.data && r.data.error) || "Could not read this backup's contents.";
        }
        renderRestoreConfirm();
      }).catch(function () {
        state.restoreYearsLoading = false;
        if (state.restoreConfirm !== timestamp) return;
        state.restoreYearsError = "Could not read this backup's contents — check your connection.";
        renderRestoreConfirm();
      });
  }
  // Restoring can rewrite registrations, overrides, settings, the flyer, and
  // even which events exist at all — far more than any single fetch's normal
  // "update this one piece of state" pattern can safely patch in place. Same
  // choice SAM's own restoreBackupEntry() makes (location.reload()): on
  // success, reload the whole page so every tab reflects the restored data,
  // rather than trying to enumerate everything that might now be stale.
  function performRestore(devPassword) {
    var timestamp = state.restoreConfirm;
    if (!timestamp || !SITE_CONFIG.backupApiUrl) return;
    state.restoreRunning = true;
    state.restoreError = null;
    renderRestoreConfirm();
    fetch(SITE_CONFIG.backupApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", timestamp: timestamp, year: state.restoreScope, devPassword: devPassword })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok) {
          window.location.reload();
          return;
        }
        state.restoreRunning = false;
        state.restoreError = (r.data && r.data.error) || "Restore failed — please try again.";
        renderRestoreConfirm();
      }).catch(function () {
        state.restoreRunning = false;
        state.restoreError = "Restore failed — check your connection and try again.";
        renderRestoreConfirm();
      });
  }
  function renderRestoreConfirm() {
    var host = $("#confirmHost");
    if (!host) return;
    host.innerHTML = "";
    var timestamp = state.restoreConfirm;
    if (!timestamp) return;

    var entry = (state.backupsList || []).filter(function (r) { return r.timestamp === timestamp; })[0];
    var fileLabel = entry && entry.fileName ? entry.fileName : "this backup";

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeRestoreConfirm);
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: "Restore from " + fileLabel + "?" }),
      el("span", { class: "spacer" }), closeBtn
    ]);

    var bodyKids = [];

    if (state.restoreYearsLoading) {
      bodyKids.push(el("p", {}, ["Loading this backup's contents…"]));
    } else if (state.restoreYearsError) {
      bodyKids.push(el("div", { class: "form-error" }, [state.restoreYearsError]));
    } else {
      var years = state.restoreYears || [];
      var scopeSel = el("select", {});
      scopeSel.appendChild(el("option", { value: "", text: "Everything (every event, plus global settings)" }));
      years.forEach(function (y) {
        scopeSel.appendChild(el("option", {
          value: y.year,
          text: (y.name || y.year) + " (" + y.year + ") — " + y.fileCount + " file" + (y.fileCount === 1 ? "" : "s")
        }));
      });
      scopeSel.value = state.restoreScope;
      scopeSel.addEventListener("change", function () { state.restoreScope = scopeSel.value; renderRestoreConfirm(); });

      var scopeIsAll = state.restoreScope === "";
      var scopeWarning = scopeIsAll
        ? "This REPLACES EVERYTHING — every event's registrations, overrides, settings, and flyer, plus the site/Developer password-reset state — with what was in that backup. Any event created since, or any global file this backup doesn't have, is deleted, not just overwritten."
        : "This REPLACES ONLY the \"" + (years.filter(function (y) { return y.year === state.restoreScope; })[0] || {}).name + "\" event's data with what was in that backup — every other event, and global settings, are left untouched.";

      bodyKids.push(el("div", { class: "form-row" }, [
        el("span", { class: "form-label", text: "Restore" }), scopeSel
      ]));
      bodyKids.push(el("p", { style: "color:var(--warn)" }, [scopeWarning]));
      bodyKids.push(el("p", {}, [
        "A safety backup of the CURRENT data is taken automatically right before restoring, so this can itself " +
        "be undone by restoring that safety backup afterward. This cannot be undone directly."
      ]));

      var pw = el("input", { type: "password", placeholder: "Developer password", autocomplete: "off" });
      var yesBtn = el("button", { class: "btn primary", style: "background:var(--warn);border-color:var(--red-dark)" }, ["Yes, Restore"]);
      if (state.restoreRunning) yesBtn.setAttribute("disabled", "disabled");
      yesBtn.addEventListener("click", function () { performRestore(pw.value); });
      pw.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); performRestore(pw.value); }
      });
      var noBtn = el("button", { class: "btn" }, ["Cancel"]);
      noBtn.addEventListener("click", closeRestoreConfirm);

      bodyKids.push(el("p", {}, ["Enter the Developer password to confirm:"]));
      bodyKids.push(pw);
      bodyKids.push(el("div", { class: "settings-actions" }, [yesBtn, noBtn]));
      if (state.restoreRunning) bodyKids.push(el("div", { class: "hint" }, ["Restoring… this may take a moment."]));
    }
    if (state.restoreError) bodyKids.push(el("div", { class: "form-error" }, [state.restoreError]));

    var body = el("div", { class: "modal-body" }, bodyKids);
    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeRestoreConfirm);
    host.appendChild(backdrop);
  }

  // Setup tab > Import Schedule > "View Logs" — server-archived log files
  // (logs.php action=list/get), so the directory is browsable from any
  // machine logged into the site, not just the one that ran the import.
  function toggleLogsPanel() {
    state.logsPanelOpen = !state.logsPanelOpen;
    if (state.logsPanelOpen && state.logsList === null) {
      loadLogsList();
      return; // loadLogsList() already re-renders
    }
    renderViews();
  }
  function loadLogsList() {
    if (!SITE_CONFIG.logsApiUrl) return;
    state.logsLoading = true;
    state.logsError = null;
    renderViews();
    fetch(SITE_CONFIG.logsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        state.logsLoading = false;
        if (r.ok && r.data && r.data.ok) {
          state.logsList = r.data.files || [];
        } else {
          state.logsError = "Could not load the log list.";
        }
        renderViews();
      }).catch(function () {
        state.logsLoading = false;
        state.logsError = "Could not load the log list — check your connection.";
        renderViews();
      });
  }

  // Re-pulls every bit of this event's server data and re-ingests it, without
  // a full page reload — called on every tab selection (see buildTabs()) so
  // a scheduled/manual import, or another officer's edit, that landed after
  // this page opened shows up right away on whichever tab you're looking at.
  // refresh.php returns exactly what vettefest_boot_data() (lib.php) assembles
  // — the same thing index.php's own boot script ingests at page load — so
  // this must re-ingest in that SAME order (see that function's own comment
  // for why: deletedRegistrations/registrationOverrides each have to land
  // before ingestRows, which triggers the CSV-driven regenerate() logic that
  // reads them). Silent on failure — the page just keeps showing whatever it
  // already had rather than surfacing an error for a background refresh
  // nobody explicitly asked to retry.
  function refreshShowData() {
    if (!state.currentShow || !SITE_CONFIG.refreshApiUrl) return;
    fetch(SITE_CONFIG.refreshApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok || !r.data || !r.data.ok) return;
        var d = r.data;
        API.ingestAppSettings(d.appSettings);
        API.ingestFlyer(d.flyer);
        API.ingestImportHistory(d.importHistory);
        API.ingestDeletedRegistrations(d.deletedRegistrations);
        API.ingestRegistrationOverrides(d.registrationOverrides);
        if (d.hasRegistrations) {
          var regRows = Papa.parse(d.regCsv, { header: true, skipEmptyLines: true }).data;
          var actRows = d.actCsv ? Papa.parse(d.actCsv, { header: true, skipEmptyLines: true }).data : [];
          API.ingestRows(regRows, actRows, new Date(d.generatedAt));
        }
        renderViews();
      }).catch(function () { /* keep showing whatever's already loaded */ });
  }

  // History tab row selection + delete. Entries have no stable id field, so
  // their timestamp is the identity — second-precision, unique in practice
  // since two imports never actually complete in the same second.
  function selectedHistoryTimestamps() { return Object.keys(state.historySelected); }
  function toggleHistorySelected(ts, checked) {
    if (!ts) return;
    if (checked) state.historySelected[ts] = true; else delete state.historySelected[ts];
  }
  function openDeleteHistoryConfirm(mode) {
    if (mode === "selected" && !selectedHistoryTimestamps().length) return;
    state.deleteHistoryConfirm = mode;
    renderDeleteHistoryConfirm();
  }
  function closeDeleteHistoryConfirm() { state.deleteHistoryConfirm = null; renderDeleteHistoryConfirm(); }
  function performDeleteHistory() {
    var mode = state.deleteHistoryConfirm;
    closeDeleteHistoryConfirm();
    if (!SITE_CONFIG.importHistoryApiUrl) return;
    var body = mode === "all" ? { action: "delete", all: true } : { action: "delete", timestamps: selectedHistoryTimestamps() };
    fetch(SITE_CONFIG.importHistoryApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok && Array.isArray(r.data.history)) {
          state.importHistory = r.data.history;
          state.historySelected = {};
        }
        renderViews();
      }).catch(function () { renderViews(); });
  }
  function renderDeleteHistoryConfirm() {
    var host = $("#confirmHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.deleteHistoryConfirm) return;

    var all = state.deleteHistoryConfirm === "all";
    var count = all ? state.importHistory.length : selectedHistoryTimestamps().length;

    var closeBtn = el("button", { class: "btn" }, ["✕"]);
    closeBtn.addEventListener("click", closeDeleteHistoryConfirm);
    var head = el("div", { class: "modal-head" }, [
      el("h3", { text: "Delete " + (all ? "all " + count : count) + " Import History entr" + (count === 1 ? "y" : "ies") + "?" }),
      el("span", { class: "spacer" }), closeBtn
    ]);

    var yesBtn = el("button", { class: "btn primary", style: "background:var(--warn);border-color:var(--red-dark)" }, ["Yes, Delete"]);
    yesBtn.addEventListener("click", performDeleteHistory);
    var noBtn = el("button", { class: "btn" }, ["Cancel"]);
    noBtn.addEventListener("click", closeDeleteHistoryConfirm);

    var body = el("div", { class: "modal-body" }, [
      el("p", {}, ["This permanently removes " + (all ? "the entire Import History log" : count + " selected entr" + (count === 1 ? "y" : "ies")) +
        " from the server. It does not affect the actual registration data those imports loaded — only this log. This cannot be undone."]),
      el("div", { class: "settings-actions" }, [yesBtn, noBtn])
    ]);

    var modal = el("div", { class: "modal" }, [head, body]);
    modal.addEventListener("click", function (e) { e.stopPropagation(); });
    var backdrop = el("div", { class: "modal-backdrop" }, [modal]);
    backdrop.addEventListener("click", closeDeleteHistoryConfirm);
    host.appendChild(backdrop);
  }

  // POSTs the chosen flyer file to flyer.php (multipart) for the open event,
  // then updates state.flyer from the response so the Setup tab's "current
  // flyer" line and the Reports tab's Print Flyer button both reflect it
  // without a page reload.
  function uploadFlyer(file) {
    if (!SITE_CONFIG.flyerApiUrl) { state.flyerError = "Flyer upload isn't available here."; renderViews(); return; }
    state.flyerUploading = true;
    state.flyerError = null;
    renderViews();
    var fd = new FormData();
    fd.append("flyer", file);
    fetch(SITE_CONFIG.flyerApiUrl, { method: "POST", body: fd })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        state.flyerUploading = false;
        if (r.ok && r.data && r.data.success) {
          state.flyer = { exists: true, mime: r.data.flyer.mime, name: r.data.flyer.name, uploadedAt: r.data.flyer.uploadedAt };
        } else {
          state.flyerError = (r.data && r.data.error) || "Upload failed — please try again.";
        }
        renderViews();
      })
      .catch(function () {
        state.flyerUploading = false;
        state.flyerError = "Upload failed — check your connection and try again.";
        renderViews();
      });
  }

  // Reuses buildSummaryView() verbatim (the same panels the Summary tab
  // shows on screen), cloned into #printHost, so this report can never drift
  // out of sync with what the Summary tab actually displays.
  function printSummaryReport() {
    if (!state.result || !state.result.ok) return;
    var host = $("#printHost");
    host.innerHTML = "";
    host.appendChild(buildPrintHeader("Vette Fest Summary Report"));
    host.appendChild(buildSummaryView());
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // Reg # / names / club / admission / shirts, always sorted by Reg # —
  // scoped to the Registration tab's current search/status filters, same as
  // its on-screen table.
  function printRegistrationReport() {
    if (!state.result || !state.result.ok) return;
    var host = $("#printHost");
    host.innerHTML = "";
    var rows = visibleRows().slice().sort(function (a, b) {
      return String(a["Reg #"]) < String(b["Reg #"]) ? -1 : 1;
    });
    var thead = el("thead", {}, [el("tr", {}, [
      el("th", { text: "Reg #" }), el("th", { text: "Last Name" }), el("th", { text: "First Name(s)" }),
      el("th", { text: "Club Name" }), el("th", { text: "Admission" }), el("th", { text: "#" }),
      el("th", { text: "Shirts" })
    ])]);
    var tbody = el("tbody", {}, rows.map(function (r) {
      return el("tr", {}, [
        el("td", { text: r["Reg #"] || "" }),
        el("td", { text: r["Last Name"] || "" }),
        el("td", { text: r["First Name(s)"] || "" }),
        el("td", { text: r["Club Name"] || "" }),
        el("td", { text: r["Reg Type"] || "" }),
        el("td", { text: String(r["#"] == null ? "" : r["#"]) }),
        el("td", { class: "shirtsum", text: shirtSummaryText(r) })
      ]);
    }));
    host.appendChild(buildPrintHeader("Registration Report"));
    host.appendChild(el("table", { class: "grid report-table" }, [thead, tbody]));
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // The judging roster: only cars actually entered in the show (SHW = Yes),
  // grouped by generation — the list the show field is laid out from, which
  // is why it ignores the Registration tab's In Show checkbox and always
  // filters for itself.
  function printCarShowReport() {
    if (!state.result || !state.result.ok) return;
    var host = $("#printHost");
    host.innerHTML = "";
    var entrants = visibleRows().filter(function (r) {
      return String(r[CONFIG.carJudgedColumn]).trim().toLowerCase() === "yes";
    }).sort(function (a, b) {
      var ag = String(a["Gen"] || "ZZ"), bg = String(b["Gen"] || "ZZ");
      if (ag !== bg) return ag < bg ? -1 : 1;
      return String(a["Reg #"]) < String(b["Reg #"]) ? -1 : 1;
    });
    var thead = el("thead", {}, [el("tr", {}, [
      el("th", { text: "Gen" }), el("th", { text: "Reg #" }), el("th", { text: "Last Name" }),
      el("th", { text: "First Name(s)" }), el("th", { text: "Year" }), el("th", { text: "Model" }),
      el("th", { text: "Color" }), el("th", { text: "Club Name" })
    ])]);
    var tbody = el("tbody", {}, entrants.map(function (r) {
      return el("tr", {}, [
        el("td", { text: r["Gen"] || "—" }),
        el("td", { text: r["Reg #"] || "" }),
        el("td", { text: r["Last Name"] || "" }),
        el("td", { text: r["First Name(s)"] || "" }),
        el("td", { text: String(r["Year"] == null ? "" : r["Year"]) }),
        el("td", { text: r["Model"] || "" }),
        el("td", { text: r["Color"] || "" }),
        el("td", { text: r["Club Name"] || "" })
      ]);
    }));
    host.appendChild(buildPrintHeader("Car Show Report — " + entrants.length + " entries"));
    host.appendChild(el("table", { class: "grid report-table" }, [thead, tbody]));
    host.appendChild(buildPrintFooter());
    window.print();
  }

  // The event flyer uploaded on the Setup tab. Unlike the four data reports
  // above (which build an HTML table into #printHost and call window.print()),
  // a flyer is a single full-bleed graphic of arbitrary size/orientation and
  // may be a PDF — so this just opens the stored file in a new tab, where the
  // browser's own image/PDF viewer handles the actual print or save. Guarded
  // the same way the button's disabled state is, in case it's called anyway.
  function printFlyer() {
    if (!state.flyer || !state.flyer.exists || !SITE_CONFIG.flyerApiUrl) return;
    window.open(SITE_CONFIG.flyerApiUrl, "_blank", "noopener");
  }

  // ---------- dates ----------
  function parseMaybeDateOnly(d) {
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      var parts = d.split("-");
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return d instanceof Date ? d : new Date(d);
  }
  function fmtDate(d) {
    d = parseMaybeDateOnly(d);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return p(d.getMonth() + 1) + "/" + p(d.getDate()) + "/" + d.getFullYear() + " " + p(h) + ":" + p(d.getMinutes()) + " " + ap;
  }

  // ---------- header menu (hamburger) ----------
  function buildHeaderMenu() {
    var header = $("header.app");
    if (!header) return;
    var hamburgerBtn = el("button", { id: "hamburgerBtn", class: "hamburger-btn", title: "Menu", "aria-label": "Menu", "aria-expanded": "false" }, [
      el("span", { class: "bar" }), el("span", { class: "bar" }), el("span", { class: "bar" })
    ]);
    hamburgerBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
    // Goes inside .hdr-left (before the logo), not header.firstChild — the
    // header is a 3-column grid and a 4th top-level child would break the
    // centered title.
    var hdrLeft = header.querySelector(".hdr-left") || header;
    hdrLeft.insertBefore(hamburgerBtn, hdrLeft.firstChild);

    var backdrop = el("div", { id: "hdrNavBackdrop", class: "hdr-nav-backdrop" });
    backdrop.addEventListener("click", closeMenu);
    var menu = el("div", { id: "hdrMenu", class: "hdr-menu" });
    document.body.appendChild(backdrop);
    document.body.appendChild(menu);
    document.addEventListener("click", closeMenu);
    renderHeaderMenu();
  }
  function toggleMenu() { state.menuOpen = !state.menuOpen; renderHeaderMenu(); }
  function closeMenu() {
    if (!state.menuOpen) return;
    state.menuOpen = false;
    renderHeaderMenu();
  }

  // Checks against a SEPARATE Developer password (index.php's
  // action=dev_login, $DEV_PASSWORD_HASH in secrets.php) — a distinct
  // credential from the main site login, without ever exposing either hash to
  // this script. Import Registrations is still independently session-gated
  // server-side using the MAIN login's session; this step only hides the link
  // from the menu until the Developer password is entered.
  function submitDeveloperPassword(password) {
    return fetch(location.pathname, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "action=dev_login&password=" + encodeURIComponent(password)
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data && r.data.success) {
          state.developerUnlocked = true;
          state.developerLoginOpen = false;
          state.developerError = null;
        } else {
          state.developerError = "Incorrect password.";
        }
        renderDeveloperLoginPage();
        renderHeaderMenu();
      })
      .catch(function () {
        state.developerError = "Could not verify — check your connection and try again.";
        renderDeveloperLoginPage();
      });
  }

  function openDeveloperLogin() {
    state.developerLoginOpen = true;
    state.developerError = null;
    renderDeveloperLoginPage();
  }
  function closeDeveloperLogin() { state.developerLoginOpen = false; renderDeveloperLoginPage(); }

  // Same full-screen gradient-card look as _login.html's main site login gate
  // — an in-app overlay, not the app's usual modal or full-page-banner
  // treatment, plus a close (✕) button since this is reachable without
  // leaving the app (the real login page has nothing to "close" back to).
  function renderDeveloperLoginPage() {
    var host = $("#developerLoginHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.developerLoginOpen) return;

    var headerLogo = $("header.app img.hdr-logo");
    var logoImg = headerLogo ? el("img", { src: headerLogo.src, class: "dev-login-logo", alt: "ETCC Logo" }) : null;

    var closeBtn = el("button", { class: "dev-login-close", title: "Cancel" }, ["✕"]);
    closeBtn.addEventListener("click", closeDeveloperLogin);

    var pwInput = el("input", { type: "password", class: "dev-login-input", placeholder: "Enter Developer password" });
    var submit = function () {
      if (!pwInput.value) return;
      state.developerVerifying = true;
      renderDeveloperLoginPage();
      submitDeveloperPassword(pwInput.value).then(function () { state.developerVerifying = false; });
    };
    var goBtn = el("button", { class: "dev-login-btn" }, [state.developerVerifying ? "Checking…" : "Unlock"]);
    if (state.developerVerifying) goBtn.setAttribute("disabled", "disabled");
    goBtn.addEventListener("click", submit);
    pwInput.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });

    var kids = [closeBtn];
    if (logoImg) kids.push(logoImg);
    kids.push(el("h1", { class: "dev-login-title", text: "Developer Login" }));
    kids.push(el("p", { class: "dev-login-subtitle" },
      ["Unlocks Settings, Regression Tests and the Change Log — " +
       "a separate password from the main site login."]));
    kids.push(pwInput);
    if (state.developerError) kids.push(el("div", { class: "dev-login-error" }, [state.developerError]));
    kids.push(goBtn);
    kids.push(el("div", { class: "dev-login-hint" }, [
      el("a", { href: "dev-forgot-password.php", target: "_blank", rel: "noopener" }, ["Forgot Developer password?"])
    ]));

    var screen = el("div", { class: "dev-login-screen" }, [el("div", { class: "dev-login-container" }, kids)]);
    host.appendChild(screen);
    pwInput.focus();
  }

  function buildDeveloperMenuItems() {
    if (state.developerUnlocked) {
      // Import Registrations used to live here; it moved to the Setup tab
      // (which needs no Developer password — the upload endpoint is
      // session-gated like everything else).
      var settings = el("button", { class: "hdr-menu-item" }, ["⚙ Settings"]);
      settings.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openSettings(); });
      var regTests = el("button", { class: "hdr-menu-item" }, ["🧪 Run Regression Tests"]);
      regTests.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openTestsPage(); });
      var changelog = el("button", { class: "hdr-menu-item" }, ["📋 Change Log"]);
      changelog.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openChangelog(); });
      return [settings, regTests, changelog];
    }
    var devBtn = el("button", { class: "hdr-menu-item" }, ["🛠 Developer"]);
    devBtn.addEventListener("click", function (e) { e.stopPropagation(); closeMenu(); openDeveloperLogin(); });
    return [devBtn];
  }
  function renderHeaderMenu() {
    var menu = $("#hdrMenu");
    if (!menu) return;
    var backdrop = $("#hdrNavBackdrop");
    var btn = $("#hamburgerBtn");
    menu.classList.toggle("open", state.menuOpen);
    if (backdrop) backdrop.classList.toggle("open", state.menuOpen);
    if (btn) {
      btn.classList.toggle("open", state.menuOpen);
      btn.setAttribute("aria-expanded", state.menuOpen ? "true" : "false");
    }
    menu.innerHTML = "";
    var logoutItem = el("a", { class: "hdr-menu-item", href: "logout.php" }, ["🚪 Logout"]);
    logoutItem.addEventListener("click", closeMenu);
    var items = [];
    // Only offered when an event is open — from the picker itself there is
    // nothing to change back to.
    if (state.currentShow) {
      var changeShowItem = el("a", { class: "hdr-menu-item", href: "#" }, ["🗓️ Change Event"]);
      changeShowItem.addEventListener("click", function (e) {
        e.preventDefault();
        closeMenu();
        closeShow();
      });
      items.push(changeShowItem);
    }
    items = items.concat([logoutItem], buildDeveloperMenuItems());
    items.forEach(function (it) { menu.appendChild(it); });
  }

  // ---------- Settings ----------
  function openSettings() { state.settingsOpen = true; renderSettingsModal(); }
  function closeSettings() { state.settingsOpen = false; renderSettingsModal(); }

  // Optimistic local update, then push to the server. Every officer viewing
  // the site picks up the new value on their next page load.
  function saveAppSettings(patch) {
    Object.keys(patch).forEach(function (k) { state.appSettings[k] = patch[k]; });
    state.appSettingsSaving = true;
    state.appSettingsError = null;
    state.appSettingsSaved = false;
    // Deliberately no renderSettingsModal() here: this fires on every field's
    // blur, and a synchronous full re-render tears down and rebuilds every
    // input on the page — which steals focus mid-Tab when a user tabs quickly
    // through several fields, so keystrokes land on a DOM node the browser
    // already forgot about. Only re-render once the request settles.
    if (!SITE_CONFIG.appSettingsApiUrl) { state.appSettingsSaving = false; renderSettingsModal(); return; }
    fetch(SITE_CONFIG.appSettingsApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", settings: patch })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      state.appSettingsSaving = false;
      state.appSettingsSaved = true;
      renderSettingsModal();
    }).catch(function () {
      state.appSettingsSaving = false;
      state.appSettingsError = "Could not save — check your connection and try again.";
      renderSettingsModal();
    });
  }

  function renderSettingsModal() {
    var host = $("#settingsHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.settingsOpen) return;

    var head = buildPageBanner(closeSettings, "Settings");
    var body = el("div", { class: "api-page-inner" });

    body.appendChild(el("h4", { text: "T-Shirt Vendor" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["Where the T-Shirts tab's “T-Shirt Order Form” defaults its To address and Subject. " +
       "Both stay editable per-send on that screen; nothing is ever sent automatically."]));
    var vendorEmailInput = el("input", { type: "text", value: state.appSettings.tshirtVendorEmail || "" });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Vendor Email" }), vendorEmailInput]));
    var subjectInput = el("input", { type: "text", value: state.appSettings.tshirtOrderSubject || "" });
    body.appendChild(el("div", { class: "form-row" }, [el("span", { class: "form-label", text: "Order Email Subject" }), subjectInput]));

    body.appendChild(el("h4", { text: "Event Model" }));
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["Read-only — these come from the app's build (src/config.js), the same tables the " +
       "original workbook's ConfigurationSheet held. Changing a price mid-event would " +
       "silently re-price registrations already imported, so it's a code change on purpose."]));
    var admTable = el("table", { class: "matrix", style: "max-width:520px" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { class: "lbl", text: "Admission" }), el("th", { text: "Fee" }),
        el("th", { text: "Attendees" }), el("th", { text: "Free shirt from" })
      ])]),
      el("tbody", {}, CONFIG.admissions.map(function (a) {
        return el("tr", {}, [
          el("td", { class: "lbl", text: a.title }),
          el("td", { text: fmtMoney(a.fee) }),
          el("td", { text: String(a.attendees) }),
          el("td", { text: a.freeShirtColumn || "— none —" })
        ]);
      }))
    ]);
    body.appendChild(admTable);
    body.appendChild(el("div", { class: "hint", style: "margin-top:8px" },
      ["Extra shirt unit cost: " + fmtMoney(CONFIG.unitCost) + " — a shirt activity's fee " +
       "divided by this is the quantity ordered."]));

    // Auto-save: every field above saves itself (no Save button) as soon as
    // it loses focus, building the same full patch each time so unrelated
    // fields stay in sync with whatever's currently on screen.
    function autoSaveSettings() {
      var vendorEmail = vendorEmailInput.value.trim();
      if (vendorEmail && vendorEmail.split(/[,;]+/).some(function (a) { return a.trim() && a.trim().indexOf("@") === -1; })) {
        state.appSettingsError = "Vendor Email doesn't look like a valid email address.";
        renderSettingsModal();
        return;
      }
      saveAppSettings({
        tshirtVendorEmail: vendorEmail,
        tshirtOrderSubject: subjectInput.value.trim() || "ETCC Vette Fest — T-Shirt Order"
      });
    }
    [vendorEmailInput, subjectInput].forEach(function (input) { input.addEventListener("blur", autoSaveSettings); });

    var settingsStatus = [];
    if (state.appSettingsSaving) settingsStatus.push(el("span", { class: "count" }, ["Saving…"]));
    else if (state.appSettingsSaved) settingsStatus.push(el("span", { class: "count", style: "color:var(--good)" }, ["Saved."]));
    if (settingsStatus.length) body.appendChild(el("div", { class: "settings-actions" }, settingsStatus));
    if (state.appSettingsError) body.appendChild(el("div", { class: "form-error" }, [state.appSettingsError]));

    var page = el("div", { class: "api-page" }, [head, el("div", { class: "api-page-body" }, [body])]);
    host.appendChild(page);
  }

  // ---------- Regression Tests (full-page screen) ----------
  // Runs the same fixture-based assertions as test/run-tests.js, entirely in
  // this tab (src/regression-tests.js + embedded fixture CSVs, both baked into
  // the build) — it never touches whatever CSVs the user currently has
  // loaded, since it works on its own copy of reg/act rows.
  function runRegressionTests() {
    if (!window.VetteFestRegressionTests || !window.VetteFestFixtures) {
      state.testResults = { results: [{ label: "Regression test module not available in this build", ok: false, expected: "available", actual: "missing" }], passed: 0, failed: 1 };
      renderTestsPage();
      return;
    }
    state.testRunning = true;
    renderTestsPage();
    var F = window.VetteFestFixtures;
    var reg = Papa.parse(F.regCsv, { header: true, skipEmptyLines: true }).data;
    var act = Papa.parse(F.actCsv, { header: true, skipEmptyLines: true }).data;
    var built = window.VetteFestRegressionTests.assertionList(reg, act);
    return window.VetteFestRegressionTests.excelAssertionList(built.out, ExcelJS).then(function (excelResults) {
      var all = built.results.concat(excelResults);
      var passed = all.filter(function (r) { return r.ok; }).length;
      state.testResults = { results: all, passed: passed, failed: all.length - passed };
      state.testRunning = false;
      renderTestsPage();
    }).catch(function (err) {
      state.testResults = { results: built.results.concat([{ label: "Excel round-trip threw", ok: false, expected: "no throw", actual: String(err && err.message || err) }]), passed: 0, failed: 1 };
      state.testRunning = false;
      renderTestsPage();
    });
  }

  // Selecting "Run Regression Tests" opens this page and immediately kicks
  // off a run, rather than opening it and making the officer press a button.
  function openTestsPage() {
    state.testsPageOpen = true;
    runRegressionTests();
  }
  function closeTestsPage() { state.testsPageOpen = false; renderTestsPage(); }

  function renderTestsPage() {
    var host = $("#testsHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.testsPageOpen) return;

    var head = buildPageBanner(closeTestsPage, "Regression Tests");

    var runBtn = el("button", { class: "btn primary" }, [state.testRunning ? "Running…" : "Run Again"]);
    if (state.testRunning) runBtn.setAttribute("disabled", "disabled");
    runBtn.addEventListener("click", runRegressionTests);

    var onlyErrCb = el("input", { type: "checkbox" });
    onlyErrCb.checked = state.testOnlyErrors;
    onlyErrCb.addEventListener("change", function () { state.testOnlyErrors = onlyErrCb.checked; renderTestsPage(); });
    var onlyErrLabel = el("label", {}, [onlyErrCb, document.createTextNode(" Only show errors")]);

    var body = el("div", { class: "api-page-inner" });
    body.appendChild(el("div", { class: "hint", style: "margin-bottom:4px" },
      ["Runs this app's fixture-based test suite in this tab. It uses its own sample data and never touches whatever CSVs you currently have loaded."]));
    body.appendChild(el("div", { class: "settings-actions" }, [runBtn, onlyErrLabel]));

    if (state.testResults) {
      var r = state.testResults;
      body.appendChild(el("div", { class: "test-summary " + (r.failed === 0 ? "good" : "warn") },
        [r.passed + " passed, " + r.failed + " failed"]));
      var shown = state.testOnlyErrors ? r.results.filter(function (t) { return !t.ok; }) : r.results;
      if (!shown.length) {
        body.appendChild(el("div", { class: "hint" }, [state.testOnlyErrors ? "No errors — all checks passed." : "No results."]));
      } else {
        body.appendChild(el("ul", { class: "test-list" }, shown.map(function (t) {
          var kids = [(t.ok ? "✓ " : "✗ ") + t.label];
          if (!t.ok) kids.push(el("div", { class: "expect" }, ["expected " + JSON.stringify(t.expected) + " — got " + JSON.stringify(t.actual)]));
          return el("li", { class: t.ok ? "pass" : "fail" }, kids);
        })));
      }
    }

    var page = el("div", { class: "api-page" }, [head, el("div", { class: "api-page-body" }, [body])]);
    host.appendChild(page);
  }

  // ---------- Change Log ----------
  // Pulls commit history straight from the public GitHub repo's REST API (no
  // server endpoint of our own needed). Re-fetched fresh every time it opens.
  var CHANGELOG_OWNER = "ETCCRepo";
  var CHANGELOG_REPO = "ETCCVetteFest";
  var CHANGELOG_FTP = "ftp.etccapps.com → /apps/vettefest/";
  // Basenames ftp-deploy.sh actually uploads (see that file) — used to count
  // "Files Deployed" out of the repo's full file tree.
  var CHANGELOG_DEPLOYED_FILES = [
    "ETCCVetteFest.html", "_login.html", "index.php", "lib.php", "shows.php",
    "app-settings.php", "deleted-registrations.php", "registration-overrides.php",
    "registrations-upload.php", "registrations-import.php", "send-tshirt-order-email.php",
    "forgot-password.php", "reset-password.php", "dev-forgot-password.php",
    "dev-reset-password.php", "logout.php", "ETCClogoWhiteBackground.png", ".htaccess"
  ];
  var CHANGELOG_TEXT_EXTS = ["html", "js", "css", "md", "php", "json", "txt", "sh", "htaccess"];

  function openChangelog() {
    state.changelogOpen = true;
    renderChangelogPage();
    loadChangelogData();
  }
  function closeChangelog() { state.changelogOpen = false; renderChangelogPage(); }

  // Exact total commit count via GitHub's pagination Link header: request one
  // commit per page, then read the rel="last" page number (= total commits).
  function fetchTotalCommitCount(base) {
    return fetch(base + "/commits?per_page=1").then(function (res) {
      if (!res.ok) return null;
      var link = res.headers.get("Link");
      if (link) {
        var m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
        if (m) return parseInt(m[1], 10);
      }
      return res.json().then(function (arr) { return Array.isArray(arr) ? arr.length : 0; });
    }).catch(function () { return null; });
  }

  function loadChangelogData() {
    state.changelogLoading = true;
    state.changelogError = null;
    renderChangelogPage();
    var base = "https://api.github.com/repos/" + CHANGELOG_OWNER + "/" + CHANGELOG_REPO;
    var commits, fileCount = "—", deployedCount = "—";

    Promise.all([
      fetch(base + "/commits?per_page=100"),
      fetch(base + "/git/trees/HEAD?recursive=1")
    ]).then(function (results) {
      var commitsRes = results[0], treeRes = results[1];
      if (!commitsRes.ok) throw new Error("GitHub API error: " + commitsRes.status);
      return commitsRes.json().then(function (c) {
        commits = c;
        if (!treeRes.ok) return [];
        return treeRes.json().then(function (tree) {
          var blobs = (tree.tree || []).filter(function (n) { return n.type === "blob"; });
          fileCount = blobs.length;
          deployedCount = blobs.filter(function (n) {
            return CHANGELOG_DEPLOYED_FILES.indexOf(n.path.split("/").pop()) !== -1;
          }).length;
          return blobs.filter(function (n) {
            return CHANGELOG_TEXT_EXTS.indexOf(n.path.split(".").pop().toLowerCase()) !== -1;
          });
        });
      });
    }).then(function (textBlobs) {
      return Promise.all(textBlobs.map(function (n) {
        return fetch(base + "/git/blobs/" + n.sha, { headers: { Accept: "application/vnd.github.raw+json" } })
          .then(function (r) { return r.ok ? r.text() : ""; })
          .catch(function () { return ""; });
      }));
    }).then(function (blobTexts) {
      var loc = blobTexts.reduce(function (sum, txt) {
        return sum + (txt.match(/\n/g) || []).length + (txt ? 1 : 0);
      }, 0);
      return fetchTotalCommitCount(base).then(function (totalCommits) {
        state.changelogMeta = {
          repo: CHANGELOG_OWNER + "/" + CHANGELOG_REPO,
          ftp: CHANGELOG_FTP,
          files: String(fileCount),
          filesDeployed: String(deployedCount),
          loc: loc.toLocaleString(),
          totalChanges: (totalCommits != null) ? String(totalCommits) : (commits.length + (commits.length === 100 ? "+" : ""))
        };
        state.changelogCommits = commits.map(function (c) {
          var d = new Date(c.commit.author.date);
          var lines = c.commit.message.split("\n");
          var subject = lines[0];
          var verMatch = subject.match(/\(v[\d.]+\)/);
          var body = lines.slice(1).filter(function (l) {
            return !/^\s*(Co-Authored-By|Signed-off-by):/i.test(l);
          }).join("\n").trim();
          return { sha: c.sha.substring(0, 7), date: d, subject: subject, body: body,
                   version: verMatch ? verMatch[0].replace(/[()]/g, "") : "", fullSha: c.sha };
        });
        state.changelogLoading = false;
        renderChangelogPage();
      });
    }).catch(function (err) {
      state.changelogLoading = false;
      state.changelogError = "Failed to load change log: " + (err && err.message || err);
      renderChangelogPage();
    });
  }

  function fmtChangelogDate(d) {
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var h = d.getHours(), ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + " · " + p(h) + ":" + p(d.getMinutes()) + " " + ap;
  }

  function renderChangelogPage() {
    var host = $("#changelogHost");
    if (!host) return;
    host.innerHTML = "";
    if (!state.changelogOpen) return;

    var head = buildPageBanner(closeChangelog, "Change Log");
    var body = el("div", { class: "changelog-page-inner" }, []);

    if (state.changelogMeta) {
      var m = state.changelogMeta;
      var statDefs = [
        ["Repository", m.repo], ["FTP Deployment Path", m.ftp], ["Files in Repo", m.files],
        ["Files Deployed", m.filesDeployed], ["Lines of Code", m.loc], ["Total Changes", m.totalChanges]
      ];
      body.appendChild(el("div", { class: "changelog-card" }, [
        el("div", { class: "changelog-meta" }, statDefs.map(function (s) {
          return el("div", {}, [el("div", { class: "k" }, [s[0]]), el("div", { class: "v" }, [s[1]])]);
        }))
      ]));
    }

    if (state.changelogLoading) {
      body.appendChild(el("div", { class: "hint" }, ["Loading commits…"]));
    } else if (state.changelogError) {
      body.appendChild(el("div", { class: "form-error" }, [state.changelogError]));
    } else if (state.changelogCommits) {
      var table = el("table", { class: "grid" }, [
        el("thead", {}, [el("tr", {}, [
          el("th", {}, ["Date"]), el("th", {}, ["Version"]), el("th", {}, ["Message"]), el("th", {}, ["SHA"])
        ])]),
        el("tbody", {}, state.changelogCommits.map(function (c) {
          var msgKids = [el("div", { style: "font-weight:600" }, [c.subject])];
          if (c.body) msgKids.push(el("div", { class: "changelog-body" }, [c.body]));
          var link = el("a", { href: "https://github.com/" + CHANGELOG_OWNER + "/" + CHANGELOG_REPO + "/commit/" + c.fullSha, target: "_blank", rel: "noopener", class: "changelog-sha" }, [c.sha]);
          return el("tr", {}, [
            el("td", {}, [fmtChangelogDate(c.date)]),
            el("td", {}, c.version ? [el("span", { class: "changelog-ver" }, [c.version])] : []),
            el("td", { style: "white-space:normal" }, msgKids),
            el("td", {}, [link])
          ]);
        }))
      ]);
      body.appendChild(el("div", { class: "changelog-card flush" }, [
        el("div", { class: "changelog-table-wrap" }, [table])
      ]));
    }

    var page = el("div", { class: "changelog-page" }, [head, el("div", { class: "changelog-page-body" }, [body])]);
    host.appendChild(page);
  }

  // ---------- init ----------
  function init() {
    document.body.appendChild(el("div", { id: "detailHost" }));
    document.body.appendChild(el("div", { id: "printHost" }));
    document.body.appendChild(el("div", { id: "settingsHost" }));
    document.body.appendChild(el("div", { id: "changelogHost" }));
    document.body.appendChild(el("div", { id: "tshirtOrderHost" }));
    document.body.appendChild(el("div", { id: "confirmHost" }));
    document.body.appendChild(el("div", { id: "testsHost" }));
    document.body.appendChild(el("div", { id: "developerLoginHost" }));
    // window.__vettefestSite is set by index.php before this script runs — see
    // the declaration comment near SITE_CONFIG above. Read it here, not at
    // module-load time, since init() is what's guaranteed to run after every
    // inline script in the document.
    SITE_CONFIG = window.__vettefestSite || {};
    buildHeaderMenu();
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") {
        if (state.detailRow) {
          if (e.key === "ArrowLeft") stepDetail(-1);
          else if (e.key === "ArrowRight") stepDetail(1);
        }
        return;
      }
      if (state.settingsOpen) { closeSettings(); return; }
      if (state.testsPageOpen) { closeTestsPage(); return; }
      if (state.developerLoginOpen) { closeDeveloperLogin(); return; }
      if (state.changelogOpen) { closeChangelog(); return; }
      if (state.tshirtOrderPageOpen) { closeTshirtOrderPage(); return; }
      if (state.showPendingDelete) { cancelDeleteShow(); return; }
      if (state.deleteHistoryConfirm) { closeDeleteHistoryConfirm(); return; }
      if (state.deleteRegSelectedOpen) { closeDeleteRegSelectedConfirm(); return; }
      if (state.menuOpen) { closeMenu(); return; }
      if (state.detailRow) closeDetail();
    });
    renderViews();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Debug/test hook (harmless in production): drive the app without file I/O.
  var API = window.__vettefest = {
    get state() { return state; },
    // MUST be called before every other ingest (index.php emits it first):
    // until the app knows which event is open it can't decide whether to
    // render the picker or the tabs, CONFIG.title has to be right before
    // ingestRows() bakes it into state.result.meta.title, and regenerate()
    // reads the open year to build Reg #.
    ingestShows: function (shows, currentYear, openYear) {
      state.shows = (Array.isArray(shows) ? shows.slice() : []).sort(function (a, b) {
        return (Number(b.year) || 0) - (Number(a.year) || 0);
      });
      state.publicShowYear = currentYear ? String(currentYear) : null;
      var open = null;
      if (openYear) {
        var wanted = String(openYear);
        state.shows.forEach(function (s) { if (String(s.year) === wanted) open = s; });
      }
      state.currentShow = open;
      applyShowTitle();
      // One assignment covers every place the event name surfaces — the
      // Summary panel heading, all four print report headers and the Excel
      // export read it through state.result.meta.title.
      if (open) CONFIG.title = LOGIC.showRegistrationTitle(open);
      renderViews();
    },
    ingestRows: function (regRows, actRows, generatedAt) {
      state.reg = { name: "registration.csv", rows: regRows };
      state.act = actRows ? { name: "activity.csv", rows: actRows } : null;
      regenerate(generatedAt);
    },
    // Called by index.php's boot script with app-wide settings read fresh
    // from the server on this page load.
    ingestAppSettings: function (settings) {
      if (settings && typeof settings === "object") {
        Object.keys(settings).forEach(function (k) { state.appSettings[k] = settings[k]; });
      }
    },
    // Called by index.php's boot script with the open event's flyer METADATA
    // ({ exists, mime, name, uploadedAt }) — never the bytes. Absent/ignored
    // when no event is open.
    ingestFlyer: function (meta) {
      state.flyer = (meta && typeof meta === "object" && meta.exists)
        ? { exists: true, mime: meta.mime, name: meta.name, uploadedAt: meta.uploadedAt }
        : { exists: false };
    },
    // Called by index.php's boot script with this event's import log
    // ({ importedAt, regRows, actRows }[]), already sorted newest-first —
    // see the History tab (buildHistoryView()).
    ingestImportHistory: function (list) {
      state.importHistory = Array.isArray(list) ? list : [];
    },
    // Called BEFORE ingestRows(), with the set of csvRegKey()s previously
    // deleted — so regenerate() can exclude them the moment the CSV is
    // parsed, not just after the fact.
    ingestDeletedRegistrations: function (keys) {
      state.deletedCsvKeys = {};
      (Array.isArray(keys) ? keys : []).forEach(function (k) { state.deletedCsvKeys[k] = true; });
    },
    // Same ordering requirement — regenerate() applies these field-edit
    // patches to the freshly-parsed rows immediately.
    ingestRegistrationOverrides: function (overrides) {
      state.csvOverrides = (overrides && typeof overrides === "object") ? overrides : {};
    },
    setTab: function (t) { state.tab = t; renderViews(); },
    setSearch: function (q) { state.search = q; renderRegBody(); },
    openDetail: openDetail,
    closeDetail: closeDetail,
    stepDetail: stepDetail,
    openSettings: openSettings,
    closeSettings: closeSettings,
    exportExcel: exportExcel,
    runRegressionTests: runRegressionTests
  };
  return (window.VetteFest = API);
})();
