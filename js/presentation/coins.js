/* Coin drops (implementation plan, section 17.5). When a creature is defeated, coins burst from where it fell, sized by its share of
   the gold; they tumble, bounce and settle on the ground, and when the fight is won every coin flies to the hero and is collected.

   var coins = Fable.createCoins({scene, rng, reduced: function(){ return bool }, onSound: function(id, x, z){}})
   coins.drop(pos, cp, {tags})        a burst at pos {x, z} worth cp copper (the number of coins follows the amount)
   coins.collect(target, onCoin)      every coin on the ground flies to target {x, y, z}; onCoin(index, count) runs as each lands.
                                      Returns how many seconds the whole collection takes
   coins.update(dt)   coins.count()   coins.settle()   put every coin on the ground now (a skip)   coins.clear()   coins.dispose()
   The creature's `treasure` tags set the look: "hoard" coins come in larger gold pieces, anything else in the usual mix. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

var GOLD=0xf0b94d,SILVER=0xcfd6dc,COPPER=0xb8703a,SHINE=0xfff0a0,MAX_COINS=60;

Fable.createCoins=function(o){
  var T=G.THREE||(typeof THREE!=='undefined'?THREE:null);
  var scene=o.scene,rng=o.rng||Math.random,reduced=o.reduced||function(){return false},sound=o.onSound||function(){};
  var list=[],geo=null,rim={},shine=null,disposed=false;
  if(T){
    geo=new T.BoxGeometry(2.4,.7,2.4);
    shine=new T.BoxGeometry(1.5,.78,1.5);
    [GOLD,SILVER,COPPER].forEach(function(c){rim[c]=new T.MeshBasicMaterial({color:c})});
    rim.shine=new T.MeshBasicMaterial({color:SHINE});
  }
  function make(metal){
    var g=new T.Group();
    var a=new T.Mesh(geo,rim[metal]),b=new T.Mesh(shine,rim.shine);
    a.renderOrder=3;b.renderOrder=4;g.add(a);g.add(b);
    return g;
  }
  function metalFor(v){return v>=100?GOLD:v>=10?SILVER:COPPER}

  var api={
    drop:function(pos,cp,opts){
      if(!T||disposed||!(cp>0))return 0;
      opts=opts||{};
      var values=Fable.rewards?Fable.rewards.pieces(cp):[cp],hoard=(opts.tags||[]).indexOf('hoard')>=0;
      var room=MAX_COINS-list.length;
      if(room<=0)return 0;
      values=values.slice(0,room);
      values.forEach(function(v,i){
        var m=make(hoard?GOLD:metalFor(v)),ang=rng()*Math.PI*2,sp=reduced()?0:14+rng()*22,rad=reduced()?2+rng()*5:0;
        scene.add(m);
        var c={mesh:m,v:v,x:pos.x+Math.sin(ang)*rad,y:reduced()?.45:7+rng()*5,z:pos.z+Math.cos(ang)*rad,vx:Math.sin(ang)*sp,vy:reduced()?0:30+rng()*30,vz:Math.cos(ang)*sp,
          spin:(rng()*2-1)*14,tilt:rng()*Math.PI,yaw:rng()*Math.PI,delay:reduced()?0:i*.025+rng()*.05,state:reduced()?'rest':'fly',bounces:0,t:0,fly:null};
        m.position.set(c.x,c.y,c.z);m.visible=false;
        list.push(c);
      });
      sound(values.length>2?'sfx-coins':'sfx-coin',pos.x,pos.z);
      return values.length;
    },
    /* every coin that lies on the ground flies to the target, one after another, shrinking as it arrives */
    collect:function(target,onCoin){
      var n=list.length,k=0;
      if(!n)return 0;
      list.forEach(function(c,i){
        c.state='collect';c.fly={t:-(i*.045),dur:.55+rng()*.2,fx:c.x,fy:Math.max(.4,c.y),fz:c.z,tx:target.x,ty:target.y+(rng()*2-1)*2,tz:target.z,arc:7+rng()*6,idx:i};
        c.onLand=function(){k++;if(onCoin)onCoin(k,n);sound('sfx-coin-tick',target.x,target.z)};
        c.mesh.visible=true;
      });
      return (n-1)*.045+.8;
    },
    update:function(dt){
      if(!T||disposed)return;
      dt=Math.min(dt,.05);
      for(var i=list.length-1;i>=0;i--){
        var c=list[i],m=c.mesh;
        if(c.state==='fly'){
          if(c.delay>0){c.delay-=dt;continue}
          m.visible=true;
          c.vy-=150*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;c.tilt+=c.spin*dt;
          m.position.set(c.x,c.y,c.z);m.rotation.set(c.tilt,c.yaw,c.tilt*.6);
          if(c.y<=.45&&c.vy<0){
            c.y=.45;
            if(c.bounces<2){c.bounces++;c.vy=-c.vy*.38;c.vx*=.55;c.vz*=.55;c.spin*=.5;sound('sfx-coin',c.x,c.z)}
            else{c.state='rest';m.rotation.set(0,c.yaw,0);m.position.set(c.x,c.y,c.z)}
          }
        }else if(c.state==='rest'){
          c.t+=dt;m.visible=true;
          /* a slow glint across the face of each coin so they catch the eye */
          var g=.5+.5*Math.sin(c.t*2.2+c.yaw*5);m.children[1].visible=g>.2;
        }else if(c.state==='collect'){
          var f=c.fly;f.t+=dt;if(f.t<0)continue;
          var u=Math.min(1,f.t/f.dur),e=u*u*(3-2*u);
          m.position.set(f.fx+(f.tx-f.fx)*e,f.fy+(f.ty-f.fy)*e+Math.sin(u*Math.PI)*f.arc,f.fz+(f.tz-f.fz)*e);
          m.rotation.y+=dt*16;var sc=1-.55*u;m.scale.set(sc,sc,sc);
          if(u>=1){scene.remove(m);list.splice(i,1);if(c.onLand)c.onLand()}
        }
      }
    },
    count:function(){return list.length},
    settle:function(){
      list.forEach(function(c){if(c.state==='fly'){c.state='rest';c.y=.45;c.mesh.rotation.set(0,c.yaw,0);c.mesh.position.set(c.x,.45,c.z);c.mesh.visible=true}});
    },
    clear:function(){list.forEach(function(c){scene.remove(c.mesh)});list.length=0},
    dispose:function(){api.clear();disposed=true;[geo,shine].forEach(function(g){if(g)g.dispose()});Object.keys(rim).forEach(function(k){rim[k].dispose()})}
  };
  return api;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
