// Valet – Freistellen mit RMBG-1.4 (BRIA, nur nicht-kommerziell) direkt im Browser.
// Rechenkerne (isnEngineFactory, gpuEngineFactory) unverändert aus dem alten Valet übernommen.
(function(){
function isnEngineFactory(G, q8, sc, bias){
  // Gewichte: Uint16Array = 16-Bit-Gleitkomma, Int8Array = 8 Bit mit Skalierung je Ausgabekanal
  const f16=q8 instanceof Uint16Array; let LUT=null;
  if(f16){ LUT=new Float32Array(65536); for(let v=0;v<65536;v++){ const s=(v&0x8000)?-1:1, e=(v>>10)&31, m=v&1023; LUT[v]= e===0 ? s*m*5.960464477539063e-8 : e===31 ? (m?NaN:s*Infinity) : s*(1+m/1024)*Math.pow(2,e-15); } }
  function wslice(n){ const co=n.co, per=n.ci*n.k*n.k, out=new Float32Array(co*per);
    if(f16){ for(let j=0,b=n.wo;j<co*per;j++) out[j]=LUT[q8[b+j]]; return out; }
    for(let o=0;o<co;o++){ const s=sc[n.so+o], b=n.wo+o*per, ob=o*per; for(let j=0;j<per;j++) out[ob+j]=q8[b+j]*s; } return out; }
  function conv(t, n, relu){
    const {c:ci,h:H,w:W,d:x}=t, co=n.co, k=n.k, dil=n.dil, w=wslice(n), st=n.s||1;
    const OH=st===2?Math.floor((H-1)/2)+1:H, OW=st===2?Math.floor((W-1)/2)+1:W, OHW=OH*OW, HW=H*W;
    const out=new Float32Array(co*OHW);
    for(let o=0;o<co;o++){ const b=bias[n.bo+o], ob=o*OHW; for(let i=0;i<OHW;i++) out[ob+i]=b; }
    if(k===1){
      for(let o=0;o<co;o++){ const ob=o*HW; for(let c=0;c<ci;c++){ const wv=w[o*ci+c], ib=c*HW; for(let i=0;i<HW;i++) out[ob+i]+=wv*x[ib+i]; } }
    } else if(st===2){
      for(let o=0;o<co;o++) for(let c=0;c<ci;c++){ const a=(o*ci+c)*9, ib=c*HW, ob=o*OHW;
        for(let oy=0;oy<OH;oy++) for(let ox=0;ox<OW;ox++){ let s=0;
          for(let ky=0;ky<3;ky++){ const iy=oy*2-1+ky; if(iy<0||iy>=H) continue; for(let kx=0;kx<3;kx++){ const ix=ox*2-1+kx; if(ix<0||ix>=W) continue; s+=w[a+ky*3+kx]*x[ib+iy*W+ix]; } }
          out[ob+oy*OW+ox]+=s; } }
    } else {
      const P=dil, PW=W+2*P, PH=H+2*P, pad=new Float32Array(PW*PH);
      const q0=-P*PW-P,q1=-P*PW,q2=-P*PW+P,q3=-P,q5=P,q6=P*PW-P,q7=P*PW,q8_=P*PW+P;
      for(let c=0;c<ci;c++){
        const ib=c*HW; for(let y=0;y<H;y++){ const s=ib+y*W, dpos=(y+P)*PW+P; for(let xx=0;xx<W;xx++) pad[dpos+xx]=x[s+xx]; }
        let o=0;
        for(;o+3<co;o+=4){
          const a=(o*ci+c)*9, b=a+ci*9, cc=b+ci*9, e=cc+ci*9;
          const a0=w[a],a1=w[a+1],a2=w[a+2],a3=w[a+3],a4=w[a+4],a5=w[a+5],a6=w[a+6],a7=w[a+7],a8=w[a+8];
          const b0=w[b],b1=w[b+1],b2=w[b+2],b3=w[b+3],b4=w[b+4],b5=w[b+5],b6=w[b+6],b7=w[b+7],b8=w[b+8];
          const c0=w[cc],c1=w[cc+1],c2=w[cc+2],c3=w[cc+3],c4=w[cc+4],c5=w[cc+5],c6=w[cc+6],c7=w[cc+7],c8=w[cc+8];
          const e0=w[e],e1=w[e+1],e2=w[e+2],e3=w[e+3],e4=w[e+4],e5=w[e+5],e6=w[e+6],e7=w[e+7],e8=w[e+8];
          const O0=o*HW, O1=O0+HW, O2=O1+HW, O3=O2+HW;
          for(let y=0;y<H;y++){ const r=(y+P)*PW+P, orow=y*W;
            for(let xx=0;xx<W;xx++){ const p=r+xx;
              const v0=pad[p+q0],v1=pad[p+q1],v2=pad[p+q2],v3=pad[p+q3],v4=pad[p],v5=pad[p+q5],v6=pad[p+q6],v7=pad[p+q7],v8=pad[p+q8_], j=orow+xx;
              out[O0+j]+=a0*v0+a1*v1+a2*v2+a3*v3+a4*v4+a5*v5+a6*v6+a7*v7+a8*v8;
              out[O1+j]+=b0*v0+b1*v1+b2*v2+b3*v3+b4*v4+b5*v5+b6*v6+b7*v7+b8*v8;
              out[O2+j]+=c0*v0+c1*v1+c2*v2+c3*v3+c4*v4+c5*v5+c6*v6+c7*v7+c8*v8;
              out[O3+j]+=e0*v0+e1*v1+e2*v2+e3*v3+e4*v4+e5*v5+e6*v6+e7*v7+e8*v8; } }
        }
        for(;o<co;o++){
          const a=(o*ci+c)*9, a0=w[a],a1=w[a+1],a2=w[a+2],a3=w[a+3],a4=w[a+4],a5=w[a+5],a6=w[a+6],a7=w[a+7],a8=w[a+8], O0=o*HW;
          for(let y=0;y<H;y++){ const r=(y+P)*PW+P, orow=y*W;
            for(let xx=0;xx<W;xx++){ const p=r+xx;
              out[O0+orow+xx]+=a0*pad[p+q0]+a1*pad[p+q1]+a2*pad[p+q2]+a3*pad[p+q3]+a4*pad[p]+a5*pad[p+q5]+a6*pad[p+q6]+a7*pad[p+q7]+a8*pad[p+q8_]; } }
        }
      }
    }
    if(relu) for(let i=0;i<out.length;i++) if(out[i]<0) out[i]=0;
    return {c:co,h:OH,w:OW,d:out};
  }
  function pool(t){ const {c,h,w,d}=t, oh=Math.ceil(h/2), ow=Math.ceil(w/2), out=new Float32Array(c*oh*ow);
    for(let ch=0;ch<c;ch++){ const ib=ch*h*w, ob=ch*oh*ow;
      for(let y=0;y<oh;y++) for(let x=0;x<ow;x++){ let m=-Infinity; for(let yy=2*y;yy<Math.min(h,2*y+2);yy++) for(let xx=2*x;xx<Math.min(w,2*x+2);xx++){ const v=d[ib+yy*w+xx]; if(v>m) m=v; } out[ob+y*ow+x]=m; } }
    return {c,h:oh,w:ow,d:out}; }
  function resize(t, H, W){ const {c,h,w,d}=t; if(h===H && w===W) return t; const out=new Float32Array(c*H*W);
    const sy=h/H, sx=w/W, ys=new Int32Array(H*2), yf=new Float32Array(H), xs=new Int32Array(W*2), xf=new Float32Array(W);
    for(let y=0;y<H;y++){ let s=(y+0.5)*sy-0.5; if(s<0) s=0; const y0=Math.min(h-1,Math.floor(s)); ys[2*y]=y0; ys[2*y+1]=Math.min(h-1,y0+1); yf[y]=s-y0; }
    for(let x=0;x<W;x++){ let s=(x+0.5)*sx-0.5; if(s<0) s=0; const x0=Math.min(w-1,Math.floor(s)); xs[2*x]=x0; xs[2*x+1]=Math.min(w-1,x0+1); xf[x]=s-x0; }
    for(let ch=0;ch<c;ch++){ const ib=ch*h*w, ob=ch*H*W;
      for(let y=0;y<H;y++){ const r0=ib+ys[2*y]*w, r1=ib+ys[2*y+1]*w, fy=yf[y];
        for(let x=0;x<W;x++){ const a=xs[2*x], b=xs[2*x+1], fx=xf[x];
          const top=d[r0+a]+(d[r0+b]-d[r0+a])*fx, bot=d[r1+a]+(d[r1+b]-d[r1+a])*fx; out[ob+y*W+x]=top+(bot-top)*fy; } } }
    return {c,h:H,w:W,d:out}; }
  function cat(ts){ const h=ts[0].h, w=ts[0].w, c=ts.reduce((s,t)=>s+t.c,0), out=new Float32Array(c*h*w); let off=0;
    for(const t of ts){ out.set(t.d, off); off+=t.d.length; } return {c,h,w,d:out}; }
  function run(input, S, onProgress){
    const env={'input.1':{c:3,h:S,w:S,d:input}};
    const uses={}; for(const n of G){ for(const k of ['x','a','b','ref']) if(n[k]) uses[n[k]]=(uses[n[k]]||0)+1; if(n.xs) for(const x of n.xs) uses[x]=(uses[x]||0)+1; }
    const relIn=new Set(); for(const n of G) if(n.op==='relu') relIn.add(n.x);
    const release=k=>{ if(--uses[k]<=0 && k!=='input.1') delete env[k]; };
    let i=0, done=0; const conv9=G.filter(n=>n.op==='conv').length;
    for(const n of G){ i++;
      if(n.op==='conv'){ const fuse=relIn.has(n.y) && uses[n.y]===1; env[n.y]=conv(env[n.x], n, fuse); if(fuse) env[n.y].fused=true; release(n.x); done++; if(onProgress && done%6===0) onProgress(done/conv9); }
      else if(n.op==='relu'){ const t=env[n.x]; if(t.fused){ env[n.y]=t; } else { const d=new Float32Array(t.d); for(let j=0;j<d.length;j++) if(d[j]<0) d[j]=0; env[n.y]={c:t.c,h:t.h,w:t.w,d}; } release(n.x); }
      else if(n.op==='pool'){ env[n.y]=pool(env[n.x]); release(n.x); }
      else if(n.op==='resize'){ const r=env[n.ref]; env[n.y]=resize(env[n.x], r.h, r.w); release(n.x); release(n.ref); }
      else if(n.op==='cat'){ env[n.y]=cat(n.xs.map(x=>env[x])); for(const x of n.xs) release(x); }
      else if(n.op==='add'){ const a=env[n.a], b=env[n.b], d=new Float32Array(a.d.length); for(let j=0;j<d.length;j++) d[j]=a.d[j]+b.d[j]; env[n.y]={c:a.c,h:a.h,w:a.w,d}; release(n.a); release(n.b); }
      else if(n.op==='sig'){ const a=env[n.x], d=new Float32Array(a.d.length); for(let j=0;j<d.length;j++) d[j]=1/(1+Math.exp(-a.d[j])); env[n.y]={c:a.c,h:a.h,w:a.w,d}; release(n.x); }
    }
    return env[G[G.length-1].y].d;
  }
  return {run};
}
// WebGPU-Variante des Modells: gleiche Graph-/Gewichtsformate wie isnEngineFactory (int8 je Ausgabekanal)
async function gpuEngineFactory(G, q8, sc, bias){
  if(!navigator.gpu) throw new Error('kein WebGPU');
  const ad=await navigator.gpu.requestAdapter({powerPreference:'high-performance'}); if(!ad) throw new Error('kein Adapter');
  const need=Math.max(q8.byteLength+16, 64*1024*1024);
  const dev=await ad.requestDevice({requiredLimits:{maxStorageBufferBindingSize:Math.min(ad.limits.maxStorageBufferBindingSize, Math.max(need, 256*1024*1024)), maxBufferSize:Math.min(ad.limits.maxBufferSize, Math.max(need, 256*1024*1024))}});
  const mk=(data,usage)=>{ const size=Math.ceil(data.byteLength/4)*4; const b=dev.createBuffer({size, usage, mappedAtCreation:true}); new Uint8Array(b.getMappedRange()).set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)); b.unmap(); return b; };
  const ST=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST;
  const F16=q8 instanceof Uint16Array?1:0; if(F16) sc=new Float32Array(Math.max(1,bias.length)).fill(1);
  const wB=mk(new Uint8Array(q8.buffer,q8.byteOffset,q8.byteLength), GPUBufferUsage.STORAGE), sB=mk(sc,GPUBufferUsage.STORAGE), bB=mk(bias,GPUBufferUsage.STORAGE);
  const convSrc=`
struct P { ci:u32, co:u32, H:u32, W:u32, OH:u32, OW:u32, k:u32, dil:u32, st:u32, wo:u32, so:u32, bo:u32, relu:u32, pad:u32, p1:u32, p2:u32 };
@group(0) @binding(0) var<storage,read> X:array<f32>;
@group(0) @binding(1) var<storage,read_write> Y:array<f32>;
@group(0) @binding(2) var<storage,read> Wq:array<u32>;
@group(0) @binding(3) var<storage,read> Sc:array<f32>;
@group(0) @binding(4) var<storage,read> Bi:array<f32>;
@group(0) @binding(5) var<uniform> p:P;
fn wv(i:u32)->f32 { if(p.p1==1u){ let h=unpack2x16float(Wq[i>>1u]); return select(h.x,h.y,(i&1u)==1u); } let w=Wq[i>>2u]; let b=(w>>((i&3u)*8u))&255u; return f32(i32(b<<24u)>>24u); }
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let OHW=p.OH*p.OW; let pix=gid.x; if(pix>=OHW) { return; }
  let o0=gid.y*4u; if(o0>=p.co) { return; }
  let oy=pix/p.OW; let ox=pix%p.OW; let HW=p.H*p.W; let kk=p.k*p.k; let r=p.pad;
  var acc=vec4<f32>(0.0);
  let n=min(4u,p.co-o0);
  for(var c=0u;c<p.ci;c++){
    let ib=c*HW;
    for(var ky=0u;ky<p.k;ky++){
      let iy=i32(oy*p.st)+i32(ky*p.dil)-i32(r); if(iy<0||iy>=i32(p.H)) { continue; }
      for(var kx=0u;kx<p.k;kx++){
        let ix=i32(ox*p.st)+i32(kx*p.dil)-i32(r); if(ix<0||ix>=i32(p.W)) { continue; }
        let v=X[ib+u32(iy)*p.W+u32(ix)];
        let wi=p.wo+(o0*p.ci+c)*kk+ky*p.k+kx; let s=p.ci*kk;
        acc.x+=v*wv(wi);
        if(n>1u){ acc.y+=v*wv(wi+s); }
        if(n>2u){ acc.z+=v*wv(wi+2u*s); }
        if(n>3u){ acc.w+=v*wv(wi+3u*s); }
      }
    }
  }
  for(var j=0u;j<n;j++){ let o=o0+j; var v=acc[j]*Sc[p.so+o]+Bi[p.bo+o]; if(p.relu==1u && v<0.0){ v=0.0; } Y[o*OHW+pix]=v; }
}`;
  const miscSrc=`
struct Q { c:u32, h:u32, w:u32, H:u32, W:u32, mode:u32, n:u32, z:u32 };
@group(0) @binding(0) var<storage,read> A:array<f32>;
@group(0) @binding(1) var<storage,read> B:array<f32>;
@group(0) @binding(2) var<storage,read_write> Y:array<f32>;
@group(0) @binding(3) var<uniform> q:Q;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let i=gid.x+gid.y*65535u*256u; if(i>=q.n) { return; }
  if(q.mode==0u){ Y[i]=A[i]+B[i]; return; }
  if(q.mode==1u){ Y[i]=max(A[i],0.0); return; }
  let HW=q.H*q.W; let ch=i/HW; let r=i%HW; let y=r/q.W; let x=r%q.W; let ib=ch*q.h*q.w;
  if(q.mode==2u){ // maxpool 2x2 ceil
    var m=-3.4e38; for(var yy=2u*y; yy<min(q.h,2u*y+2u); yy++){ for(var xx=2u*x; xx<min(q.w,2u*x+2u); xx++){ m=max(m,A[ib+yy*q.w+xx]); } } Y[i]=m; return; }
  // bilinear, half-pixel, links/oben geklemmt
  var sy=(f32(y)+0.5)*f32(q.h)/f32(q.H)-0.5; if(sy<0.0){ sy=0.0; }
  var sx=(f32(x)+0.5)*f32(q.w)/f32(q.W)-0.5; if(sx<0.0){ sx=0.0; }
  let y0=min(q.h-1u,u32(floor(sy))); let y1=min(q.h-1u,y0+1u); let fy=sy-f32(y0);
  let x0=min(q.w-1u,u32(floor(sx))); let x1=min(q.w-1u,x0+1u); let fx=sx-f32(x0);
  let t=A[ib+y0*q.w+x0]+(A[ib+y0*q.w+x1]-A[ib+y0*q.w+x0])*fx; let b=A[ib+y1*q.w+x0]+(A[ib+y1*q.w+x1]-A[ib+y1*q.w+x0])*fx;
  Y[i]=t+(b-t)*fy;
}`;
  const pConv=dev.createComputePipeline({layout:'auto', compute:{module:dev.createShaderModule({code:convSrc}), entryPoint:'main'}});
  const pMisc=dev.createComputePipeline({layout:'auto', compute:{module:dev.createShaderModule({code:miscSrc}), entryPoint:'main'}});
  const dummy=dev.createBuffer({size:16, usage:GPUBufferUsage.STORAGE});
  const pool=new Map(); const getBuf=n=>{ const sz=Math.max(16,n*4); const l=pool.get(sz); if(l&&l.length) return l.pop(); return dev.createBuffer({size:sz, usage:ST}); };
  const putBuf=b=>{ const l=pool.get(b.size)||[]; l.push(b); pool.set(b.size,l); };
  const uni=arr=>mk(new Uint32Array(arr), GPUBufferUsage.UNIFORM);
  async function run(input, S, onProgress, keep){
    const env={}; const shape={};
    const uses={}; for(const n of G){ for(const k of ['x','a','b','ref']) if(n[k]) uses[n[k]]=(uses[n[k]]||0)+1; if(n.xs) for(const x of n.xs) uses[x]=(uses[x]||0)+1; }
    const relIn=new Set(); for(const n of G) if(n.op==='relu') relIn.add(n.x);
    const inB=getBuf(3*S*S); dev.queue.writeBuffer(inB,0,input); env['input.1']=inB; shape['input.1']=[3,S,S];
    const release=k=>{ if(--uses[k]<=0 && env[k] && k!=='input.1'){ if(!env[k]._alias) putBuf(env[k]); delete env[k]; } };
    let enc=dev.createCommandEncoder(), cnt=0, done=0; const total=G.filter(n=>n.op==='conv').length; const temps=[];
    const flush=async()=>{ dev.queue.submit([enc.finish()]); await dev.queue.onSubmittedWorkDone(); for(const t of temps.splice(0)) t.destroy(); enc=dev.createCommandEncoder(); if(onProgress) onProgress(done/total); };
    const disp=(pipe, entries, gx, gy)=>{ const bg=dev.createBindGroup({layout:pipe.getBindGroupLayout(0), entries:entries.map((b,i)=>({binding:i, resource:{buffer:b}}))});
      const ps=enc.beginComputePass(); ps.setPipeline(pipe); ps.setBindGroup(0,bg); ps.dispatchWorkgroups(gx,gy); ps.end(); };
    const misc=(mode,a,b,y,dims,n)=>{ const u=uni([dims[0],dims[1],dims[2],dims[3],dims[4],mode,n,0]); temps.push(u); const g=Math.ceil(n/256); disp(pMisc,[a,b||dummy,y,u], Math.min(g,65535), Math.ceil(g/65535)); };
    for(const n of G){
      if(n.op==='conv'){ const [ci,H,W]=shape[n.x], st=n.s||1, OH=st===2?Math.floor((H-1)/2)+1:H, OW=st===2?Math.floor((W-1)/2)+1:W;
        const fuse=relIn.has(n.y) && uses[n.y]===1; const y=getBuf(n.co*OH*OW);
        const u=uni([ci,n.co,H,W,OH,OW,n.k,n.dil||1,st,n.wo,n.so||0,n.bo,fuse?1:0,n.k===3?(n.dil||1):0,F16,0]); temps.push(u);
        disp(pConv,[env[n.x],y,wB,sB,bB,u], Math.ceil(OH*OW/64), Math.ceil(n.co/4));
        env[n.y]=y; shape[n.y]=[n.co,OH,OW]; if(fuse) env[n.y]._fused=true; release(n.x); done++; cnt++;
        if(cnt>=8){ cnt=0; await flush(); } }
      else if(n.op==='relu'){ const t=env[n.x]; if(t._fused){ env[n.y]=t; shape[n.y]=shape[n.x]; delete env[n.x]; } else { const [c,h,w]=shape[n.x]; const y=getBuf(c*h*w); misc(1,t,null,y,[c,h,w,h,w],c*h*w); env[n.y]=y; shape[n.y]=[c,h,w]; release(n.x); } }
      else if(n.op==='pool'){ const [c,h,w]=shape[n.x], H=Math.ceil(h/2), W=Math.ceil(w/2); const y=getBuf(c*H*W); misc(2,env[n.x],null,y,[c,h,w,H,W],c*H*W); env[n.y]=y; shape[n.y]=[c,H,W]; release(n.x); }
      else if(n.op==='resize'){ const [c,h,w]=shape[n.x], [,H,W]=shape[n.ref]; if(h===H&&w===W){ const y=getBuf(c*h*w); enc.copyBufferToBuffer(env[n.x],0,y,0,c*h*w*4); env[n.y]=y; shape[n.y]=[c,h,w]; release(n.x); } else { const y=getBuf(c*H*W); misc(3,env[n.x],null,y,[c,h,w,H,W],c*H*W); env[n.y]=y; shape[n.y]=[c,H,W]; release(n.x); } release(n.ref); }
      else if(n.op==='cat'){ const [,h,w]=shape[n.xs[0]]; const c=n.xs.reduce((s,x)=>s+shape[x][0],0); const y=getBuf(c*h*w); let off=0;
        for(const x of n.xs){ const sz=shape[x][0]*h*w*4; enc.copyBufferToBuffer(env[x],0,y,off,sz); off+=sz; }
        env[n.y]=y; shape[n.y]=[c,h,w]; for(const x of n.xs) release(x); }
      else if(n.op==='add'){ const [c,h,w]=shape[n.a]; const y=getBuf(c*h*w); misc(0,env[n.a],env[n.b],y,[c,h,w,h,w],c*h*w); env[n.y]=y; shape[n.y]=[c,h,w]; release(n.a); release(n.b); }
      else if(n.op==='sig'){ env[n.y]=env[n.x]; shape[n.y]=shape[n.x]; env[n.y]._sig=true; delete env[n.x]; }
    }
    const last=G[G.length-1].y, ob=env[last], [c,h,w]=shape[last], nb=c*h*w*4;
    const rb=dev.createBuffer({size:nb, usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}); enc.copyBufferToBuffer(ob,0,rb,0,nb);
    await flush(); await rb.mapAsync(GPUMapMode.READ); const out=new Float32Array(rb.getMappedRange().slice(0)); rb.unmap(); rb.destroy();
    for(let i=0;i<out.length;i++) out[i]=1/(1+Math.exp(-out[i]));
    if(keep){ for(const k in env) if(env[k] && env[k].destroy && !env[k]._alias) putBuf(env[k]); } else { for(const [,l] of pool) for(const b of l) b.destroy(); pool.clear(); for(const k in env) if(env[k] && env[k].destroy) try{ env[k].destroy(); }catch(e){} }
    return out;
  }
  function release(){ for(const [,l] of pool) for(const b of l) b.destroy(); pool.clear(); }
  return {run, dev, release};
}
// ---------- ab hier: neu für Valet ----------
const V = 'rmbg14-q8-2';
const BASE = new URL('.', (document.currentScript && document.currentScript.src) || location.href).href;

