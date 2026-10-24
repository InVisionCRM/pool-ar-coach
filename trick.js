(function(){
'use strict';
var P=window.PoolPhysics,SHOTS=window.TRICK_SHOTS||[],R=P.R,D=P.D,L=P.CFG.L,W=P.CFG.W,MARGIN=5.2;
function $(id){return document.getElementById(id)}
var cv=$('table'),ctx=cv.getContext('2d'),tableLayer=document.createElement('canvas'),ballCanvas=document.createElement('canvas'),bctx=ballCanvas.getContext('2d');
var view={s:6,portrait:false,dpr:1,cw:0,ch:0};
var cur=0,setup=null,orig=null,st=null,mode='idle',slow=false,showTrails=true,showPaths=true,sound=false,audio=null,trails=null,preview=null,lastT=0,acc=0,evIdx=0,modified=false,result=null;
var BALL_COLORS={1:[236,186,24],2:[34,78,206],3:[208,36,40],4:[104,44,146],5:[240,118,28],6:[24,128,62],7:[122,32,32],8:[18,18,18]};
var POCKET_NAMES={P1:'corner pocket P1',P2:'side pocket P2',P3:'corner pocket P3',P4:'corner pocket P4',P5:'side pocket P5',P6:'corner pocket P6'};
function clone(o){return JSON.parse(JSON.stringify(o))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
// ---------- view transform (world inches, y up -> screen px) ----------
function toScreen(x,y){if(view.portrait)return {x:(y+MARGIN)*view.s,y:(x+MARGIN)*view.s};return {x:(x+MARGIN)*view.s,y:(W-y+MARGIN)*view.s}}
function toWorld(px,py){if(view.portrait)return {x:py/view.s-MARGIN,y:px/view.s-MARGIN};return {x:px/view.s-MARGIN,y:W-(py/view.s-MARGIN)}}
function layout(){
 var wrap=$('tableWrap'),aw=wrap.clientWidth-8,vh=window.innerHeight||700,portrait=(window.innerWidth<window.innerHeight)&&window.innerWidth<900;
 var TWd=L+2*MARGIN,THd=W+2*MARGIN,s;
 if(portrait){s=Math.min(aw/THd,(vh*0.74)/TWd)}else{s=Math.min(aw/TWd,(vh*(window.innerWidth>900?0.7:0.82))/THd)}
 s=Math.max(2,s);view.s=s;view.portrait=portrait;view.dpr=Math.min(window.devicePixelRatio||1,2);
 view.cw=Math.round((portrait?THd:TWd)*s);view.ch=Math.round((portrait?TWd:THd)*s);
 cv.style.width=view.cw+'px';cv.style.height=view.ch+'px';cv.width=Math.round(view.cw*view.dpr);cv.height=Math.round(view.ch*view.dpr);
 drawTableLayer();render()}
// ---------- static table layer ----------
function noiseFill(g,w,h,alpha){var id=g.getImageData(0,0,w,h),d=id.data,seed=12345;for(var i=0;i<d.length;i+=4){seed=(seed*1103515245+12345)&0x7fffffff;var n=(seed/0x7fffffff-0.5)*alpha;d[i]=clamp(d[i]+n,0,255);d[i+1]=clamp(d[i+1]+n,0,255);d[i+2]=clamp(d[i+2]+n,0,255)}g.putImageData(id,0,0)}
function poly(g,pts){g.beginPath();for(var i=0;i<pts.length;i++){var q=toScreen(pts[i][0],pts[i][1]);if(i)g.lineTo(q.x,q.y);else g.moveTo(q.x,q.y)}g.closePath()}
function drawTableLayer(){
 tableLayer.width=cv.width;tableLayer.height=cv.height;var g=tableLayer.getContext('2d',{willReadFrequently:true});g.setTransform(view.dpr,0,0,view.dpr,0,0);var s=view.s;
 // wood rails
 var a=toScreen(-MARGIN,-MARGIN),b=toScreen(L+MARGIN,W+MARGIN),x0=Math.min(a.x,b.x),y0=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
 var wg=g.createLinearGradient(x0,y0,x0+w,y0+h);wg.addColorStop(0,'#6b3a1c');wg.addColorStop(0.5,'#8a4f27');wg.addColorStop(1,'#5a2f15');g.fillStyle=wg;roundRect(g,x0,y0,w,h,s*2.2);g.fill();
 g.strokeStyle='rgba(40,18,6,.35)';g.lineWidth=1;for(var k=0;k<40;k++){var t=k/40;g.beginPath();if(view.portrait){g.moveTo(x0+w*t,y0);g.bezierCurveTo(x0+w*t+3,y0+h*.3,x0+w*t-3,y0+h*.7,x0+w*t,y0+h)}else{g.moveTo(x0,y0+h*t);g.bezierCurveTo(x0+w*.3,y0+h*t+3,x0+w*.7,y0+h*t-3,x0+w,y0+h*t)}g.stroke()}
 g.strokeStyle='rgba(255,220,170,.25)';g.lineWidth=2;roundRect(g,x0+2,y0+2,w-4,h-4,s*2);g.stroke();
 // cloth (playing surface plus cushion tops)
 var ca=toScreen(-2.1,-2.1),cb=toScreen(L+2.1,W+2.1),cx0=Math.min(ca.x,cb.x),cy0=Math.min(ca.y,cb.y),cw=Math.abs(cb.x-ca.x),ch=Math.abs(cb.y-ca.y);
 var cg=g.createRadialGradient(cx0+cw/2,cy0+ch/2,Math.min(cw,ch)*0.1,cx0+cw/2,cy0+ch/2,Math.max(cw,ch)*0.65);cg.addColorStop(0,'#1d8a4c');cg.addColorStop(1,'#0f5e31');g.fillStyle=cg;g.fillRect(cx0,cy0,cw,ch);
 // subtle cloth texture
 try{g.setTransform(1,0,0,1,0,0);var tx=Math.round(cx0*view.dpr),ty=Math.round(cy0*view.dpr),tw=Math.round(cw*view.dpr),th=Math.round(ch*view.dpr);var id=g.getImageData(tx,ty,tw,th),d=id.data,seed=777;for(var i=0;i<d.length;i+=4){seed=(seed*1103515245+12345)&0x7fffffff;var n=((seed>>8)%13)-6;d[i]+=n*0.4;d[i+1]+=n;d[i+2]+=n*0.5}g.putImageData(id,tx,ty)}catch(e){}
 g.setTransform(view.dpr,0,0,view.dpr,0,0);
 // head string and foot spot
 g.strokeStyle='rgba(255,255,255,.10)';g.lineWidth=1;var h1=toScreen(L/4,0),h2=toScreen(L/4,W);g.beginPath();g.moveTo(h1.x,h1.y);g.lineTo(h2.x,h2.y);g.stroke();
 var fs=toScreen(L*0.75,W/2);g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.arc(fs.x,fs.y,Math.max(1.5,s*0.25),0,7);g.fill();
 // pockets: dark throat between the jaws, the hole, then cushions whose ends follow the jaws
 var PK=P.pocketList(L,W),segs=P.cushionSegments(L,W),rails=segs.slice(0,6),jaws=segs.slice(6),HR=2.5,BK=2.1;
 function jawFrom(x,y){for(var i=0;i<jaws.length;i++)if(Math.abs(jaws[i].ax-x)<1e-6&&Math.abs(jaws[i].ay-y)<1e-6)return jaws[i];return null}
 PK.forEach(function(p){var js=jaws.filter(function(jw){return Math.hypot(jw.bx-p.hx,jw.by-p.hy)<HR+0.3});if(js.length===2){poly(g,[[js[0].ax,js[0].ay],[js[0].bx,js[0].by],[p.hx,p.hy],[js[1].bx,js[1].by],[js[1].ax,js[1].ay]]);g.fillStyle='#060606';g.fill()}
  var q=toScreen(p.hx,p.hy),rr=HR*s;var pg=g.createRadialGradient(q.x,q.y,rr*0.15,q.x,q.y,rr);pg.addColorStop(0,'#000');pg.addColorStop(0.8,'#090909');pg.addColorStop(1,'#202020');g.fillStyle=pg;g.beginPath();g.arc(q.x,q.y,rr,0,7);g.fill();
  g.strokeStyle='rgba(150,110,70,.55)';g.lineWidth=Math.max(1,s*0.22);g.beginPath();g.arc(q.x,q.y,rr,0,7);g.stroke()});
 rails.forEach(function(r){var ja=jawFrom(r.ax,r.ay),jb=jawFrom(r.bx,r.by);if(!ja||!jb)return;var horiz=r.ay===r.by,out=horiz?(r.ay===0?-BK:W+BK):(r.ax===0?-BK:L+BK);
  var pts=horiz?[[r.ax,r.ay],[r.bx,r.by],[jb.bx,jb.by],[jb.bx,out],[ja.bx,out],[ja.bx,ja.by]]:[[r.ax,r.ay],[r.bx,r.by],[jb.bx,jb.by],[out,jb.by],[out,ja.by],[ja.bx,ja.by]];
  poly(g,pts);var A=toScreen(r.ax,r.ay),B=toScreen(r.bx,r.by),O=toScreen(horiz?r.ax:out,horiz?out:r.ay);var cg2=g.createLinearGradient(A.x,A.y,O.x+(A.x===O.x?0:0),O.y);cg2.addColorStop(0,'#1a7f45');cg2.addColorStop(1,'#0d5a2e');
  g.fillStyle=cg2;g.fill();g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=1;g.stroke();g.beginPath();g.moveTo(A.x,A.y);g.lineTo(B.x,B.y);g.strokeStyle='rgba(170,255,190,.35)';g.lineWidth=1.2;g.stroke()});
 // diamonds
 g.fillStyle='#f3ead2';function dia(x,y){var q=toScreen(x,y),r=Math.max(1.6,s*0.42);g.beginPath();g.moveTo(q.x,q.y-r);g.lineTo(q.x+r*0.7,q.y);g.lineTo(q.x,q.y+r);g.lineTo(q.x-r*0.7,q.y);g.closePath();g.fill()}
 for(var k2=1;k2<8;k2++){if(k2===4)continue;dia(L*k2/8,-3.6);dia(L*k2/8,W+3.6)}for(var k3=1;k3<4;k3++){dia(-3.6,W*k3/4);dia(L+3.6,W*k3/4)}
 // pocket labels
 g.font='bold '+Math.max(9,Math.round(s*1.5))+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillStyle='rgba(255,240,215,.75)';
 PK.forEach(function(p){var ox=p.x===0?-3.9:p.x===L?3.9:0,oy=p.y===0?-4.0:4.0;if(!p.corner){ox=6.5;}var q=toScreen(p.x+ox,p.y+oy);g.fillText(p.id,q.x,q.y)});
}
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath()}
// ---------- ball rendering: per-pixel shading, rolling stripes/numbers ----------
var LIGHT=(function(){var l=[-0.35,0.45,0.82],n=Math.hypot(l[0],l[1],l[2]);return [l[0]/n,l[1]/n,l[2]/n]})(),HALF=(function(){var h=[LIGHT[0],LIGHT[1],LIGHT[2]+1],n=Math.hypot(h[0],h[1],h[2]);return [h[0]/n,h[1]/n,h[2]/n]})();
function ballBase(n){if(n==='cue')return null;var k=Number(n);return BALL_COLORS[k>8?k-8:k]}
function drawBall(b){
 var c=toScreen(b.x,b.y),rp=R*view.s*view.dpr,size=Math.ceil(rp*2)+2;if(ballCanvas.width!==size){ballCanvas.width=size;ballCanvas.height=size}
 var img=bctx.createImageData(size,size),d=img.data,cx=size/2,cy=size/2,M=b.M||[1,0,0,0,1,0,0,0,1],num=b.n==='cue'?0:Number(b.n),base=ballBase(b.n),stripe=num>8;
 for(var j=0;j<size;j++)for(var i=0;i<size;i++){var dx=(i+0.5-cx)/rp,dy=(j+0.5-cy)/rp,d2=dx*dx+dy*dy;if(d2>1.06)continue;
  var dd=Math.sqrt(Math.min(1,d2)),nz=Math.sqrt(Math.max(0,1-dd*dd)),nx,ny;if(view.portrait){nx=dy;ny=dx}else{nx=dx;ny=-dy}
  var lx=M[0]*nx+M[3]*ny+M[6]*nz,lz=M[2]*nx+M[5]*ny+M[8]*nz,col;
  if(b.n==='cue'){col=(Math.abs(lx)>0.955)?[200,30,40]:[246,244,232]}
  else if(num===8){col=(Math.abs(lx)>0.86)?[246,244,232]:base}
  else if(stripe){col=(Math.abs(lz)<0.55)?base:[246,244,232];if(Math.abs(lx)>0.88&&Math.abs(lz)<0.5)col=[246,244,232]}
  else{col=(Math.abs(lx)>0.86)?[246,244,232]:base}
  // lighting in screen space (light from upper left)
  var sx=dx,sy=-dy,diff=Math.max(0,sx*LIGHT[0]+sy*LIGHT[1]+nz*LIGHT[2]),sp=Math.pow(Math.max(0,sx*HALF[0]+sy*HALF[1]+nz*HALF[2]),60);
  var sh=0.30+0.75*diff,o=(j*size+i)*4;d[o]=clamp(col[0]*sh+sp*255,0,255);d[o+1]=clamp(col[1]*sh+sp*255,0,255);d[o+2]=clamp(col[2]*sh+sp*255,0,255);
  d[o+3]=d2>1?Math.max(0,255*(1-(Math.sqrt(d2)-1)*rp)):255}
 bctx.putImageData(img,0,0);
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(c.x*view.dpr+rp*0.28,c.y*view.dpr+rp*0.34,rp*1.02,rp*0.9,0,0,7);ctx.fill();
 ctx.drawImage(ballCanvas,c.x*view.dpr-size/2,c.y*view.dpr-size/2);
 // number on the visible pole(s)
 if(num>0){for(var sgn=-1;sgn<=1;sgn+=2){var px=M[0]*sgn,py=M[3]*sgn,pz=M[6]*sgn;if(pz<0.35)continue;var spx,spy;if(view.portrait){spx=py;spy=px}else{spx=px;spy=-py}
   ctx.globalAlpha=Math.min(1,(pz-0.35)*2.2);ctx.fillStyle=num===8?'#111':'#111';ctx.font='bold '+Math.round(rp*0.78*Math.sqrt(pz))+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(num),c.x*view.dpr+spx*rp*0.98,c.y*view.dpr+spy*rp*0.98+rp*0.03)}}
 ctx.restore()}
// ---------- setup / state ----------
function loadShot(i){cur=(i+SHOTS.length)%SHOTS.length;orig=clone(SHOTS[cur]);setup=clone(orig);modified=false;$('shotSel').value=String(cur);resetSim();updateInfo();syncControls();computePreview()}
function resetSim(){st=P.createState(setup.balls,{orient:true});mode='idle';trails=null;result=null;acc=0;evIdx=0;$('result').textContent='';$('result').className='';$('pauseBtn').disabled=true;$('playBtn').textContent='▶ Play';render()}
function play(){
 if(mode==='playing')return;if(mode==='paused'){mode='playing';lastT=0;$('pauseBtn').disabled=false;$('playBtn').textContent='▶ Playing';return}
 st=P.createState(setup.balls,{orient:true});P.strike(st,setup.aim,setup.power,setup.side,setup.vert,setup.masse);trails={};st.balls.forEach(function(b){trails[b.n]=[[b.x,b.y]]});
 mode='playing';acc=0;lastT=0;evIdx=0;result=null;$('result').textContent='';$('result').className='';$('pauseBtn').disabled=false;$('playBtn').textContent='▶ Playing'}
function pause(){if(mode==='playing'){mode='paused';$('pauseBtn').disabled=true;$('playBtn').textContent='▶ Resume'}}
function checkResult(s,shot){var ok=true,parts=[];shot.targets.forEach(function(t){var pk=null;s.pocketed.forEach(function(x){if(String(x.n)===String(t.n))pk=x});if(pk&&pk.pocket===t.p)parts.push(t.n+' in '+t.p);else{ok=false;parts.push(t.n+(pk?' went in '+pk.pocket+' instead of '+t.p:' missed '+t.p))}});
 var scratch=s.pocketed.some(function(x){return x.n==='cue'});if(scratch){ok=false;parts.push('cue ball scratched')}
 if(shot.firstHit!==undefined&&s.firstHit!==shot.firstHit){ok=false;parts.push('cue ball hit '+(s.firstHit===null?'nothing':'the '+s.firstHit)+' first')}
 if(shot.cueRails!==undefined&&s.cueRailsAtHit!==shot.cueRails){ok=false;parts.push('cue ball took '+s.cueRailsAtHit+' rail'+(s.cueRailsAtHit===1?'':'s')+' before contact (planned '+shot.cueRails+')')}
 if(shot.objRails){for(var k in shot.objRails){var bb=null;s.balls.forEach(function(x){if(String(x.n)===k)bb=x});if(bb&&bb.rails!==shot.objRails[k]){ok=false;parts.push('the '+k+' hit '+bb.rails+' rail'+(bb.rails===1?'':'s')+' (planned '+shot.objRails[k]+')')}}}
 return {ok:ok,text:parts.join(', ')}}
function watchRails(s){if(s.cueRailsAtHit===undefined)s.cueRailsAtHit=null;if(s.cueRailsAtHit===null&&s.firstHit!==null){var c=P.cueBall(s);s.cueRailsAtHit=c?c.rails:0}}
function finish(){mode='done';$('pauseBtn').disabled=true;$('playBtn').textContent='▶ Play again';var shot=setup;result=checkResult(st,shot);var el=$('result');
 el.textContent=(result.ok?'✓ Made it: ':'✗ Not this time: ')+result.text+(modified?' (your version)':'');el.className=result.ok?'ok':'bad'}
// run a whole shot instantly (used for the expected-path preview and the automated test)
function simulateSetup(sh,withTrails){var s=P.createState(sh.balls,{orient:false}),tr={};s.balls.forEach(function(b){tr[b.n]=[[b.x,b.y]]});P.strike(s,sh.aim,sh.power,sh.side,sh.vert,sh.masse);
 s.onStep=function(x){watchRails(x);if(withTrails&&x.stepCount%8===0)x.balls.forEach(function(b){if(b.active||!b._done){tr[b.n].push([b.x,b.y]);if(!b.active)b._done=true}})};P.run(s,25);return {state:s,trails:tr,result:checkResult(s,sh)}}
var previewTimer=0;function computePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(function(){preview=simulateSetup(setup,true);render()},60)}
// ---------- main loop ----------
function frame(ts){
 if(mode==='playing'){var dtw=lastT?Math.min(0.05,(ts-lastT)/1000):0.016;lastT=ts;acc+=dtw*(slow?0.25:1);var n=0;
  while(acc>=P.CFG.dt&&n<4000){P.step(st);watchRails(st);acc-=P.CFG.dt;n++;if(st.stepCount%8===0)st.balls.forEach(function(b){var t=trails[b.n];if(b.active||!b._done){t.push([b.x,b.y]);if(!b.active)b._done=true}});if(st.stopped||st.t>25)break}
  playSounds();if(st.stopped||st.t>25)finish();render()}
 else lastT=0;
 requestAnimationFrame(frame)}
