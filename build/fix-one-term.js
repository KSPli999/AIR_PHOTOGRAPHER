// 单场补抓：宽 bbox + relation 拼接（处理首都 T3 这类超出常规 bbox 的大航站楼）
const fs=require('fs'),path=require('path');
const id=process.argv[2], bbox=process.argv[3];
const CACHE=path.join(process.env.HOME,'.cache/osm-term');
const simplify=(pts,eps=0.000027)=>{if(pts.length<=3)return pts;const sq=eps*eps;
 const d2=(p,a,b)=>{let x=a[0],y=a[1],dx=b[0]-x,dy=b[1]-y;if(dx||dy){const t=((p[0]-x)*dx+(p[1]-y)*dy)/(dx*dx+dy*dy);if(t>1){x=b[0];y=b[1]}else if(t>0){x+=dx*t;y+=dy*t}}dx=p[0]-x;dy=p[1]-y;return dx*dx+dy*dy};
 const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const st=[[0,pts.length-1]];
 while(st.length){const [i0,i1]=st.pop();let md=-1,idx=-1;for(let i=i0+1;i<i1;i++){const d=d2(pts[i],pts[i0],pts[i1]);if(d>md){md=d;idx=i}}if(md>sq&&idx>0){keep[idx]=1;st.push([i0,idx],[idx,i1])}}
 const o=[];for(let i=0;i<pts.length;i++)if(keep[i])o.push(pts[i]);return o};
const stitch=parts=>{const ring=parts.shift().slice();while(parts.length){const last=ring[ring.length-1];let best=-1,rev=false,bd=Infinity;for(let i=0;i<parts.length;i++){const w=parts[i];const d0=Math.hypot(w[0][0]-last[0],w[0][1]-last[1]);const d1=Math.hypot(w[w.length-1][0]-last[0],w[w.length-1][1]-last[1]);if(d0<bd){bd=d0;best=i;rev=false}if(d1<bd){bd=d1;best=i;rev=true}}if(best<0||bd>0.002)break;const w=parts.splice(best,1)[0];ring.push(...(rev?w.slice().reverse():w).slice(1))}return ring};
(async()=>{
 const r=await fetch('https://api.openstreetmap.org/api/0.6/map?bbox='+bbox,{headers:{'user-agent':'skywave-term/1.0'},signal:AbortSignal.timeout(180000)});
 const xml=await r.text();console.log('xml',(xml.length/1048576).toFixed(1)+'MB');
 const nodes=new Map();
 for(const m of xml.matchAll(/<node[^>]*\bid="(\d+)"[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"/g))nodes.set(m[1],[+m[2],+m[3]]);
 const wayPts=new Map();const out=[];
 for(const m of xml.matchAll(/<way\b[^>]*>([\s\S]*?)<\/way>/g)){
  const body=m[1],tags={};for(const t of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g))tags[t[1]]=t[2];
  const pts=[];for(const nd of body.matchAll(/<nd ref="(\d+)"/g)){const p=nodes.get(nd[1]);if(p)pts.push(p)}
  const wid=/<way\b[^>]*\bid="(\d+)"/.exec(m[0]);if(wid)wayPts.set(wid[1],pts);
  if(tags.aeroway==='terminal'||tags.building==='terminal')out.push({r:simplify(pts).map(p=>[+p[0].toFixed(6),+p[1].toFixed(6)]),n:tags.name||''});
 }
 for(const m of xml.matchAll(/<relation\b[^>]*>([\s\S]*?)<\/relation>/g)){
  const body=m[1],tags={};for(const t of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g))tags[t[1]]=t[2];
  if(!/terminal/i.test((tags.aeroway||'')+(tags.building||'')))continue;
  const parts=[];for(const mm of body.matchAll(/<member type="way" ref="(\d+)" role="(outer|)"/g)){const p=wayPts.get(mm[1]);if(p&&p.length>1)parts.push(p.slice())}
  if(!parts.length)continue;const ring=stitch(parts);if(ring.length<4)continue;
  out.push({r:simplify(ring).map(p=>[+p[0].toFixed(6),+p[1].toFixed(6)]),n:tags.name||''});
 }
 // 去重（同名同重心）
 const seen=new Set(),uniq=[];
 for(const w of out){const k=w.n+':'+Math.round(w.r[0][0]*1000)+Math.round(w.r[0][1]*1000);if(seen.has(k))continue;seen.add(k);uniq.push(w)}
 fs.writeFileSync(path.join(CACHE,id+'.json'),JSON.stringify({id,ways:uniq}));
 console.log(id,'terminals',uniq.length,uniq.map(w=>w.n).join(' | '));
})();
