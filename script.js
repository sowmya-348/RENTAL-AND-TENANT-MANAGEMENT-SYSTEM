// ---------- Storage ----------
const KEY='rental-manager-v1';
let db={properties:[],tenants:[],leases:[],payments:[]};
try{const s=localStorage.getItem(KEY);if(s)db=JSON.parse(s)}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}};
const uid=()=>Math.random().toString(36).slice(2,10);

// ---------- Helpers ----------
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const pd=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const today=()=>{const t=new Date();return new Date(t.getFullYear(),t.getMonth(),t.getDate())};
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmt=d=>(typeof d==='string'?pd(d):d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
const days=(a,b)=>Math.round((a-b)/864e5);
const prop=id=>db.properties.find(p=>p.id===id);
const ten=id=>db.tenants.find(t=>t.id===id);
const lease=id=>db.leases.find(l=>l.id===id);
const leaseLabel=l=>`${ten(l.tenantId)?.name||'?'} — ${prop(l.propertyId)?.name||'?'}`;

function leaseStatus(l){
  const t=today();
  if(pd(l.start)>t)return'Upcoming';
  if(pd(l.end)<t)return'Expired';
  return'Active';
}
// Rent schedule: one row per month from lease start to current month
function schedule(l){
  const rows=[],t=today(),s=pd(l.start),e=pd(l.end);
  let y=s.getFullYear(),m=s.getMonth();
  while(true){
    const dim=new Date(y,m+1,0).getDate();
    const due=new Date(y,m,Math.min(l.dueDay,dim));
    if(due>e||new Date(y,m,1)>t)break;
    const key=`${y}-${String(m+1).padStart(2,'0')}`;
    const paid=db.payments.filter(p=>p.leaseId===l.id&&p.month===key).reduce((a,p)=>a+Number(p.amount),0);
    const bal=Math.max(0,l.rent-paid);
    let status=bal===0?'Paid':due<t?'Overdue':'Due';
    if(bal>0&&paid>0&&due<t)status='Partial';
    rows.push({leaseId:l.id,key,due,paid,bal,status,late:Math.max(0,days(t,due))});
    m++;if(m>11){m=0;y++}
  }
  return rows;
}
const allDues=()=>db.leases.flatMap(schedule);
const outstanding=()=>allDues().filter(r=>r.bal>0).sort((a,b)=>a.due-b.due);
const pill=s=>{const c={Paid:'ok',Active:'ok',Due:'warn',Upcoming:'warn',Partial:'warn',Overdue:'bad',Expired:'bad'}[s]||'';return`<span class="pill ${c}">${s}</span>`};

// ---------- Dialog form ----------
function openForm(title,fields,values,onSave){
  const f=$('#form');
  f.innerHTML=`<h3>${title}</h3>`+fields.map(x=>{
    const v=values?.[x.k]??x.def??'';
    const inp=x.opts
      ?`<select name="${x.k}" ${x.req!==false?'required':''}>${x.opts.map(o=>`<option value="${esc(o[0])}" ${o[0]==v?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`
      :`<input name="${x.k}" type="${x.t||'text'}" value="${esc(v)}" ${x.req!==false?'required':''} ${x.min!=null?`min="${x.min}"`:''} ${x.max!=null?`max="${x.max}"`:''}>`;
    return`<label>${x.l}${inp}</label>`}).join('')+
    `<div class="row"><button type="button" class="btn alt" id="cx">Cancel</button><button class="btn" value="ok">Save</button></div>`;
  const d=$('#dlg');
  $('#cx').onclick=()=>d.close();
  f.onsubmit=e=>{e.preventDefault();const o={};fields.forEach(x=>{let v=f.elements[x.k].value;if(x.t==='number')v=Number(v);o[x.k]=v});onSave(o);save();d.close();render()};
  d.showModal();
}
const optsFrom=(arr,label)=>arr.map(x=>[x.id,label(x)]);

// ---------- Views ----------
let view='dashboard',q='';
const views={
dashboard(){
  const t=today(),act=db.leases.filter(l=>leaseStatus(l)==='Active');
  const out=outstanding(),over=out.filter(r=>r.status==='Overdue'||r.status==='Partial');
  const overAmt=over.reduce((a,r)=>a+r.bal,0);
  const renew=db.leases.filter(l=>{const d=days(pd(l.end),t);return d>=-30&&d<=90}).sort((a,b)=>pd(a.end)-pd(b.end));
  const occ=db.properties.length?Math.round(new Set(act.map(l=>l.propertyId)).size/db.properties.length*100):0;
  const monthly=act.reduce((a,l)=>a+Number(l.rent),0);
  return`<div class="grid">
    <div class="stat"><b>${db.properties.length}</b><span>Properties (${occ}% occupied)</span></div>
    <div class="stat"><b>${act.length}</b><span>Active leases</span></div>
    <div class="stat"><b>${money(monthly)}</b><span>Monthly rent roll</span></div>
    <div class="stat"><b style="color:var(--bad)">${money(overAmt)}</b><span>Overdue rent (${over.length} records)</span></div>
  </div>
  <div class="card"><h2>Upcoming renewals (next 90 days)</h2>${renew.length?`<table><tr><th>Tenant</th><th>Property</th><th>Lease ends</th><th>Days left</th><th>Rent</th></tr>${renew.map(l=>{const d=days(pd(l.end),t);return`<tr><td>${esc(ten(l.tenantId)?.name)}</td><td>${esc(prop(l.propertyId)?.name)}</td><td>${fmt(l.end)}</td><td>${d<0?`<span class="pill bad">Expired ${-d}d ago</span>`:`<span class="pill ${d<=30?'bad':'warn'}">${d} days</span>`}</td><td>${money(l.rent)}</td></tr>`}).join('')}</table>`:'<div class="empty">No leases ending soon.</div>'}</div>
  <div class="card"><h2>Outstanding rent</h2>${outTable(out)}</div>`;
},
properties(){
  const rows=db.properties.filter(p=>(p.name+p.address+p.type).toLowerCase().includes(q));
  return`<div class="card"><div class="bar"><h2>Properties</h2><div class="filters"><input placeholder="Search…" value="${esc(q)}" oninput="q=this.value.toLowerCase();render(true)"><button class="btn" onclick="editProp()">+ Add property</button></div></div>
  ${rows.length?`<table><tr><th>Name</th><th>Address</th><th>Type</th><th>Market rent</th><th>Status</th><th></th></tr>${rows.map(p=>{const occ=db.leases.some(l=>l.propertyId===p.id&&leaseStatus(l)==='Active');return`<tr><td>${esc(p.name)}</td><td>${esc(p.address)}</td><td>${esc(p.type)}</td><td>${money(p.rent)}</td><td>${pill(occ?'Active':'Due').replace('Due','Vacant')}</td><td>${acts('Prop',p.id)}</td></tr>`}).join('')}</table>`:'<div class="empty">No properties yet.</div>'}</div>`;
},
tenants(){
  const rows=db.tenants.filter(t=>(t.name+t.phone+t.email).toLowerCase().includes(q));
  return`<div class="card"><div class="bar"><h2>Tenants</h2><div class="filters"><input placeholder="Search…" value="${esc(q)}" oninput="q=this.value.toLowerCase();render(true)"><button class="btn" onclick="editTen()">+ Add tenant</button></div></div>
  ${rows.length?`<table><tr><th>Name</th><th>Phone</th><th>Email</th><th>ID proof</th><th>Current lease</th><th></th></tr>${rows.map(t=>{const l=db.leases.find(l=>l.tenantId===t.id&&leaseStatus(l)==='Active');return`<tr><td>${esc(t.name)}</td><td>${esc(t.phone)}</td><td>${esc(t.email)}</td><td>${esc(t.idProof)}</td><td>${l?esc(prop(l.propertyId)?.name):'—'}</td><td>${acts('Ten',t.id)}</td></tr>`}).join('')}</table>`:'<div class="empty">No tenants yet.</div>'}</div>`;
},
leases(){
  const rows=db.leases.slice().sort((a,b)=>pd(a.end)-pd(b.end)).filter(l=>leaseLabel(l).toLowerCase().includes(q));
  return`<div class="card"><div class="bar"><h2>Leases</h2><div class="filters"><input placeholder="Search…" value="${esc(q)}" oninput="q=this.value.toLowerCase();render(true)"><button class="btn" onclick="editLease()">+ Add lease</button></div></div>
  ${rows.length?`<table><tr><th>Tenant</th><th>Property</th><th>Start</th><th>End</th><th>Rent</th><th>Due day</th><th>Deposit</th><th>Status</th><th></th></tr>${rows.map(l=>`<tr><td>${esc(ten(l.tenantId)?.name)}</td><td>${esc(prop(l.propertyId)?.name)}</td><td>${fmt(l.start)}</td><td>${fmt(l.end)}</td><td>${money(l.rent)}</td><td>${l.dueDay}</td><td>${money(l.deposit)}</td><td>${pill(leaseStatus(l))}</td><td>${acts('Lease',l.id)}</td></tr>`).join('')}</table>`:'<div class="empty">No leases yet. Add a property and tenant first.</div>'}</div>`;
},
payments(){
  const out=outstanding();
  const rows=db.payments.slice().sort((a,b)=>b.paidOn.localeCompare(a.paidOn));
  return`<div class="card"><div class="bar"><h2>Outstanding rent</h2></div>${outTable(out)}</div>
  <div class="card"><div class="bar"><h2>Payment history</h2><button class="btn" onclick="editPay()">+ Record payment</button></div>
  ${rows.length?`<table><tr><th>Paid on</th><th>Tenant</th><th>Property</th><th>For month</th><th>Amount</th><th>Method</th><th></th></tr>${rows.map(p=>{const l=lease(p.leaseId);return`<tr><td>${fmt(p.paidOn)}</td><td>${esc(ten(l?.tenantId)?.name)}</td><td>${esc(prop(l?.propertyId)?.name)}</td><td>${p.month}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td><button class="btn alt sm del" onclick="del('payments','${p.id}')">Delete</button></td></tr>`}).join('')}</table>`:'<div class="empty">No payments recorded.</div>'}</div>`;
}};
function outTable(out){
  if(!out.length)return'<div class="empty">🎉 Nothing outstanding.</div>';
  return`<table><tr><th>Tenant</th><th>Property</th><th>Month</th><th>Due date</th><th>Balance</th><th>Status</th><th></th></tr>${out.map(r=>{const l=lease(r.leaseId);return`<tr><td>${esc(ten(l.tenantId)?.name)}</td><td>${esc(prop(l.propertyId)?.name)}</td><td>${r.key}</td><td>${fmt(r.due)}${r.late?` <small style="color:var(--bad)">(${r.late}d late)</small>`:''}</td><td>${money(r.bal)}</td><td>${pill(r.status)}</td><td><button class="btn sm" onclick="quickPay('${r.leaseId}','${r.key}',${r.bal})">Mark paid</button></td></tr>`}).join('')}</table>`;
}
const acts=(n,id)=>`<button class="btn alt sm" onclick="edit${n}('${id}')">Edit</button> <button class="btn alt sm del" onclick="del${n}('${id}')">Delete</button>`;

// ---------- Actions ----------
function editProp(id){const p=db.properties.find(x=>x.id===id);openForm(p?'Edit property':'Add property',[
  {k:'name',l:'Property name'},{k:'address',l:'Address'},
  {k:'type',l:'Type',opts:['Apartment','House','Villa','Shop','Office','Room/PG'].map(x=>[x,x])},
  {k:'rent',l:'Market rent / month (₹)',t:'number',min:0}],p,o=>{p?Object.assign(p,o):db.properties.push({id:uid(),...o})})}
function editTen(id){const t=db.tenants.find(x=>x.id===id);openForm(t?'Edit tenant':'Add tenant',[
  {k:'name',l:'Full name'},{k:'phone',l:'Phone',t:'tel'},{k:'email',l:'Email',t:'email',req:false},{k:'idProof',l:'ID proof (e.g. Aadhaar last 4)',req:false}],t,o=>{t?Object.assign(t,o):db.tenants.push({id:uid(),...o})})}
function editLease(id){
  if(!db.properties.length||!db.tenants.length)return alert('Add at least one property and one tenant first.');
  const l=db.leases.find(x=>x.id===id);openForm(l?'Edit lease':'Add lease',[
  {k:'propertyId',l:'Property',opts:optsFrom(db.properties,p=>p.name)},{k:'tenantId',l:'Tenant',opts:optsFrom(db.tenants,t=>t.name)},
  {k:'start',l:'Start date',t:'date',def:iso(today())},{k:'end',l:'End date',t:'date'},
  {k:'rent',l:'Monthly rent (₹)',t:'number',min:0},{k:'dueDay',l:'Rent due day of month',t:'number',min:1,max:31,def:1},{k:'deposit',l:'Security deposit (₹)',t:'number',min:0,def:0}],l,o=>{
    if(o.end<=o.start){alert('End date must be after start date');return}
    l?Object.assign(l,o):db.leases.push({id:uid(),...o})})}
function editPay(id){
  if(!db.leases.length)return alert('Add a lease first.');
  const m=iso(today()).slice(0,7);
  openForm('Record payment',[
  {k:'leaseId',l:'Lease',opts:optsFrom(db.leases,leaseLabel)},{k:'month',l:'For month',t:'month',def:m},
  {k:'amount',l:'Amount (₹)',t:'number',min:1},{k:'paidOn',l:'Paid on',t:'date',def:iso(today())},
  {k:'method',l:'Method',opts:['UPI','Bank transfer','Cash','Cheque'].map(x=>[x,x])}],null,o=>db.payments.push({id:uid(),...o}))}
function quickPay(leaseId,month,amount){openForm('Mark paid — '+month,[
  {k:'amount',l:'Amount received (₹)',t:'number',min:1,def:amount},{k:'paidOn',l:'Paid on',t:'date',def:iso(today())},
  {k:'method',l:'Method',opts:['UPI','Bank transfer','Cash','Cheque'].map(x=>[x,x])}],null,o=>db.payments.push({id:uid(),leaseId,month,...o}))}
const ask=m=>confirm(m);
function del(coll,id){if(ask('Delete this record?')){db[coll]=db[coll].filter(x=>x.id!==id);save();render()}}
function delProp(id){if(!db.leases.some(l=>l.propertyId===id)){del('properties',id)}else alert('Delete the leases for this property first.')}
function delTen(id){if(!db.leases.some(l=>l.tenantId===id)){del('tenants',id)}else alert('Delete the leases for this tenant first.')}
function delLease(id){if(ask('Delete lease and its payments?')){db.payments=db.payments.filter(p=>p.leaseId!==id);db.leases=db.leases.filter(l=>l.id!==id);save();render()}}

// ---------- Data tools ----------
function sample(){
  if(db.properties.length&&!ask('Replace existing data with sample data?'))return;
  const t=today(),addM=(d,n)=>new Date(d.getFullYear(),d.getMonth()+n,d.getDate());
  const P=[['Sunrise Apt 2B','Madhapur, Hyderabad','Apartment',28000],['Green Villa','Gachibowli, Hyderabad','Villa',55000],['Lotus Shop 4','Ameerpet, Hyderabad','Shop',35000]].map(x=>({id:uid(),name:x[0],address:x[1],type:x[2],rent:x[3]}));
  const T=[['Ravi Kumar','9876500001','ravi@example.com','1234'],['Anita Sharma','9876500002','anita@example.com','5678'],['Suresh Reddy','9876500003','suresh@example.com','9012']].map(x=>({id:uid(),name:x[0],phone:x[1],email:x[2],idProof:x[3]}));
  const L=[
    {id:uid(),propertyId:P[0].id,tenantId:T[0].id,start:iso(addM(t,-10)),end:iso(addM(t,2)),rent:28000,dueDay:5,deposit:84000},
    {id:uid(),propertyId:P[1].id,tenantId:T[1].id,start:iso(addM(t,-4)),end:iso(addM(t,8)),rent:55000,dueDay:1,deposit:165000},
    {id:uid(),propertyId:P[2].id,tenantId:T[2].id,start:iso(addM(t,-11)),end:iso(new Date(t.getFullYear(),t.getMonth(),t.getDate()+20)),rent:35000,dueDay:10,deposit:105000}];
  const pay=[];
  L.forEach((l,i)=>schedule(l).forEach((r,j,a)=>{if(i===0&&j>=a.length-2)return;if(i===2&&j===a.length-1)return;
    pay.push({id:uid(),leaseId:l.id,month:r.key,amount:l.rent,paidOn:iso(r.due),method:'UPI'})}));
  db={properties:P,tenants:T,leases:L,payments:pay};save();render();
}
function exportData(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download='rental-data-'+iso(today())+'.json';a.click()}
$('#file').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(s=>{try{const d=JSON.parse(s);if(!d.properties||!d.leases)throw 0;db=d;save();render()}catch{alert('Invalid backup file')}});e.target.value=''};

// ---------- Render ----------
function render(keepFocus){
  $('#nav').innerHTML=['dashboard','properties','tenants','leases','payments'].map(v=>`<button class="${v===view?'on':''}" onclick="go('${v}')">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')+
   `<button onclick="sample()">Load sample</button><button onclick="exportData()">Export</button><button onclick="$('#file').click()">Import</button>`;
  const pos=keepFocus&&document.activeElement.selectionStart;
  $('#main').innerHTML=views[view]();
  if(keepFocus){const i=$('#main input');if(i){i.focus();i.setSelectionRange(pos,pos)}}
}
function go(v){view=v;q='';render()}
render();