function trailColor(n){if(n==='cue')return 'rgba(255,255,255,';var c=ballBase(n);return 'rgba('+c[0]+','+c[1]+','+c[2]+','}
function drawTrails(tr,alpha,dash){for(var k in tr){var t=tr[k];if(t.length<2)continue;ctx.beginPath();for(var i=0;i<t.length;i++){var q=toScreen(t[i][0],t[i][1]);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y)}
  ctx.strokeStyle=trailColor(k==='cue'?'cue':Number(k))+alpha+')';ctx.lineWidth=k==='cue'?2:1.6;ctx.setLineDash(dash||[]);ctx.stroke();ctx.setLineDash([])}}
function aimInfo(){var c=null;setup.balls.forEach(function(b){if(b.n==='cue')c=b});var a=setup.aim*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),best=null,bt=1e9;
 setup.balls.forEach(function(b){if(b===c)return;var ox=b.x-c.x,oy=b.y-c.y,pr=ox*dx+oy*dy;if(pr<=0)return;var perp=Math.abs(ox*dy-oy*dx);if(perp>=D)return;var t=pr-Math.sqrt(D*D-perp*perp);if(t<bt){bt=t;best=b}});
 var rt=1e9;if(dx>1e-9)rt=Math.min(rt,(L-R-c.x)/dx);if(dx<-1e-9)rt=Math.min(rt,(R-c.x)/dx);if(dy>1e-9)rt=Math.min(rt,(W-R-c.y)/dy);if(dy<-1e-9)rt=Math.min(rt,(R-c.y)/dy);
 if(best&&bt<rt){var gx=c.x+dx*bt,gy=c.y+dy*bt,ux=best.x-gx,uy=best.y-gy,ul=Math.hypot(ux,uy);var cut=Math.acos(clamp((ux*dx+uy*dy)/ul,-1,1))*180/Math.PI;return {cue:c,end:{x:gx,y:gy},ball:best,cut:cut,dir:{x:dx,y:dy}}}
 return {cue:c,end:{x:c.x+dx*rt,y:c.y+dy*rt},ball:null,dir:{x:dx,y:dy}}}
