/* Kita · ביקור הגברת הזקנה – deck controller (adapted from the Kita deck framework):
   navigation (keys, click, swipe, hash), fullscreen, phase timer, teacher notes behind code 1010 + presenter window,
   expandable cards, "who said it" quiz, answer annotations toggle, Hebrew read-aloud (TTS). */
(function(){
"use strict";
var $=function(s,r){return (r||document).querySelector(s);},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
var PFX="kitaGveret";
var slides=$$(".slide"),cur=-1,N=slides.length;
var bc=null;try{bc=new BroadcastChannel("kita-gveret-zkena");}catch(e){}

/* ---------- navigation ---------- */
function idx(key){if(key==null||key==="")return -1;var n=parseInt(key,10);if(String(n)===String(key))return Math.max(0,Math.min(N-1,n-1));for(var i=0;i<N;i++)if(slides[i].id===key)return i;return -1;}
function go(i){
  i=Math.max(0,Math.min(N-1,i));if(i===cur)return;
  slides.forEach(function(s,k){var on=k===i;s.classList.toggle("active",on);s.setAttribute("aria-hidden",on?"false":"true");if(on){s.removeAttribute("inert");}else{s.setAttribute("inert","");}});
  cur=i;var s=slides[i];
  $("#counter").textContent=(i+1)+" / "+N;$("#bar").style.width=((i+1)/N*100)+"%";
  $("#prev").disabled=i===0;$("#next").disabled=i===N-1;
  $("#phase").textContent=s.getAttribute("data-phase")||"";
  $("#announce").textContent="שקופית "+(i+1)+" מתוך "+N+": "+(s.getAttribute("aria-label")||"");
  try{history.replaceState(null,"","#"+s.id);}catch(e){}
  s.scrollTop=0;fit(s);
  timerSlide();renderNotes();
  try{localStorage.setItem(PFX+"Slide",s.id);}catch(e){}
  if(bc)try{bc.postMessage({slide:s.id,n:i+1});}catch(e){}
  stopTTS();
}
/* auto-fit: on wide screens shrink the active slide's content (CSS zoom) so it fits without scrolling; phones keep scrolling */
function fit(s){s=s||slides[cur];if(!s)return;s.style.removeProperty("--z");if(innerWidth<=720||!("zoom" in document.body.style))return;
  var z=1;while(s.scrollHeight>s.clientHeight+2&&z>0.7){z=Math.round((z-0.03)*100)/100;s.style.setProperty("--z",z);}}
var fitT=null;addEventListener("resize",function(){clearTimeout(fitT);fitT=setTimeout(function(){fit();},120);});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){fit();});
function next(){go(cur+1);}function prev(){go(cur-1);}
$("#next").addEventListener("click",next);$("#prev").addEventListener("click",prev);
document.addEventListener("keydown",function(e){
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey)return;
  if($("#gate").open)return;
  var t=e.target,tag=(t.tagName||"").toLowerCase();
  if(tag==="input"||tag==="textarea"||tag==="select"||t.isContentEditable)return;
  var onCtrl=tag==="button"||tag==="a"||tag==="summary";
  switch(e.key){
    case "ArrowRight":case "ArrowDown":case "PageDown":next();e.preventDefault();break;   /* same as Kita decks + most clickers */
    case "ArrowLeft":case "ArrowUp":case "PageUp":prev();e.preventDefault();break;
    case " ":case "Enter":if(onCtrl)return;next();e.preventDefault();break;
    case "Home":go(0);e.preventDefault();break;
    case "End":go(N-1);e.preventDefault();break;
    case "f":case "F":case "כ":toggleFS();break;
    case "n":case "N":case "מ":openNotes();break;
  }
});
var NONAV="button,a,input,label,select,textarea,summary,details,table,.card,.ans,.exam,.ws,.quote,[data-nonav]";
$("#deck").addEventListener("click",function(e){
  var pt=e.pointerType;if(pt&&pt!=="mouse")return;
  if(e.target.closest(NONAV))return;
  var sel=window.getSelection&&getSelection();if(sel&&!sel.isCollapsed)return;
  next();
});
var tx=null,ty=0,tt=0;
$("#deck").addEventListener("touchstart",function(e){if(e.target.closest("input,textarea")){tx=null;return;}tx=e.touches[0].clientX;ty=e.touches[0].clientY;tt=Date.now();},{passive:true});
$("#deck").addEventListener("touchend",function(e){if(tx==null)return;var dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;tx=null;
  /* RTL book feel: finger moving left→right (dx>0) = next */
  if(Math.abs(dx)>50&&Math.abs(dx)>1.5*Math.abs(dy)&&Date.now()-tt<900){if(dx>0)next();else prev();}},{passive:true});
