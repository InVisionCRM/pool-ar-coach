/* Trick Shots, Cue Lab and Free play. Landscape-first single screen; floating draggable cards. Plain ES5 for older Safari. */
(function(){
'use strict';
var P=window.PoolPhysics,SHOTS=window.TRICK_SHOTS||[],LESSONS=window.CUE_LESSONS||[],R=P.R,D=P.D,MARGIN=5.4;
var L=100,W=50;
function $(id){return document.getElementById(id)}
function clone(o){return JSON.parse(JSON.stringify(o))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function store(k,v){try{if(v===undefined){var s=localStorage.getItem(k);return s?JSON.parse(s):null}localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}
var cv=$('table'),ctx=cv.getContext('2d'),stage=$('stage'),tableLayer=document.createElement('canvas'),ballCanvas=document.createElement('canvas'),bctx=ballCanvas.getContext('2d');
var view={s:6,portrait:false,dpr:1,cw:0,ch:0};
var BALL_COLORS={1:[236,186,24],2:[34,78,206],3:[208,36,40],4:[104,44,146],5:[240,118,28],6:[24,128,62],7:[122,32,32],8:[18,18,18]};
var opts={trails:true,path:true,sound:false,slowSpeed:0.25,size:'9'};(function(){var o=store('trick2.opts');if(o)for(var k in o)opts[k]=o[k]})();
var TABLES={'7':[78,39],'8':[88,44],'9':[100,50]};
// app state
var mode='trick',item=0,spec=null,orig=null,st=null,anim='idle',slow=false,trails=null,preview=null,acc=0,lastT=0,evIdx=0,modified=false,result=null,audio=null,toastTimer=0;

// ---------- view transform ----------
function toScreen(x,y){if(view.portrait)return {x:(y+MARGIN)*view.s,y:(x+MARGIN)*view.s};return {x:(x+MARGIN)*view.s,y:(W-y+MARGIN)*view.s}}
function toWorld(px,py){if(view.portrait)return {x:py/view.s-MARGIN,y:px/view.s-MARGIN};return {x:px/view.s-MARGIN,y:W-(py/view.s-MARGIN)}}
function layout(){
 var w=stage.clientWidth-reserveRight(),h=stage.clientHeight,TW=L+2*MARGIN,TH=W+2*MARGIN,sL=Math.min(w/TW,h/TH),sP=Math.min(w/TH,h/TW),portrait=sP>sL*1.08;
 var s=Math.max(1.5,(portrait?sP:sL)*0.985);view.s=s;view.portrait=portrait;view.dpr=Math.min(window.devicePixelRatio||1,2);
 view.cw=Math.round((portrait?TH:TW)*s);view.ch=Math.round((portrait?TW:TH)*s);
 cv.style.width=view.cw+'px';cv.style.height=view.ch+'px';cv.style.left=Math.round((w-view.cw)/2)+'px';cv.style.top=Math.round((h-view.ch)/2)+'px';
 cv.width=Math.round(view.cw*view.dpr);cv.height=Math.round(view.ch*view.dpr);
 var touch=('ontouchstart' in window)||navigator.maxTouchPoints>0,isPortraitPhone=window.innerHeight>window.innerWidth&&window.innerWidth<700;
 $('rotateHint').hidden=!(isPortraitPhone&&!sessionStorage.getItem('trick2.rot'));
 drawTableLayer();placeCards();render()}
function reserveRight(){return (window.innerWidth>=1100&&window.innerHeight>=600&&window.innerWidth>window.innerHeight)?320:0}
// ---------- static table layer ----------
function poly(g,pts){g.beginPath();for(var i=0;i<pts.length;i++){var q=toScreen(pts[i][0],pts[i][1]);if(i)g.lineTo(q.x,q.y);else g.moveTo(q.x,q.y)}g.closePath()}
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath()}
function drawTableLayer(){
 tableLayer.width=cv.width;tableLayer.height=cv.height;var g=tableLayer.getContext('2d',{willReadFrequently:true});g.setTransform(view.dpr,0,0,view.dpr,0,0);var s=view.s;
 var a=toScreen(-MARGIN,-MARGIN),b=toScreen(L+MARGIN,W+MARGIN),x0=Math.min(a.x,b.x),y0=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
 var wg=g.createLinearGradient(x0,y0,x0+w,y0+h);wg.addColorStop(0,'#6b3a1c');wg.addColorStop(0.5,'#8a4f27');wg.addColorStop(1,'#5a2f15');g.fillStyle=wg;roundRect(g,x0,y0,w,h,s*2.2);g.fill();
 g.strokeStyle='rgba(40,18,6,.35)';g.lineWidth=1;for(var k=0;k<40;k++){var t=k/40;g.beginPath();if(view.portrait){g.moveTo(x0+w*t,y0);g.bezierCurveTo(x0+w*t+3,y0+h*.3,x0+w*t-3,y0+h*.7,x0+w*t,y0+h)}else{g.moveTo(x0,y0+h*t);g.bezierCurveTo(x0+w*.3,y0+h*t+3,x0+w*.7,y0+h*t-3,x0+w,y0+h*t)}g.stroke()}
 g.strokeStyle='rgba(255,220,170,.25)';g.lineWidth=2;roundRect(g,x0+2,y0+2,w-4,h-4,s*2);g.stroke();
 var ca=toScreen(-2.1,-2.1),cb=toScreen(L+2.1,W+2.1),cx0=Math.min(ca.x,cb.x),cy0=Math.min(ca.y,cb.y),cw=Math.abs(cb.x-ca.x),ch=Math.abs(cb.y-ca.y);
 var cg=g.createRadialGradient(cx0+cw/2,cy0+ch/2,Math.min(cw,ch)*0.1,cx0+cw/2,cy0+ch/2,Math.max(cw,ch)*0.65);cg.addColorStop(0,'#1d8a4c');cg.addColorStop(1,'#0f5e31');g.fillStyle=cg;g.fillRect(cx0,cy0,cw,ch);
 try{g.setTransform(1,0,0,1,0,0);var tx=Math.round(cx0*view.dpr),ty=Math.round(cy0*view.dpr),tw=Math.round(cw*view.dpr),th=Math.round(ch*view.dpr);var id=g.getImageData(tx,ty,tw,th),d=id.data,seed=777;for(var i=0;i<d.length;i+=4){seed=(seed*1103515245+12345)&0x7fffffff;var n=((seed>>8)%13)-6;d[i]+=n*0.4;d[i+1]+=n;d[i+2]+=n*0.5}g.putImageData(id,tx,ty)}catch(e){}
 g.setTransform(view.dpr,0,0,view.dpr,0,0);
 g.strokeStyle='rgba(255,255,255,.10)';g.lineWidth=1;var h1=toScreen(L/4,0),h2=toScreen(L/4,W);g.beginPath();g.moveTo(h1.x,h1.y);g.lineTo(h2.x,h2.y);g.stroke();
 var fs=toScreen(L*0.75,W/2);g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.arc(fs.x,fs.y,Math.max(1.5,s*0.25),0,7);g.fill();
 var PK=P.pocketList(L,W),segs=P.cushionSegments(L,W),rails=segs.slice(0,6),jaws=segs.slice(6),HR=2.5,BK=2.1;
 function jawFrom(x,y){for(var i=0;i<jaws.length;i++)if(Math.abs(jaws[i].ax-x)<1e-6&&Math.abs(jaws[i].ay-y)<1e-6)return jaws[i];return null}
 PK.forEach(function(p){var js=jaws.filter(function(jw){return Math.sqrt((jw.bx-p.hx)*(jw.bx-p.hx)+(jw.by-p.hy)*(jw.by-p.hy))<HR+0.3});if(js.length===2){poly(g,[[js[0].ax,js[0].ay],[js[0].bx,js[0].by],[p.hx,p.hy],[js[1].bx,js[1].by],[js[1].ax,js[1].ay]]);g.fillStyle='#060606';g.fill()}
  var q=toScreen(p.hx,p.hy),rr=HR*s;var pg=g.createRadialGradient(q.x,q.y,rr*0.15,q.x,q.y,rr);pg.addColorStop(0,'#000');pg.addColorStop(0.8,'#090909');pg.addColorStop(1,'#202020');g.fillStyle=pg;g.beginPath();g.arc(q.x,q.y,rr,0,7);g.fill();
  g.strokeStyle='rgba(150,110,70,.55)';g.lineWidth=Math.max(1,s*0.22);g.beginPath();g.arc(q.x,q.y,rr,0,7);g.stroke()});
 rails.forEach(function(r){var ja=jawFrom(r.ax,r.ay),jb=jawFrom(r.bx,r.by);if(!ja||!jb)return;var horiz=r.ay===r.by,out=horiz?(r.ay===0?-BK:W+BK):(r.ax===0?-BK:L+BK);
  var pts=horiz?[[r.ax,r.ay],[r.bx,r.by],[jb.bx,jb.by],[jb.bx,out],[ja.bx,out],[ja.bx,ja.by]]:[[r.ax,r.ay],[r.bx,r.by],[jb.bx,jb.by],[out,jb.by],[out,ja.by],[ja.bx,ja.by]];
  poly(g,pts);var A=toScreen(r.ax,r.ay),B=toScreen(r.bx,r.by),O=toScreen(horiz?r.ax:out,horiz?out:r.ay);var cg2=g.createLinearGradient(A.x,A.y,O.x,O.y);cg2.addColorStop(0,'#1a7f45');cg2.addColorStop(1,'#0d5a2e');
  g.fillStyle=cg2;g.fill();g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=1;g.stroke();g.beginPath();g.moveTo(A.x,A.y);g.lineTo(B.x,B.y);g.strokeStyle='rgba(170,255,190,.35)';g.lineWidth=1.2;g.stroke()});
 g.fillStyle='#f3ead2';function dia(x,y){var q=toScreen(x,y),r=Math.max(1.6,s*0.42);g.beginPath();g.moveTo(q.x,q.y-r);g.lineTo(q.x+r*0.7,q.y);g.lineTo(q.x,q.y+r);g.lineTo(q.x-r*0.7,q.y);g.closePath();g.fill()}
 for(var k2=1;k2<8;k2++){if(k2===4)continue;dia(L*k2/8,-3.7);dia(L*k2/8,W+3.7)}for(var k3=1;k3<4;k3++){dia(-3.7,W*k3/4);dia(L+3.7,W*k3/4)}
 g.font='bold '+Math.max(9,Math.round(s*1.4))+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillStyle='rgba(255,240,215,.7)';
 PK.forEach(function(p){var ox=p.x===0?-4.1:p.x===L?4.1:6.5,oy=p.y===0?-4.1:4.1;var q=toScreen(p.x+ox,p.y+oy);g.fillText(p.id,q.x,q.y)});
}
// ---------- ball rendering ----------
var LIGHT=(function(){var l=[-0.35,0.45,0.82],n=Math.sqrt(l[0]*l[0]+l[1]*l[1]+l[2]*l[2]);return [l[0]/n,l[1]/n,l[2]/n]})(),HALF=(function(){var h=[LIGHT[0],LIGHT[1],LIGHT[2]+1],n=Math.sqrt(h[0]*h[0]+h[1]*h[1]+h[2]*h[2]);return [h[0]/n,h[1]/n,h[2]/n]})();
function ballBase(n){if(n==='cue')return null;var k=Number(n);return BALL_COLORS[k>8?k-8:k]}
// draws ball n with orientation M centred at device pixel (dx,dy) with radius rp (device px); portrait flag swaps axes
function paintBall(g,n,M,dx0,dy0,rp,portrait,alpha){
 var size=Math.ceil(rp*2)+2;if(ballCanvas.width!==size){ballCanvas.width=size;ballCanvas.height=size}
 var img=bctx.createImageData(size,size),d=img.data,cx=size/2,cy=size/2,num=n==='cue'?0:Number(n),base=ballBase(n),stripe=num>8;M=M||[1,0,0,0,1,0,0,0,1];
 for(var j=0;j<size;j++)for(var i=0;i<size;i++){var dx=(i+0.5-cx)/rp,dy=(j+0.5-cy)/rp,d2=dx*dx+dy*dy;if(d2>1.06)continue;
  var dd=Math.sqrt(Math.min(1,d2)),nz=Math.sqrt(Math.max(0,1-dd*dd)),nx,ny;if(portrait){nx=dy;ny=dx}else{nx=dx;ny=-dy}
  var lx=M[0]*nx+M[3]*ny+M[6]*nz,lz=M[2]*nx+M[5]*ny+M[8]*nz,col;
  if(n==='cue'){col=(Math.abs(lx)>0.955||Math.abs(lz)>0.955)?[200,30,40]:[246,244,232]}
  else if(num===8){col=(Math.abs(lx)>0.86)?[246,244,232]:base}
  else if(stripe){col=(Math.abs(lz)<0.55)?base:[246,244,232];if(Math.abs(lx)>0.88&&Math.abs(lz)<0.5)col=[246,244,232]}
  else{col=(Math.abs(lx)>0.86)?[246,244,232]:base}
  var sx=dx,sy=-dy,diff=Math.max(0,sx*LIGHT[0]+sy*LIGHT[1]+nz*LIGHT[2]),sp=Math.pow(Math.max(0,sx*HALF[0]+sy*HALF[1]+nz*HALF[2]),60);
  var sh=0.30+0.75*diff,o=(j*size+i)*4;d[o]=clamp(col[0]*sh+sp*255,0,255);d[o+1]=clamp(col[1]*sh+sp*255,0,255);d[o+2]=clamp(col[2]*sh+sp*255,0,255);
  d[o+3]=(d2>1?Math.max(0,255*(1-(Math.sqrt(d2)-1)*rp)):255)*(alpha===undefined?1:alpha)}
 bctx.putImageData(img,0,0);g.drawImage(ballCanvas,dx0-size/2,dy0-size/2);
 if(num>0){for(var sgn=-1;sgn<=1;sgn+=2){var px=M[0]*sgn,py=M[3]*sgn,pz=M[6]*sgn;if(pz<0.35)continue;var spx,spy;if(portrait){spx=py;spy=px}else{spx=px;spy=-py}
   g.globalAlpha=Math.min(1,(pz-0.35)*2.2)*(alpha===undefined?1:alpha);g.fillStyle='#111';g.font='bold '+Math.round(rp*0.78*Math.sqrt(pz))+'px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(String(num),dx0+spx*rp*0.98,dy0+spy*rp*0.98+rp*0.03)}g.globalAlpha=1}}
function drawBall(b){var c=toScreen(b.x,b.y),z=b.z||0,rp=R*view.s*view.dpr*(1+z*0.07);
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 // shadow stays on the cloth and slides away from the light as the ball rises
 var shx=c.x*view.dpr+rp*0.28+z*view.s*view.dpr*0.55,shy=c.y*view.dpr+rp*0.34+z*view.s*view.dpr*0.55,sa=Math.max(0.10,0.30-z*0.04);
 ctx.fillStyle='rgba(0,0,0,'+sa+')';ctx.beginPath();ctx.ellipse(shx,shy,rp*1.02,rp*0.9,0,0,7);ctx.fill();
 paintBall(ctx,b.n,b.M,c.x*view.dpr,c.y*view.dpr,rp,view.portrait);
 if(z>0.3){ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='bold '+Math.round(11*view.dpr)+'px system-ui';ctx.textAlign='center';ctx.fillText(z.toFixed(1)+'″ up',c.x*view.dpr,c.y*view.dpr-rp-6*view.dpr)}
 ctx.restore()}
// ---------- content ----------
var LAB_FREE={id:'labfree',name:'Free experiment',kind:'labfree',text:'Drag the tip spot and the stick angle and watch the dashed path change. Try draw, follow, English and an elevated cue, then press Play.',balls:[{n:'cue',x:30,y:20},{n:1,x:62,y:31}],targets:[],cue:{aim:19,power:35,tipX:0,tipY:0,elev:0}};
function rack(size){var t=TABLES[size],l=t[0],w=t[1],fx=l*0.75,fy=w/2,F=D+0.01,rows=[1,2,3,2,1],nums=[1,2,3,9,4,5,6,8,7],k=0,balls=[{n:'cue',x:l*0.25,y:fy}];
 for(var r=0;r<rows.length;r++)for(var c=0;c<rows[r];c++){balls.push({n:nums[k++],x:+(fx+r*F*0.866).toFixed(3),y:+(fy+(c-(rows[r]-1)/2)*F).toFixed(3)})}return balls}
function freeItems(){var t=TABLES[opts.size],l=t[0],w=t[1];return [
 {id:'rack9',name:'9-ball rack (break)',kind:'free',balls:rack(opts.size),targets:[],cue:{aim:0,power:85,tipX:0,tipY:-0.1,elev:0}},
 {id:'practice',name:'Practice: one ball',kind:'free',balls:[{n:'cue',x:l*0.3,y:w*0.35},{n:1,x:l*0.62,y:w*0.6}],targets:[],cue:{aim:Math.round(Math.atan2(w*0.25,l*0.32)*1800/Math.PI)/10,power:35,tipX:0,tipY:0,elev:0}},
 {id:'cueonly',name:'Cue ball only',kind:'free',balls:[{n:'cue',x:l*0.25,y:w/2}],targets:[],cue:{aim:30,power:35,tipX:0,tipY:0,elev:0}}]}
function items(){if(mode==='trick')return SHOTS.map(function(s){var o=clone(s);o.kind='trick';return o});if(mode==='lab'){var a=[clone(LAB_FREE)];LESSONS.forEach(function(s){var o=clone(s);o.kind='lesson';a.push(o)});return a}return freeItems()}
function itemLabel(o,i){if(o.kind==='trick')return (i+1)+'. '+o.name;if(o.kind==='lesson')return 'Lesson '+i+': '+o.name;return o.name}
function setMode(m,idx){mode=m;$('modeSel').value=m;var list=items(),sel=$('itemSel');sel.innerHTML='';list.forEach(function(o,i){var op=document.createElement('option');op.value=String(i);op.textContent=itemLabel(o,i);sel.appendChild(op)});
 var last=store('trick2.item.'+m);loadItem(idx!==undefined?idx:(last||0));try{history.replaceState(null,'','#'+m)}catch(e){}}
function loadItem(i){var list=items();item=((i%list.length)+list.length)%list.length;store('trick2.item.'+mode,item);$('itemSel').value=String(item);
 spec=clone(list[item]);orig=clone(spec);prevShot=null;modified=false;
 var t=mode==='free'?TABLES[opts.size]:TABLES['9'];if(t[0]!==L||t[1]!==W){L=t[0];W=t[1];layout()}
 if(mode==='lab'){slow=spec.kind==='lesson';if(!cardSaved('cue'))setFold(cards.cue,false,true)}else slow=false;
 toast('','',0,true);resetSim();updateSlowBtn();updateInfo();updateCue();computePreview(true)}
function cueSpec(){for(var i=0;i<spec.balls.length;i++)if(spec.balls[i].n==='cue')return spec.balls[i];return null}
// ---------- simulation ----------
var prevShot=null;
// start every ball with its number facing up (and stripes showing as a band), each turned a little differently
function presentM(n,i){var sn=0.26,cs=0.966,ph=((typeof n==='number'?n:0)*47+i*13)*Math.PI/180,c=Math.cos(ph),q=Math.sin(ph),cols=[[sn,0,cs],[cs,0,-sn],[0,1,0]],M=[0,0,0,0,0,0,0,0,0];
 for(var k=0;k<3;k++){var v=cols[k],x=v[0]*c-v[1]*q,y=v[0]*q+v[1]*c;M[k]=x;M[3+k]=y;M[6+k]=v[2]}return M}
function resetSim(){st=P.createState(spec.balls,{orient:true,L:L,W:W});st.balls.forEach(function(b,i){b.M=presentM(b.n,i)});anim='idle';trails=null;result=null;acc=0;evIdx=0;updatePlayBtn();render()}
function play(){ensureAudio();if(anim==='playing')return;if(anim==='paused'){anim='playing';lastT=0;updatePlayBtn();return}
 if(anim==='done')resetSim();if(!cueSpec()){toast('No cue ball on the table','bad');return}
 prevShot=clone(spec);P.strike(st,spec.cue);anim='playing';lastT=0;acc=0;evIdx=0;trails=st.balls.map(function(b){return {n:b.n,pts:[[b.x,b.y]]}});updatePlayBtn();toast(spec.kind==='lesson'?'Watch the cue ball…':'Rolling…','',0)}
function pause(){if(anim==='playing'){anim='paused';updatePlayBtn()}}
function finish(){anim='done';updatePlayBtn();var pk=st.pocketed.map(function(x){return (x.n==='cue'?'cue':x.n)+'→'+x.pocket}).join(', ');
 if(spec.kind==='trick'||spec.kind==='lesson'){result=P.judge(spec,st);
  if(spec.kind==='trick')toast(result.ok?'✔ Made it! '+pk:'✖ Missed: '+result.why[0],result.ok?'ok':'bad',6000);
  else toast(result.ok?'✔ Challenge complete!':'✖ '+result.why[0]+'. Adjust and try again.',result.ok?'ok':'bad',6000)}
 else{var cue=P.cueBall(st);toast(st.pocketed.length?('Pocketed: '+pk):'No balls pocketed',cue&&cue.active?'':'bad',5000)}
 if(mode==='free'){// carry on from where the balls stopped
  var nb=[];st.balls.forEach(function(b){if(b.active)nb.push({n:b.n,x:+b.x.toFixed(3),y:+b.y.toFixed(3)})});
  if(!nb.some(function(b){return b.n==='cue'})){var p={n:'cue',x:L*0.25,y:W/2};for(var k=0;k<20&&nb.some(function(b){return Math.abs(b.x-p.x)<D&&Math.abs(b.y-p.y)<D});k++)p.y+=D;nb.unshift(p)}
  spec.balls=nb;modified=true}
 updateInfo()}
function frame(ts){
 if(anim==='playing'){if(!lastT)lastT=ts;var dt=Math.min(0.05,(ts-lastT)/1000);lastT=ts;acc+=dt*(slow?opts.slowSpeed:1);var n=0,cap=Math.floor(0.06/P.CFG.dt);
  while(acc>=P.CFG.dt&&n<cap&&!st.stopped){P.step(st);acc-=P.CFG.dt;n++;if(st.stepCount%8===0&&trails)for(var i=0;i<st.balls.length;i++){var b=st.balls[i];if(b.active)trails[i].pts.push([b.x,b.y])}}
  playSounds();if(st.stopped||st.t>25){if(mode==='free'&&trails)st.balls.forEach(function(b,i){if(b.active)trails[i].pts.push([b.x,b.y])});finish()}
  else if(st.pocketed.length)toast('In: '+st.pocketed.map(function(x){return (x.n==='cue'?'cue':x.n)+'→'+x.pocket}).join(', '),'',0)}
 else lastT=0;
 if(anim!=='idle'||dirty){render();dirty=false}if(mode==='lab')drawSpinIcon();requestAnimationFrame(frame)}
var dirty=true;
function simulate(s,maxT){var st2=P.createState(s.balls,{L:L,W:W}),tr=st2.balls.map(function(b){return {n:b.n,pts:[[b.x,b.y]]}});P.strike(st2,s.cue);
 st2.onStep=function(q){if(q.stepCount%10===0)for(var i=0;i<q.balls.length;i++){var b=q.balls[i];if(b.active)tr[i].pts.push([b.x,b.y])}};P.run(st2,maxT||14);
 st2.balls.forEach(function(b,i){if(b.active)tr[i].pts.push([b.x,b.y])});return {trails:tr,state:st2}}
var pvTimer=0;
function computePreview(now){clearTimeout(pvTimer);var go=function(){if(!cueSpec()){preview=null;dirty=true;return}preview=simulate(spec,mode==='free'?8:14);dirty=true;updateGoal()};if(now)go();else pvTimer=setTimeout(go,40)}
// ---------- drawing ----------
function drawTrails(tr,alpha,dash){tr.forEach(function(t){if(t.pts.length<2)return;var base=t.n==='cue'?[255,255,255]:(ballBase(t.n)||[200,200,200]);ctx.beginPath();for(var i=0;i<t.pts.length;i++){var q=toScreen(t.pts[i][0],t.pts[i][1]);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y)}
 var lift=(base[0]+base[1]+base[2])<150?110:40;ctx.strokeStyle='rgba('+Math.min(255,base[0]+lift)+','+Math.min(255,base[1]+lift)+','+Math.min(255,base[2]+lift)+','+alpha+')';ctx.lineWidth=t.n==='cue'?2:1.6;ctx.setLineDash(dash||[]);ctx.stroke();ctx.setLineDash([])})}
function aimInfo(){var c=cueSpec(),a=spec.cue.aim*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),best=null,bt=1e9;
 spec.balls.forEach(function(b){if(b===c)return;var fx=b.x-c.x,fy=b.y-c.y,tp=fx*dx+fy*dy;if(tp<=0)return;var perp2=fx*fx+fy*fy-tp*tp;if(perp2>D*D)return;var t=tp-Math.sqrt(D*D-perp2);if(t<bt){bt=t;best=b}});
 var tw=1e9;if(dx>1e-9)tw=Math.min(tw,(L-R-c.x)/dx);if(dx<-1e-9)tw=Math.min(tw,(R-c.x)/dx);if(dy>1e-9)tw=Math.min(tw,(W-R-c.y)/dy);if(dy<-1e-9)tw=Math.min(tw,(R-c.y)/dy);
 var t=best?bt:tw,gx=c.x+dx*t,gy=c.y+dy*t,cut=0;if(best){var nx=best.x-gx,ny=best.y-gy,nl=Math.sqrt(nx*nx+ny*ny);cut=Math.acos(clamp((nx*dx+ny*dy)/nl,-1,1))*180/Math.PI}
 return {cue:c,ball:best,end:{x:gx,y:gy},cut:cut,dir:{x:dx,y:dy}}}
function render(){
 if(!spec||!st)return;
 ctx.setTransform(view.dpr,0,0,view.dpr,0,0);ctx.clearRect(0,0,view.cw,view.ch);ctx.drawImage(tableLayer,0,0,view.cw,view.ch);var s=view.s,PK=P.pocketList(L,W);
 (spec.targets||[]).forEach(function(t){PK.forEach(function(p){if(p.id!==t.p)return;var q=toScreen(p.hx,p.hy);ctx.beginPath();ctx.arc(q.x,q.y,2.85*s,0,7);ctx.strokeStyle='rgba(131,242,143,.9)';ctx.lineWidth=2.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([])})});
 if(spec.cueZone){var z=spec.cueZone,zq=toScreen(z.x,z.y);ctx.beginPath();ctx.arc(zq.x,zq.y,z.r*s,0,7);ctx.fillStyle=result&&result.ok?'rgba(131,242,143,.45)':'rgba(131,242,143,.22)';ctx.fill();ctx.strokeStyle='rgba(131,242,143,.95)';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([])}
 if(spec.avoid)spec.avoid.forEach(function(n){spec.balls.forEach(function(b){if(String(b.n)!==String(n))return;var q=toScreen(b.x,b.y);ctx.beginPath();ctx.arc(q.x,q.y,(R+0.9)*s,0,7);ctx.strokeStyle='rgba(255,120,100,.8)';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([])})});
 if(anim==='idle'&&cueSpec()){
  if(opts.path&&preview)drawTrails(preview.trails,0.42,[4,5]);
  var ai=aimInfo(),A=toScreen(ai.cue.x,ai.cue.y),E=toScreen(ai.end.x,ai.end.y);
  ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(E.x,E.y);ctx.strokeStyle='rgba(255,189,105,.95)';ctx.lineWidth=1.6;ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);
  if(ai.ball){ctx.beginPath();ctx.arc(E.x,E.y,R*s,0,7);ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.4;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([])}
  spec.balls.forEach(function(b){if(!b.vx&&!b.vy)return;var q=toScreen(b.x,b.y),sp=Math.sqrt(b.vx*b.vx+b.vy*b.vy),e=toScreen(b.x+b.vx/sp*9,b.y+b.vy/sp*9);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(e.x,e.y);ctx.strokeStyle='#ffd27d';ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.arc(e.x,e.y,4,0,7);ctx.fillStyle='#ffd27d';ctx.fill()});
  drawStick(ai);
 }else if(opts.trails&&trails)drawTrails(trails,0.6);
 st.balls.forEach(function(b){if(b.active&&!(b.z>0))drawBall(b)});st.balls.forEach(function(b){if(b.active&&b.z>0)drawBall(b)});
 if(mode==='lab'&&anim!=='idle'){var cb=P.cueBall(st);if(cb&&cb.active){var sp2=Math.sqrt(cb.vx*cb.vx+cb.vy*cb.vy);if(sp2>2){var q2=toScreen(cb.x,cb.y),e2=toScreen(cb.x+cb.vx/sp2*(R+3),cb.y+cb.vy/sp2*(R+3));ctx.beginPath();ctx.moveTo(q2.x,q2.y);ctx.lineTo(e2.x,e2.y);ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2;ctx.stroke()}}}}
function drawStick(ai){var c=ai.cue,cu=spec.cue,e=(cu.elev||0)*Math.PI/180,fore=Math.max(0.2,Math.cos(e)),side=(cu.tipX||0)*0.5*R,px=ai.dir.y,py=-ai.dir.x;
 var bx=c.x-ai.dir.x*(R+0.8)+px*side,by=c.y-ai.dir.y*(R+0.8)+py*side,len=42*fore,ex=bx-ai.dir.x*len,ey=by-ai.dir.y*len,S1=toScreen(bx,by),S2=toScreen(ex,ey);
 var gr=ctx.createLinearGradient(S1.x,S1.y,S2.x,S2.y);gr.addColorStop(0,'#e8e2d0');gr.addColorStop(0.03,'#2a6fd1');gr.addColorStop(0.05,'#f2e6c8');gr.addColorStop(0.7,'#c99a5b');gr.addColorStop(1,'#3b2412');
 ctx.beginPath();ctx.moveTo(S1.x,S1.y);ctx.lineTo(S2.x,S2.y);ctx.strokeStyle=gr;ctx.lineCap='round';ctx.lineWidth=Math.max(3,view.s*0.55)*(1+(1-fore)*0.6);ctx.stroke();ctx.lineCap='butt';
 if(cu.elev>=3){ctx.font='bold 12px system-ui';ctx.fillStyle='#ffd27d';ctx.textAlign='center';ctx.fillText('↗ '+Math.round(cu.elev)+'°',S2.x,S2.y-8)}}
// ---------- words ----------
function pct(v){return Math.round(Math.abs(v)*100)+'%'}
function tipWords(c){var v=c.tipY||0,h=c.tipX||0,a=Math.abs(v)<0.08?'center':(v<0?'low (draw) ':'high (follow) ')+(Math.abs(v)<0.08?'':pct(v));var b=Math.abs(h)<0.08?'':', '+(h>0?'right':'left')+' English '+pct(h);return a+b}
function powerWords(p){return p<20?'soft':p<40?'medium-soft':p<60?'medium':p<80?'firm':'hard'}
function jumpHeight(c){var v0=P.cueSpeed(c.power),th=(c.elev||0)*Math.PI/180,vin=v0*Math.sin(th),offR=Math.sqrt((c.tipX||0)*(c.tipX||0)+(c.tipY||0)*(c.tipY||0))*P.CFG.maxOffset,vz=P.CFG.eSlate*Math.max(0,1-1.6*offR)*vin;return vz<6?0:vz*vz/(2*P.G)}
function effects(c){var out=[],h=c.tipX||0,v=c.tipY||0,e=c.elev||0,si=P.strikeInfo(c),side=h>0?'right':'left',other=h>0?'left':'right';
 if(v<-0.15)out.push(['Draw','backspin: on a straight hit the cue ball comes back toward you'+(v<-0.6?' (a lot)':'')]);
 else if(v>0.15)out.push(['Follow','topspin: the cue ball keeps rolling forward after contact']);
 else if(Math.abs(h)<0.15)out.push(['Center / stun','straight hit: cue ball stops; on a cut it leaves at 90°']);
 if(Math.abs(h)>=0.15){out.push([(h>0?'Right':'Left')+' English','squirts ≈'+Math.abs(si.squirtDeg).toFixed(1)+'° '+other+' of the aim line; off a rail it runs wider when the spin matches the travel (running), shorter when reverse']);
  if(e>=5&&e<35)out.push(['Elevated + English','swerve: curves back toward the '+side+' as it slides']);
  else if(e>=35)out.push(['Massé','steep cue + English: big hook to the '+side])}
 var jh=jumpHeight(c);if(e>=20&&Math.abs(h)<0.15){if(jh>D)out.push(['Jump','hops ≈'+jh.toFixed(1)+'″, enough to clear a ball']);else out.push(['Jump?','only ≈'+jh.toFixed(1)+'″ of hop; a ball is 2.25″, so use ~45°+ and more power'])}
 else if(e>=8&&e<20&&Math.abs(h)<0.15)out.push(['Elevated cue','slight hop; jacking up mostly matters with English (swerve)']);
 out.push(['Speed','≈'+(si.v0*0.0568).toFixed(1)+' mph ('+powerWords(c.power)+')']);
 return out}
// ---------- info card ----------
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function updateInfo(){var s=spec,o=orig,h='',title='',sum='';
 if(s.kind==='trick'){title='Shot';var stars='';for(var i=1;i<=5;i++)stars+=i<=o.difficulty?'★':'☆';sum=o.name;
  h+='<h2>'+esc(o.name)+'</h2><div><span class="stars">'+stars+'</span> <span class="muted">'+['','Easy','Moderate','Tricky','Hard','Expert'][o.difficulty]+'</span></div><p style="margin:6px 0">'+esc(o.desc)+'</p>';
  h+='<b>How to hit it</b><ol>'+o.how.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ol>';
  h+='<div class="facts"><b>Sink</b><span>'+o.targets.map(function(t){return 'the '+t.n+' → '+t.p}).join(', ')+'</span><b>Cue</b><span id="cueFacts"></span></div>';
  h+='<div class="goal" id="goalBox"></div>'}
 else if(s.kind==='lesson'||s.kind==='labfree'){title='Lab';sum=o.name;
  h+='<h2>'+esc(o.name)+'</h2><p style="margin:6px 0">'+esc(o.text)+'</p>';
  h+='<div class="spinrow"><canvas id="spinIcon" width="168" height="168"></canvas><div class="muted" id="spinText">Spin on the cue ball</div></div>';
  if(o.challenge)h+='<div class="goal" id="goalBox"></div>'}
 else{title='Free play';sum=o.name;h+='<h2>'+esc(o.name)+'</h2><p class="muted" style="margin:6px 0">Drag balls anywhere, drag on the cloth to aim, set the tip and stick angle in the Cue card, then Play. After each shot the balls stay where they stopped. ⟲ undoes the last shot; ☰ → Restore re-racks. Table size is in ☰.</p><div class="facts"><b>Balls left</b><span>'+s.balls.filter(function(b){return b.n!=='cue'}).length+'</span></div>'}
 if(modified&&mode!=='free')h+='<button class="smallbtn" id="origBtn2">↺ Restore original setup</button>';
 $('infoTitle').textContent=title;$('infoSum').textContent=sum;$('infoBody').innerHTML=h;var ob=$('origBtn2');if(ob)ob.onclick=restoreOriginal;updateGoal();updateCueFacts()}
function updateCueFacts(){var el=$('cueFacts');if(!el)return;var c=spec.cue,ai=cueSpec()?aimInfo():null;
 el.textContent=(ai&&ai.ball?'aim at the '+ai.ball.n+' ('+Math.round(ai.cut)+'° cut), ':'aim '+c.aim.toFixed(1)+'°, ')+tipWords(c)+', stick '+Math.round(c.elev||0)+'°, power '+c.power+'%'+(c.delay?', shoot '+c.delay.toFixed(2)+' s after the roll starts':'')}
function updateGoal(){var g=$('goalBox');if(!g)return;var txt,done=false;
 if(spec.kind==='lesson'){txt='🎯 Try it: '+spec.challenge;if(result){done=result.ok;txt+=result.ok?'  ✔ Done!':'  ✖ '+result.why[0]}}
 else{txt='Goal: sink '+spec.targets.map(function(t){return 'the '+t.n+' in '+t.p}).join(' and ')+(spec.avoid?' without touching the '+spec.avoid.join(', '):'')+(spec.cueZone?' and stop the cue ball on the green coin':'')+'.';if(result){done=result.ok;txt+=result.ok?'  ✔ Made it!':'  ✖ '+result.why[0]}}
 g.textContent=txt;g.className='goal'+(done?' done':'')}
function drawSpinIcon(){var c=$('spinIcon');if(!c)return;var g=c.getContext('2d'),cb=st?P.cueBall(st):null,w=c.width;g.clearRect(0,0,w,w);
 var M=cb&&anim!=='idle'?cb.M:[1,0,0,0,1,0,0,0,1],ww=anim!=='idle'&&cb?[cb.wx,cb.wy,cb.wz]:P.strikeInfo(spec.cue).w,vx,vy;
 if(cb&&anim!=='idle'&&(cb.vx||cb.vy)){vx=cb.vx;vy=cb.vy}else{var a=spec.cue.aim*Math.PI/180;vx=Math.cos(a);vy=Math.sin(a)}
 var vl=Math.sqrt(vx*vx+vy*vy)||1,dx=vx/vl,dy=vy/vl,top=(ww[0]*(-dy)+ww[1]*dx)*R,sideS=ww[2]*R,curl=(ww[0]*dx+ww[1]*dy)*R;
 paintBall(g,'cue',M,w/2,w/2,w*0.36,false);
 g.lineWidth=5;g.lineCap='round';var t=clamp(top/60,-1,1);if(Math.abs(t)>0.04){g.strokeStyle=t>0?'#83f28f':'#ff9c8a';g.beginPath();g.moveTo(w*0.12,w/2);g.lineTo(w*0.12,w/2-t*w*0.36);g.stroke();g.beginPath();g.moveTo(w*0.12-7,w/2-t*w*0.36+(t>0?8:-8));g.lineTo(w*0.12,w/2-t*w*0.36);g.lineTo(w*0.12+7,w/2-t*w*0.36+(t>0?8:-8));g.stroke()}
 var sd=clamp(sideS/60,-1,1);if(Math.abs(sd)>0.04){g.strokeStyle='#ffbd69';g.beginPath();var a0=-Math.PI/2,a1=a0-sd*Math.PI*0.9;g.arc(w/2,w/2,w*0.44,Math.min(a0,a1),Math.max(a0,a1));g.stroke()}
 var st2=$('spinText');if(st2){var txt=(top>3?'Topspin ':top<-3?'Backspin ':'No top/back ')+(Math.abs(top)>3?Math.round(Math.abs(top))+' in/s':'')+' · '+(Math.abs(sideS)>3?(sideS>0?'right':'left')+' spin '+Math.round(Math.abs(sideS)):'no side spin')+(Math.abs(curl)>3?' · curve spin '+Math.round(Math.abs(curl)):'');if(st2.textContent!==txt)st2.textContent=txt}}
// ---------- cue card ----------
function updateCue(){var c=spec.cue;$('power').value=c.power;$('powerVal').textContent=c.power+'%';$('aimVal').textContent=c.aim.toFixed(1)+'°';
 $('cueSum').textContent=tipWords(c).replace(' English',' Eng')+' · '+Math.round(c.elev||0)+'° · '+c.power+'%';
 $('effects').innerHTML=effects(c).map(function(f){return '<div class="fx"><b>'+esc(f[0])+':</b> '+esc(f[1])+'</div>'}).join('');drawTipPad();drawElevPad();updateCueFacts()}
function changed(){modified=true;if(anim!=='idle')resetSim();result=null;updateCue();updateGoal();computePreview();dirty=true;if(!$('origBtn2')&&mode!=='free')updateInfo()}
function drawTipPad(){var c=$('tipPad'),g=c.getContext('2d'),w=c.width,cx=w/2,cy=w/2,r=w*0.44;g.clearRect(0,0,w,w);
 var gr=g.createRadialGradient(cx-r*0.3,cy-r*0.35,r*0.1,cx,cy,r);gr.addColorStop(0,'#fff');gr.addColorStop(1,'#b5bfba');g.beginPath();g.arc(cx,cy,r,0,7);g.fillStyle=gr;g.fill();
 g.strokeStyle='rgba(60,80,70,.6)';g.lineWidth=2;g.setLineDash([6,6]);g.beginPath();g.moveTo(cx-r,cy);g.lineTo(cx+r,cy);g.moveTo(cx,cy-r);g.lineTo(cx,cy+r);g.stroke();
 g.strokeStyle='rgba(200,60,50,.65)';g.beginPath();g.arc(cx,cy,r*0.5,0,7);g.stroke();g.setLineDash([]);
 g.fillStyle='rgba(30,40,35,.75)';g.font='bold 20px system-ui';g.textAlign='center';g.fillText('follow',cx,cy-r*0.62);g.fillText('draw',cx,cy+r*0.75);g.fillText('L',cx-r*0.75,cy+7);g.fillText('R',cx+r*0.75,cy+7);
 var px=cx+(spec.cue.tipX||0)*r*0.5,py=cy-(spec.cue.tipY||0)*r*0.5;g.beginPath();g.arc(px,py,15,0,7);g.fillStyle='rgba(42,111,209,.95)';g.fill();g.strokeStyle='#fff';g.lineWidth=3;g.stroke()}
function drawElevPad(){var c=$('elevPad'),g=c.getContext('2d'),w=c.width,h=c.height,cx=w*0.68,r=w*0.17,cy=h*0.86-r,e=(spec.cue.elev||0)*Math.PI/180,b=(spec.cue.tipY||0)*0.5;g.clearRect(0,0,w,h);
 g.fillStyle='#145a33';g.fillRect(0,cy+r,w,h-cy-r);g.strokeStyle='#2c8a52';g.lineWidth=3;g.beginPath();g.moveTo(0,cy+r);g.lineTo(w,cy+r);g.stroke();
 var gr=g.createRadialGradient(cx-r*0.3,cy-r*0.35,r*0.1,cx,cy,r);gr.addColorStop(0,'#fff');gr.addColorStop(1,'#b5bfba');g.beginPath();g.arc(cx,cy,r,0,7);g.fillStyle=gr;g.fill();
 var ccx=Math.cos(e),ccy=Math.sin(e),ux=Math.sin(e),uy=-Math.cos(e),k=Math.sqrt(Math.max(0,1-b*b)),px=cx-k*r*ccx+b*r*ux,py=cy-k*r*ccy+b*r*uy;
 var ex=px-ccx*w*1.2,ey=py-ccy*w*1.2,sg=g.createLinearGradient(px,py,ex,ey);sg.addColorStop(0,'#2a6fd1');sg.addColorStop(0.04,'#f2e6c8');sg.addColorStop(0.6,'#c99a5b');sg.addColorStop(1,'#3b2412');
 g.strokeStyle=sg;g.lineWidth=12;g.lineCap='round';g.beginPath();g.moveTo(px-ccx*4,py-ccy*4);g.lineTo(ex,ey);g.stroke();g.lineCap='butt';
 g.strokeStyle='rgba(255,210,125,.8)';g.lineWidth=2;g.beginPath();g.arc(cx,cy+r,r*2.2,Math.PI,Math.PI+e,false);g.stroke();
 g.fillStyle='#ffd27d';g.font='bold 30px system-ui';g.textAlign='left';g.fillText(Math.round(spec.cue.elev||0)+'°',10,36);
 g.fillStyle='rgba(255,255,255,.55)';g.font='18px system-ui';g.fillText(spec.cue.elev<8?'level':spec.cue.elev<35?'swerve':spec.cue.elev<60?'jump / massé':'massé',10,62)}
function padPoint(c,e){var r=c.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*c.width,y:(e.clientY-r.top)/r.height*c.height}}
onDrag($('tipPad'),function(e){tipAt(e)},function(e){tipAt(e)},function(){computePreview(true)});
function tipAt(e){var c=$('tipPad'),p=padPoint(c,e),w=c.width,r=w*0.44*0.5,x=(p.x-w/2)/r,y=-(p.y-w/2)/r,m=Math.sqrt(x*x+y*y);if(m>1){x/=m;y/=m}
 if(Math.abs(x)<0.06)x=0;if(Math.abs(y)<0.06)y=0;spec.cue.tipX=Math.round(x*100)/100;spec.cue.tipY=Math.round(y*100)/100;changed()}
onDrag($('elevPad'),function(e){elevAt(e)},function(e){elevAt(e)},function(){computePreview(true)});
function elevAt(e){var c=$('elevPad'),p=padPoint(c,e),w=c.width,r=w*0.17,cx=w*0.68,cy=c.height*0.86-r,a=Math.atan2(cy-p.y,cx-p.x)*180/Math.PI;spec.cue.elev=Math.round(clamp(a,0,85));changed()}
$('power').addEventListener('input',function(){spec.cue.power=Number(this.value);changed()});
Array.prototype.forEach.call(document.querySelectorAll('[data-nudge]'),function(b){b.addEventListener('click',function(){spec.cue.aim=Math.round((spec.cue.aim+Number(b.getAttribute('data-nudge')))*100)/100;changed()})});
// ---------- generic drag helper (pointer events, touch/mouse fallback) ----------
function onDrag(el,start,move,end){var active=false;
 function s(e){if(start(e)===false)return false;active=true;return true}
 if(window.PointerEvent){el.addEventListener('pointerdown',function(e){if(e.button>0)return;if(!s(e))return;try{el.setPointerCapture(e.pointerId)}catch(x){}e.preventDefault()});
  el.addEventListener('pointermove',function(e){if(active){move(e);e.preventDefault()}});
  var up=function(e){if(active){active=false;end(e)}};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)}
 else{el.addEventListener('touchstart',function(e){if(s(e.touches[0]))e.preventDefault()},{passive:false});el.addEventListener('touchmove',function(e){if(active){move(e.touches[0]);e.preventDefault()}},{passive:false});el.addEventListener('touchend',function(e){if(active){active=false;end(e.changedTouches[0])}});
  el.addEventListener('mousedown',function(e){if(!s(e))return;var mm=function(ev){move(ev)},mu=function(ev){window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);active=false;end(ev)};window.addEventListener('mousemove',mm);window.addEventListener('mouseup',mu)})}}
