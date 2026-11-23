/* ESS Revision site. Plain JS, no build step. */
(function () {
  "use strict";
  var EMAIL = "hoda.labib@sek.sa";
  var app = document.getElementById("app");
  var LS = "essrev:";

  /* ---------- storage ---------- */
  function load(k, d) { try { var v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} }
  function drop(k) { try { localStorage.removeItem(LS + k); } catch (e) {} }

  var state = { level: load("level", "all"), teacher: load("teacher", false), present: load("present", false) };

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function strip(s) { return String(s).replace(/<[^>]+>/g, ""); }
  function topic(code) { return (window.ESS_TOPICS || {})[code]; }
  function stars(n) { if (!n) return '<span class="muted">not yet in past papers</span>'; var k = n >= 10 ? 5 : n >= 5 ? 4 : n >= 3 ? 3 : n >= 2 ? 2 : 1; return '<span class="stars" title="Appeared ' + n + '× in past papers">' + "★".repeat(k) + "</span> <span class='muted'>" + n + "× in past papers</span>"; }
  function lvlPill(p) { return p.hl ? '<span class="pill hl">HL only</span>' : '<span class="pill sl">SL + HL</span>'; }
  function visible(p) { return state.level === "all" || !p.hl; }
  function fmtTime(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }
  function toast(msg) { var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }
  function confirmBox(title, body, okLabel, onOk) {
    var m = document.createElement("div"); m.className = "modal";
    m.innerHTML = '<div class="card"><h2>' + title + '</h2><p>' + body + '</p><div class="row"><button class="btn terra" data-ok>' + okLabel + '</button><button class="btn alt" data-no>Go back</button></div></div>';
    m.querySelector("[data-ok]").onclick = function () { m.remove(); onOk(); };
    m.querySelector("[data-no]").onclick = function () { m.remove(); };
    document.body.appendChild(m);
  }
  function scoreWritten(q, ticks) {
    ticks = ticks || [];
    var n = ticks.length, cap = q.marks;
    if (q.balance) {
      var sides = {};
      ticks.forEach(function (i) { var s = q.points[i] && q.points[i].side; if (s) sides[s] = 1; });
      if (n && !(sides["for"] && sides["against"])) cap = q.marks - 1;
    }
    return Math.min(n, cap);
  }

  /* ---------- chrome ---------- */
  function header() {
    return '<header class="top no-print"><div class="wrap">' +
      '<a class="brand" href="#/"><span class="mark">ESS</span>ESS Revision</a>' +
      '<div class="search"><input id="q" type="search" placeholder="Search notes and key terms…" aria-label="Search"></div>' +
      '<div class="seg" role="group" aria-label="Level"><button data-lv="all" class="' + (state.level === "all" ? "on" : "") + '">HL</button><button data-lv="sl" class="' + (state.level === "sl" ? "on" : "") + '">SL</button></div>' +
      '</div></header>';
  }
  function footer() {
    return '<footer class="no-print"><div class="wrap"><span>IB DP Environmental Systems and Societies · Ms Labib · Notes follow our class decks (Oxford IB ESS, Save My Exams).</span>' +
      '<span><button data-teacher>' + (state.teacher ? "Teacher view: on" : "Teacher view") + '</button> · <button data-present>' + (state.present ? "Normal text" : "Bigger text") + '</button></span></div></footer>';
  }
  function bindChrome() {
    var q = document.getElementById("q");
    if (q) q.addEventListener("keydown", function (e) { if (e.key === "Enter" && q.value.trim()) location.hash = "#/search/" + encodeURIComponent(q.value.trim()); });
    document.querySelectorAll("[data-lv]").forEach(function (b) { b.onclick = function () { state.level = b.dataset.lv; save("level", state.level); route(); }; });
    var t = document.querySelector("[data-teacher]"); if (t) t.onclick = function () { state.teacher = !state.teacher; save("teacher", state.teacher); route(); };
    var p = document.querySelector("[data-present]"); if (p) p.onclick = function () { state.present = !state.present; save("present", state.present); document.body.classList.toggle("present", state.present); route(); };
  }
  function page(inner) {
    app.innerHTML = header() + '<main class="wrap">' + inner + "</main>" + footer(); bindChrome(); window.scrollTo(0, 0);
    var nav = document.querySelector(".side"), on = nav && nav.querySelector("a.on");
    if (nav && on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - nav.clientWidth / 2 + on.offsetWidth / 2;
  }

  /* ---------- home ---------- */
  function renderHome() {
    var html = '<section class="hero"><div class="eyebrow">IB DP ESS · First assessment 2026</div><h1>Revise one guide point at a time.</h1>' +
      '<p>Notes, key terms, case studies, videos and exam-style practice for each guide statement. Mark your own answers against the marking points, then send your practice to Ms Labib.</p></section><div class="grid">';
    window.ESS_COURSE.forEach(function (t) {
      html += '<div class="card topic"><h3><span>' + esc(t.n === "HL" ? "HL" : "Topic " + t.n) + '</span>' + esc(t.name) + '</h3><ul>';
      t.subs.forEach(function (s) {
        var ready = s.ready && topic(s.code);
        html += '<li class="' + (ready ? "ready" : "") + '"><span class="c">' + esc(s.code) + '</span>' +
          (ready ? '<a href="#/' + s.code + '">' + esc(s.name) + '</a>' : '<span class="muted">' + esc(s.name) + '</span> <span class="pill soon">soon</span>') + '</li>';
      });
      html += "</ul></div>";
    });
    page(html + "</div>");
  }

  /* ---------- subtopic ---------- */
  function renderSub(code) {
    var T = topic(code); if (!T) return renderHome();
    var html = '<div class="crumbs"><a href="#/">All topics</a> / ' + esc(T.topic) + '</div>' +
      '<h1><span class="pill code">' + esc(T.code) + '</span> ' + esc(T.name) + '</h1>' +
      '<div class="gq"><b>Guiding question:</b> ' + esc(T.question) + '</div><p>' + T.intro + '</p>' +
      '<div class="row"><a class="btn terra" href="#/' + code + '/practice">Practice and send to Ms Labib</a><a class="btn alt" href="#/' + code + '/' + T.points[0].code + '">Start with ' + T.points[0].code + '</a></div>' +
      '<div class="gp-list">';
    T.points.forEach(function (p) {
      html += '<a class="card gp ' + (visible(p) ? "" : "hidden") + '" href="#/' + code + '/' + p.code + '"><div class="row"><span class="pill code">' + p.code + '</span>' + lvlPill(p) + '</div><div class="t">' + esc(p.title) + '</div><div>' + stars(p.tested) + '</div></a>';
    });
    html += '</div>';
    if (state.level === "sl") html += '<p class="muted">Showing SL content only. Switch to HL at the top to see 6.3.6–6.3.14.</p>';
    html += '<section class="card block"><h2>Key terms for ' + esc(code) + '</h2>' + termsTable(T.terms) + '</section>';
    page(html);
  }
  function termsTable(terms) {
    return '<table class="t"><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody>' + terms.map(function (r) { return "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>"; }).join("") + "</tbody></table>";
  }
  function sideNav(T, cur) {
    var h = '<nav class="side no-print"><div class="lab">SL + HL</div>';
    var hlShown = false;
    T.points.forEach(function (p) {
      if (!visible(p)) return;
      if (p.hl && !hlShown) { h += '<div class="lab">HL only</div>'; hlShown = true; }
      h += '<a class="' + (p.code === cur ? "on" : "") + '" href="#/' + T.code + "/" + p.code + '"><b>' + p.code + "</b><span>" + esc(p.title) + "</span></a>";
    });
    h += '<div class="lab">Practice</div><a class="' + (cur === "practice" ? "on" : "") + '" href="#/' + T.code + '/practice"><b>✎</b><span>Practice and send</span></a></nav>';
    return h;
  }

  /* ---------- diagrams ---------- */
  function bathtub() {
    return '<svg viewBox="0 0 680 300" role="img" aria-label="Bathtub model: tap is emissions, water level is CO2 concentration, drain is sinks">' +
      '<rect x="0" y="0" width="680" height="300" fill="#FFFDF8"/>' +
      '<path d="M150 70 h90 v18 h-60 v26 h-30z" fill="#172A3A"/><circle cx="195" cy="62" r="11" fill="#C8553D"/>' +
      '<rect x="160" y="114" width="14" height="88" fill="#6FA8C9" opacity=".75"/>' +
      '<text x="250" y="60" font-size="15" font-weight="700" fill="#C8553D">TAP = EMISSIONS</text><text x="250" y="80" font-size="13" fill="#5B6670">burning fossil fuels adds CO₂</text>' +
      '<path d="M90 140 h460 v80 q0 40 -40 40 h-380 q-40 0 -40 -40z" fill="none" stroke="#172A3A" stroke-width="5"/>' +
      '<path d="M95 180 h450 v40 q0 35 -35 35 h-380 q-35 0 -35 -35z" fill="#6FA8C9" opacity=".55"/>' +
      '<line x1="95" y1="180" x2="545" y2="180" stroke="#2F6F73" stroke-width="2" stroke-dasharray="6 5"/>' +
      '<text x="330" y="212" text-anchor="middle" font-size="15" font-weight="700" fill="#172A3A">WATER LEVEL = CO₂ CONCENTRATION</text>' +
      '<text x="330" y="232" text-anchor="middle" font-size="13" fill="#172A3A">adaptation = coping with the level already in the tub</text>' +
      '<rect x="470" y="258" width="26" height="22" fill="#172A3A"/><path d="M483 280 v14" stroke="#6FA8C9" stroke-width="5"/>' +
      '<text x="508" y="276" font-size="15" font-weight="700" fill="#2F6F73">DRAIN = SINKS</text><text x="508" y="294" font-size="12" fill="#5B6670">oceans, forests: slow</text>' +
      '<rect x="590" y="24" width="80" height="120" rx="10" fill="#F8EBD6"/><text x="630" y="48" text-anchor="middle" font-size="12" font-weight="700" fill="#C8553D">MITIGATION</text>' +
      '<text x="630" y="72" text-anchor="middle" font-size="11" fill="#172A3A">turn the tap</text><text x="630" y="86" text-anchor="middle" font-size="11" fill="#172A3A">down</text>' +
      '<text x="630" y="108" text-anchor="middle" font-size="11" fill="#172A3A">widen the</text><text x="630" y="122" text-anchor="middle" font-size="11" fill="#172A3A">drain</text>' +
      '<text x="20" y="30" font-size="13" fill="#5B6670">IN &gt; OUT → the level keeps rising,</text><text x="20" y="48" font-size="13" fill="#5B6670">even when the tap is turned down.</text>' +
      "</svg>";
  }
  function sspBars() {
    var d = [["SSP1-1.9", 1.4, "#2F6F73"], ["SSP1-2.6", 1.8, "#4E8C7A"], ["SSP2-4.5", 2.7, "#E0A458"], ["SSP3-7.0", 3.6, "#D9824B"], ["SSP5-8.5", 4.4, "#C8553D"]];
    return '<div class="bars">' + d.map(function (r) { return '<div class="bar"><b>' + r[0] + '</b><div class="track"><div class="fill" style="width:' + (r[1] / 5 * 100) + '%;background:' + r[2] + '"></div></div><b>≈' + r[1] + '°C</b></div>'; }).join("") +
      '</div><p class="muted" style="margin:10px 0 0">Best-estimate warming by 2100 (IPCC AR6). Paris aim: well below 2°C, ideally 1.5°C. Only SSP1 roads stay below 2°C.</p>';
  }

  /* ---------- question blocks ---------- */
  function mcqHtml(q, id, opts) {
    opts = opts || {};
    var chosen = opts.chosen, reveal = opts.reveal;
    var h = '<div class="q" data-mcq="' + id + '"><div class="qt">' + esc(q.q) + "</div><div class='opts'>";
    q.opts.forEach(function (o, i) {
      var cls = "opt";
      if (chosen === i) cls += " sel";
      if (reveal) { if (i === q.a) cls += " right"; else if (chosen === i) cls += " wrong"; }
      h += '<button class="' + cls + '" data-i="' + i + '"' + (reveal || opts.locked ? " disabled" : "") + '><span class="l">' + "ABCD"[i] + "</span><span>" + esc(o) + "</span></button>";
    });
    h += "</div>";
    if (reveal) h += '<div class="why">' + (chosen === q.a ? "✓ Correct. " : chosen == null ? "" : "✗ Not quite. ") + esc(q.why) + "</div>";
    return h + "</div>";
  }
  function msHtml(q, id, ticks, editable) {
    ticks = ticks || [];
    var h = '<div class="ms" data-ms="' + id + '"><div class="hd"><span>Marking points: tick each one your answer makes</span><span class="score">Your mark: <span data-sc>' + scoreWritten(q, ticks) + "</span> / " + q.marks + "</span></div>";
    q.points.forEach(function (p, i) {
      h += '<label><input type="checkbox" data-pt="' + i + '"' + (ticks.indexOf(i) > -1 ? " checked" : "") + (editable ? "" : " disabled") + "><span>" + esc(p.t) + (p.side ? '<span class="side-tag ' + p.side + '">' + p.side + "</span>" : "") + "</span></label>";
    });
    if (q.note) h += '<div class="note"><b>Note:</b> ' + esc(q.note) + "</div>";
    h += '<div class="note">Award up to [' + q.marks + '] in total. Be strict: only tick a point if your answer clearly makes it.</div>';
    return h + "</div>";
  }

  /* ---------- guide point ---------- */
  function renderPoint(code, gp) {
    var T = topic(code); if (!T) return renderHome();
    var idx = T.points.findIndex(function (p) { return p.code === gp; });
    if (idx < 0) return renderSub(code);
    var p = T.points[idx];
    var key = "gp:" + gp;
    var st = load(key, { m: {}, w: {}, wl: {}, wt: {} });
    var n = 0;
    function sec(title, body, cls) { n++; return '<section class="card block ' + (cls || "") + '"><h2><span class="n">' + String(n).padStart(2, "0") + "</span>" + title + "</h2>" + body + "</section>"; }

    var main = '<div class="crumbs"><a href="#/">All topics</a> / <a href="#/' + code + '">' + code + " " + esc(T.name) + "</a></div>" +
      '<div class="row"><span class="pill code">' + p.code + "</span>" + lvlPill(p) + stars(p.tested) + "</div><h1>" + esc(p.title) + "</h1>" +
      '<div class="guide"><div class="lab">IB guide statement</div><p>' + esc(p.guide) + "</p></div>";

    if (state.teacher && p.teacher) main += '<section class="card block tbox"><h2>Teacher links</h2>' + p.teacher.map(function (t) { return '<p><a target="_blank" rel="noopener" href="' + t.url + '">' + esc(t.label) + "</a></p>"; }).join("") + "</section>";

    main += sec("Notes", '<div class="notes">' + p.notes.map(function (s) { return "<h3>" + esc(s.h) + "</h3><ul>" + s.items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>"; }).join("") + "</div>");
    if (p.diagram === "bathtub") main += sec("The bathtub model", '<div class="diagram">' + bathtub() + "</div>");
    if (p.diagram === "ssp") main += sec("Warming by 2100 in each scenario", sspBars());
    if (p.table) main += sec("Comparing the scenarios", '<table class="t"><thead><tr>' + p.table.head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + p.table.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>");
    if (p.timeline) main += sec("Timeline", '<ul class="timeline">' + p.timeline.map(function (t) { return '<li><span class="y">' + t[0] + "</span><span><b>" + esc(t[1]) + "</b>: " + esc(t[2]) + "</span></li>"; }).join("") + "</ul>");
    if (p.pros) main += sec("Strengths and limitations", '<table class="t pc"><thead><tr><th>Strategy</th><th>+ Strengths</th><th>− Limitations</th></tr></thead><tbody>' + p.pros.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td><td>" + esc(r[2]) + "</td></tr>"; }).join("") + "</tbody></table>");
    if (p.terms) main += sec("Key terms", termsTable(p.terms));
    if (p.cases) main += sec("Case studies and named examples", p.cases.map(function (c) { return '<div class="case"><h3>' + esc(c.title) + "</h3><ul>" + c.items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul></div>"; }).join(""));
    if (p.videos) main += sec("Watch on Edpuzzle", p.videos.map(function (v) { return '<div class="vid"><a class="play" target="_blank" rel="noopener" href="' + v.url + '" aria-label="Open video">▶</a><div><a target="_blank" rel="noopener" href="' + v.url + '"><b>' + esc(v.title) + "</b></a>" + (v.author ? '<div class="muted">' + esc(v.author) + "</div>" : "") + "</div></div>"; }).join("") + '<p class="muted" style="margin:10px 0 0">Answer the questions inside each video. Sign in to Edpuzzle with your school account.</p>');
    if (p.sort) main += sec(esc(p.sort.title), sortHtml(p.sort, st), "sort");
    main += sec("Quick check", '<p class="muted">Pick an answer to see if you are right.</p>' + p.mcq.map(function (q, i) {
      var c = st.m[i]; return mcqHtml(q, i, { chosen: c, reveal: c != null || state.teacher });
    }).join(""));
    main += sec("Exam-style practice", '<p class="muted">Write your answer, lock it, then mark it against the marking points.</p>' + p.written.map(function (q, i) {
      var locked = st.wl[i] || state.teacher;
      return '<div class="q" data-w="' + i + '"><div class="qt">' + esc(q.q) + ' <span class="mk">[' + q.marks + "]</span></div>" +
        '<textarea data-wa="' + i + '"' + (st.wl[i] ? " readonly" : "") + ' placeholder="Write your answer here…">' + esc(st.w[i] || "") + "</textarea>" +
        (locked ? msHtml(q, i, st.wt[i], !state.teacher || st.wl[i]) : '<div class="row" style="margin-top:10px"><button class="btn teal" data-lock="' + i + '">Lock my answer and show marking points</button></div>') + "</div>";
    }).join(""));

    var prev = T.points.slice(0, idx).reverse().find(visible), next = T.points.slice(idx + 1).find(visible);
    main += '<div class="row no-print" style="justify-content:space-between">' +
      (prev ? '<a class="btn alt" href="#/' + code + "/" + prev.code + '">← ' + prev.code + "</a>" : "<span></span>") +
      (next ? '<a class="btn" href="#/' + code + "/" + next.code + '">' + next.code + " →</a>" : '<a class="btn terra" href="#/' + code + '/practice">Practice and send →</a>') + "</div>";

    page('<div class="split">' + sideNav(T, gp) + "<div>" + main + "</div></div>");

    /* bind */
    document.querySelectorAll("[data-mcq]").forEach(function (box) {
      var i = +box.dataset.mcq;
      box.querySelectorAll("button.opt").forEach(function (b) {
        b.onclick = function () { st.m[i] = +b.dataset.i; save(key, st); box.outerHTML = mcqHtml(p.mcq[i], i, { chosen: st.m[i], reveal: true }); };
      });
    });
    document.querySelectorAll("[data-wa]").forEach(function (ta) { ta.addEventListener("input", function () { st.w[ta.dataset.wa] = ta.value; save(key, st); }); });
    document.querySelectorAll("[data-lock]").forEach(function (b) {
      b.onclick = function () {
        var i = b.dataset.lock;
        if (!(st.w[i] || "").trim()) { toast("Write an answer first."); return; }
        confirmBox("Lock your answer?", "You won't be able to change it after you see the marking points.", "Lock it", function () { st.wl[i] = true; st.wt[i] = []; save(key, st); renderPoint(code, gp); });
      };
    });
    document.querySelectorAll("[data-ms]").forEach(function (box) {
      var i = box.dataset.ms;
      box.querySelectorAll("[data-pt]").forEach(function (cb) {
        cb.onchange = function () {
          var t = Array.from(box.querySelectorAll("[data-pt]:checked")).map(function (c) { return +c.dataset.pt; });
          st.wt[i] = t; save(key, st); box.querySelector("[data-sc]").textContent = scoreWritten(p.written[i], t);
        };
      });
    });
    bindSort(p, st, key);
  }

  function sortHtml(s, st) {
    var placed = st.sort || {};
    function chip(it, i) {
      var pl = placed[i], cls = pl == null ? "" : (pl === it[1] ? "ok" : "no");
      return '<span class="chip ' + cls + '" data-si="' + i + '">' + esc(it[0]) + (pl == null ? '<button data-to="0">' + esc(s.a) + '</button><button data-to="1">' + esc(s.b) + "</button>" : "") + "</span>";
    }
    var pool = "", a = "", b = "", right = 0, done = 0;
    s.items.forEach(function (it, i) {
      var pl = placed[i];
      if (pl == null) pool += chip(it, i); else { done++; if (pl === it[1]) right++; if (pl === 0) a += chip(it, i); else b += chip(it, i); }
    });
    return '<p class="muted">Send each example to the right box. Green = correct, red = think again.</p><div class="chips" data-pool>' + (pool || '<span class="muted">All sorted: ' + right + " / " + s.items.length + " correct.</span>") + "</div>" +
      '<div class="bins"><div class="bin"><h3>' + esc(s.a) + '</h3><div class="chips">' + a + '</div></div><div class="bin"><h3>' + esc(s.b) + '</h3><div class="chips">' + b + "</div></div></div>" +
      (done ? '<div class="row" style="margin-top:10px"><button class="btn alt" data-sreset>Start again</button></div>' : "");
  }
  function bindSort(p, st, key) {
    if (!p.sort) return;
    var box = document.querySelector("section.sort");
    function rebind() {
      box.querySelectorAll("[data-to]").forEach(function (b) {
        b.onclick = function () { var i = +b.parentNode.dataset.si; st.sort = st.sort || {}; st.sort[i] = +b.dataset.to; save(key, st); redraw(); };
      });
      var r = box.querySelector("[data-sreset]"); if (r) r.onclick = function () { st.sort = {}; save(key, st); redraw(); };
    }
    function redraw() { var h2 = box.querySelector("h2").outerHTML; box.innerHTML = h2 + sortHtml(p.sort, st); rebind(); }
    rebind();
  }

  /* ---------- practice and submit ---------- */
  var timer = null;
  function renderPractice(code) {
    if (timer) { clearInterval(timer); timer = null; }
    var T = topic(code); if (!T) return renderHome();
    var key = "practice:" + code;
    var P = load(key, null);
    if (!P) return practiceSetup(T, key);
    var pts = T.points.filter(function (p) { return P.gps.indexOf(p.code) > -1; });
    var locked = P.submitted;

    var head = '<div class="crumbs"><a href="#/">All topics</a> / <a href="#/' + code + '">' + code + "</a> / Practice</div>";
    var bar = '<div class="bar-fixed no-print"><span><b>' + esc(P.name) + "</b> · " + esc(P.cls) + "</span>" +
      '<span>Time: <span class="clock" data-clock>' + fmtTime(elapsed(P)) + "</span></span>" +
      (P.finished ? "<span>Marked ✓</span>" : P.submitted ? "<span>Submitted: now mark your written answers</span>" : "<span>Answers save automatically</span>") + "</div>";

    var body = "";
    if (P.finished) body += resultsHtml(T, P, pts);
    pts.forEach(function (p) {
      body += '<section class="card block"><h2><span class="pill code">' + p.code + "</span> " + esc(p.title) + "</h2>";
      p.mcq.forEach(function (q, i) {
        var id = p.code + "-m" + i;
        body += mcqHtml(q, id, { chosen: P.mcq[id], reveal: locked, locked: locked });
      });
      p.written.forEach(function (q, i) {
        var id = p.code + "-w" + i;
        body += '<div class="q"><div class="qt">' + esc(q.q) + ' <span class="mk">[' + q.marks + "]</span></div>" +
          '<textarea data-pa="' + id + '"' + (locked ? " readonly" : "") + ' placeholder="Write your answer here…">' + esc(P.wr[id] || "") + "</textarea>" +
          (locked ? msHtml(q, id, P.ticks[id], !P.finished) : "") + "</div>";
      });
      body += "</section>";
    });
    var actions = !P.submitted ? '<div class="row"><button class="btn terra" data-submit>Submit my answers</button><span class="muted">After you submit, answers lock and the marking points appear.</span></div>' :
      !P.finished ? '<div class="row"><button class="btn terra" data-finish>Finish marking and see my results</button></div>' :
      '<div class="row"><button class="btn alt" data-new>Start a new practice</button></div>';

    page('<div class="split">' + sideNav(T, "practice") + '<div class="noselect" data-guard>' + head + bar + '<div style="height:14px"></div>' + body + actions + "</div></div>");

    guard(document.querySelector("[data-guard]"));
    if (!P.finished) timer = setInterval(function () { var c = document.querySelector("[data-clock]"); if (!c) { clearInterval(timer); return; } c.textContent = fmtTime(elapsed(P)); }, 1000);

    document.querySelectorAll("[data-mcq]").forEach(function (box) {
      var id = box.dataset.mcq;
      box.querySelectorAll("button.opt").forEach(function (b) {
        b.onclick = function () { P.mcq[id] = +b.dataset.i; save(key, P); box.querySelectorAll("button.opt").forEach(function (x) { x.classList.toggle("sel", x === b); }); };
      });
    });
    document.querySelectorAll("[data-pa]").forEach(function (ta) { ta.addEventListener("input", function () { P.wr[ta.dataset.pa] = ta.value; save(key, P); }); });
    document.querySelectorAll("[data-ms]").forEach(function (box) {
      var id = box.dataset.ms, gp = id.split("-w")[0], q = T.points.find(function (p) { return p.code === gp; }).written[+id.split("-w")[1]];
      box.querySelectorAll("[data-pt]").forEach(function (cb) {
        cb.onchange = function () { var t = Array.from(box.querySelectorAll("[data-pt]:checked")).map(function (c) { return +c.dataset.pt; }); P.ticks[id] = t; save(key, P); box.querySelector("[data-sc]").textContent = scoreWritten(q, t); };
      });
    });
    var s = document.querySelector("[data-submit]");
    if (s) s.onclick = function () {
      var miss = 0; pts.forEach(function (p) { p.mcq.forEach(function (q, i) { if (P.mcq[p.code + "-m" + i] == null) miss++; }); p.written.forEach(function (q, i) { if (!(P.wr[p.code + "-w" + i] || "").trim()) miss++; }); });
      confirmBox("Submit your answers?", (miss ? "<b>" + miss + " question" + (miss > 1 ? "s are" : " is") + " still blank.</b> " : "") + "Your answers will lock. Then you'll mark your written answers.", "Submit", function () {
        P.submitted = true; P.submitAt = Date.now(); save(key, P); renderPractice(code);
      });
    };
    var f = document.querySelector("[data-finish]");
    if (f) f.onclick = function () { P.finished = true; P.endAt = Date.now(); save(key, P); renderPractice(code); };
    var nw = document.querySelector("[data-new]");
    if (nw) nw.onclick = function () { confirmBox("Start a new practice?", "Download your PDF first. This clears your current answers on this device.", "Start new", function () { drop(key); renderPractice(code); }); };
    var pdf = document.querySelector("[data-pdf]"); if (pdf) pdf.onclick = function () { makePdf(T, P, pts); };
    var em = document.querySelector("[data-email]"); if (em) em.onclick = function () { location.href = mailto(T, P, pts); };
  }
  function elapsed(P) { var end = P.finished ? P.endAt : P.submitted ? P.submitAt : Date.now(); return (end - P.started) / 1000; }
  function guard(el) {
    ["copy", "cut", "paste", "drop", "contextmenu", "selectstart"].forEach(function (ev) {
      el.addEventListener(ev, function (e) { if (ev === "selectstart" && e.target.tagName === "TEXTAREA") return; e.preventDefault(); if (ev !== "selectstart" && ev !== "contextmenu") toast("Copy and paste are turned off in practice."); });
    });
  }
  function practiceSetup(T, key) {
    var html = '<div class="crumbs"><a href="#/">All topics</a> / <a href="#/' + T.code + '">' + T.code + "</a> / Practice</div><h1>Practice " + T.code + " and send it to Ms Labib</h1>" +
      '<div class="card"><div class="form">' +
      '<label>Your full name<input type="text" id="nm" autocomplete="name"></label>' +
      '<label>Class<select id="cl"><option value="">Choose…</option><option>DP1 ESS</option><option>DP2 ESS</option></select></label>' +
      '<label>Level<select id="lv"><option value="hl"' + (state.level === "all" ? " selected" : "") + '>HL (all guide points)</option><option value="sl"' + (state.level === "sl" ? " selected" : "") + '>SL (6.3.1–6.3.5)</option></select></label>' +
      '<div><b style="font-size:.92rem">Guide points to include</b><div class="checks" id="ck"></div></div>' +
      '<p class="muted" style="margin:0">The timer starts when you begin and records your total time. Copy and paste are turned off. Answers save on this device as you type. At the end you mark your written answers, download a PDF, email it to Ms Labib and upload it to ManageBac.</p>' +
      '<div class="row"><button class="btn terra" id="go">Start practice</button></div></div></div>';
    page('<div class="split">' + sideNav(T, "practice") + "<div>" + html + "</div></div>");
    var lv = document.getElementById("lv"), ck = document.getElementById("ck");
    function drawChecks() { ck.innerHTML = T.points.filter(function (p) { return lv.value === "hl" || !p.hl; }).map(function (p) { return '<label><input type="checkbox" value="' + p.code + '" checked> ' + p.code + " " + esc(p.title) + "</label>"; }).join(""); }
    lv.onchange = drawChecks; drawChecks();
    document.getElementById("go").onclick = function () {
      var nm = document.getElementById("nm").value.trim(), cl = document.getElementById("cl").value;
      var gps = Array.from(ck.querySelectorAll("input:checked")).map(function (c) { return c.value; });
      if (!nm || !cl) { toast("Enter your name and class."); return; }
      if (!gps.length) { toast("Choose at least one guide point."); return; }
      save(key, { name: nm, cls: cl, level: lv.value, gps: gps, started: Date.now(), mcq: {}, wr: {}, ticks: {}, submitted: false, finished: false });
      renderPractice(T.code);
    };
  }
  function tally(T, P, pts) {
    var rows = [], got = 0, max = 0;
    pts.forEach(function (p) {
      var g = 0, m = 0;
      p.mcq.forEach(function (q, i) { m++; if (P.mcq[p.code + "-m" + i] === q.a) g++; });
      p.written.forEach(function (q, i) { m += q.marks; g += scoreWritten(q, P.ticks[p.code + "-w" + i]); });
      rows.push([p.code, p.title, g, m]); got += g; max += m;
    });
    return { rows: rows, got: got, max: max };
  }
  function resultsHtml(T, P, pts) {
    var r = tally(T, P, pts), pc = r.max ? Math.round(r.got / r.max * 100) : 0;
    return '<section class="card block" style="border:2px solid var(--terra)"><h2>Your results</h2>' +
      '<div class="row" style="gap:28px;margin-bottom:12px"><div><div class="big">' + r.got + " / " + r.max + '</div><div class="muted">' + pc + '%</div></div><div><div class="big">' + fmtTime(elapsed(P)) + '</div><div class="muted">total time</div></div></div>' +
      r.rows.map(function (x) { return '<div class="result-row"><b>' + x[0] + "</b><span>" + esc(x[1]) + '</span><b style="text-align:right">' + x[2] + "/" + x[3] + "</b></div>"; }).join("") +
      '<div class="row no-print" style="margin-top:16px"><button class="btn terra" data-pdf>1 · Download PDF</button><button class="btn teal" data-email>2 · Email Ms Labib</button></div>' +
      '<p style="margin:10px 0 0"><b>3 · Upload the PDF to the ManageBac task.</b> Work not uploaded to ManageBac gets a zero. Attach the PDF to the email too.</p></section>';
  }
  function mailto(T, P, pts) {
    var r = tally(T, P, pts);
    var body = "Dear Ms Labib,\n\nHere is my ESS " + T.code + " practice. The PDF is attached.\n\nName: " + P.name + "\nClass: " + P.cls + "\nLevel: " + P.level.toUpperCase() +
      "\nScore: " + r.got + " / " + r.max + "\nTime taken: " + fmtTime(elapsed(P)) + "\n\n" + r.rows.map(function (x) { return x[0] + ": " + x[2] + "/" + x[3]; }).join("\n") + "\n\nThank you,\n" + P.name;
    return "mailto:" + EMAIL + "?subject=" + encodeURIComponent("ESS " + T.code + " practice – " + P.name + " (" + P.cls + ")") + "&body=" + encodeURIComponent(body);
  }
  function loadJsPdf(cb) {
    if (window.jspdf) return cb();
    var s = document.createElement("script"); s.src = "assets/jspdf.umd.min.js";
    s.onload = cb; s.onerror = function () { toast("PDF tool didn't load. Use your browser's Print → Save as PDF."); window.print(); };
    document.head.appendChild(s);
  }
  function makePdf(T, P, pts) {
    loadJsPdf(function () {
      var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }), y = 18, W = 180, X = 15;
      function line(txt, size, bold, color) {
        doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size || 10); doc.setTextColor.apply(doc, color || [23, 42, 58]);
        doc.splitTextToSize(clean(txt), W).forEach(function (l) { if (y > 282) { doc.addPage(); y = 18; } doc.text(l, X, y); y += (size || 10) * 0.45; });
      }
      function gap(n) { y += n || 2; }
      var r = tally(T, P, pts);
      line("ESS " + T.code + " " + T.name + ": practice", 15, true); gap(2);
      line("Name: " + P.name + "    Class: " + P.cls + "    Level: " + P.level.toUpperCase());
      line("Date: " + new Date(P.started).toLocaleString() + "    Time taken: " + fmtTime(elapsed(P)));
      line("Score: " + r.got + " / " + r.max + " (" + (r.max ? Math.round(r.got / r.max * 100) : 0) + "%)", 12, true); gap(2);
      r.rows.forEach(function (x) { line(x[0] + "  " + x[1] + ":  " + x[2] + "/" + x[3]); });
      gap(4);
      pts.forEach(function (p) {
        line(p.code + " " + p.title, 12, true, [200, 85, 61]); gap(1);
        p.mcq.forEach(function (q, i) {
          var c = P.mcq[p.code + "-m" + i], ok = c === q.a;
          line((i + 1) + ". " + q.q, 10, true);
          line("Answer: " + (c == null ? "(blank)" : "ABCD"[c] + ". " + q.opts[c]) + (ok ? "   [correct, 1/1]" : "   [0/1] Correct: " + "ABCD"[q.a] + ". " + q.opts[q.a]), 10, false, ok ? [46, 125, 79] : [178, 58, 58]);
          gap(1);
        });
        p.written.forEach(function (q, i) {
          var id = p.code + "-w" + i, t = P.ticks[id] || [];
          line(q.q + " [" + q.marks + "]", 10, true);
          line("Answer: " + ((P.wr[id] || "").trim() || "(blank)"));
          line("Self-marked: " + scoreWritten(q, t) + " / " + q.marks, 10, true, [47, 111, 115]);
          q.points.forEach(function (pt, k) { line((t.indexOf(k) > -1 ? "[x] " : "[ ] ") + pt.t, 9, false, t.indexOf(k) > -1 ? [23, 42, 58] : [140, 140, 140]); });
          gap(2);
        });
        gap(2);
      });
      doc.save("ESS " + T.code + " practice - " + P.name.replace(/[^\w\s-]/g, "") + ".pdf");
    });
  }
  function clean(s) { return strip(s).replace(/[₂]/g, "2").replace(/[₄]/g, "4").replace(/[⁻]/g, "-").replace(/[²]/g, "2").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/≈/g, "~").replace(/→/g, "->").replace(/[×]/g, "x").replace(/°/g, " deg ").replace(/[^\x00-\xFF]/g, ""); }

  /* ---------- search ---------- */
  function renderSearch(q) {
    var term = q.toLowerCase(), hits = [];
    Object.keys(window.ESS_TOPICS || {}).forEach(function (code) {
      var T = topic(code);
      T.points.forEach(function (p) {
        if (!visible(p)) return;
        var bits = [p.title, p.guide].concat((p.terms || []).map(function (t) { return t[0] + ": " + t[1]; }));
        p.notes.forEach(function (s) { bits = bits.concat(s.items); });
        (p.cases || []).forEach(function (c) { bits.push(c.title); bits = bits.concat(c.items); });
        bits.forEach(function (b) { var s = strip(b); var k = s.toLowerCase().indexOf(term); if (k > -1) hits.push({ code: code, p: p, s: s, k: k }); });
      });
    });
    var html = '<div class="crumbs"><a href="#/">All topics</a> / Search</div><h1>Results for “' + esc(q) + "”</h1>";
    if (!hits.length) html += '<p class="muted">Nothing found. Try a shorter word, like “carbon” or “NAPA”.</p>';
    hits.slice(0, 60).forEach(function (h) {
      var s = h.s, a = Math.max(0, h.k - 70), snip = (a ? "…" : "") + esc(s.slice(a, h.k)) + "<mark>" + esc(s.substr(h.k, q.length)) + "</mark>" + esc(s.slice(h.k + q.length, h.k + 120)) + "…";
      html += '<a class="card gp" style="margin-bottom:10px" href="#/' + h.code + "/" + h.p.code + '"><div class="row"><span class="pill code">' + h.p.code + "</span><b>" + esc(h.p.title) + '</b></div><div class="muted" style="margin-top:6px">' + snip + "</div></a>";
    });
    page(html);
    var box = document.getElementById("q"); if (box) box.value = q;
  }

  /* ---------- router ---------- */
  function route() {
    if (timer) { clearInterval(timer); timer = null; }
    document.body.classList.toggle("present", state.present);
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, "")), parts = h.split("/").filter(Boolean);
    if (!parts.length) return renderHome();
    if (parts[0] === "search") return renderSearch(parts.slice(1).join("/"));
    if (parts.length === 1) return renderSub(parts[0]);
    if (parts[1] === "practice") return renderPractice(parts[0]);
    return renderPoint(parts[0], parts[1]);
  }
  window.addEventListener("hashchange", route);
  route();
})();
