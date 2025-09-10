// =============================
// tailwind.config.js
// =============================
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans TC"', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        brand: {
          DEFAULT: '#059669',
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b'
        }
      },
      boxShadow: {
        card: '0 6px 20px rgba(0,0,0,.06)'
      }
    }
  },
  plugins: []
}


// =============================
// index.html
// =============================
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>健康導覽員 · 零雲端 MVP</title>

    <meta name="description" content="健康導覽員：本機日記 + 建議 + 趨勢圖，零後端、零上傳。">
    <meta property="og:title" content="健康導覽員 · 零雲端 MVP">
    <meta property="og:description" content="本機日記 + 建議 + 趨勢圖，資料只存在你的裝置。">

    <link rel="manifest" href="/manifest.webmanifest?v=8">
    <meta name="theme-color" content="#111827">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png?v=8">
    <link rel="icon" href="/icon-192.png?v=8">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js?v=8');
      }
    </script>
  </body>
</html>

// =============================
// src/main.jsx
// =============================
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// =============================
// src/App.jsx
// =============================
import React, { useEffect, useMemo, useState } from 'react'

const todayStr = () => new Date().toISOString().slice(0,10)
const LS_ENTRIES = 'hg_entries'
const LS_SYM = 'hg_custom_symptoms'
const LS_NEED = 'hg_custom_needs'

const SYMPTOMS = ["頭痛","頭暈","鼻塞","喉嚨痛","咳嗽","呼吸急促","胸悶/胸痛","胃痛","腹瀉","便祕","噁心","腰痠背痛","關節痛","皮疹","失眠","焦慮","經痛"]
const NEEDS = ["多喝水","多休息","避免刺激","清淡飲食","放鬆伸展","適度運動","日照/散步"]

const load = (k, d) => JSON.parse(localStorage.getItem(k) || d)
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v))

function Chip({label, active, onClick}) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`chip ${active? 'chip-on':'chip-off'}`}>
      {active && <span className="mr-1">✔</span>}{label}
    </button>
  )
}

function Card({children}) { return <div className="card mb-4">{children}</div> }
function Section({title, children}) { return <section className="mb-6"><div className="font-semibold mb-2">{title}</div>{children}</section> }

function sparkPath(values, width=260, height=64) {
  const nums = values.filter(v => typeof v==='number' && !isNaN(v))
  if (!nums.length) return ''
  const min = Math.min(...nums), max = Math.max(...nums), span = max-min || 1
  const pts = nums.map((v,i)=>{
    const x = (i/(nums.length-1||1))*width
    const y = height - ((v-min)/span)*height
    return [x,y]
  })
  return pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
}