function render(){
 if(!st)return;ctx.setTransform(view.dpr,0,0,view.dpr,0,0);ctx.clearRect(0,0,view.cw,view.ch);ctx.drawImage(tableLayer,0,0,view.cw,view.ch);
 // highlight target pockets
 var PK=P.pocketList(L,W);setup.targets.forEach(function(t){PK.forEach(function(p){if(p.id!==t.p)return;var q=toScreen(p.hx,p.hy);ctx.beginPath();ctx.arc(q.x,q.y,2.85*view.s,0,7);ctx.strokeStyle='rgba(131,242,143,.9)';ctx.lineWidth=2.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([])})});
 if(mode==='idle'){
  if(showPaths&&preview)drawTrails(preview.trails,0.35,[4,5]);
  var ai=aimInfo(),A=toScreen(ai.cue.x,ai.cue.y),E=toScreen(ai.end.x,ai.end.y);
  ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(E.x,E.y);ctx.strokeStyle='rgba(255,189,105,.95)';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);
  if(ai.ball){ctx.beginPath();ctx.arc(E.x,E.y,R*view.s,0,7);ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([])}
  else{ctx.beginPath();ctx.arc(E.x,E.y,4,0,7);ctx.fillStyle='#ffbd69';ctx.fill()}
  // cue stick behind the cue ball
  var bx=ai.cue.x-ai.dir.x*(R+1.2),by=ai.cue.y-ai.dir.y*(R+1.2),ex=ai.cue.x-ai.dir.x*(R+40),ey=ai.cue.y-ai.dir.y*(R+40),S1=toScreen(bx,by),S2=toScreen(ex,ey);
  var gr=ctx.createLinearGradient(S1.x,S1.y,S2.x,S2.y);gr.addColorStop(0,'#e8e2d0');gr.addColorStop(0.03,'#2a6fd1');gr.addColorStop(0.05,'#f2e6c8');gr.addColorStop(0.7,'#c99a5b');gr.addColorStop(1,'#3b2412');
  ctx.beginPath();ctx.moveTo(S1.x,S1.y);ctx.lineTo(S2.x,S2.y);ctx.strokeStyle=gr;ctx.lineCap='round';ctx.lineWidth=Math.max(3,view.s*0.55);ctx.stroke();ctx.lineCap='butt';
 }else if(showTrails&&trails)drawTrails(trails,0.55);
 st.balls.forEach(function(b){if(b.active)drawBall(b)});
 // pocketed tray
 if(mode==='playing'||mode==='paused'){var el=$('result'),txt=st.pocketed.length?'In so far: '+st.pocketed.map(function(x){return (x.n==='cue'?'cue ball':'the '+x.n)+' → '+x.pocket}).join(', '):'Rolling…';if(el.textContent!==txt){el.textContent=txt;el.className=''}}}