// Modell dauerhaft im Browser speichern (IndexedDB)
function db() { return new Promise(res => { try { const r = indexedDB.open('valet-ki', 1); r.onupgradeneeded = () => r.result.createObjectStore('m'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }); }
async function dbGet() { const d = await db(); if (!d) return null; return new Promise(res => { try { const q = d.transaction('m').objectStore('m').get('rmbg14'); q.onsuccess = () => { const v = q.result; res(v && v.v === V ? v : null); }; q.onerror = () => res(null); } catch (e) { res(null); } }); }
async function dbPut(v) { const d = await db(); if (!d) return false; return new Promise(res => { try { const t = d.transaction('m', 'readwrite'); t.objectStore('m').put(v, 'rmbg14'); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); }
async function isCached() { const d = await db(); if (!d) return false; return new Promise(res => { try { const q = d.transaction('m').objectStore('m').get('rmbg14'); q.onsuccess = () => res(!!(q.result && q.result.v === V)); q.onerror = () => res(false); } catch (e) { res(false); } }); }
async function forget() { const d = await db(); if (!d) return; await new Promise(res => { const t = d.transaction('m', 'readwrite'); t.objectStore('m').delete('rmbg14'); t.oncomplete = res; t.onerror = res; }); }

const M = { meta: null, buf: null, gpu: null, gpuErr: null, worker: null, local: null, busy: Promise.resolve(), loading: null };

async function download(onP) {
  const meta = await (await fetch(BASE + 'rmbg14.json')).json();
  const total = meta.bOff + 4 * meta.nb, out = new Uint8Array(total);
  const r = await fetch(BASE + 'rmbg14.bin'); if (!r.ok) throw new Error('Modell nicht gefunden (' + r.status + ')');
  const rd = r.body.getReader(); let off = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; out.set(value, off); off += value.length; onP && onP(off / total); }
  if (off !== total) throw new Error('Download unvollständig');
  return { meta, buf: out.buffer };
}

// lädt Modell (aus Speicher oder Netz) und startet den Grafikchip; Rückgabe: Infos für die Anzeige
function load(onP, useGpu = true) {
  if (!M.loading) M.loading = (async () => {
    const t0 = performance.now(); let st = await dbGet(), fromCache = !!st;
    if (!st) { st = await download(onP); st.v = V; await dbPut(st); try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} }
    M.meta = st.meta; M.buf = st.buf;
    const tl = performance.now();
    if (useGpu) { try { const [q8, sc, b] = arrays(); M.gpu = await gpuEngineFactory(M.meta.g, q8, sc, b); } catch (e) { M.gpu = null; M.gpuErr = String(e && e.message || e); } }
    return { fromCache, loadMs: tl - t0, gpuMs: performance.now() - tl };
  })().catch(e => { M.loading = null; throw e; });
  return M.loading;
}
function arrays() { const m = M.meta; return [new Int8Array(M.buf, 0, m.n), new Float32Array(M.buf, m.scOff, m.nsc), new Float32Array(M.buf, m.bOff, m.nb)]; }

async function cpuEngine() {
  if (M.worker || M.local) return;
  const [q8, sc, b] = arrays();
  try {
    const src = `const isnEngineFactory=${isnEngineFactory.toString()};let E=null;
self.onmessage=e=>{ const m=e.data; try{
  if(m.init){ E=isnEngineFactory(m.g,new Int8Array(m.q8),new Float32Array(m.sc),new Float32Array(m.b)); self.postMessage({ready:1}); return; }
  const y=E.run(new Float32Array(m.x), m.S, p=>self.postMessage({p}));
  self.postMessage({y:y.buffer},[y.buffer]);
}catch(err){ self.postMessage({err:String(err&&err.message||err)}); } };`;
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const qc = q8.slice(0);
    await new Promise((res, rej) => { w.onmessage = e => { if (e.data.ready) res(); else if (e.data.err) rej(new Error(e.data.err)); }; w.onerror = rej;
      w.postMessage({ init: 1, g: M.meta.g, q8: qc.buffer, sc: sc.slice(0).buffer, b: b.slice(0).buffer }, [qc.buffer]); });
    M.worker = w;
  } catch (e) { M.local = isnEngineFactory(M.meta.g, q8, sc, b); }
}

function engineName() { return M.gpu ? 'Grafikchip (WebGPU)' : 'Prozessor'; }
function modelSize() { return M.gpu ? 1024 : 512; }

async function runCpu(x, S, onP) {
  await cpuEngine();
  return new Promise((res, rej) => {
    if (M.worker) { const w = M.worker; w.onmessage = e => { const m = e.data; if (m.p !== undefined) onP && onP(m.p); else if (m.y) res(new Float32Array(m.y)); else rej(new Error(m.err || 'Fehler')); };
      w.onerror = rej; w.postMessage({ x: x.buffer, S }, [x.buffer]); }
    else { try { res(M.local.run(x, S, onP)); } catch (e) { rej(e); } }
  });
}
// eine Berechnung nach der anderen; fällt der Grafikchip aus, rechnet der Prozessor weiter (Bild dann neu vorbereiten)
function infer(x, S, onP, keep) {
  const job = M.busy.then(async () => {
    if (M.gpu) { try { return await M.gpu.run(x, S, onP, keep); } catch (e) { M.gpu = null; M.gpuErr = String(e && e.message || e); const err = new Error('GPU'); err.gpuLost = true; throw err; } }
    return runCpu(x, S, onP);
  });
  M.busy = job.catch(() => {}); return job;
}

// 1D-Gewichte zum Skalieren: verkleinern = Flächenmittel (jedes Quellpixel zählt), sonst bilinear (half-pixel wie im Original)
function weights1D(n, m, area) {
  const idx = [], wt = [];
  for (let i = 0; i < m; i++) {
    if (area && n > m) {
      const a = i * n / m, b = (i + 1) * n / m, I = [], Wt = [];
      for (let j = Math.floor(a); j < Math.ceil(b); j++) { const w = Math.min(b, j + 1) - Math.max(a, j); if (w > 1e-6) { I.push(Math.min(n - 1, j)); Wt.push(w / (b - a)); } }
      idx.push(I); wt.push(Wt);
    } else {
      let s = (i + 0.5) * n / m - 0.5; if (s < 0) s = 0; const j0 = Math.min(n - 1, Math.floor(s)), j1 = Math.min(n - 1, j0 + 1), f = s - j0;
      idx.push([j0, j1]); wt.push([1 - f, f]);
    }
  }
  return { idx, wt };
}
// Bildausschnitt (RGBA) → Modelleingabe 3×S×S, /255 − 0,5
function prep(d, W, x0, y0, w, h, S, area) {
  const wx = weights1D(w, S, area), wy = weights1D(h, S, area), tmp = new Float32Array(3 * h * S), out = new Float32Array(3 * S * S);
  for (let y = 0; y < h; y++) { const row = ((y0 + y) * W + x0) * 4;
    for (let x = 0; x < S; x++) { const I = wx.idx[x], Wt = wx.wt[x]; let r = 0, g = 0, b = 0;
      for (let k = 0; k < I.length; k++) { const p = row + I[k] * 4, f = Wt[k]; r += d[p] * f; g += d[p + 1] * f; b += d[p + 2] * f; }
      const o = y * S + x; tmp[o] = r; tmp[h * S + o] = g; tmp[2 * h * S + o] = b; } }
  for (let c = 0; c < 3; c++) for (let y = 0; y < S; y++) { const I = wy.idx[y], Wt = wy.wt[y];
    for (let x = 0; x < S; x++) { let s = 0; for (let k = 0; k < I.length; k++) s += tmp[c * h * S + I[k] * S + x] * Wt[k]; out[c * S * S + y * S + x] = s / 255 - 0.5; } }
  return out;
}
async function mask(d, W, x0, y0, w, h, area, onP, keep) {
  const S = modelSize(), x = prep(d, W, x0, y0, w, h, S, area);
  const y = await infer(x, S, onP, keep);
  let mn = 1e9, mx = -1e9; for (const v of y) { if (v < mn) mn = v; if (v > mx) mx = v; }
  if (mx - mn < 0.2) return null;
  for (let i = 0; i < y.length; i++) y[i] = (y[i] - mn) / (mx - mn);
  return { S, p: y };
}
// Maske bilinear auf w×h in das Alpha-Feld A (Breite W) an Position x0,y0; Rückgabe: Anteil > 0,5
function upMask(m, A, W, x0, y0, w, h) {
  const S = m.S, p = m.p; let cov = 0;
  for (let y = 0; y < h; y++) { let fy = (y + 0.5) * S / h - 0.5; if (fy < 0) fy = 0; const ya = Math.min(S - 1, Math.floor(fy)), yb = Math.min(S - 1, ya + 1), ty = fy - ya;
    for (let x = 0; x < w; x++) { let fx = (x + 0.5) * S / w - 0.5; if (fx < 0) fx = 0; const xa = Math.min(S - 1, Math.floor(fx)), xb = Math.min(S - 1, xa + 1), tx = fx - xa;
      const t = p[ya * S + xa] + (p[ya * S + xb] - p[ya * S + xa]) * tx, u = p[yb * S + xa] + (p[yb * S + xb] - p[yb * S + xa]) * tx, a = t + (u - t) * ty;
      A[(y0 + y) * W + x0 + x] = a; if (a > 0.5) cov++; } }
  return cov / (w * h);
}
function bbox(A, W, H, th) { let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A[y * W + x] > th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 }; }

// Kastenfilter (Fenster k, Rand: nur vorhandene Pixel zählen)
function box(src, W, H, k) {
  const r = k >> 1, tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { const o = y * W; let s = 0;
    for (let x = 0; x <= Math.min(r, W - 1); x++) s += src[o + x];
    for (let x = 0; x < W; x++) { const lo = Math.max(0, x - r), hi = Math.min(W - 1, x + r); tmp[o + x] = s / (hi - lo + 1);
      if (x + r + 1 < W) s += src[o + x + r + 1]; if (x - r >= 0) s -= src[o + x - r]; } }
  for (let x = 0; x < W; x++) { let s = 0;
    for (let y = 0; y <= Math.min(r, H - 1); y++) s += tmp[y * W + x];
    for (let y = 0; y < H; y++) { const lo = Math.max(0, y - r), hi = Math.min(H - 1, y + r); out[y * W + x] = s / (hi - lo + 1);
      if (y + r + 1 < H) s += tmp[(y + r + 1) * W + x]; if (y - r >= 0) s -= tmp[(y - r) * W + x]; } }
  return out;
}

// Nachbearbeitung („Verbessert“): A wird verändert, Rückgabe: Farben ohne Saum (RGB 0..1, nur im Ausschnitt R)
function refine(d, A, W, H, up, info, edges = true) {
  const N = W * H;
  // 1) einfarbiger Shop-Hintergrund: vom Rand aus zusammenhängende Fläche in Hintergrundfarbe sicher entfernen
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)], bp = [];
  const addB = i => { bp.push(i); for (let c = 0; c < 3; c++) hist[c][d[i * 4 + c]]++; };
  for (let x = 0; x < W; x++) { addB(x); addB((H - 1) * W + x); } for (let y = 1; y < H - 1; y++) { addB(y * W); addB(y * W + W - 1); }
  const med = hist.map(h => { let s = 0; for (let v = 0; v < 256; v++) { s += h[v]; if (s * 2 >= bp.length) return v; } return 255; });
  const dh = new Uint32Array(256); for (const i of bp) { let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(d[i * 4 + c] - med[c])); dh[m]++; }
  let p95 = 0; { let s = 0; for (let v = 0; v < 256; v++) { s += dh[v]; if (s >= bp.length * 0.95) { p95 = v; break; } } }
  info.einfarbig = p95 <= 6;
  if (info.einfarbig) {
    const diff = new Float32Array(N); for (let i = 0; i < N; i++) { let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(d[i * 4 + c] - med[c])); diff[i] = m; }
    const dd = box(diff, W, H, 3), seen = new Uint8Array(N), st = new Int32Array(N); let sp = 0;
    for (const i of bp) if (dd[i] <= 8 && !seen[i]) { seen[i] = 1; st[sp++] = i; }
    let removed = 0;
    while (sp) { const i = st[--sp]; if (A[i] < 0.95) { if (A[i] > 0.02) removed++; A[i] = 0; } const x = i % W, y = (i / W) | 0;
      if (x > 0 && !seen[i - 1] && dd[i - 1] <= 8) { seen[i - 1] = 1; st[sp++] = i - 1; } if (x < W - 1 && !seen[i + 1] && dd[i + 1] <= 8) { seen[i + 1] = 1; st[sp++] = i + 1; }
      if (y > 0 && !seen[i - W] && dd[i - W] <= 8) { seen[i - W] = 1; st[sp++] = i - W; } if (y < H - 1 && !seen[i + W] && dd[i + W] <= 8) { seen[i + W] = 1; st[sp++] = i + W; } }
    info.hgPixel = removed;
  }
  // 2) Krümel: abgetrennte kleine Inseln weit weg vom Teil entfernen
  const lab = new Int32Array(N), area = [0], bb = [null], st = new Int32Array(N); let n = 0;
  for (let s = 0; s < N; s++) if (A[s] > 0.5 && !lab[s]) { n++; let sp = 0, ar = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; lab[s] = n; st[sp++] = s;
    while (sp) { const i = st[--sp]; ar++; const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (!lab[j] && A[j] > 0.5) { lab[j] = n; st[sp++] = j; } } }
    area.push(ar); bb.push({ x0, y0, x1, y1 }); }
  info.inseln = Math.max(0, n - 1); info.inselnWeg = 0;
  if (n > 1) {
    let big = 1; for (let i = 2; i <= n; i++) if (area[i] > area[big]) big = i;
    const II = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x++) { s += lab[y * W + x] === big ? 1 : 0; II[(y + 1) * (W + 1) + x + 1] = II[y * (W + 1) + x + 1] + s; } }
    const lim = Math.round(0.03 * Math.hypot(W, H)), keep = new Uint8Array(n + 1); keep[big] = 1;
    for (let i = 1; i <= n; i++) { if (i === big) continue; const b = bb[i];
      const X0 = Math.max(0, b.x0 - lim), Y0 = Math.max(0, b.y0 - lim), X1 = Math.min(W, b.x1 + 1 + lim), Y1 = Math.min(H, b.y1 + 1 + lim);
      const near = II[Y1 * (W + 1) + X1] - II[Y0 * (W + 1) + X1] - II[Y1 * (W + 1) + X0] + II[Y0 * (W + 1) + X0] > 0;
      if (area[i] >= 0.25 * area[big] || (area[i] >= 0.002 * area[big] && near)) keep[i] = 1; else info.inselnWeg++; }
    const km = new Float32Array(N); for (let i = 0; i < N; i++) km[i] = keep[lab[i]] ? 1 : 0;
    const kd = box(km, W, H, 5); for (let i = 0; i < N; i++) if (kd[i] <= 0) A[i] = 0;
  }
  info.kanten = edges; if (!edges) return null;
  // ab hier nur im Bereich ums Teil rechnen (spart Speicher und Zeit)
  const b = bbox(A, W, H, 0.02); if (!b) return null;
  const r1 = Math.max(15, Math.round(90 * Math.max(W, H) / 1024)), mg = r1;
  const R = { x0: Math.max(0, b.x0 - mg), y0: Math.max(0, b.y0 - mg), x1: Math.min(W, b.x1 + mg), y1: Math.min(H, b.y1 + mg) };
  const w = R.x1 - R.x0, h = R.y1 - R.y0, n2 = w * h, a = new Float32Array(n2), f = [new Float32Array(n2), new Float32Array(n2), new Float32Array(n2)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (R.y0 + y) * W + R.x0 + x, j = y * w + x; a[j] = A[i]; for (let c = 0; c < 3; c++) f[c][j] = d[i * 4 + c] / 255; }
  // 3) Kante an echten Bildkanten ausrichten (Guided Filter), nur wenn die Maske hochgerechnet wurde
  info.kantenfilter = up > 1.15;
  if (info.kantenfilter) {
    const g = new Float32Array(n2); for (let i = 0; i < n2; i++) g[i] = 0.299 * f[0][i] + 0.587 * f[1][i] + 0.114 * f[2][i];
    const k = Math.max(3, Math.round(up * 2) | 1), eps = 1e-3, t = new Float32Array(n2), t2 = new Float32Array(n2);
    const mI = box(g, w, h, k), mp = box(a, w, h, k);
    for (let i = 0; i < n2; i++) { t[i] = g[i] * a[i]; t2[i] = g[i] * g[i]; }
    const mIp = box(t, w, h, k), mII = box(t2, w, h, k);
    for (let i = 0; i < n2; i++) { const va = (mIp[i] - mI[i] * mp[i]) / (mII[i] - mI[i] * mI[i] + eps); t[i] = va; t2[i] = mp[i] - va * mI[i]; }
    const ma = box(t, w, h, k), mb = box(t2, w, h, k);
    for (let i = 0; i < n2; i++) if (a[i] > 0.02 && a[i] < 0.98) a[i] = Math.min(1, Math.max(0, ma[i] * g[i] + mb[i]));
  }
  // 4) Farbsaum entfernen (Blur-Fusion): Randfarbe aus dem Teil schätzen statt Hintergrund durchscheinen lassen
  const est = (F, B, k) => { const ba = box(a, w, h, k), nf = [], nb = [];
    for (let c = 0; c < 3; c++) { const ta = new Float32Array(n2), tb = new Float32Array(n2);
      for (let i = 0; i < n2; i++) { ta[i] = F[c][i] * a[i]; tb[i] = B[c][i] * (1 - a[i]); }
      const bF = box(ta, w, h, k), bB = box(tb, w, h, k), o = new Float32Array(n2);
      for (let i = 0; i < n2; i++) { const fF = bF[i] / (ba[i] + 1e-5), fB = bB[i] / (1 - ba[i] + 1e-5); bB[i] = fB;
        o[i] = Math.min(1, Math.max(0, fF + a[i] * (f[c][i] - a[i] * fF - (1 - a[i]) * fB))); }
      nf.push(o); nb.push(bB); }
    return [nf, nb]; };
  const [F1, B1] = est(f, f, r1), [F2] = est(F1, B1, 6);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) A[(R.y0 + y) * W + R.x0 + x] = a[y * w + x];
  return { R, w, F: F2 };
}

