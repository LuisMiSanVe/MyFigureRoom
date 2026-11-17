const K = "myfigureroom.v2";
let D = {
    mfc_username: "",
    synced: "",
    figures: [],
    orders: [],
    shelf: { figures: [] },
    wall: { items: [] },
    over: {},
    scales: {},
  },
  sel = null,
  pc = false,
  page = 0,
  view = 1,
  vy = 0,
  lastDown = 0;
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
try {
  const r = localStorage.getItem(K);
  if (r) D = Object.assign(D, JSON.parse(r));
} catch (e) {}
if (!(D.rows >= 3)) D.rows = 3;
let warned = false;
if (!D.scales || typeof D.scales !== "object") D.scales = {};
if (!D.shelf || !Array.isArray(D.shelf.figures)) D.shelf = { figures: [] };
if (!D.over) D.over = {};
if (!D.wall || !Array.isArray(D.wall.items)) D.wall = { items: [] };
if (!D.rowsReset3) {
  D.rowsReset3 = true;
  if (D.rows > 3) {
    D.rows = 3;
    D.shelf.figures.forEach((s) => {
      if (typeof s.row === "number" && s.row > 2) {
        s.row = 2;
        s.y = undefined;
      }
    });
  }
  save();
}
function save() {
  try {
    localStorage.setItem(K, JSON.stringify(D));
  } catch (e) {
    if (!warned) {
      warned = true;
      alert(
        "Browser storage is full. Use Backup on the computer to export your room, and reset large uploaded images.",
      );
    }
  }
}
const room = $("#room");
function go(v) {
  view = v;
  const st = $("#stage");
  st.classList.toggle("right", v === 1);
  st.classList.toggle("wall", v === 2);
  $("#box").classList.toggle("on", v >= 1);
  sel = null;
  closeBoxModal();
  $("#panel").classList.toggle("on", false);
  $("#L").style.display = v > 0 ? "" : "none";
  $("#R").style.display = v < 2 ? "" : "none";
  $("#L").setAttribute("aria-label", v === 2 ? "Go to shelf" : "Go to bedroom");
  $("#R").setAttribute("aria-label", v === 0 ? "Go to shelf" : "Go to poster wall");
  $("#R").title = v === 0 ? "Go to shelf" : "Pin posters on the wall";
  render();
  updateV();
}
$("#L").onclick = () => go(Math.max(0, view - 1));
$("#R").onclick = () => go(Math.min(2, view + 1));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOpen()) {
    e.preventDefault();
    closeBoxModal();
    return;
  }
  if (e.target.tagName === "INPUT") return;
  if (e.key === "Escape") {
    if ($("#wish").classList.contains("on")) wake();
    else if (pc) pcOff();
    else if (view >= 1 && sel) clearSel();
    return;
  }
  if (pc || $("#wish").classList.contains("on")) return;
  if (view === 1 && e.key === "ArrowUp") setV(vy - STEP);
  if (view === 1 && e.key === "ArrowDown") setV(vy + STEP);
  if (e.key === "ArrowLeft") go(Math.max(0, view - 1));
  if (e.key === "ArrowRight") go(Math.min(2, view + 1));
});
["bed", "pc"].forEach((id) => {
  const n = $("#" + id);
  n.onclick = () => (id === "bed" ? dream() : pcOn());
  n.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      n.onclick();
    }
  };
});

const cache = {},
  ARC = {};
const thumb = (f) =>
  D.over[f.id] ||
  (f.image.startsWith("data:")
    ? f.image
    : "/api/img?url=" + encodeURIComponent(f.image));
async function procSrc(f) {
  if (D.over[f.id]) return D.over[f.id];
  if (f.image.startsWith("data:")) return f.image;
  if (cache[f.id]) return cache[f.id];
  try {
    const r = await fetch(thumb(f));
    if (!r.ok) throw 0;
    const bm = await createImageBitmap(await r.blob()),
      s = Math.min(1, 480 / Math.max(bm.width, bm.height)),
      w = Math.round(bm.width * s),
      h = Math.round(bm.height * s),
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.drawImage(bm, 0, 0, w, h);
    clearBg(x, w, h);
    return (cache[f.id] = c.toDataURL("image/png"));
  } catch (e) {
    return thumb(f);
  }
}
function clearBg(x, w, h) {
  const d = x.getImageData(0, 0, w, h),
    p = d.data;
  let r = 0,
    g = 0,
    b = 0;
  for (const [i, j] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]) {
    const k = (j * w + i) * 4;
    r += p[k] / 4;
    g += p[k + 1] / 4;
    b += p[k + 2] / 4;
  }
  const seen = new Uint8Array(w * h),
    st = [];
  const ok = (i) => {
    const k = i * 4;
    return (
      Math.abs(p[k] - r) + Math.abs(p[k + 1] - g) + Math.abs(p[k + 2] - b) < 90
    );
  };
  for (let i = 0; i < w; i++) st.push(i, (h - 1) * w + i);
  for (let j = 0; j < h; j++) st.push(j * w, j * w + w - 1);
  while (st.length) {
    const i = st.pop();
    if (seen[i] || !ok(i)) continue;
    seen[i] = 1;
    p[i * 4 + 3] = 0;
    const cx = i % w;
    if (cx > 0) st.push(i - 1);
    if (cx < w - 1) st.push(i + 1);
    if (i >= w) st.push(i - w);
    if (i < w * (h - 1)) st.push(i + w);
  }
  x.putImageData(d, 0, 0);
}
function fillImg(im, f, box) {
  im.src = thumb(f);
  procSrc(f).then((s) => {
    im.onload = () => {
      ARC[f.id] = im.naturalWidth + "/" + im.naturalHeight;
      if (box) box.style.aspectRatio = ARC[f.id];
    };
    im.src = s;
  });
}

