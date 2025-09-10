import React, { useEffect, useMemo, useState } from "react";

// ------------------------------
// Health Guide Zero-Cloud MVP (React Single File)
// 功能：本機日記、建議卡、紅旗提醒、月曆回顧、照片（本機壓縮）、CSV 匯出
// 資料儲存：localStorage（無雲端）
// 重要：所有內容僅供參考，非醫療診斷；若有緊急狀況請立即就醫。
// ------------------------------

// --- 常用選項 ---
const SYMPTOMS = [
  "頭痛","頭暈","失眠","疲倦","焦慮","胸悶","心悸",
  "咳嗽","喉嚨痛","流鼻水","胃脹氣","腹痛","便秘","腹瀉",
  "腰痛","肩頸痠痛","關節痛","皮膚疹","口腔潰瘍","冒冷汗",
];
const NEEDS = ["改善睡眠","舒緩壓力","腸胃調理","放鬆肩頸","提升體力"]; // 可自行擴增

// --- 規則庫（示例）---
const ADVICE_RULES = [
  { triggerSymptom: "胃脹氣", type: "food", content: "溫熱薑茶；減少豆類、碳酸飲料與高油炸", priority: 5 },
  { triggerSymptom: "便秘", triggerDaysGte: 2, type: "food", content: "高纖＋多水＋固定如廁時間；奇異果/優格可試", priority: 5 },
  { triggerSymptom: "腹瀉", type: "food", content: "補充水與電解質；避免生冷辛辣；清淡飲食", priority: 5 },
  { triggerSymptom: "失眠", triggerDaysGte: 3, type: "tcm", content: "晚餐清淡；睡前足浴；酸棗仁甘麥茶（服藥者先詢問醫師）", priority: 4 },
  { triggerSymptom: "疲倦", triggerDaysGte: 3, type: "food", content: "均衡飲食；B 群/鐵質食材；日照 10–15 分鐘", priority: 3 },
  { triggerSymptom: "肩頸痠痛", type: "tcm", content: "溫熱敷 15 分；避免久坐；可做頸部伸展", priority: 3 },
  { triggerSymptom: "口腔潰瘍", type: "food", content: "補充維生素 B 群；避免辛辣刺激；注意口腔衛生", priority: 2 },
  { triggerSymptom: "喉嚨痛", type: "dept", content: "持續 ≥3 天或合併發燒→建議耳鼻喉科；先補水與休息", priority: 4 },
  { triggerSymptom: "頭暈", triggerDaysGte: 3, type: "dept", content: "連續 ≥3 天→先內科評估；若合併胸痛/呼吸困難→立即就醫", priority: 5 },
];

const RED_FLAGS = [
  { symptom: "胸痛", action: "立即就醫", notes: "伴出汗/噁心或放射至左臂" },
  { symptom: "突發劇烈頭痛", action: "立即就醫", notes: "合併視力/語言障礙或意識改變" },
  { symptom: "高燒", daysGte: 3, action: "優先就醫", notes: "> 39°C 持續 ≥3 天" },
  { symptom: "呼吸困難", action: "立即就醫", notes: "" },
  { symptom: "黑便或血便", action: "優先就醫", notes: "" },
  { symptom: "持續嘔吐", action: "優先就醫", notes: "> 24 小時，無法補水" },
  { symptom: "持續腹痛伴反彈痛", action: "優先就醫", notes: "" },
  { symptom: "自殺意念", action: "立即求助", notes: "撥打 1925/1995 或最近急診" },
];

// --- 工具函數 ---
const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const todayStr = () => fmtDate(new Date());

const loadEntries = () => {
  try { return JSON.parse(localStorage.getItem("hg_entries")||"[]"); } catch { return []; }
};
const saveEntries = (arr) => localStorage.setItem("hg_entries", JSON.stringify(arr));