// ---------- floating cards ----------
var cards={cue:{id:'cue',el:$('cueCard')},info:{id:'info',el:$('infoCard')}},layoutSaved={};
function orientKey(){return window.innerWidth>=window.innerHeight?'land':'port'}
function loadLayout(){layoutSaved=store('trick2.cards.'+orientKey())||{}}
function saveLayout(){var o={};for(var k in cards){var c=cards[k];o[k]={x:parseFloat(c.el.style.left)||0,y:parseFloat(c.el.style.top)||0,f:c.el.classList.contains('folded')}}layoutSaved=o;store('trick2.cards.'+orientKey(),o)}
function cardSaved(id){return !!layoutSaved[id]}
function clampCard(c){var bd=c.el.querySelector('.card-b'),top0=parseFloat(c.el.style.top)||0;if(bd)bd.style.maxHeight=Math.max(140,window.innerHeight-Math.max(4,top0)-56)+'px';var el=c.el,r=el.getBoundingClientRect(),x=parseFloat(el.style.left)||0,y=parseFloat(el.style.top)||0,vw=window.innerWidth,vh=window.innerHeight;
 x=clamp(x,4,Math.max(4,vw-r.width-4));y=clamp(y,4,Math.max(4,vh-r.height-4));el.style.left=Math.round(x)+'px';el.style.top=Math.round(y)+'px'}
