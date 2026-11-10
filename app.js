
const API_URL='https://script.google.com/macros/s/AKfycbzagRlIzKJl8gJ2rrR7f_w8zK35pJ9rD29VYquSeInHtwmgdXhy4X87QDQUyxNXRKJ-/exec';
let rating=0, photoPayload=null, statsCache=null, adminSessionKey='';
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];

function setStatus(el,msg,type='info'){el.textContent=msg;el.className='status show '+type}
function today(){const d=new Date();const off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10)}
$('#date').value=today();

$$('.tab').forEach(btn=>btn.addEventListener('click',()=>{ $$('.tab').forEach(x=>x.classList.remove('active')); $$('.panel').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); $('#'+btn.dataset.tab).classList.add('active'); if(btn.dataset.tab==='stats') loadStats(); }));

for(let i=1;i<=5;i++){const s=document.createElement('button');s.type='button';s.setAttribute('aria-label',i+' 星');s.setAttribute('aria-pressed','false');s.className='star';s.textContent='★';s.dataset.value=i;s.onclick=()=>setRating(i);$('#stars').appendChild(s)}
function setRating(v){rating=v;$$('.star').forEach(s=>(s.classList.toggle('on',Number(s.dataset.value)<=v),s.setAttribute('aria-pressed',String(Number(s.dataset.value)===v))));$('#ratingHint').textContent='本次評分：'+v+' 星'}
$('#feedback').addEventListener('input',e=>$('#count').textContent=e.target.value.length);
$('#resetBtn').onclick=()=>{photoVersion++;photoReading=false;['className','studentName','parentName','book','feedback'].forEach(id=>$('#'+id).value='');$('#date').value=today();$('#photo').value='';$('#preview').innerHTML='';$('#count').textContent='0';photoPayload=null;setRating(0);$('#submitStatus').className='status'};


let photoVersion=0, photoReading=false;
$('#photo').addEventListener('change',async e=>{
  const input=e.target, version=++photoVersion, file=input.files[0];
  photoPayload=null;$('#preview').replaceChildren();photoReading=false;
  if(!file)return;
  if(!['image/jpeg','image/png'].includes(file.type)||file.size>5*1024*1024){
    input.value='';setStatus($('#submitStatus'),'請選擇 5MB 以下的 JPG 或 PNG 照片。','err');return;
  }
  photoReading=true;
  try{
    const dataUrl=await readFile(file);
    if(version!==photoVersion)return;
    photoPayload={dataUrl,mimeType:file.type,name:file.name};
    const img=document.createElement('img');img.src=dataUrl;img.alt='本次晨讀照片預覽';
    const label=document.createElement('span');label.textContent=file.name;
    $('#preview').replaceChildren(img,label);
  }catch(error){if(version===photoVersion){input.value='';setStatus($('#submitStatus'),'照片讀取失敗，請重新選擇。','err');}}
  finally{if(version===photoVersion)photoReading=false;}
});
function readFile(file){return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(reader.error||new Error('照片讀取失敗'));
  reader.onabort=()=>reject(new Error('照片讀取已取消'));reader.readAsDataURL(file);
});}

function jsonpOnce(params, timeout=15000){return new Promise((resolve,reject)=>{const cb='__cb_'+Date.now()+'_'+Math.floor(Math.random()*1e6);const script=document.createElement('script');let settled=false;const timer=setTimeout(()=>cleanup(new Error('連線逾時')),timeout);function cleanup(err,data){if(settled)return;settled=true;clearTimeout(timer);try{delete window[cb]}catch(_){window[cb]=undefined}script.remove();err?reject(err):resolve(data)}window[cb]=data=>cleanup(null,data);script.onerror=()=>cleanup(new Error('JSONP 載入失敗'));const q=new URLSearchParams({...params,callback:cb,_:Date.now()});script.src=API_URL+'?'+q.toString();script.async=true;document.head.appendChild(script)})}
async function jsonp(params, timeout=15000){try{return await jsonpOnce(params,timeout)}catch(first){await new Promise(r=>setTimeout(r,700));return jsonpOnce(params,timeout)}}

async function ping(){try{const d=await jsonp({action:'ping'},10000);if(d&&d.ok)setStatus($('#apiStatus'),'✅ 系統連線正常','ok');else throw new Error(d?.message||'連線失敗')}catch(e){setStatus($('#apiStatus'),'❌ Apps Script 連線失敗：'+e.message,'err')}}
ping();