document.addEventListener("click",function(e){var a=e.target.closest("[data-goto]");if(!a)return;var i=idx(a.getAttribute("data-goto"));if(i>=0){e.preventDefault();go(i);}});
addEventListener("hashchange",function(){var i=idx(location.hash.slice(1));if(i>=0)go(i);});
function toggleFS(){try{if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(){});}else{document.exitFullscreen();}}catch(e){}}
$("#fs-btn").addEventListener("click",toggleFS);
if(!document.documentElement.requestFullscreen)$("#fs-btn").hidden=true;

/* ---------- phase timer ---------- */
var tLeft=0,tRun=null,tBtn=$("#timer-btn"),tOut=$("#timer-out");
function fmt(sec){sec=Math.max(0,Math.round(sec));return Math.floor(sec/60)+":"+("0"+sec%60).slice(-2);}
function timerSlide(){if(tRun)return;var m=parseFloat(slides[cur].getAttribute("data-min")||"0");tLeft=m*60;tOut.textContent=fmt(tLeft);tBtn.classList.remove("done");tBtn.disabled=!m;tBtn.setAttribute("aria-label",m?("הפעלת שעון של "+m+" דקות לשקופית"):"אין שעון בשקופית הזו");}
tBtn.addEventListener("click",function(){
  if(tRun){clearInterval(tRun);tRun=null;tBtn.classList.remove("running");return;}
  if(tLeft<=0)timerSlide();var end=Date.now()+tLeft*1000;tBtn.classList.add("running");tBtn.classList.remove("done");
  tRun=setInterval(function(){tLeft=(end-Date.now())/1000;tOut.textContent=fmt(tLeft);if(tLeft<=0){clearInterval(tRun);tRun=null;tBtn.classList.remove("running");tBtn.classList.add("done");}},250);
});
$("#timer-reset").addEventListener("click",function(){if(tRun){clearInterval(tRun);tRun=null;}tBtn.classList.remove("running","done");timerSlide();});

/* ---------- reveal buttons + expandable cards ---------- */
$$("[data-reveal]").forEach(function(b){b.addEventListener("click",function(){var box=document.getElementById(b.getAttribute("data-reveal")),open=box.hidden;box.hidden=!open;b.setAttribute("aria-expanded",open?"true":"false");});});
$$(".char,.sym").forEach(function(b){b.setAttribute("aria-expanded","false");b.addEventListener("click",function(){b.setAttribute("aria-expanded",b.getAttribute("aria-expanded")==="true"?"false":"true");});});
$$("[data-openall]").forEach(function(b){b.addEventListener("click",function(){var box=document.getElementById(b.getAttribute("data-openall")),items=$$(".char,.sym",box),allOpen=items.every(function(x){return x.getAttribute("aria-expanded")==="true";});items.forEach(function(x){x.setAttribute("aria-expanded",allOpen?"false":"true");});b.textContent=allOpen?"פתיחת כל הכרטיסים":"סגירת כל הכרטיסים";});});

/* ---------- who said it? ---------- */
var wsScore=0,wsDone=0,wsTotal=$$(".ws").length;
$$(".ws").forEach(function(w){var ans=w.getAttribute("data-a"),fb=$(".fb",w);fb.setAttribute("data-orig",fb.innerHTML);
  w.addEventListener("click",function(e){var b=e.target.closest(".opt");if(!b||w.classList.contains("answered"))return;
    var ok=b.textContent.trim()===ans;w.classList.add("answered");b.classList.add(ok?"ok":"no");
    $$(".opt",w).forEach(function(o){if(o.textContent.trim()===ans)o.classList.add("ok");o.disabled=true;});
    fb.hidden=false;fb.innerHTML=(ok?"<b>✔ נכון.</b> ":"<b>✘ לא בדיוק:</b> זה "+ans+". ")+fb.getAttribute("data-orig");
    wsDone++;if(ok)wsScore++;var sc=$("#ws-score");if(sc)sc.textContent=wsScore+" מתוך "+wsDone+(wsDone===wsTotal?" · סיימתם!":"");});
});
var wsReset=$("#ws-reset");if(wsReset)wsReset.addEventListener("click",function(){wsScore=0;wsDone=0;$$(".ws").forEach(function(w){w.classList.remove("answered");$$(".opt",w).forEach(function(o){o.disabled=false;o.classList.remove("ok","no");});var fb=$(".fb",w);fb.hidden=true;fb.innerHTML=fb.getAttribute("data-orig");});var sc=$("#ws-score");if(sc)sc.textContent="0 מתוך 0";});