// ---------- sound ----------
function playSounds(){var ev=st.events;if(!sound||!audio){evIdx=ev.length;return}var now=audio.currentTime,count=0;
 for(;evIdx<ev.length;evIdx++){var e=ev[evIdx];if(count++>4)continue;var o=audio.createOscillator(),g=audio.createGain();o.type=e.type==='ball'?'triangle':'sine';o.frequency.value=e.type==='ball'?2200:e.type==='rail'?320:140;
  var vol=Math.min(0.25,0.02+e.v/400);g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(0.0001,now+(e.type==='pocket'?0.25:0.06));o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+0.3)}}
// ---------- info + controls ----------
function pct(v){return Math.round(Math.abs(v)*100)+'%'}
function vertWords(v){if(Math.abs(v)<0.08)return 'center (stun)';return (v<0?'below center, draw ':'above center, follow ')+pct(v)}
function sideWords(s){if(Math.abs(s)<0.08)return 'no English';return (s>0?'right':'left')+' English '+pct(s)}
function powerWords(p){return p<20?'soft':p<40?'medium-soft':p<60?'medium':p<80?'firm':'hard'}
function updateInfo(){var s=setup,o=orig;$('shotName').textContent=o.name;var st5='';for(var i=1;i<=5;i++)st5+=i<=o.difficulty?'★':'☆';$('stars').textContent=st5;$('diffText').textContent=['','Easy','Moderate','Tricky','Hard','Expert'][o.difficulty];
 $('shotDesc').textContent=o.desc;$('tipText').textContent='Tip: '+o.tip;
 $('targetsText').textContent=o.targets.map(function(t){return 'the '+t.n+' → '+POCKET_NAMES[t.p]}).join('; ');updateCueText()}