$('#submitBtn').onclick=async()=>{if(photoReading){setStatus($('#submitStatus'),'照片仍在讀取，請稍候再送出。','info');return;}const data={action:'submit',date:$('#date').value,className:$('#className').value.trim(),studentName:$('#studentName').value.trim(),parentName:$('#parentName').value.trim(),book:$('#book').value.trim(),rating:String(rating),feedback:$('#feedback').value.trim(),photoBase64:photoPayload?.dataUrl||'',photoMimeType:photoPayload?.mimeType||'',photoName:photoPayload?.name||''};if(!data.date||!data.className||!data.studentName||!data.parentName||!data.book||!data.feedback||!rating){setStatus($('#submitStatus'),'❌ 請完成所有必填欄位與星等評分','err');return}const btn=$('#submitBtn');btn.classList.add('busy');setStatus($('#submitStatus'),'資料傳送中…','info');try{await fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams(data)});setStatus($('#submitStatus'),'已傳送打卡資料，尚未確認儲存結果。請稍候查看統計，避免重複送出。','info');setTimeout(()=>{statsCache=null;loadStats()},2500)}catch(e){setStatus($('#submitStatus'),'❌ 傳送失敗：'+e.message,'err')}finally{btn.disabled=false;btn.classList.remove('busy')}};


let statsPending=null,statsLoadedAt=0;
function loadStats(){
  if(statsPending)return statsPending;
  if(statsCache&&Date.now()-statsLoadedAt<30000){renderStats(statsCache);return Promise.resolve();}
  const box=$('#lineChart');box.textContent='載入統計中…';
  statsPending=(async()=>{try{
    const data=await jsonp({action:'stats'});if(!data?.ok)throw new Error(data?.message||'讀取失敗');
    statsCache=data;statsLoadedAt=Date.now();renderStats(data);
  }catch(error){
    box.replaceChildren();const message=document.createElement('p');message.textContent='統計載入失敗，請稍後重試。';
    const retry=document.createElement('button');retry.type='button';retry.className='btn secondary';retry.textContent='重新載入';retry.onclick=()=>loadStats();box.append(message,retry);
  }finally{statsPending=null;}})();return statsPending;
}

function renderStats(d){$('#totalCount').textContent=d.total||0;$('#avgRating').textContent=Number(d.averageRating||0).toFixed(1);const dates=(d.dateSeries||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||'')));renderLine(dates);renderGrades(d.gradeSeries||[],d.total||0);renderRatings(d.ratingSeries||[],d.total||0)}
function renderLine(series){const el=$('#lineChart');if(!series.length){el.innerHTML='<div class="hint">目前尚無資料</div>';return}const w=640,h=210,p=34,max=Math.max(1,...series.map(x=>x.count));const pts=series.map((x,i)=>{const xx=p+(w-p*2)*(i/(Math.max(1,series.length-1)));const yy=h-p-(h-p*2)*(x.count/max);return [xx,yy,x]});let svg=`<svg viewBox="0 0 ${w} ${h}" class="line-svg">`;for(let i=0;i<5;i++){const y=p+(h-p*2)*i/4;svg+=`<line x1="${p}" y1="${y}" x2="${w-p}" y2="${y}" stroke="#e6ece9"/>`}svg+=`<polyline fill="none" stroke="#10a978" stroke-width="4" points="${pts.map(p=>p[0]+','+p[1]).join(' ')}"/>`;pts.forEach(([x,y,o])=>{svg+=`<circle cx="${x}" cy="${y}" r="5" fill="#10a978"/><text x="${x}" y="${h-8}" font-size="11" text-anchor="middle" fill="#65717d">${o.date.slice(5)}</text>`});svg+='</svg>';el.innerHTML=svg}
function renderGrades(series,total){
  const colors=['#16b67f','#3289e8','#f4b51f','#a64ce0','#eb4d84','#9da7b0','#65c8b1'];
  const order=['一年級','二年級','三年級','四年級','五年級','六年級','其他'];
  const aliases={'1':'一年級','1年':'一年級','1年級':'一年級','一':'一年級','一年級':'一年級','2':'二年級','2年':'二年級','2年級':'二年級','二':'二年級','二年級':'二年級','3':'三年級','3年':'三年級','3年級':'三年級','三':'三年級','三年級':'三年級','4':'四年級','4年':'四年級','4年級':'四年級','四':'四年級','四年級':'四年級','5':'五年級','5年':'五年級','5年級':'五年級','五':'五年級','五年級':'五年級','6':'六年級','6年':'六年級','6年級':'六年級','六':'六年級','六年級':'六年級','其他':'其他'};
  const counts=Object.fromEntries(order.map(k=>[k,0]));
  (series||[]).forEach(x=>{
    const raw=String(x?.name??'').trim();
    const name=aliases[raw]||'其他';
    counts[name]+=Number(x?.count||0);
  });
  const clean=order.map(name=>({name,count:counts[name]}));
  const cleanTotal=clean.reduce((sum,x)=>sum+x.count,0);
  const denominator=cleanTotal||Number(total)||0;
  let angle=0,parts=[];
  clean.forEach((x,i)=>{const pct=denominator?x.count/denominator*100:0;if(pct>0){parts.push(`${colors[i]} ${angle}% ${angle+pct}%`);angle+=pct}});
  $('#gradeDonut').style.background=denominator&&parts.length?`conic-gradient(${parts.join(',')})`:'#edf2f0';
  $('#gradeLegend').innerHTML=clean.map((x,i)=>`<div class="legend-row"><span class="dot" style="background:${colors[i]}"></span><span>${x.name}</span><strong>${denominator?Math.round(x.count/denominator*100):0}%</strong></div>`).join('');
}
function renderRatings(series,total){series=(Array.isArray(series)?series:[]).filter(x=>Number.isInteger(Number(x.star))&&Number(x.star)>=1&&Number(x.star)<=5).map(x=>({star:Number(x.star),count:Math.max(0,Number(x.count)||0)}));const colors={5:'#17b780',4:'#7ac943',3:'#ffbd2e',2:'#ff8a2a',1:'#ef3b3b'};const max=Math.max(1,...series.map(x=>x.count));$('#ratingBars').innerHTML=series.map(x=>`<div class="rating-row"><strong>${x.star}星</strong><div class="bar"><span style="width:${x.count/max*100}%;background:${colors[x.star]}"></span></div><span>${total?Math.round(x.count/total*100):0}% (${x.count})</span></div>`).join('')}