/* ---------- annotations toggle ---------- */
$$("[data-ann]").forEach(function(b){b.addEventListener("click",function(){var box=document.getElementById(b.getAttribute("data-ann")),on=!box.classList.contains("ann-on");box.classList.toggle("ann-on",on);b.setAttribute("aria-pressed",on?"true":"false");b.textContent=on?"הסתרת הסימונים":"הצגת הסימונים";});});

/* ---------- read aloud (browser Hebrew voice, if any) ---------- */
var synth=window.speechSynthesis||null;
function stopTTS(){if(synth)try{synth.cancel();}catch(e){}$$("[data-tts]").forEach(function(b){b.setAttribute("aria-pressed","false");b.textContent="🔊 הקראה";});}
$$("[data-tts]").forEach(function(b){
  if(!synth||!window.SpeechSynthesisUtterance){b.hidden=true;return;}
  b.addEventListener("click",function(){
    if(b.getAttribute("aria-pressed")==="true"){stopTTS();return;}
    stopTTS();var el=document.getElementById(b.getAttribute("data-tts"));var txt=el.innerText.replace(/\s+\d+\s/g," ");
    var u=new SpeechSynthesisUtterance(txt);u.lang="he-IL";u.rate=.95;
    var v=(synth.getVoices()||[]).filter(function(x){return /^he|iw/i.test(x.lang);})[0];if(v)u.voice=v;
    u.onend=function(){b.setAttribute("aria-pressed","false");b.textContent="🔊 הקראה";};
    synth.speak(u);b.setAttribute("aria-pressed","true");b.textContent="⏹ עצירת ההקראה";
  });
});

/* ---------- teacher notes (code 1010, content stored encoded) ---------- */
var NOTES=null;
function teacherOK(){try{return sessionStorage.getItem(PFX+"TeacherOK")==="1";}catch(e){return false;}}
function loadNotes(){if(!NOTES){NOTES=JSON.parse(decodeURIComponent(escape(atob($("#teacher-data").textContent.trim()))));}return NOTES;}
function renderNotes(){var box=$("#notes");if(box.hidden||!NOTES)return;var s=slides[cur];$("#notes-slide").textContent="שקופית "+(cur+1)+": "+(s.getAttribute("aria-label")||"");$("#notes-body").innerHTML=NOTES[s.id]||"<p>אין הערות לשקופית הזו.</p>";}
function showNotes(){loadNotes();$("#notes").hidden=false;renderNotes();}
function openNotes(){if(!$("#notes").hidden){$("#notes").hidden=true;return;}if(teacherOK()){showNotes();return;}var d=$("#gate");$("#gate-err").hidden=true;$("#gate-pw").value="";if(d.showModal){d.showModal();}else{d.setAttribute("open","");}$("#gate-pw").focus();}
$("#notes-btn").addEventListener("click",openNotes);
$("#gate-form").addEventListener("submit",function(e){e.preventDefault();if($("#gate-pw").value.trim()==="1010"){try{sessionStorage.setItem(PFX+"TeacherOK","1");}catch(x){}$("#gate").close();showNotes();$("#notes-close").focus();}else{$("#gate-err").hidden=false;$("#gate-pw").value="";$("#gate-pw").focus();}});
$("#gate-cancel").addEventListener("click",function(){$("#gate").close();});
$("#notes-close").addEventListener("click",function(){$("#notes").hidden=true;$("#notes-btn").focus();});
$("#notes-popout").addEventListener("click",function(){window.open("teacher.html#presenter","kitaGveretNotes","width=640,height=780");});

/* ---------- start ---------- */
var start=idx(location.hash.slice(1));go(start>=0?start:0);
})();