function applySync(j) {
  D.figures = [
    ...j.owned.map((x) => ({ ...x, list: "owned" })),
    ...j.wished.map((x) => ({ ...x, list: "wishlist" })),
  ];
  const own = new Set(j.owned.map((x) => x.id));
  D.shelf.figures = D.shelf.figures.filter((s) => own.has(s.fid));
  D.wall.items = D.wall.items.filter((s) => own.has(s.fid));
  const tr = new Map(D.orders.map((o) => [o.id, o.tracking_id]));
  D.orders = j.ordered.map((o) => ({
    id: o.id,
    figure_name: o.name,
    tracking_id: tr.get(o.id) || "",
  }));
  D.synced = new Date().toLocaleString();
  save();
  drawShelf();
  setV(vy);
  render();
}
async function sync() {
  const r = await fetch("/api/mfc?user=" + encodeURIComponent(D.mfc_username));
  let j = {};
  try {
    j = await r.json();
  } catch (e) {
    throw new Error(
      "Can’t reach the MyFigureRoom server. Run python server.py on your computer and open http://localhost:3000.",
    );
  }
  if (!r.ok) throw new Error(j.error || "Server error " + r.status);
  applySync(j);
}
function sample() {
  const C = [
    ["#f58fb0", "#7c63d6"],
    ["#7cc4f2", "#f58fb0"],
    ["#7fd3b0", "#a392ea"],
    ["#ffd36b", "#4db07f"],
    ["#a392ea", "#ffd36b"],
    ["#f5b48c", "#7cc4f2"],
    ["#4db07f", "#f58fb0"],
    ["#f2688f", "#7fd3b0"],
  ];
  const mk = (i) => {
    const [a, b] = C[i % 8];
    return (
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200"><ellipse cx="60" cy="192" rx="40" ry="7" fill="#0002"/><rect x="40" y="96" width="40" height="80" rx="16" fill="${a}"/><rect x="44" y="170" width="14" height="20" rx="5" fill="${b}"/><rect x="62" y="170" width="14" height="20" rx="5" fill="${b}"/><circle cx="60" cy="62" r="34" fill="#ffe3d0"/><path d="M24 62C20 20 100 20 96 62 88 40 32 40 24 62z" fill="${b}"/><path d="M26 60c-6 40 4 60 12 70M94 60c6 40-4 60-12 70" stroke="${b}" stroke-width="10" stroke-linecap="round" fill="none"/><circle cx="48" cy="68" r="4" fill="#4f4068"/><circle cx="72" cy="68" r="4" fill="#4f4068"/></svg>`,
      )
    );
  };
  const it = (p, n, i) => ({
    id: p + i,
    name: `Sample figure ${i + 1} (${["1/8", "1/7", "1/6", "1/8", "1/4", "1/7", "1/8", "1/6"][(i + n) % 8]})`,
    image: mk(i + n),
  });
  applySync({
    owned: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => it("so", 0, i)),
    wished: [0, 1, 2, 3, 4, 5, 6].map((i) => it("sw", 3, i)),
    ordered: [0, 1].map((i) => ({
      id: "sd" + i,
      name: "Sample preorder " + (i + 1),
    })),
  });
}