async function toCanvas(file, maxE) {
  const url = URL.createObjectURL(file); const img = new Image(); img.src = url; await img.decode(); URL.revokeObjectURL(url);
  const k = Math.min(1, maxE / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
  return { c, ow: img.naturalWidth, oh: img.naturalHeight };
}
function blob(c, type, q) { return new Promise(r => c.toBlob(r, type, q)); }

// Ganzer Ablauf. mode: 'alt' (wie im alten Valet) oder 'neu' (verbessert)
async function cutout(file, mode, onStep) {
  try { return await cutout1(file, mode, onStep); }
  catch (e) { if (e && e.gpuLost) { onStep && onStep('Grafikchip ausgefallen – rechne mit Prozessor …', 0); return cutout1(file, mode, onStep); } throw e; }
}
async function cutout1(file, mode, onStep) {
  const neu = mode !== 'alt', light = mode === 'alt2' || mode === 'alt2f', area = mode === 'neu' || mode === 'k1024', win = mode === 'k1024' || mode === 'alt2f', maxE = win ? 2400 : (neu && !light) ? 1600 : 2000, info = { mode, t: {} }, T = () => performance.now();
  let t = T(); const { c, ow, oh } = await toCanvas(file, maxE); info.t.lesen = T() - t;
  const W = c.width, H = c.height, d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, A = new Float32Array(W * H);
  info.eingang = `${ow}×${oh}`; info.arbeit = `${W}×${H}`; info.S = modelSize(); info.engine = engineName();
  t = T(); onStep && onStep('1. Durchgang …', 0);
  const m = await mask(d, W, 0, 0, W, H, area, p => onStep && onStep('1. Durchgang', p), neu); info.t.pass1 = T() - t;
  if (!m) { M.gpu && M.gpu.release && M.gpu.release(); throw new Error('Kein Teil erkannt'); }
  const cov = upMask(m, A, W, 0, 0, W, H);
  if (cov < 0.01 || cov > 0.98) { M.gpu && M.gpu.release && M.gpu.release(); throw new Error('Kein Teil erkannt (Abdeckung ' + Math.round(cov * 100) + ' %)'); }
  // 2. Durchgang wie im alten Valet: Teil klein im Bild → Ausschnitt nochmal durchs Modell
  const b = bbox(A, W, H, 0.5); info.pass2 = false; let up = Math.max(W, H) / info.S;
  if (b && win) {
    // Fenster in Modellgröße (S×S) ums Teil, in Originalauflösung; ist das Teil größer, möglichst quadratisch knapp ums Teil
    const S = info.S, bw = b.x1 - b.x0, bh = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const need = Math.round(Math.max(bw, bh) * 1.06), side = Math.max(S, need);
    const ww = Math.min(W, side), wh = Math.min(H, side);
    const x0 = Math.max(0, Math.min(W - ww, Math.round(cx - ww / 2))), y0 = Math.max(0, Math.min(H - wh, Math.round(cy - wh / 2)));
    info.fenster = `${ww}×${wh} bei ${x0},${y0}` + (side > S ? ` (Teil größer als ${S} px → verkleinert)` : ' (1:1, ohne Skalieren)');
    if (!(x0 === 0 && y0 === 0 && ww === W && wh === H)) {
      t = T(); onStep && onStep('2. Durchgang …', 0);
      const m2 = await mask(d, W, x0, y0, ww, wh, area, p => onStep && onStep('2. Durchgang', p), false); info.t.pass2 = T() - t;
      if (m2) { const A2 = new Float32Array(W * H), c2 = upMask(m2, A2, W, x0, y0, ww, wh);
        if (c2 >= 0.01 && c2 <= 0.98) { A.set(A2); info.pass2 = true; up = Math.max(ww, wh) / S; } }
    } else info.fenster += ' – ganzes Foto, kein 2. Durchgang';
  } else if (b) { const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (bw > 24 && bh > 24 && (bw < W * 0.8 || bh < H * 0.8)) {
      const pad = Math.round(0.06 * Math.max(bw, bh)), x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(W, b.x1 + pad), y1 = Math.min(H, b.y1 + pad);
      t = T(); onStep && onStep('2. Durchgang …', 0);
      const m2 = await mask(d, W, x0, y0, x1 - x0, y1 - y0, area, p => onStep && onStep('2. Durchgang', p), false); info.t.pass2 = T() - t;
      if (m2) { const A2 = new Float32Array(W * H), c2 = upMask(m2, A2, W, x0, y0, x1 - x0, y1 - y0);
        if (c2 >= 0.01 && c2 <= 0.98) { A.set(A2); info.pass2 = true; up = Math.max(x1 - x0, y1 - y0) / info.S; } } } }
  M.gpu && M.gpu.release && M.gpu.release();
  let col = null; t = T();
  if (neu) { onStep && onStep('Nachbearbeitung …', 1); await new Promise(r => setTimeout(r, 30)); col = refine(d, A, W, H, up, info, !light); }
  info.t.nach = T() - t;
  // Ergebnis: auf das Teil zuschneiden
  const bb = bbox(A, W, H, 0.02); if (!bb) throw new Error('Kein Teil erkannt');
  const ow2 = bb.x1 - bb.x0, oh2 = bb.y1 - bb.y0, out = document.createElement('canvas'); out.width = ow2; out.height = oh2;
  const ox = out.getContext('2d'), im = ox.createImageData(ow2, oh2), od = im.data;
  for (let y = 0; y < oh2; y++) for (let x = 0; x < ow2; x++) { const X = bb.x0 + x, Y = bb.y0 + y, i = Y * W + X, o = (y * ow2 + x) * 4;
    if (col && X >= col.R.x0 && X < col.R.x1 && Y >= col.R.y0 && Y < col.R.y1) { const j = (Y - col.R.y0) * col.w + (X - col.R.x0); od[o] = col.F[0][j] * 255 + 0.5; od[o + 1] = col.F[1][j] * 255 + 0.5; od[o + 2] = col.F[2][j] * 255 + 0.5; }
    else { od[o] = d[i * 4]; od[o + 1] = d[i * 4 + 1]; od[o + 2] = d[i * 4 + 2]; }
    od[o + 3] = Math.round(Math.max(0, Math.min(1, A[i])) * 255); }
  ox.putImageData(im, 0, 0);
  t = T();
  let file2 = neu ? await blob(out, 'image/webp', 0.9) : null; if (!file2 || file2.type !== 'image/webp') file2 = await blob(out, 'image/png');
  let thumb = null;
  if (neu) { const k = Math.min(1, 400 / Math.max(ow2, oh2)), tc = document.createElement('canvas'); tc.width = Math.round(ow2 * k); tc.height = Math.round(oh2 * k);
    const tx = tc.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(out, 0, 0, tc.width, tc.height);
    thumb = await blob(tc, 'image/webp', 0.85); if (!thumb || thumb.type !== 'image/webp') thumb = await blob(tc, 'image/png'); }
  info.t.speichern = T() - t;
  info.groesse = `${ow2}×${oh2}`;
  return { canvas: out, file: file2, thumb, info };
}

window.ValetRMBG = { load, isCached, forget, cutout, engineName, modelSize, get gpuErr() { return M.gpuErr; }, get ready() { return !!M.meta; } };
})();
