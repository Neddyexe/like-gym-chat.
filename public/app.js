const PROGRAM = [
  {name:"Pull", focus:"Calisthenics + back + biceps", exercises:[
    ["Pull-ups",3,"quality reps"],["Lat pulldown",3,"8–12"],["Seated row",3,"8–12"],
    ["Rear delt fly",3,"12–15"],["Biceps curl",3,"10–15"],["Hanging knee raise",3,"clean reps"]
  ]},
  {name:"Push", focus:"Dips + chest + delts + triceps", exercises:[
    ["Dips",3,"quality reps"],["Incline press",3,"8–12"],["Push-ups",3,"near technical failure"],
    ["Lateral raise",4,"12–20"],["Triceps pressdown",3,"10–15"],["Handstand practice",4,"short quality sets"]
  ]},
  {name:"Legs + conditioning", focus:"Lower body + running", exercises:[
    ["Squat or leg press",3,"8–12"],["Romanian deadlift",3,"8–12"],["Leg curl",3,"10–15"],
    ["Calf raise",4,"10–15"],["Core",3,"controlled"],["Treadmill",1,"conditioning block"]
  ]},
  {name:"Upper", focus:"Hypertrophy + calisthenics", exercises:[
    ["Pull-ups",3,"quality reps"],["Dips",3,"quality reps"],["Chest press",3,"8–12"],
    ["Cable row",3,"8–12"],["Lateral raise",4,"12–20"],["Biceps + triceps",3,"10–15 each"]
  ]}
];

const KEY="gymChatStateV1";
const baseState={
  blockStart:"2026-09-05",
  workoutIndex:0, exerciseIndex:0, setIndex:0, repDraft:5,
  history:[], messages:[
    {role:"coach",text:"21-day comeback block ready. When you get to the gym, just tell me “I’m here” and we’ll go one exercise at a time."}
  ],
  prs:{pullups:5,dips:1}
};
let state=load();
let timer=90, timerId=null;