function setFold(c,f,nosave){c.el.classList.toggle('folded',!!f);clampCard(c);if(!nosave)saveLayout()}
function defaultPos(id){var sr=stage.getBoundingClientRect(),small=window.innerHeight<560||window.innerWidth<560,land=window.innerWidth>=window.innerHeight;
 if(reserveRight()){if(id==='cue')return {x:sr.right-310,y:sr.top+8,f:false};return {x:sr.right-310,y:sr.top+8+cards.cue.el.offsetHeight+8,f:false}}
 if(id==='info')return {x:sr.left+8,y:sr.top+8,f:small};
 var f=small&&mode!=='lab';if(f)return {x:sr.right-190,y:sr.bottom-(land?52:120),f:true};
 return land?{x:sr.right-308,y:small?sr.top+8:sr.bottom-430,f:false}:{x:sr.right-308,y:sr.bottom-440,f:false}}
function placeCards(){loadLayout();for(var k in cards){var c=cards[k],p=layoutSaved[k]||defaultPos(k);c.el.classList.toggle('folded',!!p.f);c.el.style.left=Math.round(p.x)+'px';c.el.style.top=Math.round(p.y)+'px';clampCard(c)}}
Object.keys(cards).forEach(function(k){var c=cards[k],hd=c.el.querySelector('.card-h'),ox=0,oy=0,sx=0,sy=0,moved=false;
 c.el.querySelector('.fold').addEventListener('click',function(e){e.stopPropagation();setFold(c,true)});
 onDrag(hd,function(e){if(e.target&&e.target.closest&&e.target.closest('.fold'))return false;sx=e.clientX;sy=e.clientY;ox=parseFloat(c.el.style.left)||0;oy=parseFloat(c.el.style.top)||0;moved=false},
  function(e){var dx=e.clientX-sx,dy=e.clientY-sy;if(!moved&&Math.abs(dx)+Math.abs(dy)<6)return;moved=true;c.el.classList.add('dragging');c.el.style.left=(ox+dx)+'px';c.el.style.top=(oy+dy)+'px';clampCard(c)},
  function(){c.el.classList.remove('dragging');if(!moved){if(c.el.classList.contains('folded'))setFold(c,false);return}saveLayout()})});