function updateCueText(){var s=setup,ai=aimInfo();
 $('aimText').textContent=ai.ball?('cue ball at the '+ai.ball.n+'-ball, about a '+Math.round(ai.cut)+'° cut (ghost ball shown dotted)'):'rail first: aim at the orange dot on the cushion';
 $('contactText').textContent=vertWords(s.vert)+', '+sideWords(s.side);$('powerText').textContent=Math.round(s.power)+'% ('+powerWords(s.power)+')';
 var m=s.masse||0;$('masseText').textContent=Math.abs(m)<0.05?'none':(m>0?'swerve right ':'swerve left ')+pct(m)+' (elevated cue)';
 $('aimVal').textContent=(Math.round(s.aim*100)/100)+'°';$('powerVal').textContent=Math.round(s.power)+'%';$('sideVal').textContent=Math.abs(s.side)<0.01?'Center':(s.side>0?'Right ':'Left ')+pct(s.side);
 $('vertVal').textContent=Math.abs(s.vert)<0.01?'Center':(s.vert>0?'Follow ':'Draw ')+pct(s.vert);$('masseVal').textContent=Math.abs(m)<0.01?'None':(m>0?'Right ':'Left ')+pct(m);
 $('modTag').textContent=modified?'You have changed this shot. Reset restores the original.':'';renderCueGraphic()}
