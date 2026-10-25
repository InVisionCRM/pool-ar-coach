// Node test: every trick shot and Cue Lab lesson must achieve its goal in the physics engine.  Run: node tests/trick-shots.test.js
var P=require('../physics.js'),S=require('../shots.js'),fails=0,n=0;
function check(kind,o){n++;var r=P.evaluate(o);console.log((r.ok?'PASS ':'FAIL ')+kind+' '+o.id+' - '+o.name+(r.ok?'':' ('+r.why.join('; ')+')'));if(!r.ok)fails++}
S.shots.forEach(function(o){check('shot  ',o)});
S.lessons.forEach(function(o){check('lesson',o)});
// physics sanity: squirt, swerve, jump and massé behave in the expected directions
function cueEnd(o,balls){var st=P.createState(balls||[{n:'cue',x:20,y:25}]);P.strike(st,o);var early=null,at60=null;st.onStep=function(s){var c=P.cueBall(s);if(s.stepCount===150)early=c.y;if(at60===null&&c.x>=60)at60=c.y};P.run(st,20);var c=P.cueBall(st);return {x:c.x,y:c.y,early:early,at60:at60,maxZ:st.maxZ}}
function expect(name,cond){n++;console.log((cond?'PASS ':'FAIL ')+'physics '+name);if(!cond)fails++}
expect('right English squirts left',cueEnd({aim:0,power:30,tipX:1}).early>25.05);
expect('elevated right English swerves right',cueEnd({aim:0,power:30,tipX:1,elev:15}).at60<25-0.5);
expect('center-ball 45° stroke jumps higher than a ball',cueEnd({aim:0,power:50,elev:45}).maxZ>P.D);
expect('level stroke does not jump',cueEnd({aim:0,power:80}).maxZ===0);
expect('draw comes back',cueEnd({aim:0,power:40,tipY:-1},[{n:'cue',x:20,y:25},{n:1,x:40,y:25}]).x<20);
console.log((n-fails)+'/'+n+' checks pass ('+S.shots.length+' shots, '+S.lessons.length+' lessons)');
if(fails)process.exit(1);
