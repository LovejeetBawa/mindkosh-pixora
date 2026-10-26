'use strict';
const $=id=>document.getElementById(id), STORE='mindkosh.pixora.tutor.v3';
let data={version:3,lesson:0,drill:0,sound:true,sessions:{}};
let storageOK=true;
try{const saved=localStorage.getItem(STORE);if(saved)data=validate(JSON.parse(saved));}catch(e){storageOK=false;}
let virtualShift=false,virtualCaps=false,continueEnterHeld=false;
let running=false,startedAt=0,clock=null,audio=null,toastTimer=null;
const fingerNames={'left-little':'Left little finger','left-ring':'Left ring finger','left-middle':'Left middle finger','left-index':'Left index finger','left-thumb':'Left thumb','right-thumb':'Right thumb','right-index':'Right index finger','right-middle':'Right middle finger','right-ring':'Right ring finger','right-little':'Right little finger'};
function fresh(){return{typed:'',attempts:0,correctAttempts:0,mistakes:0,elapsed:0,done:false,best:null};}
function session(){const k=data.lesson+':'+data.drill;return data.sessions[k]||(data.sessions[k]=fresh());}
function target(){return COURSE[data.lesson].drills[data.drill];}
function elapsed(){return session().elapsed+(running?performance.now()-startedAt:0);}
function validate(raw){
 if(!raw||raw.version!==3||!Number.isInteger(raw.lesson)||raw.lesson<0||raw.lesson>=COURSE.length||!Number.isInteger(raw.drill)||raw.drill<0||raw.drill>2||typeof raw.sound!=='boolean'||!raw.sessions||Array.isArray(raw.sessions)||typeof raw.sessions!=='object')throw Error('Invalid progress file');
 const out={version:3,lesson:raw.lesson,drill:raw.drill,sound:raw.sound,volume:Number.isFinite(raw.volume)?Math.max(0,Math.min(1,raw.volume)):.65,sessions:{}};
 for(const [k,v]of Object.entries(raw.sessions)){
  if(!/^\d{1,2}:[0-2]$/.test(k))throw Error('Invalid drill');const [l,d]=k.split(':').map(Number);if(!COURSE[l])throw Error('Invalid lesson');
  if(!v||typeof v.typed!=='string'||v.typed.length>COURSE[l].drills[d].length||!Number.isFinite(v.elapsed)||v.elapsed<0||v.elapsed>1e12||![v.attempts,v.correctAttempts,v.mistakes].every(n=>Number.isSafeInteger(n)&&n>=0)||v.correctAttempts+v.mistakes!==v.attempts||v.attempts<v.typed.length||typeof v.done!=='boolean'||(v.done&&v.typed.length!==COURSE[l].drills[d].length))throw Error('Invalid practice data');
  let best=null;if(v.best!==null&&v.best!==undefined){if(!Number.isFinite(v.best.wpm)||v.best.wpm<0||!Number.isFinite(v.best.accuracy)||v.best.accuracy<0||v.best.accuracy>100)throw Error('Invalid result');best={wpm:v.best.wpm,accuracy:v.best.accuracy};}
  out.sessions[k]={typed:v.typed,elapsed:v.elapsed,attempts:v.attempts,correctAttempts:v.correctAttempts,mistakes:v.mistakes,done:v.done,best};
 }return out;
}
function save(){try{const copy=JSON.parse(JSON.stringify(data));if(running)copy.sessions[data.lesson+':'+data.drill].elapsed=elapsed();localStorage.setItem(STORE,JSON.stringify(copy));storageOK=true;}catch(e){storageOK=false;} $('save-status').textContent=storageOK?'Saved on this browser. Export a backup to keep a copy.':'Browser saving is unavailable. Export a backup before closing.';}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
async function unlockAudio(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error();if(!audio)audio=new Audio();if(audio.state!=='running')await audio.resume();if(audio.state==='running')await loadRecordedSounds();return audio.state==='running';}catch(e){$('sound-hint').textContent='Audio unavailable in this browser.';return false;}}
const recordedBuffers={};let recordedLoading=null,lastRecordedSound=null;
async function loadRecordedSounds(){
 if(recordedLoading)return recordedLoading;
 recordedLoading=Promise.all(Object.entries(TYPEWRITER_RECORDINGS).map(async([key,value])=>{
  const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));recordedBuffers[key]=await audio.decodeAudioData(bytes.buffer);
 })).then(()=>{$('sound-hint').textContent='Recorded typewriter ready · key / Space / bell + return';return true;}).catch(()=>{$('sound-hint').textContent='Recorded audio could not load. Check your browser audio support.';return false;});
 return recordedLoading;
}
function playRecording(name,delay=0,rate=1,volume=1){
 const buffer=recordedBuffers[name];if(!buffer)return;
 const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=(data.volume??.65)*volume;source.connect(gain);gain.connect(audio.destination);source.onended=()=>{source.disconnect();gain.disconnect();};source.start(audio.currentTime+delay);lastRecordedSound=name;
}
function clickSound(key){
 if(!data.sound)return;
 if(!audio||audio.state!=='running'){unlockAudio().then(ok=>{if(ok)clickSound(key);});return;}
 if(!recordedBuffers.key1){loadRecordedSounds().then(ok=>{if(ok)clickSound(key);});return;}
 if(key==='Enter'){playRecording('bell',0,1,.65);playRecording('return',.04,1,.8);}
 else if(key===' ')playRecording('space');
 else if(key==='Shift')playRecording('shift',0,1,.65);
 else if(key==='Backspace'||key==='Delete')playRecording('key2',0,.85,.85);
 else playRecording(Math.random()<.5?'key1':'key2',0,.98+Math.random()*.04);
}
function buildKeyboard(){for(const row of KEY_ROWS){const r=document.createElement('div');r.className='key-row';for(const [key,secondary,weight]of row){const el=document.createElement('button');el.type='button';el.tabIndex=-1;el.setAttribute('aria-label',key===' '?'Space':key);el.className='key'+(weight?' wide':'')+(key===' '?' space':'');el.dataset.key=key;el.dataset.finger=key===' '?'right-thumb':key==='Enter'?'right-little':key.startsWith('Shift')?(key==='ShiftLeft'?'left-little':'right-little'):key.length===1?keyGuide(key).finger:'';if(weight)el.style.flex=weight;const label=document.createElement('span');label.textContent=key===' '?'Space':key.startsWith('Shift')?'Shift':key.endsWith('Right')?key.replace('Right',''):key;el.append(label);if(secondary){const s=document.createElement('span');s.className='secondary';s.textContent=secondary;el.append(s);}el.addEventListener('pointerdown',e=>e.preventDefault());el.onclick=()=>virtualKey(key,secondary);r.append(el);}$('keyboard').append(r);}

 const positions={'left-little':[170,239],'left-ring':[295,122],'left-middle':[401,65],'left-index':[514,125],'left-thumb':[687,435],'right-thumb':[986,435],'right-index':[1165,126],'right-middle':[1274,65],'right-ring':[1381,122],'right-little':[1504,240]};
 for(const [finger,[x,y]] of Object.entries(positions)){
  const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.dataset.finger=finger;g.setAttribute('class','finger');
  const halo=document.createElementNS(ns,'ellipse');halo.setAttribute('cx',x);halo.setAttribute('cy',y);halo.setAttribute('rx','43');halo.setAttribute('ry','56');
  const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','25');
  const text=document.createElementNS(ns,'text');text.setAttribute('x',x);text.setAttribute('y',y+9);text.setAttribute('text-anchor','middle');
  g.append(halo,dot,text);$('hand-highlights').append(g);
 }

}
function guide(){const s=session(),char=target()[s.typed.length];document.querySelectorAll('.key.next,.key.shift').forEach(el=>el.classList.remove('next','shift'));document.querySelectorAll('.finger.active').forEach(el=>el.classList.remove('active','shift-finger'));if(char===undefined){$('next-key').textContent='Drill complete ✓';$('finger-name').textContent='Drill complete';$('finger-tip').textContent='Continue to the next drill.';return;}const g=keyGuide(char);document.querySelectorAll('.key').forEach(el=>{if(el.dataset.key===g.key)el.classList.add('next');if(el.dataset.key===g.shift)el.classList.add('shift');});document.querySelectorAll('.finger').forEach(el=>{if(el.dataset.finger===g.finger||(g.shift&&el.dataset.finger===(g.shift==='ShiftLeft'?'left-little':'right-little'))){el.classList.add('active');const shiftFinger=el.dataset.finger!==g.finger;el.classList.toggle('shift-finger',shiftFinger);el.querySelector('text').textContent=shiftFinger?'⇧':g.key===' '?'␣':g.key==='Enter'?'↵':g.label;}});$('next-key').textContent=(g.shift?'Shift + ':'')+g.label;$('finger-name').textContent=fingerNames[g.finger];$('finger-tip').textContent=g.shift?'Hold '+(g.shift==='ShiftLeft'?'left':'right')+' Shift with your little finger.':char===' '?'Either thumb works. This guide uses the right thumb.':'Return to the home row after each key.';}
function renderPassage(){const s=session(),frag=document.createDocumentFragment();[...target()].forEach((c,i)=>{const el=document.createElement('span');el.textContent=c==='\n'?'↵\n':c;el.className=i<s.typed.length?(s.typed[i]===c?'correct':'incorrect'):i===s.typed.length?'cursor':'';frag.append(el);});$('passage').replaceChildren(frag);const cursor=$('passage').querySelector('.cursor');if(cursor){const p=$('passage');if(cursor.offsetTop-p.offsetTop>p.scrollTop+p.clientHeight-35)p.scrollTop=cursor.offsetTop-p.offsetTop-50;else if(cursor.offsetTop-p.offsetTop<p.scrollTop)p.scrollTop=Math.max(0,cursor.offsetTop-p.offsetTop-20);}}
function updateStats(){const s=session(),ms=elapsed(),m=calculate(s.typed,target(),s.attempts,s.correctAttempts,ms);$('wpm').textContent=m.wpm;$('accuracy').textContent=m.accuracy===null?'—':m.accuracy+'%';$('mistakes').textContent=s.mistakes;const seconds=Math.floor(ms/1000);$('time').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');$('progress').textContent=s.typed.length+' / '+target().length;const fraction=s.typed.length/target().length;$('chart-label').textContent=Math.round(fraction*100)+'% of this drill';$('progress-chart').setAttribute('aria-label',Math.round(fraction*100)+' percent of current drill typed');[...$('progress-chart').children].forEach((bar,i)=>bar.classList.toggle('filled',fraction>i/12));}
function courseProgress(){let complete=0;for(const v of Object.values(data.sessions))if(v.done||v.best)complete++;$('course-bar').style.width=complete/60*100+'%';$('course-status').textContent=complete+' / 60 drills completed · '+Math.round(complete/60*100)+'%';}
function renderLessons(){const frag=document.createDocumentFragment();COURSE.forEach((l,i)=>{const completed=l.drills.filter((_,d)=>(data.sessions[i+':'+d]?.done||data.sessions[i+':'+d]?.best)).length;const b=document.createElement('button');b.className='lesson-link'+(i===data.lesson?' active':'')+(completed===3?' done':'');b.setAttribute('aria-current',i===data.lesson?'step':'false');const num=document.createElement('span');num.className='lesson-num';num.textContent=completed===3?'✓':String(i+1).padStart(2,'0');const info=document.createElement('span');const name=document.createElement('strong');name.textContent=l.title;const small=document.createElement('small');small.textContent=l.keys+' · '+completed+'/3';info.append(name,small);b.append(num,info);b.onclick=()=>selectLesson(i);frag.append(b);});$('lessons').replaceChildren(frag);courseProgress();}
function render(){const l=COURSE[data.lesson],s=session();$('lesson-label').textContent='LESSON '+String(data.lesson+1).padStart(2,'0')+' / 20 · '+l.keys;$('lesson-title').textContent=l.title;$('lesson-tip').textContent=l.tip;$('lesson-count').textContent='Lesson '+(data.lesson+1)+' of 20';$('previous').disabled=data.lesson===0;$('next').disabled=data.lesson===19;
 $('drill-tabs').replaceChildren();l.drills.forEach((_,d)=>{const b=document.createElement('button');b.textContent='Drill '+(d+1)+((data.sessions[data.lesson+':'+d]?.done||data.sessions[data.lesson+':'+d]?.best)?' ✓':'');b.className=d===data.drill?'selected':'';b.setAttribute('aria-pressed',String(d===data.drill));b.onclick=()=>{pause();if(data.drill!==d){data.drill=d;resetAttempt();}save();render();};$('drill-tabs').append(b);});
 $('typing').value=s.done?'':s.typed;$('typing').disabled=false;$('typing').readOnly=!running;$('typing').placeholder=s.done?'Press Enter for the next drill, or click here to retry…':'Click here and start typing…';$('start').disabled=running;$('start').textContent=s.done?'Start again →':s.typed.length?'Resume drill →':'Start drill →';$('pause').disabled=!running;$('state').textContent=s.done?'DRILL COMPLETE':running?'PRACTICE IN PROGRESS':s.typed.length?'PAUSED · PROGRESS SAVED':'READY WHEN YOU ARE';$('best').textContent=s.best?'BEST: '+s.best.wpm+' WPM · '+s.best.accuracy+'%':'';$('sound').textContent=data.sound?'♪ Typewriter on':'♪ Typewriter off';$('sound').setAttribute('aria-pressed',String(data.sound));$('volume').value=Math.round((data.volume??.65)*100);$('result').hidden=!s.done;
 if(s.done){const m=calculate(s.typed,target(),s.attempts,s.correctAttempts,s.elapsed);$('result').replaceChildren();const msg=document.createElement('strong');msg.textContent='Drill complete! '+m.wpm+' WPM · '+m.accuracy+'% accuracy · '+s.mistakes+' mistakes.';const p=document.createElement('div');p.textContent=(m.accuracy>=95?'Nice control. ':'You can retry to improve accuracy. ')+(data.lesson===19&&data.drill===2?'Final drill completed. Choose a lesson to review.':'Press Enter to start the next drill.');const b=document.createElement('button');b.textContent=data.drill<2?'Continue to drill '+(data.drill+2)+' →':data.lesson<19?'Next lesson →':'Course overview ✓';b.onclick=()=>advanceDrill(true);$('result').append(msg,p,b);}
 renderPassage();guide();updateStats();renderLessons();}
function selectLesson(i){pause();data.lesson=i;data.drill=COURSE[i].drills.findIndex((_,d)=>!(data.sessions[i+':'+d]?.done||data.sessions[i+':'+d]?.best));if(data.drill===-1)data.drill=0;resetAttempt();save();render();}
function begin(){if(running)return;if(session().done)resetAttempt();unlockAudio();running=true;startedAt=performance.now();clock=setInterval(()=>{updateStats();save();},1000);render();$('typing').focus();caret();}
function pause(){if(running){session().elapsed=elapsed();running=false;clearInterval(clock);save();}render();}
function caret(){const input=$('typing');input.setSelectionRange(input.value.length,input.value.length);}
function insert(text){if(!running)return;const s=session(),t=target();const input=$('typing');if(input.selectionEnd>input.selectionStart){s.typed=s.typed.slice(0,input.selectionStart)+s.typed.slice(input.selectionEnd);}for(const c of text){if(s.typed.length>=t.length)break;const right=c===t[s.typed.length];s.attempts++;s.correctAttempts+=right?1:0;s.mistakes+=right?0:1;s.typed+=c;}
 $('typing').value=s.typed;caret();renderPassage();guide();updateStats();const m=calculate(s.typed,t,s.attempts,s.correctAttempts,elapsed());$('feedback').textContent=m.wrong?m.wrong+' uncorrected '+(m.wrong===1?'character':'characters')+'. Use Backspace to correct.':'Steady pace. Keep your eyes on the practice text.';
 if(s.typed.length===t.length){s.elapsed=elapsed();running=false;clearInterval(clock);s.done=true;const score=calculate(s.typed,t,s.attempts,s.correctAttempts,s.elapsed);if(!s.best||score.accuracy>s.best.accuracy||(score.accuracy===s.best.accuracy&&score.wpm>s.best.wpm))s.best={wpm:score.wpm,accuracy:score.accuracy};save();render();}else save();}
function backspace(){
 if(!running&&session().done){toast('Use Restart drill to edit a completed attempt.');return;}
 if(!running)return;
 const s=session(),input=$('typing'),start=input.selectionStart,end=input.selectionEnd;
 // Delete removes the selection, or the previous character at the typing caret.
 if(end>start)s.typed=s.typed.slice(0,start)+s.typed.slice(end);else s.typed=s.typed.slice(0,-1);
 input.value=s.typed;caret();renderPassage();guide();updateStats();save();
}
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented)return;
 if(e.key==='Enter'&&continueEnterHeld){e.preventDefault();return;}
 if(e.key==='Enter'&&session().done&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(e.target===$('typing')||e.target===$('passage')||e.target===document.body||$('result').contains(e.target))){e.preventDefault();if(!e.repeat){continueEnterHeld=true;advanceDrill(true);}return;}
 if(!running)return;if(e.target!==$('typing')&&e.target.closest('button,input,select,textarea,a,[contenteditable]'))return;if(e.ctrlKey||e.metaKey||e.altKey){if(['v','x','z','y'].includes(e.key.toLowerCase()))e.preventDefault();return;}
 if(e.key==='Tab'){return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();return;}
 if(e.key==='Enter'){pressFeedback('Enter',target()[session().typed.length]==='\n');e.preventDefault();clickSound('Enter');insert('\n');}else if(e.key==='Backspace'||e.key==='Delete'){pressFeedback('Backspace',true);e.preventDefault();clickSound('Backspace');backspace();}else if(e.key.length===1){pressFeedback(e.key,e.key===target()[session().typed.length]);e.preventDefault();clickSound(e.key);insert(e.key);}else if(e.key==='Shift')clickSound('Shift');
 const physical=e.code.startsWith('Shift')?e.code:e.key==='Enter'||e.key==='Backspace'||e.key==='Delete'?(e.key==='Delete'?'Backspace':e.key):e.code==='Space'?' ':e.code.startsWith('Key')?e.code.slice(3).toLowerCase():keyGuide(e.key).key;
 document.querySelectorAll('.key').forEach(el=>{if(el.dataset.key===physical){el.classList.add('pressed');setTimeout(()=>el.classList.remove('pressed'),85);}});
});
$('typing').addEventListener('beforeinput',e=>{e.preventDefault();if(!running)return;if(e.inputType==='deleteContentBackward'||e.inputType==='deleteContentForward'||e.inputType==='deleteByCut'){pressFeedback('Backspace',true);clickSound('Backspace');backspace();}else if(e.inputType==='insertText'&&e.data&&e.data.length===1){pressFeedback(e.data,e.data===target()[session().typed.length]);clickSound(e.data);insert(e.data);}else if(e.inputType==='insertLineBreak'){clickSound('Enter');insert('\n');}else toast('Type each character to practice. Paste and word suggestions are disabled.');});
['paste','drop'].forEach(event=>$('typing').addEventListener(event,e=>{e.preventDefault();toast('Type each character yourself for accurate practice.');}));
$('typing').addEventListener('click',()=>{if(!running)begin();});$('passage').onclick=()=>{if(!running&&!session().done)begin();else restoreTypingFocus();};window.addEventListener('blur',()=>{if(running)pause();});$('passage').addEventListener('keydown',e=>{if(!running&&!session().done&&(e.key==='Enter'||e.key===' ')){e.preventDefault();begin();}});
$('start').onclick=begin;$('pause').onclick=pause;$('restart').onclick=()=>{if(session().typed&&!session().done&&!confirm('Restart this drill? Your current attempt will be reset.'))return;pause();const best=session().best,done=session().done;data.sessions[data.lesson+':'+data.drill]=fresh();session().best=best;save();render();$('feedback').textContent=done?'Ready for another attempt. Your best score is kept.':'Fresh start. Aim for smooth, accurate typing.';};
$('previous').onclick=()=>selectLesson(data.lesson-1);$('next').onclick=()=>selectLesson(data.lesson+1);
$('sound').onclick=async()=>{data.sound=!data.sound;save();render();restoreTypingFocus();if(data.sound){await unlockAudio();clickSound('a');}};
$('test-sound').onclick=async()=>{if(!data.sound){toast('Turn sound on first.');restoreTypingFocus();return;}restoreTypingFocus();if(await unlockAudio()){clickSound('a');setTimeout(()=>clickSound(' '),240);setTimeout(()=>clickSound('Enter'),530);toast('Key → Space → Enter. Check device volume if silent.');}else toast('Audio could not start. Check browser audio settings.');};
$('export').onclick=()=>{pause();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mindkosh-typing-tutor-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Progress backup exported.');};
$('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1000000)throw Error();const next=validate(JSON.parse(await file.text()));if(!confirm('Replace this browser’s tutor progress with this backup?'))return;pause();data=next;save();render();toast('Backup imported. Resume any saved drill.');}catch(err){toast('This is not a valid V3 tutor progress backup. Nothing was changed.');}finally{e.target.value='';}};
$('clear').onclick=()=>{if(!confirm('Reset every lesson and saved score? Export a backup first if needed.'))return;pause();data={version:3,lesson:0,drill:0,sound:data.sound,sessions:{}};save();render();toast('Course progress reset.');};
window.addEventListener('pagehide',()=>{if(running){session().elapsed=elapsed();running=false;}save();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause();});
for(let i=0;i<12;i++){const bar=document.createElement('span');bar.style.height=(14+i*6)+'px';$('progress-chart').append(bar);}buildKeyboard();render();save();

$('focus').onclick=()=>{const focused=document.body.classList.toggle('focused');$('focus').textContent=focused?'Exit focus':'Focus view';$('focus').setAttribute('aria-pressed',String(focused));restoreTypingFocus();};

$('volume').oninput=e=>{data.volume=Number(e.target.value)/100;save();};

$('coach-next').onclick=()=>advanceDrill(true);

function restoreTypingFocus(){if(running){$('typing').focus({preventScroll:true});caret();}}
$('volume').addEventListener('change',restoreTypingFocus);
function pressFeedback(key,correct){
 const g=key==='Backspace'?{key:'Backspace',finger:'right-little'}:keyGuide(key==='Enter'?'\n':key);
 document.querySelectorAll('.key').forEach(el=>{if(el.dataset.key===g.key){el.classList.remove('key-hit','key-error');void el.offsetWidth;el.classList.add(correct?'key-hit':'key-error');setTimeout(()=>el.classList.remove('key-hit','key-error'),200);}});
 document.querySelectorAll('.finger').forEach(el=>{if(el.dataset.finger===g.finger){el.classList.remove('tapped','tap-error');void el.getBoundingClientRect();el.classList.add('tapped');el.classList.toggle('tap-error',!correct);setTimeout(()=>el.classList.remove('tapped','tap-error'),240);}});
 $('last-key').textContent=(key===' '?'Space':key)+' · '+(correct?'✓':'mistake');
}
function virtualKey(key,shifted){
 if(key.startsWith('Shift')){virtualShift=!virtualShift;document.querySelectorAll('.key').forEach(el=>el.classList.toggle('held',el.dataset.key.startsWith('Shift')&&virtualShift));unlockAudio().then(()=>clickSound('Shift'));restoreTypingFocus();return;}
 if(key==='Caps'){virtualCaps=!virtualCaps;document.querySelectorAll('.key').forEach(el=>el.classList.toggle('held',el.dataset.key==='Caps'&&virtualCaps));restoreTypingFocus();return;}
 if(['Tab','Ctrl','CtrlRight','Alt','AltRight'].includes(key)){toast('Use letters, numbers, Space, Enter or Backspace for this course.');restoreTypingFocus();return;}
 if(session().done){toast('Drill complete. Choose Next drill or Restart.');return;}
 if(!running)begin();else unlockAudio();
 let char=key==='Enter'?'\n':key;if(key.length===1){if(/[a-z]/.test(key))char=virtualShift!==virtualCaps?key.toUpperCase():key;else if(virtualShift&&shifted)char=shifted;}
 pressFeedback(key==='Enter'?'Enter':key==='Backspace'?'Backspace':char,key==='Backspace'||char===target()[session().typed.length]);
 if(key==='Backspace')backspace();else insert(char);
 if(virtualShift){virtualShift=false;document.querySelectorAll('.key').forEach(el=>el.classList.remove('held'));}
 unlockAudio().then(()=>clickSound(key==='Enter'?'Enter':char));restoreTypingFocus();
}

$('clear-text').onclick=()=>{const s=session();if(s.done){s.done=false;}s.typed='';save();render();if(!running)begin();else restoreTypingFocus();$('feedback').textContent='Text cleared. Start typing again; previous attempts remain in your accuracy score.';};

function resetAttempt(){const best=session().best;data.sessions[data.lesson+':'+data.drill]=fresh();session().best=best;}
function advanceDrill(autoStart=false){
 if(data.lesson===19&&data.drill===2){toast('Final drill completed. Choose a lesson to practice again.');return false;}
 pause();if(data.drill<2)data.drill++;else{data.lesson++;data.drill=0;}
 resetAttempt();$('last-key').textContent='Physical keyboard or click the keys below';
 $('feedback').textContent='New drill. Type the highlighted text.';save();render();if(autoStart)begin();return true;
}
document.addEventListener('keyup',e=>{if(e.key==='Enter')continueEnterHeld=false;});
window.addEventListener('blur',()=>{continueEnterHeld=false;});