async function compressImageToDataURL(file, maxW=900) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bitmap.width);
  const w = Math.round(bitmap.width*scale); const h = Math.round(bitmap.height*scale);
  const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap,0,0,w,h);
  return canvas.toDataURL('image/jpeg', 0.8);
}

// 計算連續天數（含當日）
function consecutiveDaysCount(entries, symptom, dateStr){
  const days = new Set(entries.filter(e=>e.symptoms.includes(symptom)).map(e=>e.date));
  const d = new Date(dateStr);
  let count=0; while(true){
    const s = fmtDate(d);
    if(days.has(s)){ count++; d.setDate(d.getDate()-1); } else break;
  }
  return count;
}

function genAdvice(entry, allEntries){
  const adv = [];
  for(const r of ADVICE_RULES){
    if(entry.symptoms.includes(r.triggerSymptom)){
      if(r.triggerDaysGte){
        const c = consecutiveDaysCount(allEntries, r.triggerSymptom, entry.date);
        if(c < r.triggerDaysGte) continue;
      }
      adv.push({type:r.type, content:r.content, priority:r.priority, key:`${r.type}-${r.triggerSymptom}`});
    }
  }
  adv.sort((a,b)=>b.priority-a.priority);
  return adv;
}

function checkRedFlags(entry, allEntries){
  const hits = [];
  for(const rf of RED_FLAGS){
    if(entry.symptoms.includes(rf.symptom)){
      if(rf.daysGte){
        const c = consecutiveDaysCount(allEntries, rf.symptom, entry.date);
        if(c < rf.daysGte) continue;
      }
      hits.push(rf);
    }
  }
  return hits;
}

