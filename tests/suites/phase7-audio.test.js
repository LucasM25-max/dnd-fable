'use strict';
const assert=require('assert'),H=require('../harness');

/* The audio engine against a fake Web Audio context: every sound recipe in the content renders without error, voices are capped,
   the mixer follows the settings, and mute silences the master bus. */
function fakeCtx(){
  const made={osc:0,src:0,gain:0,filt:0};
  const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(v){this.value=v},cancelScheduledValues(){}});
  const node=(extra)=>Object.assign({connect(){},disconnect(){},start(){},stop(){}},extra);
  const ctx={currentTime:0,sampleRate:8000,state:'running',destination:node(),
    resume(){this.state='running'},suspend(){this.state='suspended'},close(){},
    createGain(){made.gain++;return node({gain:param()})},
    createOscillator(){made.osc++;return node({frequency:param(),detune:param(),type:''})},
    createBufferSource(){made.src++;return node({buffer:null,loop:false})},
    createBiquadFilter(){made.filt++;return node({frequency:param(),Q:param(),type:''})},
    createDynamicsCompressor(){return node({threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()})},
    createStereoPanner(){return node({pan:param()})},
    createBuffer(c,l){return {getChannelData(){return new Float32Array(l)}}}};
  return {ctx,made};
}
module.exports=function({suite,test}){
  suite('phase 7 audio',()=>{
    async function make(settings){
      const C=await H.loadData({presentation:true});
      H.runFile('js/rules/rng.js');H.runFile('js/presentation/audio.js');
      const f=fakeCtx(),vals=Object.assign({volMaster:.8,volMusic:.5,volSfx:.9,volVoice:.8,mute:false},settings||{});
      const listeners=[];
      const S={get:k=>vals[k],onChange:fn=>{listeners.push(fn);return()=>{}},set:(k,v)=>{vals[k]=v;listeners.forEach(l=>l(k,v))}};
      const a=Fable.createAudio({settings:S,ctxFactory:()=>f.ctx,autoUnlock:false});
      return {C,a,f,S};
    }
    test('every sound recipe plays without error and builds nodes',async()=>{
      const {C,a,f}=await make();
      a.unlock();
      C.sounds.list().filter(s=>s.kind!=='bed').forEach(s=>{const h=a.play(s.id,{text:'hello there'});assert.ok(h,s.id);assert.ok(h.end>0)});
      assert.ok(f.made.osc>10&&f.made.src>5);
    });
    test('nothing plays before unlock when the context is suspended; unlock resumes it',async()=>{
      const {a,f}=await make();
      a.unlock();f.ctx.state='suspended';
      assert.strictEqual(a.play('sfx-hit'),null);
      a.unlock();assert.ok(a.play('sfx-hit'));
    });
    test('voices are capped and an important sound still gets through a full mixer',async()=>{
      const {a,f}=await make();
      a.unlock();
      let ok=0;for(let i=0;i<60;i++)if(a.play('sfx-step'))ok++;
      assert.ok(a.stats().voices<=28);
      assert.ok(a.play('sfx-crit'),'a priority 4 sound replaces a footstep');
    });
    test('mute and volumes drive the bus gains',async()=>{
      const {a,S}=await make();
      a.unlock();
      const b=a.buses();
      assert.ok(Math.abs(b.master.gain.value-.64)<1e-6);
      S.set('mute',true);assert.strictEqual(b.master.gain.value,0);
      S.set('mute',false);S.set('volSfx',.5);assert.ok(Math.abs(b.sfx.gain.value-.25)<1e-6);
    });
    test('the combat bed starts and stops, and intensity is clamped',async()=>{
      const {a}=await make();
      a.unlock();
      assert.ok(a.music.start('bed-combat'));assert.ok(a.music.running());
      a.music.setIntensity(3);assert.strictEqual(a.music.intensity(),1);
      a.music.pump();a.music.stop(0);assert.ok(!a.music.running());
      assert.strictEqual(a.music.start('no-such-bed'),false);
    });
    test('note names convert to frequencies',async()=>{
      await make();
      assert.ok(Math.abs(Fable.audioNoteFreq('A4')-440)<.01);assert.ok(Math.abs(Fable.audioNoteFreq('C4')-261.63)<.05);assert.strictEqual(Fable.audioNoteFreq(123),123);
    });
  });
};