function pcOn() {
  pc = true;
  document.body.classList.add("pc");
  $("#s1").classList.add("zoom");
  $("#os").classList.add("open");
  clock();
}
function pcOff() {
  pc = false;
  $("#win").innerHTML = "";
  $("#os").classList.remove("open");
  $("#s1").classList.remove("zoom");
  document.body.classList.remove("pc");
}
$("#off").onclick = pcOff;
function clock() {
  $("#clk").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
setInterval(clock, 30000);
document
  .querySelectorAll("#os .ic")
  .forEach((b) => (b.onclick = () => app(b.dataset.a)));
function win(t, body) {
  $("#win").innerHTML =
    `<div class="win" role="dialog" aria-label="${t}"><div class="wt"><button class="dot" id="wx" aria-label="Close window"></button><b>${t}</b></div><div class="wb">${body}</div></div>`;
  $("#wx").onclick = () => ($("#win").innerHTML = "");
}
function app(a) {
  if (a === "mfc") {
    win(
      "MFC profile",
      `<h2>MyFigureCollection</h2><p class="muted">Enter your public MFC username. Your collection, wishlist and orders must be public on MFC. No password is needed.</p><div class="row"><input id="un" placeholder="username" value="${esc(D.mfc_username)}"><button class="b p" id="us">Save and sync</button></div><p id="um" class="muted">${D.synced ? `${D.figures.filter((f) => f.list === "owned").length} owned, ${D.figures.filter((f) => f.list === "wishlist").length} on your wishlist. Last synced ${esc(D.synced)}.` : "Not synced yet."}</p><div class="row"><button class="b" id="sm">Preview with sample figures</button></div>`,
    );
    $("#us").onclick = async () => {
      D.mfc_username = $("#un").value.trim();
      save();
      if (!D.mfc_username) {
        $("#um").textContent = "Enter a username first.";
        return;
      }
      $("#um").textContent = "Syncing…";
      try {
        await sync();
        app("mfc");
      } catch (e) {
        $("#um").textContent = e.message;
      }
    };
    $("#sm").onclick = () => {
      sample();
      app("mfc");
    };
  }
  if (a === "bak") {
    win(
      "Backup",
      `<h2>Your room data</h2><p class="muted">Export saves your username, tracking IDs, shelf layout and uploaded images to a JSON file. Import restores it on any device.</p><div class="row"><button class="b p" id="ex">Export JSON</button><button class="b" id="im">Import JSON</button></div>`,
    );
    $("#ex").onclick = () => {
      const l = document.createElement("a");
      l.href = URL.createObjectURL(
        new Blob([JSON.stringify(D, null, 2)], { type: "application/json" }),
      );
      l.download = "myfigureroom.json";
      l.click();
    };
    $("#im").onclick = () => $("#impf").click();
  }
  if (a === "trk") {
    win(
      "Tracking",
      `<h2>Ongoing orders</h2>${D.orders.length ? `<p class="muted">Orders come from your MFC profile. Add a tracking ID to each; clear the field to remove it.</p><div id="ol">${D.orders.map((o) => `<div class="ord" data-id="${esc(o.id)}"><span>${esc(o.figure_name)}</span><input placeholder="Tracking ID" value="${esc(o.tracking_id)}"></div>`).join("")}</div><div class="row"><button class="b p" id="os2">Save</button></div>` : '<p class="muted">No ongoing orders yet. They appear here after you sync your MFC profile, if your orders are public.</p>'}`,
    );
    if ($("#os2"))
      $("#os2").onclick = () => {
        document.querySelectorAll("#ol .ord").forEach((r) => {
          const o = D.orders.find((x) => x.id === r.dataset.id);
          if (o) o.tracking_id = r.querySelector("input").value.trim();
        });
        save();
        $("#os2").textContent = "Saved";
      };
  }
}
$("#impf").onchange = async (e) => {
  try {
    const j = JSON.parse(await e.target.files[0].text());
    if (!j.figures || !j.shelf) throw 0;
    D = Object.assign(
      { over: {}, orders: [], scales: {}, rows: 3, wall: { items: [] } },
      j,
    );
    if (!D.scales || typeof D.scales !== "object") D.scales = {};
    if (!(D.rows >= 3)) D.rows = 3;
    if (!D.wall || !Array.isArray(D.wall.items)) D.wall = { items: [] };
    vy = 0;
    save();
    drawShelf();
    setV(0);
    render();
  } catch (x) {
    alert("That file isn’t a MyFigureRoom export.");
  }
  e.target.value = "";
};

function veil(mid) {
  const d = $("#dream");
  d.classList.remove("go", "fade");
  void d.offsetWidth;
  d.classList.add("go");
  setTimeout(mid, 1980);
}
function fade(mid) {
  const d = $("#dream");
  d.classList.remove("go", "fade");
  void d.offsetWidth;
  d.classList.add("fade");
  setTimeout(mid, 650);
}
function dream() {
  veil(() => {
    page = 0;
    wishRender();
    $("#wish").classList.add("on");
    document.body.classList.add("dz");
  });
}
function wake() {
  fade(() => {
    $("#wish").classList.remove("on");
    document.body.classList.remove("dz");
  });
}
$("#wake").onclick = wake;
$("#wl").onclick = () => {
  page--;
  wishRender();
};
$("#wr").onclick = () => {
  page++;
  wishRender();
};
function wishRender() {
  const w = D.figures.filter((f) => f.list === "wishlist"),
    per = 6,
    pp = per * 3,
    pages = Math.max(1, Math.ceil(w.length / pp));
  page = Math.max(0, Math.min(page, pages - 1));
  const sh = $("#wshelf");
  sh.innerHTML = "";
  for (let r = 0; r < 3; r++) {
    const row = document.createElement("div");
    row.className = "wrow";
    w.slice(page * pp + r * per, page * pp + r * per + per).forEach((f) => {
      const d = document.createElement("div");
      d.className = "wf";
      const im = new Image();
      im.alt = "";
      d.appendChild(im);
      const s = document.createElement("span");
      s.textContent = f.name;
      d.appendChild(s);
      d.title = f.name;
      fillImg(im, f);
      row.appendChild(d);
    });
    sh.appendChild(row);
  }
  const em = $("#wempty");
  em.hidden = !!w.length;
  em.textContent =
    "Your wishlist is empty. Open the computer, enter your MFC username and sync to fill this shelf.";
  $("#wl").style.display = page > 0 ? "" : "none";
  $("#wr").style.display = page < pages - 1 ? "" : "none";
}

const STEP = 225,
  REF = 8,
  BASE = 195,
  CLEAR = 22;
let SHELF = { hs: [STEP, STEP, STEP], surf: [772, 547, 322], extra: 0 };
const figEl = (fid) => document.querySelector(`.fig[data-id="${fid}"]`);
const fById = (id) => D.figures.find((f) => f.id === id);

const WALL_BOTTOM = 624,
  POST_H = 320,
  PINS = [
    ["#f58fb0", "#d4608a"],
    ["#ffd36b", "#d9a52c"],
    ["#7fd3b0", "#43a67d"],
    ["#a392ea", "#7c63d6"],
    ["#7cc4f2", "#3f94cc"],
  ];
const usedIds = () =>
  new Set([...D.shelf.figures, ...D.wall.items].map((s) => s.fid));
function aspectOf(fid) {
  const a = String(ARC[fid] || "").split("/"),
    r = +a[0] / +a[1];
  return r > 0 && isFinite(r) ? r : 0.72;
}
function postH(s) {
  return Math.round(
    Math.min(POST_H * (s.scale || 1), 560, 1400 / aspectOf(s.fid)),
  );
}
function hashId(fid) {
  let h = 7;
  for (const c of String(fid)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
const tiltOf = (fid) => ((hashId(fid) % 33) - 16) / 10;
function makePin(fid) {
  const [c, d] = PINS[(hashId(fid) >> 3) % PINS.length],
    p = document.createElement("span");
  p.className = "pin";
  p.style.setProperty("--pc", c);
  p.style.setProperty("--pd", d);
  p.innerHTML =
    '<i class="pin-sh"></i><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="pa" cx="20" cy="20" r="18"/><circle class="pb" cx="20" cy="19" r="14.5"/><circle class="pa pd" cx="20" cy="19" r="6.5"/><ellipse class="ph" cx="14" cy="12.5" rx="5.5" ry="3.3" transform="rotate(-35 14 12.5)"/></svg><i class="pin-ring"></i>';
  return p;
}
function pinIt(el, s, anim) {
  el.querySelectorAll(".pin").forEach((n) => n.remove());
  const p = makePin(s.fid);
  el.appendChild(p);
  if (anim) {
    p.classList.add("drop");
    el.classList.remove("tap");
    void el.offsetWidth;
    el.classList.add("tap");
    setTimeout(() => el.classList.remove("tap"), 750);
  }
}
function unpin(el, s) {
  s.pinned = false;
  el.querySelectorAll(".pin").forEach((n) => n.remove());
  el.classList.add("lift");
}
function popIn(el) {
  const a = el.classList.contains("post") ? "-50%,-50%" : "-50%,-100%";
  el.animate(
    [
      { transform: `translate(${a}) scale(.7)`, opacity: 0.2 },
      { transform: `translate(${a}) scale(1)`, opacity: 1 },
    ],
    { duration: 180 },
  );
}
function addPlaced(f, x, y) {
  if (view === 2) {
    const s = {
      fid: f.id,
      x: clampX(x),
      y: Math.max(0, Math.min(900, y)),
      scale: 1,
      pinned: false,
    };
    D.wall.items.push(s);
    return s;
  }
  if (!D.scales[f.id]) D.scales[f.id] = scaleOf(f.id);
  const s = { fid: f.id, x: clampX(x), y: clampY(y), scale: 1, row: null };
  D.shelf.figures.push(s);
  return s;
}
function clampPost(s) {
  const h = postH(s),
    w = h * aspectOf(s.fid);
  s.x = Math.round(Math.max(w / 2 + 16, Math.min(1600 - w / 2 - 16, s.x)));
  s.y = Math.round(Math.max(h / 2 + 20, Math.min(WALL_BOTTOM - h / 2, s.y)));
  return h;
}
function placePost(el, s, h) {
  el.style.left = s.x / 16 + "%";
  el.style.top = s.y / 9 + "%";
  el.style.height = h / 9 + "%";
}
function fitPost(el, s) {
  if (!el || s.pinned === false) return;
  placePost(el, s, clampPost(s));
}
function settleWall(s) {
  const el = figEl(s.fid),
    h = clampPost(s);
  s.pinned = true;
  if (el) {
    el.classList.remove("lift");
    el.style.transition = "left .2s ease, top .2s ease";
    placePost(el, s, h);
    setTimeout(() => (el.style.transition = ""), 260);
    pinIt(el, s, true);
  }
  save();
  updateBox();
  renderPanel();
}
function fillPost(im, f, box, s) {
  im.onload = () => {
    ARC[f.id] = im.naturalWidth + "/" + im.naturalHeight;
    box.style.aspectRatio = ARC[f.id];
    fitPost(box, s);
  };
  im.src = thumb(f);
}
function renderWall() {
  const box = $("#posts");
  box.innerHTML = "";
  D.wall.items.forEach((s) => {
    const f = fById(s.fid);
    if (!f) return;
    const e = document.createElement("div");
    e.className = "fig post" + (sel === s.fid ? " sel" : "");
    e.dataset.id = s.fid;
    e.title = f.name;
    e.style.setProperty("--tilt", tiltOf(s.fid) + "deg");
    e.style.aspectRatio = ARC[f.id] || "auto";
    placePost(e, s, postH(s));
    const im = new Image();
    im.alt = f.name;
    e.appendChild(im);
    fillPost(im, f, e, s);
    if (s.pinned !== false) e.appendChild(makePin(s.fid));
    e.onpointerdown = (ev) => drag(ev, s, e);
    box.appendChild(e);
  });
  $("#whint").hidden = D.wall.items.length > 0;
}

function parseScale(name) {
  const m = String(name || "").match(/(?:^|[^0-9])1\s*\/\s*(\d{1,3})(?![0-9])/);
  return m ? Math.max(1, +m[1]) : 0;
}
function scaleOf(fid) {
  if (D.scales[fid]) return +D.scales[fid];
  const f = fById(fid);
  const d = f ? parseScale(f.name) : 0;
  return d || REF;
}
const scaleLabel = (d) => "1/" + d;
function figHeight(s) {
  return Math.round(BASE * (REF / scaleOf(s.fid)) * (s.scale || 1));
}
function surfaces(hs) {
  const a = [772];
  for (let i = 0; i < hs.length - 1; i++) a.push(a[i] - hs[i]);
  return a;
}
function inferRow(y) {
  if (y >= 790) return -1;
  return Math.max(0, Math.min(D.rows - 1, Math.round((772 - y) / STEP)));
}
function refreshShelf() {
  D.shelf.figures.forEach((s) => {
    if (typeof s.row !== "number" || !isFinite(s.row)) s.row = inferRow(s.y);
  });
  const hs = Array.from({ length: D.rows }, () => STEP);
  D.shelf.figures.forEach((s) => {
    const r = s.row;
    if (r >= 0 && r < D.rows && fById(s.fid))
      hs[r] = Math.max(hs[r], Math.ceil((figHeight(s) + CLEAR) / 5) * 5);
  });
  const surf = surfaces(hs),
    total = hs.reduce((a, b) => a + b, 0);
  D.shelf.figures.forEach((s) => {
    if (s.row >= 0 && s.row < D.rows) s.y = surf[s.row];
  });
  SHELF = { hs, surf, extra: Math.max(0, total - STEP * 3) };
}
const ext = () => SHELF.extra;
function landPoint(x, y) {
  const floor = Math.max(830, Math.min(900, y));
  if (x < 170 || x > 1430) return { y: floor, row: -1 };
  const c = SHELF.surf.filter((v) => v >= y - 6);
  const t = c.length ? Math.min(...c) : floor;
  return { y: t, row: SHELF.surf.indexOf(t) };
}
function setV(v) {
  vy = Math.max(-ext(), Math.min(0, v));
  $("#world").style.transform = `translateY(${-vy / 9}%)`;
  updateV();
}
function updateV() {
  const top = vy <= -ext();
  $("#U").style.display = view === 1 ? "" : "none";
  $("#U .pls").style.display = top ? "" : "none";
  $("#D").style.display = view === 1 && vy < 0 ? "" : "none";
}
$("#U").onclick = () => {
  if (vy <= -ext()) {
    D.rows++;
    save();
    drawShelf();
    setV(vy - STEP);
    positionFigs();
    updateBox();
  } else setV(vy - STEP);
};
$("#D").onclick = () => setV(vy + STEP);
let wl = 0;
$("#s2").addEventListener(
  "wheel",
  (e) => {
    if (view !== 1) return;
    e.preventDefault();
    const t = Date.now();
    if (t - wl < 650) return;
    wl = t;
    setV(vy + (e.deltaY < 0 ? -STEP : STEP));
  },
  { passive: false },
);
function drawShelf() {
  refreshShelf();
  const e = SHELF.extra,
    sv = $("#ssvg");
  sv.setAttribute("viewBox", `0 ${-e} 1600 ${900 + e}`);
  sv.style.top = -e / 9 + "%";
  sv.style.height = (900 + e) / 9 + "%";
  const b = SHELF.surf
    .map(
      (y) =>
        `<rect class="bs" x="170" y="${y}" width="1260" height="18"/><rect x="170" y="${y + 18}" width="1260" height="12" fill="#4f406824"/>`,
    )
    .join("");
  sv.innerHTML = `<rect x="0" y="${-e}" width="1600" height="${900 + e}" fill="url(#w)"/><rect class="fl" y="650" width="1600" height="250"/><path class="pl" d="M0 720h1600M0 790h1600M0 860h1600" fill="none"/><rect class="bs" y="636" width="1600" height="18"/><path d="M-20 ${50 - e}Q400 ${130 - e} 800 ${60 - e}T1620 ${60 - e}" stroke="#ffd36b" stroke-width="12" stroke-linecap="round" stroke-dasharray="0 52" fill="none"/><rect x="140" y="${82 - e}" width="1320" height="${790 + e}" rx="16" fill="#4f406826"/><rect class="bs" x="140" y="${70 - e}" width="1320" height="${790 + e}" rx="16"/><rect class="lv2" x="170" y="${100 - e}" width="1260" height="${760 + e}" rx="8"/><rect x="170" y="${100 - e}" width="1260" height="${760 + e}" rx="8" fill="url(#g)" opacity=".7"/>${b}<g><path class="gr" d="M60 850c-40-50-30-110-10-150 14 50 30 90 10 150zM80 850c0-70 20-120 50-150 6 60-6 110-50 150z"/><path class="pk" d="M40 820h64l-10 50H50z"/></g><g><path class="gr2" d="M1540 850c-40-50-30-110-10-150 14 50 30 90 10 150zM1560 850c0-70 20-120 50-150 6 60-6 110-50 150z"/><path class="yl" d="M1520 820h64l-10 50h-44z"/></g>`;
}
function positionFigs() {
  D.shelf.figures.forEach((s) => {
    const e = figEl(s.fid);
    if (!e) return;
    e.style.left = s.x / 16 + "%";
    e.style.top = s.y / 9 + "%";
    e.style.height = figHeight(s) / 9 + "%";
  });
}
function relayout() {
  drawShelf();
  positionFigs();
  setV(vy);
  updateV();
  updateBox();
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("on"), 2200);
}
function updateBox() {
  const used = usedIds(),
    owned = D.figures.filter((f) => f.list === "owned"),
    left = owned.filter((f) => !used.has(f.id)).length,
    b = $("#box");
  $("#boxCount").textContent = !owned.length
    ? "No figures yet"
    : left
      ? left + " to unpack · drag or click"
      : "All unpacked · click";
  b.classList.toggle("empty", !left);
  b.setAttribute(
    "aria-label",
    !owned.length
      ? "My Figures box. It is empty. Sync your MFC profile on the computer to fill it."
      : left
        ? `My Figures box. ${left} figures left. Click to browse, or hold and drag to pull one out.`
        : "My Figures box. All your figures are already on the shelf. Click to browse.",
  );
  b.title = left
    ? "Click to browse the box, or hold and drag to pull out a random figure"
    : "Click to browse the box";
}
function randomUnplaced() {
  const used = usedIds(),
    pool = D.figures.filter((f) => f.list === "owned" && !used.has(f.id));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
function boxEmpty() {
  const b = $("#box");
  b.classList.remove("shake");
  void b.offsetWidth;
  b.classList.add("shake");
  const owned = D.figures.filter((f) => f.list === "owned").length;
  toast(
    owned
      ? "Every owned item is already on display."
      : "Your box is empty. Sync your MFC profile on the computer, or load the sample figures there.",
  );
}

let pull = null,
  boxPress = null,
  modalDrag = null;
const setDragging = (on) => document.body.classList.toggle("dragging", on);
function toShelf(cx, cy) {
  const r = room.getBoundingClientRect();
  return {
    x: ((cx - r.left) / r.width) * 1600,
    y: ((cy - r.top) / r.height) * 900 + (view === 1 ? vy : 0),
  };
}
const clampX = (v) => Math.max(0, Math.min(1600, v));
const clampY = (v) => Math.max(view === 2 ? 0 : -ext(), Math.min(900, v));
function overBox(x, y) {
  const b = $("#box");
  if (view < 1 || !b.classList.contains("on")) return false;
  const r = b.getBoundingClientRect();
  return (
    x >= r.left - 12 &&
    x <= r.right + 12 &&
    y >= r.top - 12 &&
    y <= r.bottom + 12
  );
}
function clearBoxHandlers() {
  const b = $("#box");
  if (!b) return;
  b.classList.remove("holding");
  b.onpointermove = b.onpointerup = b.onpointercancel = null;
  setDragging(false);
}
function startPull(ev, f) {
  const b = $("#box");
  b.classList.add("holding");
  setDragging(true);
  const p = toShelf(ev.clientX, ev.clientY);
  const s = addPlaced(f, p.x, p.y);
  sel = f.id;
  save();
  render();
  pull = { id: ev.pointerId, s, el: figEl(f.id) };
  if (pull.el) {
    pull.el.style.transition = "none";
    popIn(pull.el);
  }
}
function movePull(ev) {
  const p = toShelf(ev.clientX, ev.clientY);
  pull.s.x = clampX(p.x);
  pull.s.y = clampY(p.y);
  if (pull.el) {
    pull.el.style.left = pull.s.x / 16 + "%";
    pull.el.style.top = pull.s.y / 9 + "%";
  }
}
function boxDown(ev) {
  if (view < 1 || ev.button !== 0) return;
  ev.preventDefault();
  const b = $("#box");
  if (pull || boxPress) return;
  b.setPointerCapture(ev.pointerId);
  boxPress = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY };
  b.onpointermove = boxMove;
  b.onpointerup = boxUp;
  b.onpointercancel = boxCancel;
}
function boxMove(ev) {
  if (boxPress && !pull) {
    if (ev.pointerId !== boxPress.id) return;
    if (Math.hypot(ev.clientX - boxPress.sx, ev.clientY - boxPress.sy) < 8)
      return;
    const f = randomUnplaced();
    if (!f) {
      boxPress = null;
      clearBoxHandlers();
      boxEmpty();
      return;
    }
    startPull(ev, f);
  }
  if (!pull || ev.pointerId !== pull.id) return;
  movePull(ev);
}
function boxUp(ev) {
  const b = $("#box");
  if (pull && ev && ev.pointerId !== pull.id) return;
  if (boxPress && ev && ev.pointerId !== boxPress.id) return;
  const wasClick = !!boxPress && !pull;
  if (b) {
    try {
      if (ev && b.hasPointerCapture(ev.pointerId))
        b.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  }
  clearBoxHandlers();
  const p = pull;
  pull = null;
  boxPress = null;
  if (p) settle(p.s);
  else if (wasClick) openBoxModal();
}
function boxCancel(ev) {
  const b = $("#box");
  const p = pull;
  pull = null;
  boxPress = null;
  clearBoxHandlers();
  if (b) {
    try {
      if (ev && b.hasPointerCapture(ev.pointerId))
        b.releasePointerCapture(ev.pointerId);
    } catch (_) {}
  }
  if (p && p.s) settle(p.s);
}
function boxKey(ev) {
  if (ev.key !== "Enter" && ev.key !== " ") return;
  ev.preventDefault();
  openBoxModal();
}
$("#box").addEventListener("pointerdown", boxDown);
$("#box").addEventListener("keydown", boxKey);

function boxFigures() {
  const used = usedIds();
  return D.figures.filter((f) => f.list === "owned" && !used.has(f.id));
}
function modalOpen() {
  return $("#boxModal").classList.contains("on");
}
function openBoxModal() {
  const b = $("#box");
  if (modalOpen() || b.classList.contains("zooming")) return;
  b.classList.remove("zooming");
  void b.offsetWidth;
  b.classList.add("zooming");
  setTimeout(() => {
    b.classList.remove("zooming");
    if (view >= 1 && !modalOpen()) showBoxModal();
  }, 260);
}
function showBoxModal() {
  const m = $("#boxModal"),
    list = boxFigures();
  m.innerHTML = `<div class="bk" data-close="1"></div><div class="bm" role="dialog" aria-modal="true" aria-label="Figures in the box"><div class="bmh"><span>My Figures <span class="sub">${list.length ? list.length + " inside · hold and drag one onto the shelf or the wall" : "empty"}</span></span><button class="bmx" id="bmx" aria-label="Close the box">✕</button></div><div class="bmg" id="bmg">${list.length ? list.map((f) => `<div class="bmc" data-fid="${esc(f.id)}" role="button" tabindex="0" aria-label="${esc(f.name)}. Hold and drag onto the shelf."><span class="tg">${scaleLabel(scaleOf(f.id))}</span><img alt=""><span class="nm">${esc(f.name)}</span></div>`).join("") : '<p class="bme">Your box is empty.<br>Sync your MFC profile on the computer to fill it, or drag a figure here to put it back.</p>'}</div></div>`;
  m.classList.add("on");
  m.setAttribute("aria-hidden", "false");
  m.querySelectorAll(".bmc").forEach((c) => {
    const f = fById(c.dataset.fid),
      im = c.querySelector("img");
    if (f && im) fillImg(im, f);
    c.addEventListener("pointerdown", (ev) => modalDown(ev, c.dataset.fid));
    c.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        placeFromModal(c.dataset.fid);
      }
    });
  });
  $("#bmx").onclick = () => closeBoxModal();
  m.querySelector(".bk").onclick = () => closeBoxModal();
  $("#bmx").focus();
}
function closeBoxModal() {
  const m = $("#boxModal");
  if (!m.classList.contains("on")) return;
  m.classList.remove("on");
  m.setAttribute("aria-hidden", "true");
  m.innerHTML = "";
}
function modalDown(ev, fid) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  modalDrag = {
    id: ev.pointerId,
    fid,
    sx: ev.clientX,
    sy: ev.clientY,
    s: null,
    el: null,
  };
  window.addEventListener("pointermove", modalMove);
  window.addEventListener("pointerup", modalUp);
  window.addEventListener("pointercancel", modalUp);
}
function endModalDrag() {
  window.removeEventListener("pointermove", modalMove);
  window.removeEventListener("pointerup", modalUp);
  window.removeEventListener("pointercancel", modalUp);
  setDragging(false);
}
function modalMove(ev) {
  if (!modalDrag || ev.pointerId !== modalDrag.id) return;
  if (!modalDrag.s) {
    if (Math.hypot(ev.clientX - modalDrag.sx, ev.clientY - modalDrag.sy) < 8)
      return;
    setDragging(true);
    closeBoxModal();
    const f = fById(modalDrag.fid);
    if (!f) {
      endModalDrag();
      modalDrag = null;
      return;
    }
    const p = toShelf(ev.clientX, ev.clientY);
    const s = addPlaced(f, p.x, p.y);
    sel = f.id;
    save();
    render();
    modalDrag.s = s;
    modalDrag.el = figEl(f.id);
    if (modalDrag.el) {
      modalDrag.el.style.transition = "none";
      popIn(modalDrag.el);
    }
  }
  const p = toShelf(ev.clientX, ev.clientY);
  modalDrag.s.x = clampX(p.x);
  modalDrag.s.y = clampY(p.y);
  if (modalDrag.el) {
    modalDrag.el.style.left = modalDrag.s.x / 16 + "%";
    modalDrag.el.style.top = modalDrag.s.y / 9 + "%";
  }
}
function modalUp(ev) {
  if (!modalDrag || ev.pointerId !== modalDrag.id) return;
  const p = modalDrag.s;
  endModalDrag();
  modalDrag = null;
  if (p) settle(p);
}
function placeFromModal(fid) {
  closeBoxModal();
  const f = fById(fid);
  if (!f) return;
  const s = addPlaced(
    f,
    420 + Math.random() * 760,
    view === 2 ? 380 : vy + 430,
  );
  sel = f.id;
  save();
  render();
  settle(s);
}
function settle(s) {
  if (view === 2) return settleWall(s);
  const el = figEl(s.fid),
    p = landPoint(s.x, s.y);
  s.row = p.row;
  s.y = p.y;
  const oldTop = el ? el.style.top : null;
  drawShelf();
  D.shelf.figures.forEach((a) => {
    const n = figEl(a.fid);
    if (!n) return;
    n.style.left = a.x / 16 + "%";
    n.style.height = figHeight(a) / 9 + "%";
    n.style.top = a === s && oldTop ? oldTop : a.y / 9 + "%";
  });
  if (el && oldTop) {
    el.style.transition = "none";
    el.style.top = oldTop;
    void el.offsetWidth;
    el.style.transition = "top .45s cubic-bezier(.5,0,1,.7)";
    el.style.top = s.y / 9 + "%";
    el.addEventListener("transitionend", () => (el.style.transition = ""), {
      once: true,
    });
  }
  setV(vy);
  updateBox();
  save();
  renderPanel();
}
function render() {
  const box = $("#figs");
  box.innerHTML = "";
  D.shelf.figures.forEach((s) => {
    const f = fById(s.fid);
    if (!f) return;
    const e = document.createElement("div");
    e.className = "fig" + (sel === s.fid ? " sel" : "");
    e.dataset.id = s.fid;
    e.title = f.name + " · " + scaleLabel(scaleOf(s.fid));
    e.style.left = s.x / 16 + "%";
    e.style.top = s.y / 9 + "%";
    e.style.height = figHeight(s) / 9 + "%";
    e.style.aspectRatio = ARC[f.id] || "auto";
    const im = new Image();
    im.alt = f.name;
    e.appendChild(im);
    fillImg(im, f, e);
    e.onpointerdown = (ev) => drag(ev, s, e);
    box.appendChild(e);
  });
  renderWall();
  renderPanel();
  updateBox();
}
function renderPanel() {
  const p = $("#panel"),
    ws = sel && D.wall.items.find((a) => a.fid === sel),
    s = ws || (sel && D.shelf.figures.find((a) => a.fid === sel));
  if (!s) {
    p.classList.remove("on");
    p.innerHTML = "";
    return;
  }
  p.classList.add("on");
  const f = fById(sel),
    den = scaleOf(sel),
    opts = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
  if (!opts.includes(den)) opts.push(den);
  opts.sort((a, b) => a - b);
  const name = `<b title="${esc(f ? f.name : "Item")}">${esc(f ? f.name : "Item")}</b>`,
    btns = `<button class="b" id="pup">Own image</button>${D.over[sel] ? '<button class="b" id="prs">MFC image</button>' : ""}<button class="b" id="prm">Remove</button>`;
  if (ws) {
    p.innerHTML = `${name}<span class="grp"><label for="psize">Size ×${(s.scale || 1).toFixed(2)}</label><input id="psize" type="range" min="0.4" max="2" step="0.05" value="${s.scale || 1}"></span>${btns}`;
    $("#psize").oninput = (e) => {
      const n = +e.target.value;
      s.scale = n;
      $("#psize").previousElementSibling.textContent = "Size ×" + n.toFixed(2);
      fitPost(figEl(s.fid), s);
      save();
    };
  } else {
    p.innerHTML = `${name}<span class="grp"><label for="pscale">Scale</label><select id="pscale">${opts.map((d) => `<option value="${d}"${d === den ? " selected" : ""}>1/${d}</option>`).join("")}</select></span><span class="grp"><label for="psize">Size ×${(s.scale || 1).toFixed(2)}</label><input id="psize" type="range" min="0.4" max="2.5" step="0.05" value="${s.scale || 1}"></span>${btns}`;
    $("#pscale").onchange = (e) => {
      D.scales[sel] = +e.target.value;
      save();
      relayout();
      render();
    };
    $("#psize").oninput = (e) => {
      const n = +e.target.value;
      s.scale = n;
      $("#psize").previousElementSibling.textContent = "Size ×" + n.toFixed(2);
      relayout();
      save();
    };
  }
  $("#pup").onclick = () => $("#upl").click();
  if ($("#prs"))
    $("#prs").onclick = () => {
      delete D.over[sel];
      delete ARC[sel];
      save();
      render();
    };
  $("#prm").onclick = () => removeFigure(sel);
}
function clearSel() {
  sel = null;
  renderPanel();
  document
    .querySelectorAll(".fig.sel")
    .forEach((n) => n.classList.remove("sel"));
}
function removeFigure(fid) {
  if (fid == null) return;
  D.shelf.figures = D.shelf.figures.filter((a) => a.fid !== fid);
  D.wall.items = D.wall.items.filter((a) => a.fid !== fid);
  if (sel === fid) sel = null;
  save();
  relayout();
  render();
  toast("Figure put back in the box.");
}
document.addEventListener("pointerdown", (ev) => {
  if (!sel || view < 1) return;
  if (ev.target.closest(".fig,#panel,#boxModal")) return;
  clearSel();
});
$("#upl").onchange = (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !sel) return;
  const id = sel,
    im = new Image();
  im.onload = () => {
    const s = Math.min(1, 480 / Math.max(im.width, im.height)),
      w = Math.round(im.width * s),
      h = Math.round(im.height * s),
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.drawImage(im, 0, 0, w, h);
    if (!D.wall.items.some((a) => a.fid === id)) clearBg(x, w, h);
    D.over[id] = c.toDataURL("image/png");
    delete ARC[id];
    save();
    render();
  };
  im.src = URL.createObjectURL(file);
};
function drag(ev, s, e) {
  ev.preventDefault();
  lastDown = Date.now();
  sel = s.fid;
  const wall = e.classList.contains("post");
  document
    .querySelectorAll(".fig")
    .forEach((n) => n.classList.toggle("sel", n === e));
  e.setPointerCapture(ev.pointerId);
  const k = 1600 / room.getBoundingClientRect().width,
    sx = ev.clientX,
    sy = ev.clientY,
    ox = s.x,
    oy = s.y;
  let moved = false;
  e.style.cursor = "grabbing";
  setDragging(true);
  renderPanel();
  e.onpointermove = (m) => {
    if (wall && !moved) {
      if (Math.hypot(m.clientX - sx, m.clientY - sy) < 4) return;
      moved = true;
      unpin(e, s);
    }
    s.x = clampX(ox + (m.clientX - sx) * k);
    s.y = clampY(oy + (m.clientY - sy) * k);
    e.style.left = s.x / 16 + "%";
    e.style.top = s.y / 9 + "%";
    $("#box").classList.toggle("trash", overBox(m.clientX, m.clientY));
  };
  const end = (ev2) => {
    e.onpointermove = e.onpointerup = e.onpointercancel = null;
    e.style.cursor = "";
    $("#box").classList.remove("trash");
    setDragging(false);
    if (ev2 && overBox(ev2.clientX, ev2.clientY)) removeFigure(s.fid);
    else if (wall && !moved) return;
    else settle(s);
  };
  e.onpointerup = end;
  e.onpointercancel = end;
}
drawShelf();
setV(0);
go(1);
if (D.mfc_username) sync().catch(() => {});