async function adminLogin(){
  const key=$('#adminKey').value.trim();
  if(!key){setStatus($('#adminLoginStatus'),'❌ 請輸入管理密碼','err');return}
  const btn=$('#adminLoginBtn');btn.classList.add('busy');setStatus($('#adminLoginStatus'),'驗證中…','info');
  try{
    const auth=await jsonp({action:'adminAuth',key});
    if(!auth.ok)throw new Error(auth.message||'登入失敗');
    adminSessionKey=key;
    $('#adminGate').style.display='none';
    $('#adminTools').classList.add('show');
    $('#adminLoginStatus').className='status';
    await loadAdminRows();
  }catch(e){
    adminSessionKey='';
    setStatus($('#adminLoginStatus'),'❌ '+e.message,'err');
  }finally{btn.classList.remove('busy')}
}
async function loadAdminRows(){
  if(!adminSessionKey){adminLogout();return}
  setStatus($('#adminStatus'),'載入中…','info');
  try{
    const d=await jsonp({action:'adminList',key:adminSessionKey});
    if(!d.ok)throw new Error(d.message||'讀取失敗');
    renderAdmin(d.rows||[]);
    setStatus($('#adminStatus'),'✅ 已載入 '+(d.rows||[]).length+' 筆資料','ok');
  }catch(e){
    if(String(e.message||'').includes('管理密碼')){adminLogout();setStatus($('#adminLoginStatus'),'❌ 登入已失效，請重新登入','err');return}
    setStatus($('#adminStatus'),'❌ '+e.message,'err');
  }
}
function adminLogout(){
  adminSessionKey='';
  $('#adminKey').value='';
  $('#adminBody').innerHTML='';
  $('#adminTools').classList.remove('show');
  $('#adminGate').style.display='block';
  $('#adminStatus').className='status';
}
$('#adminLoginBtn').onclick=adminLogin;
$('#adminKey').addEventListener('keydown',e=>{if(e.key==='Enter')adminLogin()});
$('#reloadAdmin').onclick=loadAdminRows;
$('#adminLogoutBtn').onclick=adminLogout;

function csvCell(v){
  let s=String(v??'').replace(/\r?\n/g,' ');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r]/.test(s))s="'"+s;
  return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function downloadCsv(filename,rows){
  const csv='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportStamp(){const d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')}
