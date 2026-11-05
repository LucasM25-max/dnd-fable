/* Where the stones of the tavern's back wall go (pure maths, so the Node tests can check that the masonry fits).

   The wall is built in courses (rows) of stones. An opening (the window, the fireplace) takes a rectangle out of the wall; a course
   that crosses it is laid in separate runs, and each run is cut so its first and last stone end exactly on the edge of the opening.
   Joints are staggered from course to course, and no stone is ever narrower than MIN or wider than MAX.

   Fable.tavernLayout.WALL                      {x0, x1, courses, courseH, nominal}
   Fable.tavernLayout.OPENINGS                  [{id, x0, x1, y0, y1}]  the holes in the wall (the window frame, the fireplace)
   Fable.tavernLayout.runs(course)              [[x0, x1]]  the stretches of wall a course has, after the openings
   Fable.tavernLayout.stones(course)            [{x0, x1}]  the stones of one course, tiling every run exactly
   Fable.tavernLayout.all()                     [{course, y0, y1, x0, x1}] every stone of the wall */
(function(G){
G.Fable=G.Fable||{};
var L=Fable.tavernLayout={};
L.WALL={x0:-48,x1:48,courses:11,courseH:4,nominal:6};
/* the window frame is 12.8 wide and 14.2 tall (tavern.js); the firebox is 18 wide and its mantel sits at 13.3 */
L.OPENINGS=[
  {id:'window',x0:23.1,x1:35.9,y0:12.9,y1:27.1},
  {id:'fireplace',x0:-9,x1:9,y0:0,y1:12}
];
var MIN=2,MAX=6.4;
L.MIN=MIN;L.MAX=MAX;

function band(c){return [c*L.WALL.courseH,(c+1)*L.WALL.courseH]}
L.runs=function(c){
  var b=band(c),W=L.WALL,cuts=[];
  L.OPENINGS.forEach(function(o){if(o.y1>b[0]+.001&&o.y0<b[1]-.001)cuts.push([o.x0,o.x1])});
  cuts.sort(function(a,z){return a[0]-z[0]});
  var runs=[],x=W.x0;
  cuts.forEach(function(k){if(k[0]>x)runs.push([x,k[0]]);x=Math.max(x,k[1])});
  if(x<W.x1)runs.push([x,W.x1]);
  return runs;
};
/* joints every `nominal`, shifted half a stone on every other course; a joint too close to a run's end is dropped so no sliver is made */
L.stones=function(c){
  var W=L.WALL,out=[],shift=(c%2)?W.nominal/2:0;
  L.runs(c).forEach(function(r){
    var joints=[r[0]],k=Math.ceil((r[0]-W.x0-shift)/W.nominal);
    for(var x=W.x0+shift+k*W.nominal;x<r[1]-.001;x+=W.nominal){
      if(x>r[0]+MIN-.001&&x<r[1]-MIN+.001)joints.push(x);
    }
    joints.push(r[1]);
    for(var i=0;i<joints.length-1;i++)out.push({x0:joints[i],x1:joints[i+1]});
  });
  return out;
};
L.all=function(){
  var out=[];
  for(var c=0;c<L.WALL.courses;c++){
    var b=band(c);
    L.stones(c).forEach(function(s){out.push({course:c,y0:b[0],y1:b[1],x0:s.x0,x1:s.x1})});
  }
  return out;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