function syncControls(){$('power').value=Math.round(setup.power);$('side').value=Math.round(setup.side*100);$('vert').value=Math.round(setup.vert*100);$('masse').value=Math.round((setup.masse||0)*100);updateCueText()}
function changed(){modified=true;if(mode!=='idle')resetSim();updateCueText();computePreview();render()}
function renderCueGraphic(){var c=$('cueGraphic'),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.fillStyle='#111915';g.fillRect(0,0,c.width,c.height);var x=130,y=86,r=57;
 var grad=g.createRadialGradient(x-17,y-20,4,x,y,r);grad.addColorStop(0,'#fff');grad.addColorStop(1,'#b9c3be');g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=grad;g.fill();g.strokeStyle='#e8eee9';g.lineWidth=2;g.stroke();
 g.strokeStyle='#64756a';g.setLineDash([3,4]);g.beginPath();g.moveTo(x-r,y);g.lineTo(x+r,y);g.moveTo(x,y-r);g.lineTo(x,y+r);g.stroke();g.setLineDash([]);
 var px=x+setup.side*r*.72,py=y-setup.vert*r*.72;g.beginPath();g.arc(px,py,7,0,Math.PI*2);g.fillStyle='#ffbd69';g.fill();g.strokeStyle='#fff0d7';g.stroke();
 g.fillStyle='#aab8af';g.font='11px system-ui';g.textAlign='center';g.fillText('CUE-BALL CONTACT (tap to change)',130,164)}