// ---------- menu ----------
function closeMenu(){$('menu').hidden=true;$('menuBtn').setAttribute('aria-expanded','false')}
$('menuBtn').addEventListener('click',function(e){e.stopPropagation();var m=$('menu');m.hidden=!m.hidden;this.setAttribute('aria-expanded',String(!m.hidden))});
document.addEventListener('pointerdown',function(e){var m=$('menu');if(!m.hidden&&!m.contains(e.target)&&e.target!==$('menuBtn'))closeMenu()});
function saveOpts(){store('trick2.opts',opts)}
$('optTrails').checked=opts.trails;$('optPath').checked=opts.path;$('optSound').checked=opts.sound;$('optSlow').value=String(opts.slowSpeed);$('optSize').value=opts.size;
$('optTrails').addEventListener('change',function(){opts.trails=this.checked;saveOpts();dirty=true});
$('optPath').addEventListener('change',function(){opts.path=this.checked;saveOpts();dirty=true});
$('optSound').addEventListener('change',function(){opts.sound=this.checked;saveOpts();ensureAudio()});
$('optSlow').addEventListener('change',function(){opts.slowSpeed=Number(this.value);saveOpts();updateSlowBtn()});
$('optSize').addEventListener('change',function(){opts.size=this.value;saveOpts();if(mode==='free')setMode('free',item);else toast('Table size applies to Free play (trick shots and lessons are set up on a 9 ft table)','',4000)});
function restoreOriginal(){spec=clone(orig);modified=false;prevShot=null;resetSim();updateInfo();updateCue();computePreview(true);closeMenu()}
$('origBtn').addEventListener('click',restoreOriginal);
$('layoutBtn').addEventListener('click',function(){try{localStorage.removeItem('trick2.cards.land');localStorage.removeItem('trick2.cards.port')}catch(e){}layoutSaved={};placeCards();closeMenu();toast('Card layout reset','',2500)});
// ---------- top bar + strip ----------
$('modeSel').addEventListener('change',function(){setMode(this.value)});
$('itemSel').addEventListener('change',function(){loadItem(Number(this.value))});
$('prevBtn').addEventListener('click',function(){loadItem(item-1)});$('nextBtn').addEventListener('click',function(){loadItem(item+1)});
$('playBtn').addEventListener('click',function(){if(anim==='playing')pause();else play()});
$('resetBtn').addEventListener('click',resetAction);
function resetAction(){if(mode==='free'&&prevShot&&anim!=='idle'){spec=prevShot;prevShot=null}else if(mode==='free'&&prevShot&&anim==='idle'){spec=prevShot;prevShot=null}resetSim();updateInfo();computePreview(true);toast('','',0,true)}
$('slowBtn').addEventListener('click',function(){slow=!slow;updateSlowBtn()});
function updateSlowBtn(){var b=$('slowBtn');b.textContent=slow?(opts.slowSpeed+'×').replace('0.','.'):'1×';b.classList.toggle('on',slow)}
function updatePlayBtn(){var b=$('playBtn');b.textContent=anim==='playing'?'⏸':'▶';b.classList.toggle('pause',anim==='playing');b.setAttribute('aria-label',anim==='playing'?'Pause':'Play')}
$('rotateClose').addEventListener('click',function(){sessionStorage.setItem('trick2.rot','1');$('rotateHint').hidden=true});
function toast(msg,cls,ms,hide){var t=$('toast');clearTimeout(toastTimer);if(hide||!msg){t.className='';return}t.textContent=msg;t.className='show'+(cls?' '+cls:'');if(ms)toastTimer=setTimeout(function(){t.className=''},ms)}
// ---------- table input: drag balls, drag cloth to aim ----------
var drag=null;
function evWorld(e){var r=cv.getBoundingClientRect();return toWorld((e.clientX-r.left)*view.cw/r.width,(e.clientY-r.top)*view.ch/r.height)}
onDrag(cv,function(e){closeMenu();var w=evWorld(e),best=null,bd=R*2;spec.balls.forEach(function(b){var d=Math.sqrt((b.x-w.x)*(b.x-w.x)+(b.y-w.y)*(b.y-w.y));if(d<bd){bd=d;best=b}});
  if(anim!=='idle')resetSim();drag=best?{ball:best}:{aim:true};if(drag.aim)aimAt(w)},
 function(e){if(!drag)return;var w=evWorld(e);if(drag.ball){var b=drag.ball;b.x=clamp(w.x,R,L-R);b.y=clamp(w.y,R,W-R);
   spec.balls.forEach(function(o){if(o===b)return;var dx=b.x-o.x,dy=b.y-o.y,d=Math.sqrt(dx*dx+dy*dy);if(d<D+0.004&&d>1e-6){b.x=o.x+dx/d*(D+0.004);b.y=o.y+dy/d*(D+0.004)}});
   b.x=+b.x.toFixed(3);b.y=+b.y.toFixed(3);modified=true;resetSim();computePreview()}else aimAt(w)},
 function(){if(!drag)return;drag=null;changed();computePreview(true)});