// --- UI 小元件 ---
function Chip({label, active, onClick}){
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-full border text-sm mr-2 mb-2 ${active?"bg-black text-white border-black":"bg-white border-gray-300 hover:bg-gray-100"}`}>
      {label}
    </button>
  );
}

function Section({title, children}){
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function Card({children, tone="default"}){
  const toneCls = tone==='warn'?"border-amber-400 bg-amber-50":"border-gray-200 bg-white";
  return <div className={`border ${toneCls} rounded-2xl p-4 shadow-sm mb-3`}>{children}</div>;
}

// --- 主元件 ---
export default function App(){
  const [route, setRoute] = useState("home");
  const [entries, setEntries] = useState(()=>loadEntries());
  const [draft, setDraft] = useState({
    date: todayStr(), symptoms: [], needs: [], mood: 2, note: "", photos: []
  });
  const [advice, setAdvice] = useState([]);
  const [redFlags, setRedFlags] = useState([]);
  
  useEffect(()=>{ saveEntries(entries); },[entries]);

  // 每次進入寫入頁，預設今天
  useEffect(()=>{
    if(route==='write') setDraft(d=>({...d, date: todayStr()}));
  },[route]);

  const todayEntry = useMemo(()=> entries.find(e=>e.date===todayStr()),[entries]);

  async function handlePhoto(e){
    const f = e.target.files?.[0]; if(!f) return;
    const dataURL = await compressImageToDataURL(f, 900);
    setDraft(d=>({...d, photos: [...d.photos, dataURL]}));
    e.target.value = ""; // reset
  }
  function removePhoto(idx){ setDraft(d=>({...d, photos: d.photos.filter((_,i)=>i!==idx)})); }

  function toggleSymptom(s){ setDraft(d=>({ ...d, symptoms: d.symptoms.includes(s)? d.symptoms.filter(x=>x!==s): [...d.symptoms,s] })); }
  function toggleNeed(n){ setDraft(d=>({ ...d, needs: d.needs.includes(n)? d.needs.filter(x=>x!==n): [...d.needs,n] })); }

  function submitEntry(){
    if(draft.symptoms.length===0 && !draft.note && draft.needs.length===0){
      alert("請至少選一項症狀或填寫備註"); return;
    }
    const entry = { ...draft, createdAt: Date.now() };
    const newList = [...entries.filter(e=>e.date!==entry.date), entry];
    const adv = genAdvice(entry, newList);
    const rf = checkRedFlags(entry, newList);
    setEntries(newList); setAdvice(adv); setRedFlags(rf); setRoute("advice");
  }

  function exportCSV(){
    const headers = ["date","symptoms","needs","mood","note"];
    const rows = entries.map(e=> [e.date, e.symptoms.join("|"), e.needs.join("|"), e.mood, JSON.stringify(e.note||"")]);
    const csv = [headers.join(","), ...rows.map(r=>r.join(","))].join("\\n");
    const blob = new Blob(["\\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='health_guide_entries.csv'; a.click(); URL.revokeObjectURL(url);
  }

  function clearAll(){
    if(confirm("確定要刪除所有本機資料？此動作無法復原。")){
      localStorage.removeItem("hg_entries"); setEntries([]); setDraft({...draft, symptoms:[], needs:[], note:"", photos:[]});
    }
  }

  // 簡易月曆（當月）
  function Calendar(){
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
    const startDow = first.getDay(); // 0=Sun
    const days = [];
    for(let i=0;i<startDow;i++) days.push(null);
    for(let d=1; d<=last.getDate(); d++) days.push(new Date(now.getFullYear(), now.getMonth(), d));
    return (
      <div>
        <div className="grid grid-cols-7 gap-2 text-center text-sm text-gray-500 mb-2">
          {["日","一","二","三","四","五","六"].map(w=> <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d,i)=> d? (
            <button key={i} className={`h-20 rounded-xl border text-sm flex flex-col items-center justify-center ${fmtDate(d)===todayStr()?"border-black":"border-gray-200"}`}
              onClick={()=>{
                const hit = entries.find(e=>e.date===fmtDate(d));
                if(hit){ setDraft({...hit}); setAdvice(genAdvice(hit, entries)); setRedFlags(checkRedFlags(hit, entries)); setRoute('advice'); }
              }}>
              <div className="font-semibold">{d.getDate()}</div>
              {entries.some(e=>e.date===fmtDate(d)) && <div className="mt-1 w-2 h-2 rounded-full bg-black"/>}
            </button>
          ) : <div key={i}></div>) }
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-lg font-bold">健康導覽員 · 零雲端 MVP</div>
        <nav className="space-x-1">
          {['home','write','advice','calendar','settings'].map(r=> (
            <button key={r} onClick={()=>setRoute(r)} className={`px-3 py-1 rounded-full text-sm border ${route===r?"bg-black text-white border-black":"bg-white border-gray-300"}`}>{
              r==='home'? '首頁': r==='write'? '寫日記': r==='advice'? '建議': r==='calendar'? '月曆': '設定'
            }</button>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {/* Disclaimer */}
        <Card>
          <div className="text-sm text-gray-600">本 App 僅提供一般性健康資訊與導引，<b>非醫療診斷</b>；如有緊急或嚴重症狀請立即就醫或撥打當地急救專線。</div>
        </Card>

        {route==='home' && (
          <div>
            <Section title="今天的心情">
              <div className="flex gap-2">
                {[1,2,3].map(v=> (
                  <button key={v} onClick={()=> setDraft(d=>({...d, mood:v}))} className={`px-4 py-2 rounded-xl border ${draft.mood===v?"bg-black text-white border-black":"bg-white border-gray-300"}`}>{v===1?'不適':v===2?'一般':'平穩'}</button>
                ))}
              </div>
            </Section>
            <Section title="快速症狀">
              {SYMPTOMS.slice(0,10).map(s=> <Chip key={s} label={s} active={draft.symptoms.includes(s)} onClick={()=>toggleSymptom(s)} />)}
            </Section>
            <button onClick={()=>setRoute('write')} className="mt-2 w-full md:w-auto px-5 py-3 rounded-2xl bg-black text-white font-semibold">去寫日記</button>
            {todayEntry && <div className="mt-3 text-sm text-gray-600">今天已紀錄，可至「建議」查看。</div>}
          </div>
        )}

        {route==='write' && (
          <div>
            <Section title="日期">
              <input type="date" value={draft.date} onChange={(e)=>setDraft(d=>({...d, date:e.target.value}))} className="border rounded-xl px-3 py-2" />
            </Section>
            <Section title="症狀（可多選）">
              <div>
                {SYMPTOMS.map(s=> <Chip key={s} label={s} active={draft.symptoms.includes(s)} onClick={()=>toggleSymptom(s)} />)}
              </div>
            </Section>
            <Section title="今日需求（可多選）">
              {NEEDS.map(n=> <Chip key={n} label={n} active={draft.needs.includes(n)} onClick={()=>toggleNeed(n)} />)}
            </Section>
            <Section title="備註">
              <textarea value={draft.note} onChange={(e)=>setDraft(d=>({...d, note:e.target.value}))} rows={4} className="w-full border rounded-2xl p-3" placeholder="可描述不適、誘因、用藥…（不建議輸入可識別個資）"/>
            </Section>
            <Section title="照片（選擇性；將自動壓縮並僅存本機）">
              <input type="file" accept="image/*" onChange={handlePhoto} />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {draft.photos.map((p,i)=> (
                  <div key={i} className="relative">
                    <img src={p} alt="upload" className="w-full h-24 object-cover rounded-xl border"/>
                    <button onClick={()=>removePhoto(i)} className="absolute top-1 right-1 text-xs bg-white/90 border rounded px-2 py-0.5">刪除</button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">請避免上傳含人臉、病歷等可識別資訊。</div>
            </Section>
            <button onClick={submitEntry} className="w-full md:w-auto px-5 py-3 rounded-2xl bg-black text-white font-semibold">送出並查看建議</button>
          </div>
        )}

        {route==='advice' && (
          <div>
            {redFlags.length>0 && (
              <Card tone="warn">
                <div className="font-semibold mb-1">⚠️ 安全提醒</div>
                {redFlags.map((rf,idx)=> (
                  <div key={idx} className="text-sm mb-1"><b>{rf.symptom}</b> → {rf.action}。<span className="text-gray-600">{rf.notes}</span></div>
                ))}
                <div className="text-xs text-gray-600 mt-1">如有疑慮請儘速就醫或撥打 1925/1995。</div>
              </Card>
            )}
            <Section title="今日建議卡">
              {advice.length===0 && <Card><div className="text-sm">暫無命中規則。請持續觀察與紀錄，或諮詢專業醫師。</div></Card>}
              {advice.map((a,i)=> (
                <Card key={i}>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{a.type==='food'? '食養': a.type==='dept'? '就醫科別': '中醫導引'}</div>
                  <div className="text-sm leading-relaxed">{a.content}</div>
                </Card>
              ))}
            </Section>
          </div>
        )}

        {route==='calendar' && (
          <div>
            <Calendar/>
          </div>
        )}

        {route==='settings' && (
          <div>
            <Card>
              <div className="font-semibold mb-2">資料工具</div>
              <div className="flex flex-col gap-2">
                <button onClick={exportCSV} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm w-full md:w-auto">匯出 CSV</button>
                <button onClick={clearAll} className="px-4 py-2 rounded-xl border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 text-sm w-full md:w-auto">刪除所有本機資料</button>
              </div>
              <div className="text-xs text-gray-500 mt-2">* 本機儲存僅限此裝置與瀏覽器；更換裝置將看不到舊資料（除非匯出備份）。</div>
            </Card>
            <Card>
              <div className="font-semibold mb-2">提醒（本機）</div>
              <div className="text-sm text-gray-600">目前版本不含推播伺服器；可改用手機鬧鐘或行事曆提醒。日後上雲後將提供推播。</div>
            </Card>
          </div>
        )}
      </main>

      <footer className="p-6 text-center text-xs text-gray-500">© {new Date().getFullYear()} Health Guide · 僅供參考，非醫療診斷</footer>
    </div>
  );
}