$('cueGraphic').addEventListener('click',function(e){var r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*260,y=(e.clientY-r.top)/r.height*180;setup.side=Math.round(clamp((x-130)/57/0.72,-1,1)*100)/100;setup.vert=Math.round(clamp((86-y)/57/0.72,-1,1)*100)/100;syncControls();changed()});
['power','side','vert','masse'].forEach(function(id){$(id).addEventListener('input',function(){var v=Number($(id).value);if(id==='power')setup.power=v;else setup[id]=v/100;changed()})});
document.querySelectorAll('[data-nudge]').forEach(function(b){b.addEventListener('click',function(){setup.aim=Math.round((setup.aim+Number(b.getAttribute('data-nudge')))*100)/100;changed()})});
$('playBtn').addEventListener('click',function(){ensureAudio();play()});$('pauseBtn').addEventListener('click',pause);$('replayBtn').addEventListener('click',function(){resetSim();computePreview()});
$('slowBtn').addEventListener('click',function(){slow=!slow;this.classList.toggle('on',slow)});
$('trailBtn').addEventListener('click',function(){showTrails=!showTrails;this.classList.toggle('on',showTrails);render()});
$('pathBtn').addEventListener('click',function(){showPaths=!showPaths;this.classList.toggle('on',showPaths);render()});
$('soundBtn').addEventListener('click',function(){sound=!sound;ensureAudio();this.textContent=(sound?'🔊':'🔇')+' Sound';this.classList.toggle('on',sound)});
function ensureAudio(){if(!sound||audio)return;try{var AC=window.AudioContext||window.webkitAudioContext;if(AC)audio=new AC()}catch(e){}}
$('prevBtn').addEventListener('click',function(){loadShot(cur-1)});$('nextBtn').addEventListener('click',function(){loadShot(cur+1)});
$('shotSel').addEventListener('change',function(){loadShot(Number($('shotSel').value))});
$('resetSetupBtn').addEventListener('click',function(){setup=clone(orig);modified=false;resetSim();syncControls();computePreview()});
SHOTS.forEach(function(s,i){var o=document.createElement('option');o.value=String(i);o.textContent=(i+1)+'. '+s.name;$('shotSel').appendChild(o)});
// ---------- dragging balls / aiming on the table ----------
var drag=null;
function evPoint(e){var r=cv.getBoundingClientRect();return toWorld(e.clientX-r.left,e.clientY-r.top)}
function down(e){var w=evPoint(e),best=null,bd=R*1.8;setup.balls.forEach(function(b){var d=Math.hypot(b.x-w.x,b.y-w.y);if(d<bd){bd=d;best=b}});
 if(mode!=='idle')resetSim();drag=best?{ball:best}:{aim:true};if(drag.aim)aimAt(w);if(e.preventDefault)e.preventDefault()}
