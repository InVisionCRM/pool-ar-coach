// Run: node tests/trick-shots.test.js  — simulates every library shot with the same engine the page uses
var P=require('../physics.js'),SHOTS=require('../shots.js');var fails=0;
SHOTS.forEach(function(s){var st=P.createState(s.balls);P.strike(st,s.aim,s.power,s.side,s.vert,s.masse);var cr=null;st.onStep=function(x){if(cr===null&&x.firstHit!==null)cr=P.cueBall(x).rails};P.run(st,25);
 var ok=true,why=[];s.targets.forEach(function(t){var pk=st.pocketed.filter(function(x){return String(x.n)===String(t.n)})[0];if(!pk||pk.pocket!==t.p){ok=false;why.push(t.n+' not in '+t.p)}});
 if(st.pocketed.some(function(x){return x.n==='cue'})){ok=false;why.push('scratch')}
 if(s.firstHit!==undefined&&st.firstHit!==s.firstHit){ok=false;why.push('first hit '+st.firstHit)}
 if(s.cueRails!==undefined&&cr!==s.cueRails){ok=false;why.push('cue rails '+cr)}
 if(s.objRails)for(var k in s.objRails){var b=st.balls.filter(function(x){return String(x.n)===k})[0];if(b.rails!==s.objRails[k]){ok=false;why.push(k+' rails '+b.rails)}}
 if(!ok)fails++;console.log((ok?'PASS ':'FAIL ')+s.id+' - '+s.name+(why.length?' ('+why.join(', ')+')':''))});
console.log(SHOTS.length-fails+'/'+SHOTS.length+' shots pass');process.exit(fails?1:0);
