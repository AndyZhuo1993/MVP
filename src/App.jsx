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

// --- 工具函數 ---$1
// 產生簡易 sparkline path（0~1 正規化）
function sparkPath(values, width = 240, height = 60) {
  const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (nums.length === 0) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const points = nums.map((v, i) => {
    const x = (i / (nums.length - 1 || 1)) * width;
    const y = height - ((v - min) / span) * height;
    return [x, y];
  });
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

// --- 主元件 ---
export default function App(){
  const [route, setRoute] = useState("home");
  const [entries, setEntries] = useState(()=>loadEntries());
  const [draft, setDraft] = useState({
    date: todayStr(),
    symptoms: [],
    needs: [],
    mood: 2,
    note: "",
    photos: [],
    // 生命徵象/數據（選填）
    bpSys: "",
    bpDia: "",
    heartRate: "",
    weight: "",
    steps: ""
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
    const headers = ["date","symptoms","needs","mood","note","bpSys","bpDia","heartRate","weight","steps"];
    const rows = entries.map(e=> [
      e.date,
      (e.symptoms||[]).join("|"),
      (e.needs||[]).join("|"),
      e.mood ?? "",
      JSON.stringify(e.note||""),
      e.bpSys ?? "",
      e.bpDia ?? "",
      e.heartRate ?? "",
      e.weight ?? "",
      e.steps ?? ""
    ]);
    const csv = [headers.join(","), ...rows.map(r=>r.join(","))].join("\n");

    const blob = new Blob(["\ufeff"+csv], { type: "text/csv;charset=utf-8;" });
    const file = new File([blob], `health_guide_${Date.now()}.csv`, { type: "text/csv" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "健康導覽員匯出", text: "我的健康日記（CSV）" }).catch(()=>{});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'health_guide_entries.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    const isIOSStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (typeof navigator!=="undefined" && 'standalone' in navigator && navigator.standalone);
    if (isIOSStandalone) {
      const reader = new FileReader();
      reader.onload = () => {
        const w = window.open('', '_blank');
        if (w) { w.document.write(`<pre style=\"white-space:pre-wrap;word-wrap:break-word;\">${String(reader.result).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`); w.document.close(); }
      };
      reader.readAsText(blob, 'utf-8');
    }
  }

  function clearAll(){
    if(confirm("確定要刪除所有本機資料？此動作無法復原。")){
      localStorage.removeItem("hg_entries"); setEntries([]); setDraft({
        ...draft,
        symptoms:[], needs:[], note:"", photos:[],
        bpSys:"", bpDia:"", heartRate:"", weight:"", steps:""
      });
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

  // 簡易趨勢頁（最近 30 筆資料）
  function Trends(){
    const byDate = [...entries].sort((a,b)=> a.date.localeCompare(b.date));
    const lastN = (getter, n=30)=> byDate.slice(-n).map(getter).map(v=> (v===''||v==null)? undefined : Number(v));
    const blocks = [
      { key:'bpSys', label:'收縮壓', unit:'mmHg', data: lastN(e=>e.bpSys) },
      { key:'bpDia', label:'舒張壓', unit:'mmHg', data: lastN(e=>e.bpDia) },
      { key:'heartRate', label:'心率', unit:'bpm', data: lastN(e=>e.heartRate) },
      { key:'weight', label:'體重', unit:'kg', data: lastN(e=>e.weight) },
      { key:'steps', label:'步數', unit:'步', data: lastN(e=>e.steps) },
    ];
    return (
      <div>
        {blocks.map(b=>{
          const nums = b.data.filter(v=> typeof v==='number' && !isNaN(v));
          const latest = nums.length? nums[nums.length-1] : '-';
          const path = sparkPath(nums);
          return (
            <Card key={b.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{b.label}</div>
                <div className="text-sm text-gray-600">{latest}{typeof latest==='number'? ' '+b.unit: ''}</div>
              </div>
              <svg viewBox="0 0 240 60" width="100%" height="60">
                <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </Card>
          );
        })}
        {byDate.length===0 && <Card><div className="text-sm text-gray-600">目前沒有資料，請先在「寫日記」新增一則。</div></Card>}
      </div>
    );
  }

  // PWA 安裝提示（Android 會捕捉 beforeinstallprompt）
  const [installEvt, setInstallEvt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  useEffect(()=>{
    const handler = (e)=>{ e.preventDefault(); setInstallEvt(e); setCanInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', ()=> setCanInstall(false));
    return ()=> window.removeEventListener('beforeinstallprompt', handler);
  },[]);
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const inStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (typeof navigator!== 'undefined' && 'standalone' in navigator && navigator.standalone);
  async function handleInstall(){ if(!installEvt) return; installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); setCanInstall(false); }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-lg font-bold">健康導覽員 · 零雲端 MVP</div>
        <nav className="space-x-1">
          {['home','write','advice','calendar','trends','settings'].map(r=> (
            <button key={r} onClick={()=>setRoute(r)} className={`px-3 py-1 rounded-full text-sm border ${route===r?"bg-black text-white border-black":"bg-white border-gray-300"}`}>{
              r==='home'? '首頁': r==='write'? '寫日記': r==='advice'? '建議': r==='calendar'? '月曆' : r==='trends'? '趨勢' : '設定'
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
            <Section title="生命徵象/數據（選填）">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="text-sm">收縮壓(mmHg)
                  <input type="number" inputMode="numeric" value={draft.bpSys} onChange={e=>setDraft(d=>({...d, bpSys:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-2"/>
                </label>
                <label className="text-sm">舒張壓(mmHg)
                  <input type="number" inputMode="numeric" value={draft.bpDia} onChange={e=>setDraft(d=>({...d, bpDia:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-2"/>
                </label>
                <label className="text-sm">心率(bpm)
                  <input type="number" inputMode="numeric" value={draft.heartRate} onChange={e=>setDraft(d=>({...d, heartRate:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-2"/>
                </label>
                <label className="text-sm">體重(kg)
                  <input type="number" inputMode="numeric" step="0.1" value={draft.weight} onChange={e=>setDraft(d=>({...d, weight:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-2"/>
                </label>
                <label className="text-sm">步數(步)
                  <input type="number" inputMode="numeric" value={draft.steps} onChange={e=>setDraft(d=>({...d, steps:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-2"/>
                </label>
              </div>
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

        {route==='trends' && (
          <div>
            <Trends/>
          </div>
        )}

        {route==='settings' && (
          <div>
            <Card>
              <div className="font-semibold mb-2">安裝到主畫面</div>
              {canInstall && (
                <button onClick={handleInstall} className="px-4 py-2 rounded-xl bg-black text-white text-sm w-full md:w-auto">安裝 App（Android/Chrome）</button>
              )}
              {!canInstall && isiOS && !inStandalone && (
                <div className="text-sm text-gray-600">iPhone：請用 Safari → 分享 → 加到主畫面。</div>
              )}
              {!canInstall && !isiOS && (
                <div className="text-sm text-gray-600">若看不到按鈕，請在瀏覽器選單找到「安裝 App / 加到主畫面」。</div>
              )}
            </Card>
            <Card>
              <div className="font-semibold mb-2">資料工具</div>
              <div className="flex flex-col gap-2">
                <button onClick={exportCSV} className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm w-full md:w-auto">分享/下載 CSV</button>
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