function move(e){if(!drag)return;var w=evPoint(e);if(drag.ball){var b=drag.ball;b.x=clamp(w.x,R,L-R);b.y=clamp(w.y,R,W-R);
  setup.balls.forEach(function(o){if(o===b)return;var dx=b.x-o.x,dy=b.y-o.y,d=Math.hypot(dx,dy);if(d<D+0.004&&d>1e-6){b.x=o.x+dx/d*(D+0.004);b.y=o.y+dy/d*(D+0.004)}});
  modified=true;resetSim();updateCueText()}else aimAt(w);if(e.preventDefault)e.preventDefault()}
function up(){if(!drag)return;drag=null;changed()}
function aimAt(w){var c=null;setup.balls.forEach(function(b){if(b.n==='cue')c=b});if(!c)return;if(Math.hypot(w.x-c.x,w.y-c.y)<0.5)return;setup.aim=Math.round(Math.atan2(w.y-c.y,w.x-c.x)*18000/Math.PI)/100;modified=true;resetSim();updateCueText()}
if(window.PointerEvent){cv.addEventListener('pointerdown',function(e){cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);down(e)});cv.addEventListener('pointermove',move);cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up)}
else{cv.addEventListener('touchstart',function(e){down(e.touches[0]);e.preventDefault()},{passive:false});cv.addEventListener('touchmove',function(e){move(e.touches[0]);e.preventDefault()},{passive:false});cv.addEventListener('touchend',up);cv.addEventListener('mousedown',down);window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)}
var rt=0;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(layout,120)});window.addEventListener('orientationchange',function(){setTimeout(layout,300)});
// ---------- test hook ----------
window.trickTest={count:SHOTS.length,runAll:function(){return SHOTS.map(function(s){var r=simulateSetup(clone(s),false);return {id:s.id,name:s.name,ok:r.result.ok,text:r.result.text,t:r.state.t}})},load:loadShot,play:play,state:function(){return {mode:mode,t:st?st.t:0,pocketed:st?st.pocketed:[],result:result,cur:cur}},setSlow:function(v){slow=v}};
loadShot(0);layout();requestAnimationFrame(frame);
})();