function aimAt(w){var c=cueSpec();if(!c)return;if(Math.abs(w.x-c.x)+Math.abs(w.y-c.y)<0.6)return;spec.cue.aim=Math.round(Math.atan2(w.y-c.y,w.x-c.x)*18000/Math.PI)/100;modified=true;if(anim!=='idle')resetSim();updateCue();computePreview();dirty=true}
// ---------- sound ----------
function ensureAudio(){if(!opts.sound||audio)return;try{var AC=window.AudioContext||window.webkitAudioContext;if(AC)audio=new AC()}catch(e){}}
function playSounds(){var ev=st.events;if(!opts.sound||!audio){evIdx=ev.length;return}var now=audio.currentTime,count=0;
 for(;evIdx<ev.length;evIdx++){var e=ev[evIdx];if(count++>4)continue;var o=audio.createOscillator(),g=audio.createGain();o.type=e.type==='ball'?'triangle':'sine';o.frequency.value=e.type==='ball'?2200:e.type==='rail'?320:e.type==='cue'?900:e.type==='land'?180:140;
  var vol=Math.min(0.25,0.02+e.v/400);g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(0.0001,now+(e.type==='pocket'?0.25:0.06));o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+0.3)}}
// ---------- page-level gesture guards ----------
document.addEventListener('gesturestart',function(e){e.preventDefault()});
document.addEventListener('touchmove',function(e){var t=e.target;if(t&&t.closest&&(t.closest('.card-b')||t.closest('#menu')))return;e.preventDefault()},{passive:false});
document.addEventListener('keydown',function(e){if(e.target&&(e.target.tagName==='SELECT'||e.target.tagName==='INPUT'))return;if(e.key===' '){e.preventDefault();if(anim==='playing')pause();else play()}else if(e.key==='r'||e.key==='R')resetAction()});
var rt=0;function relayout(){clearTimeout(rt);rt=setTimeout(function(){layout()},120)}
window.addEventListener('resize',relayout);window.addEventListener('orientationchange',function(){setTimeout(layout,300)});
// ---------- test hook ----------
window.trickTest={shots:SHOTS.length,lessons:LESSONS.length,setMode:setMode,load:loadItem,play:play,pause:pause,reset:resetAction,
 runAll:function(){return SHOTS.map(function(s){var r=P.evaluate(s);return {id:s.id,name:s.name,ok:r.ok,why:r.why}})},
 runLessons:function(){return LESSONS.map(function(s){var r=P.evaluate(s);return {id:s.id,name:s.name,ok:r.ok,why:r.why}})},
 state:function(){return {mode:mode,item:item,anim:anim,t:st?st.t:0,maxZ:st?st.maxZ:0,pocketed:st?st.pocketed:[],result:result,modified:modified,portrait:view.portrait,canvas:[view.cw,view.ch]}},
 setSlow:function(v){slow=v;updateSlowBtn()},spec:function(){return spec},
 cards:function(){var o={};for(var k in cards){var r=cards[k].el.getBoundingClientRect();o[k]={x:r.left,y:r.top,w:r.width,h:r.height,folded:cards[k].el.classList.contains('folded')}}return o}};
// ---------- start ----------
var start=(location.hash||'').replace('#','');if(start!=='lab'&&start!=='free')start='trick';
mode=start;layout();setMode(start);placeCards();
window.addEventListener('hashchange',function(){var h=(location.hash||'').replace('#','');if((h==='trick'||h==='lab'||h==='free')&&h!==mode)setMode(h)});requestAnimationFrame(frame);
})();