function load(){
  try{return {...structuredClone(baseState),...JSON.parse(localStorage.getItem(KEY)||"{}")}}
  catch{return structuredClone(baseState)}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function q(id){return document.getElementById(id)}

function currentWorkout(){return PROGRAM[state.workoutIndex%PROGRAM.length]}
function currentExercise(){return currentWorkout().exercises[state.exerciseIndex] || currentWorkout().exercises[0]}

function render(){
  const day=Math.min(21, Math.max(1, Math.floor((Date.now()-new Date(state.blockStart+"T00:00:00").getTime())/86400000)+1));
  q("dayLabel").textContent=`DAY ${day} / 21`;
  q("sessionTitle").textContent=`${currentWorkout().name} • ${currentWorkout().focus}`;
  q("exerciseName").textContent=currentExercise()[0];
  q("setCount").textContent=`${state.setIndex+1} / ${currentExercise()[1]}`;
  const last=[...state.history].reverse().find(x=>x.exercise===currentExercise()[0]);
  q("lastSet").textContent=last?`${last.reps} reps`:"—";
  q("pullupPr").textContent=state.prs.pullups;
  q("dipPr").textContent=state.prs.dips;
  q("sessionCount").textContent=new Set(state.history.map(x=>x.date)).size;
  q("streak").textContent=calcStreak();
  renderChat(); renderExercises(); renderHistory(); renderProgram();
}
function renderChat(){
  q("chatLog").innerHTML="";
  state.messages.slice(-30).forEach(m=>{
    const d=document.createElement("div");
    d.className=`bubble ${m.role==="user"?"user":"coach"}`;
    d.textContent=m.text; q("chatLog").appendChild(d);
  });
  q("chatLog").scrollTop=q("chatLog").scrollHeight;
}
function renderExercises(){
  q("exerciseList").innerHTML="";
  currentWorkout().exercises.forEach((e,i)=>{
    const d=document.createElement("div");
    d.className="exercise-item"+(i===state.exerciseIndex?" active":"");
    d.innerHTML=`<strong>${i+1}. ${e[0]}</strong><span class="exercise-meta">${e[1]} sets • ${e[2]}</span>`;
    q("exerciseList").appendChild(d);
  });
}
function renderHistory(){
  const rows=state.history.slice(-12).reverse();
  q("historyList").innerHTML=rows.length?"":"<div class='muted'>No sets logged yet.</div>";
  rows.forEach(h=>{
    const d=document.createElement("div"); d.className="history-row";
    d.innerHTML=`<strong>${h.exercise}: ${h.reps} reps</strong><small>${new Date(h.time).toLocaleString()}</small>`;
    q("historyList").appendChild(d);
  });
}
function renderProgram(){
  q("programList").innerHTML="";
  PROGRAM.forEach((p,i)=>{
    const d=document.createElement("div"); d.className="program-day";
    d.innerHTML=`<strong>Day ${i+1} — ${p.name}</strong><small>${p.focus}<br>${p.exercises.map(x=>x[0]).join(" · ")}</small>`;
    q("programList").appendChild(d);
  });
}
function calcStreak(){
  const days=[...new Set(state.history.map(x=>x.date))].sort().reverse();
  if(!days.length)return 0;
  let n=1, d=new Date(days[0]+"T00:00:00");
  for(let i=1;i<days.length;i++){
    d.setDate(d.getDate()-1);
    if(days[i]===d.toISOString().slice(0,10))n++; else break;
  }
  return n;
}
function coachFallback(text){
  const t=text.toLowerCase().trim();
  if(/i'?m here|at the gym|ready/.test(t)){
    return `You're on ${currentWorkout().name}. Start with ${currentExercise()[0]}. Do a proper warm-up, then give me your first clean set. I only care about reps with good form.`;
  }
  const num=t.match(/\b(\d{1,2})\b/);
  if(num && /rep|got|managed|did|clean/.test(t)){
    const reps=Math.max(0,Math.min(50,Number(num[1])));
    logSet(reps,false);
    return `Logged: ${reps} reps on ${state.history.at(-1).exercise}. ${nextCoachLine(reps)}`;
  }
  if(/cooked|tired|exhaust|form/.test(t)) return "Keep the next set clean. Drop reps before you sacrifice form. Tell me what starts failing and I’ll adjust the target.";
  return `Tell me the reps, how clean they felt, or say “I’m here”. Current exercise: ${currentExercise()[0]}, set ${state.setIndex+1}.`;
}
function nextCoachLine(reps){
  const ex=currentExercise()[0];
  return `Rest 90 seconds. Current target stays quality-first; when the timer ends, tell me you're ready for the next set of ${ex}.`;
}
async function sendCoach(text){
  state.messages.push({role:"user",text}); save(); renderChat();
  let reply;
  try{
    const r=await fetch("/api/coach",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      message:text,state:{workout:currentWorkout(),exercise:currentExercise(),setIndex:state.setIndex,history:state.history.slice(-20),prs:state.prs}
    })});
    if(!r.ok) throw new Error("offline");
    reply=(await r.json()).text;
  }catch{
    reply=coachFallback(text);
  }
  state.messages.push({role:"coach",text:reply}); save(); render();
}
function logSet(reps=state.repDraft,announce=true){
  const ex=currentExercise()[0];
  const entry={exercise:ex,reps,date:new Date().toISOString().slice(0,10),time:new Date().toISOString()};
  state.history.push(entry);
  if(ex==="Pull-ups")state.prs.pullups=Math.max(state.prs.pullups,reps);
  if(ex==="Dips")state.prs.dips=Math.max(state.prs.dips,reps);
  const totalSets=currentExercise()[1];
  if(state.setIndex+1>=totalSets){
    state.setIndex=0;
    if(state.exerciseIndex+1>=currentWorkout().exercises.length){
      state.exerciseIndex=0; state.workoutIndex=(state.workoutIndex+1)%PROGRAM.length;
      if(announce) state.messages.push({role:"coach",text:"Session complete. Good work. I've moved you to the next training day."});
    }else{
      state.exerciseIndex++;
      if(announce) state.messages.push({role:"coach",text:`Set logged. ${ex} complete — next up: ${currentExercise()[0]}.`});
    }
  } else {
    state.setIndex++;
    if(announce) state.messages.push({role:"coach",text:`${reps} reps logged. Rest 90 seconds, then set ${state.setIndex+1}.`});
  }
  startTimer(90); save(); render();
}
function startTimer(seconds){
  clearInterval(timerId); timer=seconds; paintTimer();
  timerId=setInterval(()=>{timer--; paintTimer(); if(timer<=0){clearInterval(timerId); q("timerText").textContent="READY";}},1000)
}
function paintTimer(){q("timerText").textContent=`${String(Math.floor(timer/60)).padStart(2,"0")}:${String(timer%60).padStart(2,"0")}`}

document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); q(b.dataset.tab).classList.add("active");
}));
q("chatForm").addEventListener("submit",e=>{e.preventDefault();const t=q("chatInput").value.trim();if(!t)return;q("chatInput").value="";sendCoach(t)});
q("plusRep").addEventListener("click",()=>{state.repDraft=Math.min(50,state.repDraft+1);q("logSet").textContent=`Log ${state.repDraft} reps`});
q("minusRep").addEventListener("click",()=>{state.repDraft=Math.max(0,state.repDraft-1);q("logSet").textContent=`Log ${state.repDraft} reps`});
q("logSet").addEventListener("click",()=>logSet());
q("startWorkoutBtn").addEventListener("click",()=>{document.querySelector('[data-tab="coach"]').click();sendCoach("I'm here")});
q("resetBtn").addEventListener("click",()=>{localStorage.removeItem(KEY);state=structuredClone(baseState);save();render()});

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
  const recog=new SR(); recog.lang="en-GB"; recog.interimResults=false;
  q("voiceBtn").addEventListener("click",()=>{q("voiceStatus").textContent="Listening…";recog.start()});
  recog.onresult=e=>{const t=e.results[0][0].transcript;q("voiceStatus").textContent=`Heard: ${t}`;sendCoach(t)};
  recog.onerror=()=>q("voiceStatus").textContent="Voice input unavailable. You can still type.";
  recog.onend=()=>{if(q("voiceStatus").textContent==="Listening…")q("voiceStatus").textContent=""};
}else{
  q("voiceBtn").disabled=true;q("voiceStatus").textContent="Voice recognition is not available in this browser; typing still works.";
}

if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
q("logSet").textContent=`Log ${state.repDraft} reps`;
render(); paintTimer();
