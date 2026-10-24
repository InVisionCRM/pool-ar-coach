/* Pool Trick Shot physics: deterministic fixed-timestep engine (inches, seconds).
   Table coords: x 0..L along the long rail, y 0..W, y up. Works in browsers and Node. */
(function(root){
'use strict';
var R=1.125,D=2*R,G=386.09;
var CFG={L:100,W:50,R:R,muS:0.2,muR:0.015,spinDecay:10,eBall:0.95,muBall:0.06,eCush:0.78,muCush:0.2,dt:0.001,cornerMouth:3.6,sideMouth:2.6};
function pocketList(L,W){return [
 {id:'P1',x:0,y:W,cx:-1.2,cy:W+1.2,r:2.1,corner:true,hx:-1.2,hy:W+1.2},{id:'P2',x:L/2,y:W,cx:L/2,cy:W+2.3,r:2.3,corner:false,hx:L/2,hy:W+2.2},{id:'P3',x:L,y:W,cx:L+1.2,cy:W+1.2,r:2.1,corner:true,hx:L+1.2,hy:W+1.2},
 {id:'P4',x:L,y:0,cx:L+1.2,cy:-1.2,r:2.1,corner:true,hx:L+1.2,hy:-1.2},{id:'P5',x:L/2,y:0,cx:L/2,cy:-2.3,r:2.3,corner:false,hx:L/2,hy:-2.2},{id:'P6',x:0,y:0,cx:-1.2,cy:-1.2,r:2.1,corner:true,hx:-1.2,hy:-1.2}]}
// Cushion noses and pocket jaws as line segments; balls collide when their centre comes within R of a segment.
function cushionSegments(L,W){var c=CFG.cornerMouth,s=CFG.sideMouth,S=[];
 function seg(ax,ay,bx,by){S.push({ax:ax,ay:ay,bx:bx,by:by})}
 seg(c,0,L/2-s,0);seg(L/2+s,0,L-c,0);seg(c,W,L/2-s,W);seg(L/2+s,W,L-c,W);seg(0,c,0,W-c);seg(L,c,L,W-c);
 // corner jaws: from the cushion point to the edge of the pocket hole (about 40 degrees off the rail)
 var J1=1.15,J2=2.05;
 seg(c,0,J1,-J2);seg(0,c,-J2,J1);seg(L-c,0,L-J1,-J2);seg(L,c,L+J2,J1);
 seg(c,W,J1,W+J2);seg(0,W-c,-J2,W-J1);seg(L-c,W,L-J1,W+J2);seg(L,W-c,L+J2,W-J1);
 // side pocket jaws (slightly narrowing toward the hole)
 seg(L/2-s,0,L/2-s+0.25,-1.35);seg(L/2+s,0,L/2+s-0.25,-1.35);seg(L/2-s,W,L/2-s+0.25,W+1.35);seg(L/2+s,W,L/2+s-0.25,W+1.35);
 return S}
function createState(balls,opts){opts=opts||{};var L=opts.L||CFG.L,W=opts.W||CFG.W;
 var st={L:L,W:W,t:0,balls:[],pockets:pocketList(L,W),segs:cushionSegments(L,W),orient:!!opts.orient,events:[],pocketed:[],firstHit:null,cushionHits:0,stopped:true,onStep:null,stepCount:0};
 for(var i=0;i<balls.length;i++){var b=balls[i];st.balls.push({n:b.n,x:b.x,y:b.y,vx:0,vy:0,wx:0,wy:0,wz:0,active:true,pocket:null,M:[1,0,0,0,1,0,0,0,1],rails:0})}
 return st}
function cueBall(st){for(var i=0;i<st.balls.length;i++)if(st.balls[i].n==='cue')return st.balls[i];return null}
// power 0..100, side/vert -1..1 (fraction of the max safe tip offset, 0.5 R), masse -1..1 (curve right/left)
function cueSpeed(power){return 12+288*power/100}
function strike(st,aimDeg,power,side,vert,masse){var b=cueBall(st);if(!b)return;var a=aimDeg*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),v0=cueSpeed(power);
 var off=0.5*R,sa=(side||0)*off,sb=(vert||0)*off,k=5*v0/(2*R*R);
 b.vx=v0*dx;b.vy=v0*dy;b.wx=-dy*k*sb;b.wy=dx*k*sb;b.wz=-k*sa;
 if(masse){var ls=masse*v0*0.9;b.wx+=ls*dx/R;b.wy+=ls*dy/R}
 st.stopped=false;st.t=0;st.firstHit=null}
function rotateM(M,wx,wy,wz,dt){var ax=wx*dt,ay=wy*dt,az=wz*dt,o=M.slice();
 for(var c=0;c<3;c++){var x=o[c],y=o[3+c],z=o[6+c];M[c]=x+(ay*z-az*y);M[3+c]=y+(az*x-ax*z);M[6+c]=z+(ax*y-ay*x)}}
function orthonorm(M){var c0=[M[0],M[3],M[6]],c1=[M[1],M[4],M[7]];var n=Math.hypot(c0[0],c0[1],c0[2]);c0=[c0[0]/n,c0[1]/n,c0[2]/n];var d=c0[0]*c1[0]+c0[1]*c1[1]+c0[2]*c1[2];
 c1=[c1[0]-d*c0[0],c1[1]-d*c0[1],c1[2]-d*c0[2]];n=Math.hypot(c1[0],c1[1],c1[2]);c1=[c1[0]/n,c1[1]/n,c1[2]/n];var c2=[c0[1]*c1[2]-c0[2]*c1[1],c0[2]*c1[0]-c0[0]*c1[2],c0[0]*c1[1]-c0[1]*c1[0]];
 M[0]=c0[0];M[3]=c0[1];M[6]=c0[2];M[1]=c1[0];M[4]=c1[1];M[7]=c1[2];M[2]=c2[0];M[5]=c2[1];M[8]=c2[2]}
function step(st){var dt=CFG.dt,B=st.balls,i,j,b,moving=false,kS=CFG.muS*G*dt,kR=CFG.muR*G*dt;
 for(i=0;i<B.length;i++){b=B[i];if(!b.active)continue;
  var ux=b.vx-R*b.wy,uy=b.vy+R*b.wx,us=Math.sqrt(ux*ux+uy*uy),sp=Math.sqrt(b.vx*b.vx+b.vy*b.vy);
  if(us>1e-3){moving=true;
   if(us<=3.5*kS){b.vx-=ux/3.5;b.vy-=uy/3.5;b.wx=-b.vy/R;b.wy=b.vx/R}
   else{var fx=ux/us,fy=uy/us;b.vx-=kS*fx;b.vy-=kS*fy;b.wx-=2.5/R*kS*fy;b.wy+=2.5/R*kS*fx}
  }else if(sp>0){moving=true;if(sp<=kR){b.vx=0;b.vy=0}else{var f=(sp-kR)/sp;b.vx*=f;b.vy*=f}b.wx=-b.vy/R;b.wy=b.vx/R}
  if(b.wz!==0){var dz=CFG.spinDecay*dt*(sp>0?1:3);if(Math.abs(b.wz)<=dz)b.wz=0;else b.wz-=dz*(b.wz>0?1:-1)}
  if(st.orient&&(b.wx||b.wy||b.wz)){rotateM(b.M,b.wx,b.wy,b.wz,dt);if((st.stepCount&63)===0)orthonorm(b.M)}
  b.x+=b.vx*dt;b.y+=b.vy*dt}
 // ball-ball: iterative impulses so frozen chains and simultaneous contacts resolve
 var CT=D+0.01;
 for(var pass=0;pass<12;pass++){var any=false;
  for(i=0;i<B.length;i++){var a=B[i];if(!a.active)continue;for(j=i+1;j<B.length;j++){b=B[j];if(!b.active)continue;
   var dx=b.x-a.x,dy=b.y-a.y;if(dx>CT||dx<-CT||dy>CT||dy<-CT)continue;var d2=dx*dx+dy*dy;if(d2>=CT*CT)continue;var d=Math.sqrt(d2)||1e-9,nx=dx/d,ny=dy/d;
   if(pass===0&&d<D){var ov=(D-d)/2+1e-4;a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov}
   var vr=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(vr<=1e-6)continue;
   var J=(1+CFG.eBall)/2*vr;a.vx-=J*nx;a.vy-=J*ny;b.vx+=J*nx;b.vy+=J*ny;
   var tx=-ny,ty=nx,s=(a.vx-b.vx)*tx+(a.vy-b.vy)*ty+R*(a.wz+b.wz);if(Math.abs(s)>1e-6){var Jt=-(s>0?1:-1)*Math.min(CFG.muBall*J,Math.abs(s)/7);a.vx+=Jt*tx;a.vy+=Jt*ty;b.vx-=Jt*tx;b.vy-=Jt*ty;a.wz+=2.5*Jt/R;b.wz+=2.5*Jt/R}
   any=true;moving=true;if(!st.firstHit&&(a.n==='cue'||b.n==='cue'))st.firstHit=a.n==='cue'?b.n:a.n;
   if(J>2)st.events.push({type:'ball',t:st.t,v:J})}}
  if(!any)break}
 // cushions
 var S=st.segs;
 for(i=0;i<B.length;i++){b=B[i];if(!b.active)continue;
  if(b.x>R+0.05&&b.x<st.L-R-0.05&&b.y>R+0.05&&b.y<st.W-R-0.05)continue;
  for(j=0;j<S.length;j++){var sg=S[j],ex=sg.bx-sg.ax,ey=sg.by-sg.ay,l2=ex*ex+ey*ey,t=((b.x-sg.ax)*ex+(b.y-sg.ay)*ey)/l2;t=t<0?0:t>1?1:t;
   var qx=sg.ax+ex*t,qy=sg.ay+ey*t,cx=b.x-qx,cy=b.y-qy,dd=cx*cx+cy*cy;if(dd>=R*R)continue;var dl=Math.sqrt(dd)||1e-9,nx2=cx/dl,ny2=cy/dl;
   b.x=qx+nx2*R;b.y=qy+ny2*R;var vn=b.vx*nx2+b.vy*ny2;if(vn>=0)continue;
   var Jn=-(1+CFG.eCush)*vn;b.vx+=Jn*nx2;b.vy+=Jn*ny2;var tx2=-ny2,ty2=nx2,s2=b.vx*tx2+b.vy*ty2-R*b.wz;
   if(Math.abs(s2)>1e-6){var Jt2=-(s2>0?1:-1)*Math.min(CFG.muCush*Jn,Math.abs(s2)/3.5);b.vx+=Jt2*tx2;b.vy+=Jt2*ty2;b.wz-=2.5*Jt2/R}
   var rx=R*b.wy,ry=-R*b.wx,rn=rx*nx2+ry*ny2;rx-=rn*nx2;ry-=rn*ny2;b.wy=rx/R;b.wx=-ry/R;
   b.rails++;st.cushionHits++;moving=true;if(Jn>3)st.events.push({type:'rail',t:st.t,v:Jn})}}
 // pockets
 for(i=0;i<B.length;i++){b=B[i];if(!b.active)continue;var out=b.x<-0.5||b.y<-0.5||b.x>st.L+0.5||b.y>st.W+0.5,P=st.pockets,hit=null,bd=1e9;
  for(j=0;j<P.length;j++){var p=P[j],ddx=b.x-p.cx,ddy=b.y-p.cy,dc=Math.sqrt(ddx*ddx+ddy*ddy);if(dc<p.r){hit=p;break}if(out){var dp=Math.hypot(b.x-p.x,b.y-p.y);if(dp<bd){bd=dp;hit=p}}}
  if(hit&&(out||Math.hypot(b.x-hit.cx,b.y-hit.cy)<hit.r)){b.active=false;b.pocket=hit.id;b.vx=b.vy=b.wx=b.wy=b.wz=0;st.pocketed.push({n:b.n,pocket:hit.id,t:st.t});st.events.push({type:'pocket',t:st.t,v:10})}}
 st.t+=dt;st.stepCount++;if(!moving)st.stopped=true;if(st.onStep)st.onStep(st);return moving}
function run(st,maxT){maxT=maxT||25;while(!st.stopped&&st.t<maxT)step(st);return st}
var api={CFG:CFG,R:R,D:D,createState:createState,strike:strike,step:step,run:run,cueBall:cueBall,cueSpeed:cueSpeed,pocketList:pocketList,cushionSegments:cushionSegments};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PoolPhysics=api;
})(this);