export default function App(){
  const [route, setRoute] = useState('home')
  const [entries, setEntries] = useState(()=> load(LS_ENTRIES, '[]'))
  useEffect(()=> save(LS_ENTRIES, entries), [entries])

  const [customSymptoms, setCustomSymptoms] = useState(()=> load(LS_SYM, '[]'))
  const [customNeeds, setCustomNeeds] = useState(()=> load(LS_NEED, '[]'))
  useEffect(()=> save(LS_SYM, customSymptoms), [customSymptoms])
  useEffect(()=> save(LS_NEED, customNeeds), [customNeeds])

  const ALL_SYMPTOMS = useMemo(()=> [...SYMPTOMS, ...customSymptoms], [customSymptoms])
  const ALL_NEEDS = useMemo(()=> [...NEEDS, ...customNeeds], [customNeeds])

  const [draft, setDraft] = useState({
    date: todayStr(), symptoms:[], needs:[], mood:2, note:'', photos:[],
    bpSys:'', bpDia:'', heartRate:'', weight:'', steps:''
  })

  const hasAnyInput = !!(draft.symptoms.length || draft.needs.length || (draft.note && draft.note.trim()) || draft.bpSys || draft.bpDia || draft.heartRate || draft.weight || draft.steps)

  const toggleSymptom = s => setDraft(d=> ({...d, symptoms: d.symptoms.includes(s) ? d.symptoms.filter(x=>x!==s) : [...d.symptoms, s]}))
  const toggleNeed = n => setDraft(d=> ({...d, needs: d.needs.includes(n) ? d.needs.filter(x=>x!==n) : [...d.needs, n]}))

  async function compressImage(file, maxW=1280, maxH=1280, quality=.85){
    const img = new Image(); const url = URL.createObjectURL(file)
    return new Promise((res,rej)=>{
      img.onload = ()=>{ const r = Math.min(maxW/img.width, maxH/img.height, 1); const w = Math.round(img.width*r), h = Math.round(img.height*r)
        const c = document.createElement('canvas'); c.width=w; c.height=h; const ctx = c.getContext('2d'); ctx.drawImage(img,0,0,w,h)
        c.toBlob(b=>{ const fr = new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(b); URL.revokeObjectURL(url) }, 'image/jpeg', quality)
      }
      img.onerror = rej; img.src = url
    })
  }

  async function handlePhoto(e){
    const f = e.target.files?.[0]; if(!f) return
    const b64 = await compressImage(f); setDraft(d=>({...d, photos:[...d.photos, b64]})); e.target.value=''
  }
  const removePhoto = (i)=> setDraft(d=> ({...d, photos: d.photos.filter((_,idx)=> idx!==i)}))

  function submitEntry(){
    const list = [...entries, {...draft, createdAt: Date.now()}].sort((a,b)=> a.date.localeCompare(b.date))
    setEntries(list); setRoute('advice')
  }

  function exportCSV(){
    const headers = ["date","symptoms","needs","mood","note","bpSys","bpDia","heartRate","weight","steps"]
    const rows = entries.map(e=> [e.date,(e.symptoms||[]).join('|'),(e.needs||[]).join('|'), e.mood??'', JSON.stringify(e.note||''), e.bpSys??'', e.bpDia??'', e.heartRate??'', e.weight??'', e.steps??''])
    const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n')
    const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'}); const file = new File([blob], `health_guide_${Date.now()}.csv`, {type:'text/csv'})
    if(navigator.canShare && navigator.canShare({files:[file]})){ navigator.share({files:[file], title:'健康導覽員匯出', text:'我的健康日記（CSV）'}).catch(()=>{}); return }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='health_guide_entries.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  function clearAll(){ if(confirm('確定要刪除所有本機資料？此動作無法復原。')){ localStorage.removeItem(LS_ENTRIES); setEntries([]) } }

  const advice = useMemo(()=>{
    const out=[]; const s=new Set(draft.symptoms); const needs=new Set(draft.needs)
    const sys=Number(draft.bpSys||NaN), dia=Number(draft.bpDia||NaN), hr=Number(draft.heartRate||NaN)
    if (s.has('胸悶/胸痛') || s.has('呼吸急促')) out.push('胸悶/呼吸急促：若伴隨冒冷汗、噁心、放射性疼痛，請立刻就醫（急診）。')
    if (sys>=180 || dia>=120) out.push('血壓非常高（≥180/120），請儘速就醫。')
    if (hr && (hr<45 || hr>120)) out.push('心率過低或過高，建議就醫評估。')
    if (s.has('喉嚨痛') || s.has('咳嗽') || s.has('鼻塞')) out.push('上呼吸道不適：補水、休息、避免刺激性飲食。若>7天或高燒不退，建議就醫。')
    if (s.has('腹瀉')) out.push('腹瀉：口服補液、清淡飲食，留意脫水。便血/高燒/>3天建議就醫。')
    if (s.has('便祕')) out.push('便祕：增加蔬果水份、規律運動。若伴隨嚴重腹痛或黑便，請就醫。')
    if (s.has('失眠') || s.has('焦慮')) out.push('睡眠/壓力：規律作息、睡前減少藍光，嘗試 5 分鐘呼吸冥想。')
    if (needs.size) out.push(`你今天標記的需求：${[...needs].join('、')}（完成 1〜2 項即可）`)
    out.push('本工具非醫療診斷，急重症請就醫。')
    return out
  }, [draft])

  function Calendar(){
    const [month, setMonth] = useState(()=>{ const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
    const monthStr = month.toISOString().slice(0,7)
    const days = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate()
    const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay()
    const has = new Set(entries.map(e=>e.date))
    const cells=[]; for(let i=0;i<first;i++) cells.push(null); for(let d=1; d<=days; d++) cells.push(d)
    return (
      <Card>
        <div className="flex items-center justify-between mb-3">
          <button className="tab tab-off" onClick={()=> setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}>‹ 上個月</button>
          <div className="font-semibold text-slate-800">{monthStr}</div>
          <button className="tab tab-off" onClick={()=> setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}>下個月 ›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-600 mb-1">{['日','一','二','三','四','五','六'].map(d=> <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d,i)=> d===null ? <div key={i}/> : (
            <div key={i} className={`h-12 rounded-xl border flex items-center justify-center ${has.has(`${monthStr}-${String(d).padStart(2,'0')}`)? 'bg-slate-900 text-white border-slate-900':'bg-white border-slate-200'}`}>{d}</div>
          ))}
        </div>
      </Card>
    )
  }

  function Trends(){
    const byDate=[...entries].sort((a,b)=> a.date.localeCompare(b.date))
    const lastN=(g,n=30)=> byDate.slice(-n).map(g).map(v=> (v===''||v==null)? undefined: Number(v))
    const blocks=[
      {key:'bpSys', label:'收縮壓', unit:'mmHg', data:lastN(e=>e.bpSys)},
      {key:'bpDia', label:'舒張壓', unit:'mmHg', data:lastN(e=>e.bpDia)},
      {key:'heartRate', label:'心率', unit:'bpm', data:lastN(e=>e.heartRate)},
      {key:'weight', label:'體重', unit:'kg', data:lastN(e=>e.weight)},
      {key:'steps', label:'步數', unit:'步', data:lastN(e=>e.steps)}
    ]
    return (
      <div>
        {blocks.map(b=>{ const nums=b.data.filter(v=> typeof v==='number' && !isNaN(v)); const latest = nums.length? nums.at(-1) : '-'; const path=sparkPath(nums)
          return (
            <Card key={b.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{b.label}</div>
                <div className="text-sm text-slate-600">{latest}{typeof latest==='number'? ' '+b.unit:''}</div>
              </div>
              <svg viewBox="0 0 260 64" width="100%" height="64" className="text-brand-600">
                <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </Card>
          )
        })}
        {!byDate.length && <Card><div className="text-sm text-slate-600">目前無資料，請先在「寫日記」新增一則。</div></Card>}
      </div>
    )
  }

  // ===== UI =====
  return (
    <div className="min-h-screen">
      {/* Hero / Header */}
      <div className="bg-gradient-to-b from-brand-50 to-transparent">
        <header className="max-w-3xl mx-auto px-4 pt-6 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-slate-900">健康導覽員</div>
              <div className="text-xs text-slate-500">零雲端 · 本機儲存 · 你自己的健康儀表板</div>
            </div>
            <nav className="flex gap-1 bg-white/80 backdrop-blur border border-slate-200 rounded-full p-1 shadow-card">
              {['home','write','advice','calendar','trends','settings'].map(r=> (
                <button key={r} onClick={()=>setRoute(r)} className={`tab ${route===r? 'tab-on':'tab-off'}`}>{r==='home'?'首頁': r==='write'?'寫日記': r==='advice'?'建議': r==='calendar'?'月曆': r==='trends'?'趨勢':'設定'}</button>
              ))}
            </nav>
          </div>
        </header>
      </div>

      <main className="max-w-3xl mx-auto px-4 pb-12">
        {route==='home' && (
          <div>
            <Card>
              <div className="font-semibold mb-2">最近紀錄</div>
              {!entries.length && <div className="text-sm text-slate-600">尚無資料，先到「寫日記」建立第一筆吧。</div>}
              {entries.slice(-10).reverse().map((e,i)=> (
                <div key={i} className="border-b last:border-b-0 border-slate-100 py-2 text-sm">
                  <span className="font-semibold">{e.date}</span>
                  {!!e.symptoms?.length && <> · 症狀：{e.symptoms.join('、')}</>}
                  {!!e.needs?.length && <> · 需求：{e.needs.join('、')}</>}
                </div>
              ))}
            </Card>
          </div>
        )}

        {route==='write' && (
          <div>
            <Section title="日期">
              <input type="date" className="input max-w-xs" value={draft.date} onChange={e=>setDraft(d=>({...d, date:e.target.value}))}/>
            </Section>

            <Section title="症狀（可多選）">
              <div>
                {ALL_SYMPTOMS.map(s=> <Chip key={s} label={s} active={draft.symptoms.includes(s)} onClick={()=>toggleSymptom(s)} />)}
              </div>
              <div className="mt-2 flex gap-2">
                <input id="customSym" placeholder="新增自定症狀…" className="input flex-1" />
                <button className="btn btn-ghost" onClick={()=>{ const el=document.getElementById('customSym'); const v=el.value.trim(); if(!v) return; if(customSymptoms.includes(v)) return alert('已存在'); setCustomSymptoms([...customSymptoms, v]); el.value='' }}>加入</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-xs text-slate-600">
                {customSymptoms.map(x=> <span key={x} className="px-2 py-1 border rounded-full">{x} <button className="ml-1" onClick={()=> setCustomSymptoms(customSymptoms.filter(v=>v!==x))}>×</button></span>)}
              </div>
            </Section>

            <Section title="今日需求（可多選）">
              <div>
                {ALL_NEEDS.map(n=> <Chip key={n} label={n} active={draft.needs.includes(n)} onClick={()=>toggleNeed(n)} />)}
              </div>
              <div className="mt-2 flex gap-2">
                <input id="customNeed" placeholder="新增自定需求…" className="input flex-1" />
                <button className="btn btn-ghost" onClick={()=>{ const el=document.getElementById('customNeed'); const v=el.value.trim(); if(!v) return; if(customNeeds.includes(v)) return alert('已存在'); setCustomNeeds([...customNeeds, v]); el.value='' }}>加入</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-xs text-slate-600">
                {customNeeds.map(x=> <span key={x} className="px-2 py-1 border rounded-full">{x} <button className="ml-1" onClick={()=> setCustomNeeds(customNeeds.filter(v=>v!==x))}>×</button></span>)}
              </div>
            </Section>

            <Section title="生命徵象/數據（選填）">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <label className="text-sm">收縮壓(mmHg)
                  <input type="number" inputMode="numeric" value={draft.bpSys} onChange={e=>setDraft(d=>({...d, bpSys:e.target.value}))} className="input mt-1"/>
                </label>
                <label className="text-sm">舒張壓(mmHg)
                  <input type="number" inputMode="numeric" value={draft.bpDia} onChange={e=>setDraft(d=>({...d, bpDia:e.target.value}))} className="input mt-1"/>
                </label>
                <label className="text-sm">心率(bpm)
                  <input type="number" inputMode="numeric" value={draft.heartRate} onChange={e=>setDraft(d=>({...d, heartRate:e.target.value}))} className="input mt-1"/>
                </label>
                <label className="text-sm">體重(kg)
                  <input type="number" inputMode="numeric" step="0.1" value={draft.weight} onChange={e=>setDraft(d=>({...d, weight:e.target.value}))} className="input mt-1"/>
                </label>
                <label className="text-sm">步數(步)
                  <input type="number" inputMode="numeric" value={draft.steps} onChange={e=>setDraft(d=>({...d, steps:e.target.value}))} className="input mt-1"/>
                </label>
              </div>
            </Section>

            <Section title="備註">
              <textarea className="input min-h-[120px]" value={draft.note} onChange={e=>setDraft(d=>({...d, note:e.target.value}))} placeholder="可描述不適、誘因、用藥…（避免輸入可識別個資）" />
            </Section>

            <Section title="照片（選擇性；僅存本機）">
              <input type="file" accept="image/*" onChange={handlePhoto} />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {draft.photos.map((p,i)=> (
                  <div key={i} className="relative">
                    <img src={p} alt="upload" className="w-full h-24 object-cover rounded-xl border"/>
                    <button onClick={()=>removePhoto(i)} className="absolute top-1 right-1 text-xs bg-white/90 border rounded px-2 py-0.5">刪除</button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500 mt-1">請避免上傳含人臉、病歷等可識別資訊。</div>
            </Section>

            <button onClick={submitEntry} className="btn btn-primary">送出並查看建議</button>
          </div>
        )}

        {route==='advice' && (
          <div>
            {!hasAnyInput ? (
              <Card><div className="text-sm text-slate-700">目前尚未填寫今日資料，請到「寫日記」輸入症狀/需求或數據後再查看建議。</div></Card>
            ) : (
              <Card>
                <div className="font-semibold mb-2">今日建議（非醫療診斷）</div>
                <ul className="list-disc pl-5 text-sm leading-relaxed">
                  {advice.map((t,i)=> <li key={i}>{t}</li>)}
                </ul>
              </Card>
            )}
          </div>
        )}

        {route==='calendar' && <Calendar/>}
        {route==='trends' && <Trends/>}

        {route==='settings' && (
          <div>
            <Card>
              <div className="font-semibold mb-2">安裝到主畫面</div>
              <InstallTips/>
            </Card>
            <Card>
              <div className="font-semibold mb-2">資料工具</div>
              <div className="flex flex-col gap-2">
                <button onClick={exportCSV} className="btn btn-ghost w-full sm:w-auto">分享 / 下載 CSV</button>
                <button onClick={clearAll} className="btn w-full sm:w-auto bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">刪除所有本機資料</button>
              </div>
            </Card>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-500 py-8">© {new Date().getFullYear()} 健康導覽員 · v0.3 · 本工具非醫療診斷，急重症請就醫</footer>
    </div>
  )
}

function InstallTips(){
  const [evt, setEvt] = React.useState(null)
  const [can, setCan] = React.useState(false)
  React.useEffect(()=>{ const h=e=>{e.preventDefault(); setEvt(e); setCan(true)}; window.addEventListener('beforeinstallprompt',h); window.addEventListener('appinstalled',()=>setCan(false)); return ()=> window.removeEventListener('beforeinstallprompt',h)},[])
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const stand = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (typeof navigator!=='undefined' && 'standalone' in navigator && navigator.standalone)
  return (
    <div>
      {can && <button onClick={async()=>{evt.prompt(); await evt.userChoice; setEvt(null); setCan(false)}} className="btn btn-primary">安裝 App（Android/Chrome）</button>}
      {!can && isiOS && !stand && <div className="text-sm text-slate-600">iPhone：請用 Safari → 分享 → 加到主畫面。</div>}
      {!can && !isiOS && <div className="text-sm text-slate-600">若看不到按鈕，請在瀏覽器選單找到「安裝 App / 加到主畫面」。</div>}
    </div>
  )
}
