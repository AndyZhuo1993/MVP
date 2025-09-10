import React, { useEffect, useMemo, useRef, useState } from "react";

// ============ 小工具 ============

const todayStr = () => new Date().toISOString().slice(0, 10);
const LS_KEY = "hg_entries";
const LS_SYM = "hg_custom_symptoms";
const LS_NEED = "hg_custom_needs";

const SYMPTOMS = ["頭痛", "頭暈", "鼻塞", "喉嚨痛", "咳嗽", "呼吸急促", "胸悶/胸痛", "胃痛", "腹瀉", "便祕", "噁心", "腰痠背痛", "關節痛", "皮疹", "失眠", "焦慮", "經痛"];
const NEEDS = ["多喝水", "多休息", "避免刺激", "清淡飲食", "放鬆伸展", "適度運動", "日照/散步"];

const loadEntries = () => JSON.parse(localStorage.getItem(LS_KEY) || "[]");
const saveEntries = (list) => localStorage.setItem(LS_KEY, JSON.stringify(list));

const Section = ({ title, children }) => (
  <section className="mb-5">
    <div className="font-semibold mb-2">{title}</div>
    {children}
  </section>
);

const Card = ({ children }) => (
  <div className="bg-white border rounded-2xl p-4 mb-4 shadow-sm">{children}</div>
);

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded-full border mr-2 mb-2 ${active ? "bg-black text-white border-black" : "bg-white border-gray-300"}`}
    >
      {label}
    </button>
  );
}

// 壓縮圖片（避免巨大檔）
function compressImage(file, maxW = 1280, maxH = 1280, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(maxW / width, maxH / height, 1);
      const w = Math.round(width * ratio);
      const h = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
          URL.revokeObjectURL(url);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

// sparkline path
function sparkPath(values, width = 240, height = 60) {
  const nums = values.filter((v) => typeof v === "number" && !isNaN(v));
  if (nums.length === 0) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pts = nums.map((v, i) => {
    const x = (i / (nums.length - 1 || 1)) * width;
    const y = height - ((v - min) / span) * height;
    return [x, y];
  });
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

// ============ 主 App ============

export default function App() {
  const [route, setRoute] = useState("home");
  const [entries, setEntries] = useState(loadEntries);

  // 自定清單
  const [customSymptoms, setCustomSymptoms] = useState(() => JSON.parse(localStorage.getItem(LS_SYM) || "[]"));
  const [customNeeds, setCustomNeeds] = useState(() => JSON.parse(localStorage.getItem(LS_NEED) || "[]"));
  const ALL_SYMPTOMS = useMemo(() => [...SYMPTOMS, ...customSymptoms], [customSymptoms]);
  const ALL_NEEDS = useMemo(() => [...NEEDS, ...customNeeds], [customNeeds]);

  useEffect(() => saveEntries(entries), [entries]);
  useEffect(() => localStorage.setItem(LS_SYM, JSON.stringify(customSymptoms)), [customSymptoms]);
  useEffect(() => localStorage.setItem(LS_NEED, JSON.stringify(customNeeds)), [customNeeds]);

  // 草稿
  const [draft, setDraft] = useState({
    date: todayStr(),
    symptoms: [],
    needs: [],
    mood: 2,
    note: "",
    photos: [],
    bpSys: "",
    bpDia: "",
    heartRate: "",
    weight: "",
    steps: ""
  });

  // PWA 安裝提示（Android）
  const [installEvt, setInstallEvt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  useEffect(() => {
    const h = (e) => {
      e.preventDefault();
      setInstallEvt(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", () => setCanInstall(false));
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  async function doInstall() {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
    setCanInstall(false);
  }
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const inStandalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" && "standalone" in navigator && navigator.standalone);

  // 切換 chip
  const toggleSymptom = (s) =>
    setDraft((d) => ({ ...d, symptoms: d.symptoms.includes(s) ? d.symptoms.filter((x) => x !== s) : [...d.symptoms, s] }));
  const toggleNeed = (n) =>
    setDraft((d) => ({ ...d, needs: d.needs.includes(n) ? d.needs.filter((x) => x !== n) : [...d.needs, n] }));

  // 照片
  async function handlePhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const base64 = await compressImage(f);
    setDraft((d) => ({ ...d, photos: [...d.photos, base64] }));
    e.target.value = "";
  }
  const removePhoto = (i) => setDraft((d) => ({ ...d, photos: d.photos.filter((_, idx) => idx !== i) }));

  // 送出
  function submitEntry() {
    const newItem = { ...draft, createdAt: Date.now() };
    const list = [...entries, newItem].sort((a, b) => a.date.localeCompare(b.date));
    setEntries(list);
    setRoute("advice");
  }

  // 匯出 CSV（分享優先）
  function exportCSV() {
    const headers = ["date", "symptoms", "needs", "mood", "note", "bpSys", "bpDia", "heartRate", "weight", "steps"];
    const rows = entries.map((e) => [
      e.date,
      (e.symptoms || []).join("|"),
      (e.needs || []).join("|"),
      e.mood ?? "",
      JSON.stringify(e.note || ""),
      e.bpSys ?? "",
      e.bpDia ?? "",
      e.heartRate ?? "",
      e.weight ?? "",
      e.steps ?? ""
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const file = new File([blob], `health_guide_${Date.now()}.csv`, { type: "text/csv" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "健康導覽員匯出", text: "我的健康日記（CSV）" }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "health_guide_entries.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    if (confirm("確定要刪除所有本機資料？此動作無法復原。")) {
      localStorage.removeItem(LS_KEY);
      setEntries([]);
      setDraft({
        date: todayStr(),
        symptoms: [],
        needs: [],
        mood: 2,
        note: "",
        photos: [],
        bpSys: "",
        bpDia: "",
        heartRate: "",
        weight: "",
        steps: ""
      });
    }
  }

  // 建議（極簡規則，非醫療診斷）
  const advice = useMemo(() => {
    const a = [];
    const s = new Set(draft.symptoms);
    const needs = new Set(draft.needs);
    const sys = Number(draft.bpSys || NaN);
    const dia = Number(draft.bpDia || NaN);
    const hr = Number(draft.heartRate || NaN);
    const w = Number(draft.weight || NaN);

    if (s.has("胸悶/胸痛") || s.has("呼吸急促")) a.push("胸悶/呼吸急促：若伴隨冒冷汗、噁心、放射性疼痛，請立刻就醫（急診）。");
    if (sys >= 180 || dia >= 120) a.push("血壓讀值異常高（≥180/120）。請儘速就醫。");
    if (hr && (hr < 45 || hr > 120)) a.push("心率過低或過高，建議就醫評估。");

    if (s.has("感冒") || s.has("喉嚨痛") || s.has("咳嗽") || s.has("鼻塞")) a.push("上呼吸道不適：補水、充分休息、避免刺激性飲食。若持續>7天或高燒不退，建議就醫。");
    if (s.has("腹瀉")) a.push("腹瀉：口服補液、清淡飲食，留意脫水徵象。便血/高燒/超過三天建議就醫。");
    if (s.has("便祕")) a.push("便祕：增加蔬果/水份，規律運動。若伴隨嚴重腹痛或黑便，請就醫。");
    if (s.has("失眠") || s.has("焦慮")) a.push("睡眠/壓力：規律作息、睡前減少藍光，短時冥想/呼吸練習。長期影響功能請求助專業。");
    if (w) a.push("體重：維持穩定即可，急遽變化需排除水腫/甲狀腺等因素。");

    if (needs.size) a.push(`你今天標記的需求：${[...needs].join("、")}（試著完成 1〜2 項即可）`);

    a.push("本 App 為生活建議與自我追蹤工具，非醫療診斷；急重症請就醫。");
    return a;
  }, [draft]);

  // 月曆
  function Calendar() {
    const [month, setMonth] = useState(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const monthStr = month.toISOString().slice(0, 7);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay(); // 0 Sun
    const hasEntry = new Set(entries.map((e) => e.date));

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <Card>
        <div className="flex items-center justify-between mb-3">
          <button className="px-3 py-1 rounded-xl border" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹ 上個月</button>
          <div className="font-semibold">{monthStr}</div>
          <button className="px-3 py-1 rounded-xl border" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>下個月 ›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-600 mb-1">
          {["日","一","二","三","四","五","六"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i}></div>;
            const ds = `${monthStr}-${String(d).padStart(2, "0")}`;
            const mark = hasEntry.has(ds);
            return (
              <div key={i} className={`h-12 rounded-xl border flex items-center justify-center ${mark ? "bg-black text-white border-black" : "bg-white"}`}>
                {d}
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // 趨勢（最近 30 筆）
  function Trends() {
    const byDate = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const lastN = (getter, n = 30) =>
      byDate.slice(-n).map(getter).map((v) => (v === "" || v == null ? undefined : Number(v)));

    const blocks = [
      { key: "bpSys", label: "收縮壓", unit: "mmHg", data: lastN((e) => e.bpSys) },
      { key: "bpDia", label: "舒張壓", unit: "mmHg", data: lastN((e) => e.bpDia) },
      { key: "heartRate", label: "心率", unit: "bpm", data: lastN((e) => e.heartRate) },
      { key: "weight", label: "體重", unit: "kg", data: lastN((e) => e.weight) },
      { key: "steps", label: "步數", unit: "步", data: lastN((e) => e.steps) }
    ];
    return (
      <div>
        {blocks.map((b) => {
          const nums = b.data.filter((v) => typeof v === "number" && !isNaN(v));
          const latest = nums.length ? nums[nums.length - 1] : "-";
          const path = sparkPath(nums);
          return (
            <Card key={b.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{b.label}</div>
                <div className="text-sm text-gray-600">
                  {latest}
                  {typeof latest === "number" ? " " + b.unit : ""}
                </div>
              </div>
              <svg viewBox="0 0 240 60" width="100%" height="60">
                <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </Card>
          );
        })}
        {byDate.length === 0 && (
          <Card>
            <div className="text-sm text-gray-600">目前沒有資料，請先在「寫日記」新增一則。</div>
          </Card>
        )}
      </div>
    );
  }

  // ============ UI ============

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-lg font-bold">健康導覽員 · 零雲端 MVP</div>
        <nav className="space-x-1">
          {["home", "write", "advice", "calendar", "trends", "settings"].map((r) => (
            <button
              key={r}
              onClick={() => setRoute(r)}
              className={`px-3 py-1 rounded-full text-sm border ${
                route === r ? "bg-black text-white border-black" : "bg-white border-gray-300"
              }`}
            >
              {r === "home" ? "首頁" : r === "write" ? "寫日記" : r === "advice" ? "建議" : r === "calendar" ? "月曆" : r === "trends" ? "趨勢" : "設定"}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">

        {route === "home" && (
          <div>
            <Card>
              <div className="font-semibold mb-2">最近紀錄</div>
              {entries.length === 0 && <div className="text-sm text-gray-600">尚無資料，請到「寫日記」建立第一筆。</div>}
              {entries.slice(-10).reverse().map((e, i) => (
                <div key={i} className="border-b last:border-b-0 py-2">
                  <div className="text-sm">
                    <span className="font-semibold">{e.date}</span>
                    {!!e.symptoms?.length && <> · 症狀：{e.symptoms.join("、")}</>}
                    {!!e.needs?.length && <> · 需求：{e.needs.join("、")}</>}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {route === "write" && (
          <div>
            <Section title="日期">
              <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="border rounded-xl px-3 py-2" />
            </Section>

            <Section title="症狀（可多選）">
              <div>
                {ALL_SYMPTOMS.map((s) => (
                  <Chip key={s} label={s} active={draft.symptoms.includes(s)} onClick={() => toggleSymptom(s)} />
                ))}
              </div>
              {/* 自定症狀 */}
              <div className="mt-2 flex gap-2">
                <input id="customSym" placeholder="新增自定症狀…" className="border rounded-xl px-3 py-2 flex-1" />
                <button
                  className="px-3 py-2 rounded-xl border"
                  onClick={() => {
                    const el = document.getElementById("customSym");
                    const v = el.value.trim();
                    if (!v) return;
                    if (customSymptoms.includes(v)) return alert("已存在");
                    setCustomSymptoms([...customSymptoms, v]);
                    el.value = "";
                  }}
                >
                  加入
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs text-gray-600">
                {customSymptoms.map((x) => (
                  <span key={x} className="px-2 py-1 border rounded-full">
                    {x}{" "}
                    <button className="ml-1" onClick={() => setCustomSymptoms(customSymptoms.filter((v) => v !== x))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </Section>

            <Section title="今日需求（可多選）">
              <div>
                {ALL_NEEDS.map((n) => (
                  <Chip key={n} label={n} active={draft.needs.includes(n)} onClick={() => toggleNeed(n)} />
                ))}
              </div>
              {/* 自定需求 */}
              <div className="mt-2 flex gap-2">
                <input id="customNeed" placeholder="新增自定需求…" className="border rounded-xl px-3 py-2 flex-1" />
                <button
                  className="px-3 py-2 rounded-xl border"
                  onClick={() => {
                    const el = document.getElementById("customNeed");
                    const v = el.value.trim();
                    if (!v) return;
                    if (customNeeds.includes(v)) return alert("已存在");
                    setCustomNeeds([...customNeeds, v]);
                    el.value = "";
                  }}
                >
                  加入
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs text-gray-600">
                {customNeeds.map((x) => (
                  <span key={x} className="px-2 py-1 border rounded-full">
                    {x}{" "}
                    <button className="ml-1" onClick={() => setCustomNeeds(customNeeds.filter((v) => v !== x))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </Section>

            <Section title="生命徵象/數據（選填）">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="text-sm">
                  收縮壓(mmHg)
                  <input type="number" inputMode="numeric" value={draft.bpSys} onChange={(e) => setDraft((d) => ({ ...d, bpSys: e.target.value }))} className="mt-1 w-full border rounded-xl px-3 py-2" />
                </label>
                <label className="text-sm">
                  舒張壓(mmHg)
                  <input type="number" inputMode="numeric" value={draft.bpDia} onChange={(e) => setDraft((d) => ({ ...d, bpDia: e.target.value }))} className="mt-1 w-full border rounded-xl px-3 py-2" />
                </label>
                <label className="text-sm">
                  心率(bpm)
                  <input type="number" inputMode="numeric" value={draft.heartRate} onChange={(e) => setDraft((d) => ({ ...d, heartRate: e.target.value }))} className="mt-1 w-full border rounded-xl px-3 py-2" />
                </label>
                <label className="text-sm">
                  體重(kg)
                  <input type="number" inputMode="numeric" step="0.1" value={draft.weight} onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value }))} className="mt-1 w-full border rounded-xl px-3 py-2" />
                </label>
                <label className="text-sm">
                  步數(步)
                  <input type="number" inputMode="numeric" value={draft.steps} onChange={(e) => setDraft((d) => ({ ...d, steps: e.target.value }))} className="mt-1 w-full border rounded-xl px-3 py-2" />
                </label>
              </div>
            </Section>

            <Section title="備註">
              <textarea
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                rows={4}
                className="w-full border rounded-2xl p-3"
                placeholder="可描述不適、誘因、用藥…（避免輸入可識別個資）"
              />
            </Section>

            <Section title="照片（選擇性；僅存本機）">
              <input type="file" accept="image/*" onChange={handlePhoto} />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {draft.photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p} className="w-full h-24 object-cover rounded-xl border" />
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 text-xs bg-white/90 border rounded px-2 py-0.5">
                      刪除
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">請避免上傳含人臉、病歷等可識別資訊。</div>
            </Section>

            <button onClick={submitEntry} className="w-full md:w-auto px-5 py-3 rounded-2xl bg-black text-white font-semibold">
              送出並查看建議
            </button>
          </div>
        )}

        {route === "advice" && (
          <div>
            <Card>
              <div className="font-semibold mb-2">今日建議（非醫療診斷）</div>
              <ul className="list-disc pl-5 text-sm leading-relaxed">
                {advice.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {route === "calendar" && (
          <div>
            <Calendar />
          </div>
        )}

        {route === "trends" && (
          <div>
            <Trends />
          </div>
        )}

        {route === "settings" && (
          <div>
            <Card>
              <div className="font-semibold mb-2">安裝到主畫面</div>
              {canInstall && (
                <button onClick={doInstall} className="px-4 py-2 rounded-xl bg-black text-white text-sm w-full md:w-auto">
                  安裝 App（Android/Chrome）
                </button>
              )}
              {!canInstall && isiOS && !inStandalone && <div className="text-sm text-gray-600">iPhone：請用 Safari → 分享 → 加到主畫面。</div>}
              {!canInstall && !isiOS && <div className="text-sm text-gray-600">若看不到按鈕：請在瀏覽器選單找「安裝 App / 加到主畫面」。</div>}
            </Card>

            <Card>
              <div className="font-semibold mb-2">資料工具</div>
              <div className="flex flex-col gap-2">
                <button onClick={exportCSV} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm w-full md:w-auto">
                  分享 / 下載 CSV
                </button>
                <button onClick={clearAll} className="px-4 py-2 rounded-xl border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 text-sm w-full md:w-auto">
                  刪除所有本機資料
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">* 本機儲存僅限此裝置與瀏覽器；更換裝置將看不到舊資料（除非匯出備份）。</div>
            </Card>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-500 py-8">© {new Date().getFullYear()} 健康導覽員 · v0.2 · 本工具非醫療診斷，急重症請就醫</footer>
    </div>
  );
}
