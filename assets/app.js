/* ===== 交互逻辑 ===== */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const byId = new Map(ENTRIES.map((e) => [e.id, e]));

  /* ---------- 标签页 ---------- */
  function goTab(name) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $$(".panel").forEach((p) => (p.hidden = p.id !== "tab-" + name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => goTab(t.dataset.tab)));
  $$("[data-goto]").forEach((b) => b.addEventListener("click", () => goTab(b.dataset.goto)));

  /* ---------- 统计 ---------- */
  const TYPE_LABEL = { core: "核心概念", theory: "理论 / 模式", method: "研究方法" };
  $("#stat-total").textContent = ENTRIES.length;
  $("#stat-theory").textContent = ENTRIES.filter((e) => e.type === "theory" || e.type === "core").length;
  $("#stat-method").textContent = ENTRIES.filter((e) => e.type === "method").length;
  $("#footCount").textContent = ENTRIES.length;

  /* ---------- 学科地图 ---------- */
  function renderMap() {
    $("#mapGrid").innerHTML = Object.keys(GROUPS)
      .map((k) => {
        const g = GROUPS[k];
        const n = ENTRIES.filter((e) => e.group === k).length;
        return `<div class="map-card" data-group="${k}" style="--c:${g.color}">
          <div class="mc-top"><span class="mc-dot"></span><h4>${esc(g.label)}</h4><span class="mc-count">${n}</span></div>
          <p>${esc(g.desc)}</p>
        </div>`;
      })
      .join("");
    $$("#mapGrid .map-card").forEach((c) =>
      c.addEventListener("click", () => {
        goTab("library");
        state.group = c.dataset.group;
        state.q = "";
        input.value = "";
        renderChips();
        applyFilters();
      })
    );
  }

  /* ---------- 易混对照 ---------- */
  $("#confusionGrid").innerHTML = CONFUSIONS.map(
    (c) => `<div class="cf-card">
      <div class="cf-vs"><b>${esc(c.a)}</b><i>VS</i><b>${esc(c.b)}</b></div>
      <p>${esc(c.note)}</p>
    </div>`
  ).join("");

  /* ---------- 概念库筛选 ---------- */
  const state = { group: "", level: "", type: "", q: "" };

  function renderChips() {
    const all = Object.keys(GROUPS);
    $("#filterChips").innerHTML =
      `<button class="chip ${state.group === "" ? "on" : ""}" data-g="">全部</button>` +
      all
        .map((k) => `<button class="chip ${state.group === k ? "on" : ""}" data-g="${k}">${esc(GROUPS[k].label)}</button>`)
        .join("");
    $$("#filterChips .chip").forEach((c) =>
      c.addEventListener("click", () => {
        state.group = c.dataset.g;
        renderChips();
        applyFilters();
      })
    );
  }

  function cardHTML(e) {
    const g = GROUPS[e.group];
    return `<article class="card" data-id="${e.id}" style="--c:${g.color};--cbg:${g.color}14">
      <div class="c-top">
        <span class="c-badge">${esc(g.short)}</span>
        <span class="c-level">${esc(e.level)}</span>
      </div>
      <h4>${esc(e.name)}</h4>
      <div class="en">${esc(e.en)}</div>
      <div class="one">${esc(e.one)}</div>
      <div class="c-foot">${(e.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    </article>`;
  }

  function matchQ(e, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return [e.name, e.en, e.one, e.era, (e.scholars || []).join(","), (e.tags || []).join(","), GROUPS[e.group].label]
      .join(" ")
      .toLowerCase()
      .includes(q);
  }

  function applyFilters() {
    const list = ENTRIES.filter(
      (e) =>
        (!state.group || e.group === state.group) &&
        (!state.level || e.level === state.level) &&
        (!state.type || e.type === state.type) &&
        matchQ(e, state.q)
    );
    $("#cardGrid").innerHTML = list.map(cardHTML).join("");
    $("#emptyState").hidden = list.length > 0;
    $("#resultCount").textContent = list.length + " 条";
    $$("#cardGrid .card").forEach((c) => c.addEventListener("click", () => openModal(c.dataset.id)));
  }

  $("#levelFilter").addEventListener("change", (ev) => ((state.level = ev.target.value), applyFilters()));
  $("#typeFilter").addEventListener("change", (ev) => ((state.type = ev.target.value), applyFilters()));

  /* ---------- 详情弹层 ---------- */

  /* 示意图渲染：把抽象的机制画出来 */
  function diagramHTML(dg) {
    if (!dg) return "";
    if (dg.type === "flow") {
      return `<div class="dg dg-flow">${dg.steps
        .map((s, i) => {
          const t = Array.isArray(s) ? s[0] : s;
          const sub = Array.isArray(s) ? s[1] : "";
          return (i ? `<span class="dg-arrow">→</span>` : "") + `<div class="dg-node"><b>${esc(t)}</b>${sub ? `<i>${esc(sub)}</i>` : ""}</div>`;
        })
        .join("")}</div>${dg.note ? `<div class="dg-note">${esc(dg.note)}</div>` : ""}`;
    }
    if (dg.type === "rel") {
      return `<div class="dg dg-rel">${dg.flow
        .map((s, i) => {
          if (s.length === 1) return `<span class="dg-op">${esc(s[0])}</span>`;
          return (i ? `<span class="dg-op">${i ? "→" : ""}</span>` : "") + `<div class="dg-box"><b>${esc(s[0])}</b>${s[1] ? `<i>${esc(s[1])}</i>` : ""}</div>`;
        })
        .join("")}</div>${
        dg.mods && dg.mods.length
          ? `<div class="dg-mods">${dg.mods.map((m) => `<span>${esc(m)}</span>`).join("")}</div>`
          : ""
      }${dg.note ? `<div class="dg-note">${esc(dg.note)}</div>` : ""}`;
    }
    if (dg.type === "vs") {
      return `<div class="dg dg-vs">
        <div class="dg-side"><h6>${esc(dg.left[0])}</h6><p>${esc(dg.left[1])}</p></div>
        <div class="dg-mid">vs</div>
        <div class="dg-side alt"><h6>${esc(dg.right[0])}</h6><p>${esc(dg.right[1])}</p></div>
      </div>${dg.note ? `<div class="dg-note">${esc(dg.note)}</div>` : ""}`;
    }
    return "";
  }

  function openModal(id) {
    const e = byId.get(id);
    if (!e) return;
    const g = GROUPS[e.group];
    const D = (typeof DETAIL !== "undefined" && DETAIL[id]) || {};
    const blk = (title, arr, cls) =>
      arr && arr.length
        ? `<div class="m-block ${cls || ""}"><h5>${title}</h5><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`
        : "";
    const para = (title, body, cls) => {
      if (!body) return "";
      const ps = (Array.isArray(body) ? body : [body]).map((x) => `<p>${esc(x)}</p>`).join("");
      return `<div class="m-block ${cls || ""}"><h5>${title}</h5>${ps}</div>`;
    };

    $("#modalBody").innerHTML = `
      <div class="m-head">
        <div class="m-meta">
          <span class="m-badge" style="--c:${g.color};--cbg:${g.color}14">${esc(g.label)}</span>
          <span class="m-pill">${esc(TYPE_LABEL[e.type])}</span>
          <span class="m-pill">${esc(e.level)}</span>
          <span class="m-pill">${esc(e.era)}</span>
        </div>
        <h2>${esc(e.name)}</h2>
        <div class="m-en">${esc(e.en)}</div>
      </div>
      ${(e.scholars || []).length ? `<div class="m-scholars">${e.scholars.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
      ${D.plain ? `<div class="m-plain"><span class="mp-label">说人话</span><p>${esc(D.plain)}</p></div>` : ""}
      <div class="m-one">${esc(e.one)}</div>
      ${D.diagram ? diagramHTML(D.diagram) : ""}
      ${para("到底怎么回事", D.deep)}
      ${D.terms && D.terms.length ? `<div class="m-block"><h5>关键术语</h5><dl class="m-terms">${D.terms.map((t) => `<dt>${esc(t[0])}</dt><dd>${esc(t[1])}</dd>`).join("")}</dl></div>` : ""}
      ${blk("核心要点", e.points)}
      ${para("它长什么样：一个具体场景", D.scene, "scene")}
      ${blk("经典案例 / 研究实例", e.cases)}
      ${e.use ? para("做研究时怎么用", e.use) : ""}
      ${D.misread ? para("常见误解", D.misread, "warn") : ""}
      ${blk("局限与批评", e.limits, "warn")}
      ${
        (e.see || []).length
          ? `<div class="m-block"><h5>相关条目</h5><div class="m-see">${e.see
              .map((s) => (byId.has(s) ? `<button data-see="${s}">${esc(byId.get(s).name)} →</button>` : ""))
              .join("")}</div></div>`
          : ""
      }
      <div class="m-block"><h5>标签</h5><div class="m-tags">${(e.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div></div>
    `;
    $$("#modalBody [data-see]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.see)));
    $("#modal").hidden = false;
    $(".modal-card").scrollTop = 0;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    $("#modal").hidden = true;
    document.body.style.overflow = "";
  }
  $$("#modal [data-close]").forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (!$("#modal").hidden) closeModal();
      $("#suggest").hidden = true;
    }
  });

  /* ---------- 搜索 ---------- */
  const input = $("#search");
  const sug = $("#suggest");
  let sgList = [], sgIdx = -1;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    state.q = q;
    if (q) {
      goTabSilently("library");
    }
    applyFilters();
    if (!q) return (sug.hidden = true);
    sgList = ENTRIES.filter((e) => matchQ(e, q)).slice(0, 8);
    if (!sgList.length) return (sug.hidden = true);
    sug.innerHTML = sgList
      .map(
        (e, i) =>
          `<div class="sg-item" data-i="${i}"><b>${esc(e.name)}</b><span>${esc(GROUPS[e.group].label)} · ${esc(e.en)}</span></div>`
      )
      .join("");
    sug.hidden = false;
    sgIdx = -1;
    $$(".sg-item", sug).forEach((it) =>
      it.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        openModal(sgList[+it.dataset.i].id);
        sug.hidden = true;
      })
    );
  });

  input.addEventListener("keydown", (ev) => {
    if (sug.hidden) return;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      sgIdx = Math.max(0, Math.min(sgList.length - 1, sgIdx + (ev.key === "ArrowDown" ? 1 : -1)));
      $$(".sg-item", sug).forEach((it, i) => it.classList.toggle("on", i === sgIdx));
    } else if (ev.key === "Enter" && sgIdx >= 0) {
      sug.hidden = true;
      openModal(sgList[sgIdx].id);
    }
  });

  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".search-wrap")) sug.hidden = true;
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "/" && document.activeElement !== input) {
      ev.preventDefault();
      input.focus();
    }
  });

  /* 切换标签但不滚动到顶部（搜索时） */
  function goTabSilently(name) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $$(".panel").forEach((p) => (p.hidden = p.id !== "tab-" + name));
  }

  /* ---------- 方法页 ---------- */
  function renderMethods() {
    const t = METHOD_TABLE;
    $("#methodTable").innerHTML =
      `<thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
      `<tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;

    const mkeys = ["quant", "qual", "comp"];
    let active = "quant";
    const renderChip = () => {
      $("#methodChips").innerHTML = mkeys
        .map((k) => `<button class="chip ${active === k ? "on" : ""}" data-m="${k}">${esc(GROUPS[k].label)}</button>`)
        .join("");
      $$("#methodChips .chip").forEach((c) =>
        c.addEventListener("click", () => {
          active = c.dataset.m;
          renderChip();
          renderGrid();
        })
      );
    };
    const renderGrid = () => {
      const list = ENTRIES.filter((e) => e.group === active);
      $("#methodGrid").innerHTML = list.map(cardHTML).join("");
      $$("#methodGrid .card").forEach((c) => c.addEventListener("click", () => openModal(c.dataset.id)));
    };
    renderChip();
    renderGrid();
  }

  /* ---------- 时间轴 ---------- */
  function renderTimeline() {
    $("#timeline").innerHTML = TIMELINE.map((t) => {
      const c = GROUPS[t.side] ? GROUPS[t.side].color : "#4f6bf6";
      return `<div class="tl-item" style="--c:${c}">
        <div class="tl-card">
          <div class="tl-year">${esc(t.year)}</div>
          <h4>${esc(t.title)}</h4>
          <p>${esc(t.text)}</p>
        </div>
      </div>`;
    }).join("");
  }

  /* ---------- 学习路径 ---------- */
  const LS = "cm-path-progress";
  let store = null;
  try {
    localStorage.setItem("__t", "1");
    localStorage.removeItem("__t");
    store = localStorage;
  } catch (e) {
    store = null; // 某些环境（隐私模式、file:// 限制）不可用时降级为仅本次会话有效
  }
  const readStore = () => {
    if (!store) return [];
    try {
      return JSON.parse(store.getItem(LS) || "[]");
    } catch (e) {
      return [];
    }
  };
  const writeStore = (arr) => {
    try {
      store && store.setItem(LS, JSON.stringify(arr));
    } catch (e) {
      /* 忽略写入失败 */
    }
  };
  let done = new Set(readStore());

  function renderPath() {
    let total = 0, n = 0;
    $("#pathList").innerHTML = PATHS.map((p, i) => {
      const items = p.items
        .map((it) => {
          const e = byId.get(it.id);
          if (!e) return "";
          total++;
          const d = done.has(it.id);
          if (d) n++;
          return `<div class="ps-item ${d ? "done" : ""}" data-p="${it.id}">
            <span class="box" data-toggle="1" role="checkbox" aria-checked="${d}" title="标记完成">${d ? "✓" : ""}</span>
            <span class="name">${esc(e.name)}</span>
            <span class="lvl">${esc(e.level)}</span>
            <span class="jump" title="查看详解">→</span>
          </div>`;
        })
        .join("");
      return `<div class="path-stage">
        <div class="ps-head"><span class="ps-num">${i + 1}</span><h4>${esc(p.stage)}</h4></div>
        <p class="ps-hint">${esc(p.hint)}</p>
        <div class="ps-items">${items}</div>
      </div>`;
    }).join("");

    $$("#pathList .ps-item[data-p]").forEach((el) =>
      el.addEventListener("click", (ev) => {
        const id = el.dataset.p;
        if (ev.target.classList.contains("jump")) {
          openModal(id);
          return;
        }
        if (done.has(id)) done.delete(id);
        else done.add(id);
        writeStore([...done]);
        renderPath();
      })
    );
    const pct = total ? (n / total) * 100 : 0;
    $("#ppFill").style.width = pct + "%";
    $("#ppText").textContent = n + " / " + total;
  }
  $("#resetPath").addEventListener("click", () => {
    done = new Set();
    writeStore([]);
    renderPath();
  });

  /* ---------- 初始化 ---------- */
  renderMap();
  renderChips();
  applyFilters();
  renderMethods();
  renderTimeline();
  renderPath();
})();