async function exportAdminData(){
  if(!adminSessionKey){adminLogout();return}
  const btn=$('#exportDataBtn');btn.classList.add('busy');setStatus($('#adminStatus'),'正在準備完整資料…','info');
  try{
    const d=await jsonp({action:'adminExportData',key:adminSessionKey},20000);
    if(!d.ok)throw new Error(d.message||'匯出失敗');
    const rows=[['ID','建立時間','入班日期','班級','年級','學生姓名','家長姓名','閱讀書籍','評價','回饋心得','照片網址','照片檔名']];
    (d.rows||[]).forEach(r=>rows.push([r.id,r.createdAt,r.date,r.className,r.grade,r.studentName,r.parentName,r.book,r.rating,r.feedback,r.photoUrl,r.photoName]));
    downloadCsv('興嘉國小_家長入班晨讀_完整資料_'+exportStamp()+'.csv',rows);
    setStatus($('#adminStatus'),'✅ 已匯出 '+(d.rows||[]).length+' 筆完整資料','ok');
  }catch(e){setStatus($('#adminStatus'),'❌ 匯出資料失敗：'+e.message,'err')}finally{btn.classList.remove('busy')}
}
async function exportAdminStats(){
  if(!adminSessionKey){adminLogout();return}
  const btn=$('#exportStatsBtn');btn.classList.add('busy');setStatus($('#adminStatus'),'正在準備統計數據…','info');
  try{
    const d=await jsonp({action:'adminExportStats',key:adminSessionKey},20000);
    if(!d.ok)throw new Error(d.message||'匯出失敗');
    const rows=[['興嘉國小家長入班晨讀統計'],['匯出時間',new Date().toLocaleString('zh-TW')],['總打卡人次',d.total||0],['平均評分',Number(d.averageRating||0).toFixed(1)],[],['每日入班人數'],['日期','人次']];
    (d.dateSeries||[]).forEach(x=>rows.push([x.date,x.count]));
    rows.push([],['各年級入班統計'],['年級','人次','比例']);
    (d.gradeSeries||[]).forEach(x=>rows.push([x.name,x.count,(d.total?Math.round(x.count/d.total*100):0)+'%']));
    rows.push([],['晨讀評價統計'],['星等','人次','比例']);
    (d.ratingSeries||[]).forEach(x=>rows.push([x.star+'星',x.count,(d.total?Math.round(x.count/d.total*100):0)+'%']));
    downloadCsv('興嘉國小_家長入班晨讀_統計數據_'+exportStamp()+'.csv',rows);
    setStatus($('#adminStatus'),'✅ 統計數據 CSV 已下載','ok');
  }catch(e){setStatus($('#adminStatus'),'❌ 匯出統計失敗：'+e.message,'err')}finally{btn.classList.remove('busy')}
}
$('#exportDataBtn').onclick=exportAdminData;
$('#exportStatsBtn').onclick=exportAdminStats;


function renderAdmin(rows){
  const fragment=document.createDocumentFragment();
  for(const row of rows){
    const tr=document.createElement('tr');
    for(const key of ['date','className','studentName','parentName','book','rating','feedback']){
      const td=document.createElement('td');td.textContent=String(row[key]??'')+(key==='rating'?'★':'');tr.append(td);
    }
    const photo=document.createElement('td');
    try{const url=new URL(row.photoUrl);if(url.protocol==='https:'){
      const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='查看';photo.append(link);
    }}catch(_){}
    const action=document.createElement('td'),button=document.createElement('button');
    button.type='button';button.className='mini del';button.textContent='刪除';
    button.addEventListener('click',()=>deleteRow(String(row.id)));action.append(button);tr.append(photo,action);fragment.append(tr);
  }
  $('#adminBody').replaceChildren(fragment);
}

async function deleteRow(id){
  if(!adminSessionKey){adminLogout();return}
  if(!confirm('確定刪除這筆資料？'))return;
  try{
    await fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams({action:'adminDelete',key:adminSessionKey,id})});
    setStatus($('#adminStatus'),'✅ 已送出刪除要求，稍候重新整理資料','ok');
    setTimeout(loadAdminRows,1800);
  }catch(e){setStatus($('#adminStatus'),'❌ 刪除失敗：'+e.message,'err')}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}function attr(v){return esc(v).replace(/`/g,'&#96;')}


document.querySelectorAll('.field').forEach(field=>{const control=field.querySelector('input,textarea');const label=field.querySelector('label');if(control&&label){label.htmlFor=control.id;if(control.type!=='file')control.required=true;}});
document.querySelectorAll('.status').forEach(el=>{el.setAttribute('role','status');el.setAttribute('aria-live','polite');});
document.querySelector('#adminKey').setAttribute('aria-label','管理密碼');
document.querySelector('#stars').setAttribute('role','group');
document.querySelector('#stars').setAttribute('aria-label','晨讀評價，選擇一至五星');
document.querySelectorAll('.tab').forEach(button=>{button.setAttribute('aria-controls',button.dataset.tab);button.setAttribute('aria-pressed',String(button.classList.contains('active')));button.addEventListener('click',()=>document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-pressed',String(b===button))));});
const send=document.querySelector('#submitBtn');send.addEventListener('click',event=>{const missing=[...document.querySelectorAll('#checkin [required]')].find(el=>!el.value.trim()||!el.checkValidity());if(missing){event.stopImmediatePropagation();missing.reportValidity();missing.focus();}else if(!rating){event.stopImmediatePropagation();setStatus(document.querySelector('#submitStatus'),'請選擇本次晨讀評價。','err');document.querySelector('.star').focus();}},true);
const reset=document.querySelector('#resetBtn');reset.addEventListener('click',event=>{if([...document.querySelectorAll('#checkin input:not([type="date"]),#feedback')].some(el=>el.value)||rating){if(!confirm('清空目前填寫的內容並重新填寫？'))event.stopImmediatePropagation();}},true);
