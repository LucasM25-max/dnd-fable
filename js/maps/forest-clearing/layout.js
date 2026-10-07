/* Forest clearing: the numbers that define this map's layout, shared by its terrain, flora, props
   and spawn logic. Units: 1 = 10cm. The origin is the centre of the playable square; +z is south. */
window.Fable=window.Fable||{};
(function(){
var FC=Fable.forestClearing=Fable.forestClearing||{};

/* half-extents of the playable square: 694 x 694 units (about 228 ft a side) */
FC.BOUNDS={x:347,z:347};

/* where the player starts: the south edge, on the open grass beside the start of the path.
   facing is the heading in radians (Math.PI = north, towards the outpost). */
FC.PLAYER_SPAWN={x:0,z:240,w:48,d:36,facing:Math.PI};

/* where enemies appear: open ground just south of the outpost gate, with the path running through it */
FC.ENEMY_SPAWNS=[{id:'outpost-front',x:110,z:-40,w:80,d:60}];

/* the ruined outpost is modelled around its own origin and shifted here */
FC.OUTPOST={x:70,z:-70};

/* winds from the south edge, past the player spawn, up to the outpost gate */
var PATH=[[0,352],[-4,300],[0,262],[6,225],[40,170],[80,115],[104,60],[116,10],[122,-50],[124,-86],[124,-106]];
FC.pathDist=function(x,z){var m=1e9;for(var i=0;i<PATH.length-1;i++){var a=PATH[i],b=PATH[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));m=Math.min(m,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return m};

/* Woods only fill a ragged band around the edge of the square; the middle is open grass.
   Returns how far (in units) the point is inside the woods: positive = in the trees, negative = open. */
FC.woodIn=function(x,z){var B=FC.BOUNDS,m=Math.min(B.x-Math.abs(x),B.z-Math.abs(z));
  return 44+12*Math.sin(x*.031+z*.02+1)+8*Math.sin(z*.07-x*.05)-m};

/* Ground that scenery must keep clear of, on top of the spawn zones (which the world builder handles):
   the dirt path and the outpost footprint. p = padding around the object being placed. */
FC.isReserved=function(x,z,p){
  if(FC.pathDist(x,z)<8+p)return true;
  var o=FC.OUTPOST;
  return x>12+o.x-p&&x<92+o.x+p&&z>-72+o.z-p&&z<-8+o.z+p;
};
})();
