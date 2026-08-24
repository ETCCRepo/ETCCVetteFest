/* =============================================================================
 * logic.js — pure data transform. No DOM. Runs in the browser AND in Node
 * (for the test harness). Ports the VetteFest workbook's VBA pipeline
 * (CSpreadsheet / CRegistrationSheet / CActivity / CItem / CSummarySheet).
 * ========================================================================== */
(function (root) {
  "use strict";

  var CONFIG = root.VetteFestConfig ||
    (typeof require !== "undefined" ? require("./config.js") : null);

  // ---- small helpers -------------------------------------------------------
  function isBlank(v) { return v === null || v === undefined || String(v).trim() === ""; }
  function toInt(v) { var n = parseInt(String(v).replace(/[^0-9\-]/g, ""), 10); return isNaN(n) ? 0 : n; }
  function toNum(v) { if (isBlank(v)) return 0; var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function isYes(v) { return String(v == null ? "" : v).trim().toLowerCase() === "yes"; }

  function formatPhone(phoneTxt) {
    if (isBlank(phoneTxt)) return "";
    var digits = String(phoneTxt).replace(/\D/g, "");
    if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
    if (digits.length === 10) {
      return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
    }
    return String(phoneTxt); // leave untouched if not a 10-digit number
  }

  // Parse "3/7/2026 8:15:00 AM" (or a plain Date) to a millisecond key for
  // matching registrations to their activity rows. Returns NaN if unparseable.
  function dtKey(v) {
    if (v instanceof Date) return v.getTime();
    if (isBlank(v)) return NaN;
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
    if (m) {
      var mo = +m[1], da = +m[2], yr = +m[3], hr = +m[4], mi = +m[5], se = +(m[6] || 0);
      var ap = m[7] ? m[7].toUpperCase() : "";
      if (ap === "PM" && hr < 12) hr += 12;
      if (ap === "AM" && hr === 12) hr = 0;
      return new Date(yr, mo - 1, da, hr, mi, se).getTime();
    }
    var t = Date.parse(s);
    return isNaN(t) ? NaN : t;
  }

  function genFromYear(year) {
    if (!year || year <= 0) return "";
    for (var i = 0; i < CONFIG.corvetteGenerations.length; i++) {
      var g = CONFIG.corvetteGenerations[i];
      if (year >= g.from && year <= g.to) return g.gen;
    }
    return "";
  }

  function hasColumn(rows, name) {
    if (!rows.length) return false;
    return Object.prototype.hasOwnProperty.call(rows[0], name);
  }

  // Shirt bucket key -> its final column header ("FreeLG" -> "Free LG").
  function bucketCol(key, C) {
    C = C || CONFIG;
    for (var i = 0; i < C.SHIRT_BUCKETS.length; i++) if (C.SHIRT_BUCKETS[i].key === key) return C.SHIRT_BUCKETS[i].col;
    return key;
  }

  // The admission config entry for an activity title, or null if the title
  // isn't an admission at all (a shirt Item, or something unrecognized).
  function admissionFor(title, C) {
    C = C || CONFIG;
    for (var i = 0; i < C.admissions.length; i++) {
      if (C.admissions[i].title === title) return C.admissions[i];
    }
    return null;
  }

  // "26-01" — the event year's last two digits, then a zero-padded sequence.
  // The sequence is assigned in Reg Date order (see generate()), so a
  // registrant's number is stable across re-exports as long as nobody
  // registers *earlier* than them, which is impossible after the fact.
  function regNumber(eventYear, seq, C) {
    C = C || CONFIG;
    var yy = String(eventYear == null ? "" : eventYear).slice(-2);
    var n = String(seq);
    while (n.length < (C.regNumberPad || 2)) n = "0" + n;
    return yy + "-" + n;
  }

  // Aggregate attendees/funds/shirts/judges/generations/clubs from a list of
  // already-built registration records (the same shape generate() outputs).
  // Kept independent of generate()'s CSV/activity matching so the app can
  // re-run it against just the currently filtered/visible subset of records
  // (search, status) for a live Summary tab, not only once against the full
  // dataset.
  function summarizeRecords(records, C) {
    C = C || CONFIG;
    var carShow = {}; // gen -> {atEvent, inCarShow}
    C.corvetteGenerations.forEach(function (g) { carShow[g.gen] = { atEvent: 0, inCarShow: 0 }; });
    var clubTally = {}; // name -> attendees (insertion order preserved)
    var shirtTotals = {};
    C.SHIRT_BUCKETS.forEach(function (b) { shirtTotals[b.key] = 0; });
    var totalAttendees = 0, totalFunds = 0, judges = 0;
    var admissionTally = {};
    C.admissions.forEach(function (a) { admissionTally[a.title] = 0; });

    records.forEach(function (rec) {
      var attendee = toInt(rec["#"]) || 0;
      totalAttendees += attendee;
      totalFunds += toNum(rec[C.totalFeeColumn]);
      C.SHIRT_BUCKETS.forEach(function (b) { shirtTotals[b.key] += Number(rec[b.col]) || 0; });

      // "Judges" on the workbook's Summary sheet counts the CSJ ("would you
      // volunteer as a judge?") answers, not the cars being judged — that's
      // the separate SHW column below.
      if (isYes(rec[C.beAJudgeColumn])) judges += 1;

      if (Object.prototype.hasOwnProperty.call(admissionTally, rec["Reg Type"])) {
        admissionTally[rec["Reg Type"]] += 1;
      }

      var gen = rec["Gen"];
      if (gen && carShow[gen]) {
        carShow[gen].atEvent += 1;
        if (isYes(rec[C.carJudgedColumn])) carShow[gen].inCarShow += 1;
      }

      // blank Club Name -> "Unknown" with 0 attendees, matching the VBA
      var club = rec[C.clubNameColumn];
      club = isBlank(club) ? "Unknown" : String(club).trim();
      clubTally[club] = (clubTally[club] || 0) + attendee;
    });

    var clubs = Object.keys(clubTally).map(function (k) {
      return { name: k, attendees: clubTally[k] };
    }).sort(function (a, b) { return b.attendees - a.attendees || (a.name < b.name ? -1 : 1); });

    var gens = C.corvetteGenerations.map(function (g) {
      return { gen: g.gen, from: g.from, to: g.to,
               atEvent: carShow[g.gen].atEvent, inCarShow: carShow[g.gen].inCarShow };
    });

    var admissions = C.admissions.map(function (a) {
      return { title: a.title, fee: a.fee, attendees: a.attendees, count: admissionTally[a.title] };
    });

    return {
      attendees: totalAttendees,
      registrations: records.length,
      funds: totalFunds,
      judges: judges,
      shirtTotals: shirtTotals,
      admissions: admissions,
      gens: gens,
      clubs: clubs
    };
  }

  // ---- main ----------------------------------------------------------------
  // regRows / actRows: arrays of objects keyed by CSV header.
  // opts: { regFileName, actFileName, generatedAt, eventYear }
  function generate(regRows, actRows, opts) {
    opts = opts || {};
    var C = CONFIG;
    var messages = [];

    regRows = regRows || [];
    actRows = actRows || [];

    // --- validation -------------------------------------------------------
    if (!regRows.length) {
      return failure("Registration file is empty.", opts, regRows, actRows);
    }
    if (!hasColumn(regRows, C.registrationValidColumn)) {
      return failure("File is not a Vette Fest registration export — missing column '" +
        C.registrationValidColumn + "'.", opts, regRows, actRows);
    }
    if (actRows.length && !hasColumn(actRows, C.activityValidColumn)) {
      return failure("File is not an activity export — missing column '" +
        C.activityValidColumn + "'.", opts, regRows, actRows);
    }

    // --- final column layout ---------------------------------------------
    var shirtCols = C.SHIRT_BUCKETS.map(function (b) { return b.col; });
    var columns = C.baseColumnOrder.concat(shirtCols);

    // --- index activities by registration datetime -----------------------
    var actByDt = {};
    actRows.forEach(function (a) {
      var k = dtKey(a[C.dateTimeColumn]);
      if (isNaN(k)) return;
      (actByDt[k] || (actByDt[k] = [])).push(a);
    });

    // optionally drop cancelled rows
    var working = regRows.filter(function (r) {
      if (!C.showCancelled && String(r.Status).trim() === "Cancelled") return false;
      return true;
    });

    // --- per-registration processing -------------------------------------
    var records = working.map(function (r) {
      var rec = buildRecord(r, columns, shirtCols);
      var matches = actByDt[dtKey(r[C.dateTimeColumn])] || [];

      // Pass 1 — find the admission. A registration can carry more than one
      // admission row (Single + T-Shirt Only appears in the real data), so
      // resolve them all and let CONFIG.admissions' own order decide, rather
      // than letting whichever row the CSV happened to list first win.
      var admission = null, admissionRow = null;
      matches.forEach(function (a) {
        var found = admissionFor(a["Activity Title"], C);
        if (!found) return;
        if (admission === null || C.admissions.indexOf(found) < C.admissions.indexOf(admission)) {
          admission = found;
          admissionRow = a;
        }
      });

      if (admission) {
        rec["Reg Type"] = admission.title;
        rec["#"] = admission.attendees;
        // The free shirt's size is answered on the admission row itself, in a
        // column that differs per admission type. The two admissions with no
        // freeShirtColumn (Car Show Only, T-Shirt Only) grant no free shirt —
        // that's the event's rule, not missing data, so it isn't a message.
        if (admission.freeShirtColumn) {
          var sizeAnswer = admissionRow[admission.freeShirtColumn];
          if (!isBlank(sizeAnswer)) {
            var fb = C.freeSizeMap[String(sizeAnswer).trim()];
            if (fb) rec[bucketCol(fb, C)] = (rec[bucketCol(fb, C)] || 0) + 1;
            else messages.push("Invalid free t-shirt size '" + sizeAnswer + "' for " +
              (r[C.registrationValidColumn] || ""));
          }
        }
      } else {
        rec["Reg Type"] = "";
        rec["#"] = 0;
        messages.push("No admission activity found for " +
          (r[C.registrationValidColumn] || "") + " (" + (r[C.dateTimeColumn] || "") + ")");
      }

      // Pass 2 — everything that isn't the admission: shirt Items, priced by
      // quantity (a $50 "Extra T-Shirt - XL" row is two XL shirts).
      matches.forEach(function (a) {
        var title = a["Activity Title"];
        if (admissionFor(title, C)) return; // handled above (or a losing duplicate admission)
        var bucket = C.activityTitleToBucket[title];
        if (bucket) {
          var qty = Math.round(toNum(a["Activity Fee"]) / C.unitCost) || 0;
          if (qty <= 0) qty = 1;
          rec[bucketCol(bucket, C)] = (rec[bucketCol(bucket, C)] || 0) + qty;
        } else {
          messages.push("Invalid activity title '" + title + "'");
        }
      });

      // generation from year
      var year = toInt(rec[C.corvetteYearColumn]);
      var gen = genFromYear(year);
      rec["Gen"] = gen;
      if (year > 0 && !gen) {
        messages.push("Invalid Corvette year '" + year + "' for " + (rec["Last Name"] || ""));
      }

      return rec;
    });

    var registrationsCount = records.length;

    // --- sort by registration date ----------------------------------------
    // Must happen BEFORE numbering: Reg # is the position in this order.
    records.sort(function (a, b) {
      var av = dtKey(a["Reg Date"]), bv = dtKey(b["Reg Date"]);
      av = isNaN(av) ? Infinity : av;   // undated rows sort last, and stay last
      bv = isNaN(bv) ? Infinity : bv;
      return av - bv;
    });

    // --- assign Reg # ("26-01", "26-02", ...) -----------------------------
    var eventYear = resolveEventYear(opts.eventYear, records);
    records.forEach(function (rec, i) {
      rec["Reg #"] = regNumber(eventYear, i + 1, C);
    });

    // --- format phones ----------------------------------------------------
    records.forEach(function (rec) { rec["Phone"] = formatPhone(rec["Phone"]); });

    // --- summary ------------------------------------------------------------
    // Computed from the final `records` rather than tracked inline above, so
    // the exact same aggregation can be reused against just a filtered/visible
    // subset of records (see summarizeRecords).
    var summary = summarizeRecords(records, C);
    summary.eventYear = eventYear;

    var errorCount = messages.length;
    var statusMessage = errorCount === 0
      ? "Successfully created " + registrationsCount + " registrations"
      : "Registrations created with " + errorCount + " errors";

    return {
      ok: true,
      columns: columns,
      shirtColumns: shirtCols,
      registrations: records,
      messages: messages,
      summary: summary,
      meta: {
        title: C.title,
        eventYear: eventYear,
        regFileName: opts.regFileName || "",
        actFileName: opts.actFileName || "",
        regRows: regRows.length,
        actRows: actRows.length,
        generatedAt: opts.generatedAt || new Date(),
        statusMessage: statusMessage,
        errorCount: errorCount
      }
    };
  }

  // Which year's event is this? The caller knows (the app passes the open
  // event's year), but the offline tool and the test fixtures don't — fall
  // back to the earliest registration's own year, and only then to today.
  // This only ever decides the "26-" prefix on Reg #.
  function resolveEventYear(explicit, records) {
    var y = toInt(explicit);
    if (y > 0) return y;
    for (var i = 0; i < records.length; i++) {
      var k = dtKey(records[i]["Reg Date"]);
      if (!isNaN(k)) return new Date(k).getFullYear();
    }
    return new Date().getFullYear();
  }

  function buildRecord(srcRow, columns, shirtCols) {
    // Start from a blank record, then copy renamed source values in.
    var rec = blankRecord(columns, shirtCols);
    var C = CONFIG;
    // Deletions are applied BEFORE renames on purpose: ClubExpress's own
    // "Last Name"/"First Name" account fields are dropped so the event
    // question's "VF Last Name"/"VF First Names" can rename into their place
    // without one clobbering the other depending on key iteration order.
    Object.keys(srcRow).forEach(function (k) {
      if (C.deleteColumns.indexOf(k) !== -1) return;
      var finalName = C.renameMap[k] || k;
      if (columns.indexOf(finalName) !== -1) {
        rec[finalName] = srcRow[k];
      }
    });
    // Numeric coercions for display/formatting.
    if (!isBlank(rec["Total Fee"])) rec["Total Fee"] = toNum(rec["Total Fee"]);
    return rec;
  }

  function blankRecord(columns, shirtCols) {
    var rec = {};
    columns.forEach(function (c) { rec[c] = ""; });
    shirtCols.forEach(function (c) { rec[c] = 0; });
    return rec;
  }

  function failure(msg, opts, regRows, actRows) {
    return {
      ok: false,
      columns: [], shirtColumns: [], registrations: [],
      messages: [msg],
      summary: null,
      meta: {
        title: CONFIG.title,
        eventYear: toInt(opts.eventYear) || null,
        regFileName: opts.regFileName || "", actFileName: opts.actFileName || "",
        regRows: (regRows || []).length, actRows: (actRows || []).length,
        generatedAt: opts.generatedAt || new Date(),
        statusMessage: msg, errorCount: 1
      }
    };
  }

  // ---- Events (one per year) ----
  // Mirrors vettefest_valid_year() in deploy/lib.php. The SERVER is the real
  // gate — every endpoint re-validates and 400s on a bad year — but having
  // the same rule here lets the UI reject a typo before the round trip, and
  // puts the contract under the regression suite.
  function validShowYear(raw) {
    var y = String(raw == null ? "" : raw).trim();
    return /^[0-9]{4}$/.test(y) ? y : null;
  }

  // The event name shown by the Summary panel heading, every print report
  // header and the Excel export — they all read it through
  // state.result.meta.title, which generate() copies from CONFIG.title.
  // app.js's ingestShows() assigns this the moment an event is opened.
  //
  // The no-name fallback is CONFIG.defaultTitle, NOT CONFIG.title: ingestShows
  // overwrites `title` in place, so by the time this is called for a second
  // event `title` already holds the FIRST event's name — falling back to it
  // would label an unnamed 2027 event "2026 Vette Fest Registration List".
  function showRegistrationTitle(show) {
    var name = (show && show.name) ? String(show.name).trim() : "";
    return name ? name + " Registration List" : CONFIG.defaultTitle;
  }

  var API = {
    validShowYear: validShowYear,
    showRegistrationTitle: showRegistrationTitle,
    generate: generate,
    summarizeRecords: summarizeRecords,
    formatPhone: formatPhone,
    genFromYear: genFromYear,
    admissionFor: admissionFor,
    regNumber: regNumber,
    dtKey: dtKey,
    toInt: toInt,
    toNum: toNum
  };
  root.VetteFestLogic = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
