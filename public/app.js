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

const KEY = "gymChatStateV2";

function localDateString(date = new Date()){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

function startOfLocalDay(date = new Date()){
  const d = new Date(date);
  d.setHours(0,0,0,0);
  return d;
}

function parseLocalDate(value){
  return new Date(`${value}T00:00:00`);
}

function addDays(date, amount){
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

const baseState = {
  blockStart:"2026-09-05",
  workoutIndex:0,
  exerciseIndex:0,
  setIndex:0,
  repDraft:5,

  history:[],

  messages:[
    {
      role:"coach",
      text:"21-day comeback block ready. When you get to the gym, just tell me “I’m here” and we’ll go one exercise at a time."
    }
  ],

  prs:{
    pullups:5,
    dips:1
  }
};

let state = load();
let timer = 90;
let timerId = null;


/* -----------------------------
   STORAGE
----------------------------- */

function load(){
  try{
    const old =
      JSON.parse(localStorage.getItem(KEY) || "null") ||
      JSON.parse(localStorage.getItem("gymChatStateV1") || "{}");

    return {
      ...structuredClone(baseState),
      ...old,

      prs:{
        ...baseState.prs,
        ...(old.prs || {})
      },

      history:old.history || [],

      messages:
        old.messages ||
        structuredClone(baseState.messages)
    };

  }catch{
    return structuredClone(baseState);
  }
}

function save(){
  localStorage.setItem(
    KEY,
    JSON.stringify(state)
  );
}

function q(id){
  return document.getElementById(id);
}


/* -----------------------------
   CURRENT TRAINING STATE
----------------------------- */

function currentWorkout(){
  return PROGRAM[
    state.workoutIndex %
    PROGRAM.length
  ];
}

function currentExercise(){
  return (
    currentWorkout()
      .exercises[state.exerciseIndex] ||
    currentWorkout()
      .exercises[0]
  );
}


/* -----------------------------
   DATE-AWARE SCHEDULE
----------------------------- */

/*
  The active workout is always scheduled
  for today (or blockStart if the block
  hasn't started yet).

  This means if you miss a planned day,
  the unfinished workout moves forward
  to the day you come back.

  Future workouts move with it.
*/

function activeWorkoutDate(){
  const today = startOfLocalDay();
  const blockStart =
    parseLocalDate(state.blockStart);

  return today < blockStart
    ? blockStart
    : today;
}

function getPlannedWorkouts(){
  const start =
    activeWorkoutDate();

  return PROGRAM.map((_,offset) => ({
    programIndex:
      (state.workoutIndex + offset) %
      PROGRAM.length,

    date:
      addDays(start,offset)
  }));
}

function formatProgramDate(date){
  return date.toLocaleDateString(
    "en-GB",
    {
      weekday:"short",
      day:"numeric",
      month:"short"
    }
  );
}

function formatHeaderDate(date){
  return date.toLocaleDateString(
    "en-GB",
    {
      weekday:"short",
      day:"numeric",
      month:"short"
    }
  ).toUpperCase();
}


/* -----------------------------
   RENDERING
----------------------------- */

function render(){

  const start =
    parseLocalDate(state.blockStart)
      .getTime();

  const today =
    startOfLocalDay()
      .getTime();

  const day =
    Math.min(
      21,
      Math.max(
        1,
        Math.floor(
          (today - start) /
          86400000
        ) + 1
      )
    );

  q("dayLabel").textContent =
    `${formatHeaderDate(new Date())} • DAY ${day} / 21`;

  q("sessionTitle").textContent =
    `${currentWorkout().name} • ${currentWorkout().focus}`;

  q("exerciseName").textContent =
    currentExercise()[0];

  q("setCount").textContent =
    `${state.setIndex + 1} / ${currentExercise()[1]}`;

  const last =
    [...state.history]
      .reverse()
      .find(
        x =>
          x.exercise ===
          currentExercise()[0]
      );

  q("lastSet").textContent =
    last
      ? `${last.reps} reps`
      : "—";

  q("pullupPr").textContent =
    state.prs.pullups;

  q("dipPr").textContent =
    state.prs.dips;

  q("sessionCount").textContent =
    new Set(
      state.history.map(
        x => x.date
      )
    ).size;

  q("streak").textContent =
    calcStreak();

  renderChat();
  renderExercises();
  renderHistory();
  renderProgram();
}


/* -----------------------------
   SAFE MINI MARKDOWN
----------------------------- */

function escapeHTML(text){
  return String(text)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function formatCoachText(text){

  let safe =
    escapeHTML(text);

  safe =
    safe
      .split("\n")
      .filter(
        line =>
          !/^\s*\|?\s*:?-{3,}/
            .test(line)
      )
      .join("\n");

  safe =
    safe.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

  safe =
    safe.replace(
      /^\s*[-•]\s+(.*)$/gm,
      "• $1"
    );

  safe =
    safe.replace(
      /\s*\|\s*/g,
      " · "
    );

  safe =
    safe.replace(
      /\n/g,
      "<br>"
    );

  return safe;
}

function renderChat(){

  q("chatLog").innerHTML = "";

  state.messages
    .slice(-40)
    .forEach(m => {

      const d =
        document.createElement("div");

      d.className =
        `bubble ${
          m.role === "user"
            ? "user"
            : "coach"
        }`;

      if(m.role === "coach"){
        d.innerHTML =
          formatCoachText(m.text);
      }else{
        d.textContent =
          m.text;
      }

      q("chatLog")
        .appendChild(d);
    });

  q("chatLog").scrollTop =
    q("chatLog").scrollHeight;
}


/* -----------------------------
   WORKOUT UI
----------------------------- */

function renderExercises(){

  q("exerciseList").innerHTML = "";

  currentWorkout()
    .exercises
    .forEach((e,i) => {

      const d =
        document.createElement("div");

      d.className =
        "exercise-item" +
        (
          i === state.exerciseIndex
            ? " active"
            : ""
        );

      d.innerHTML = `
        <strong>
          ${i + 1}. ${e[0]}
        </strong>

        <span class="exercise-meta">
          ${e[1]} sets • ${e[2]}
        </span>
      `;

      q("exerciseList")
        .appendChild(d);
    });
}

function renderHistory(){

  const rows =
    state.history
      .slice(-15)
      .reverse();

  q("historyList").innerHTML =
    rows.length
      ? ""
      : "<div class='muted'>No sets logged yet.</div>";

  rows.forEach(h => {

    const d =
      document.createElement("div");

    d.className =
      "history-row";

    d.innerHTML = `
      <strong>
        ${h.exercise}: ${h.reps} reps
      </strong>

      <small>
        ${new Date(h.time).toLocaleString()}
      </small>
    `;

    q("historyList")
      .appendChild(d);
  });
}


/* -----------------------------
   DATE-AWARE PROGRAM
----------------------------- */

function renderProgram(){

  q("programList").innerHTML = "";

  const schedule =
    getPlannedWorkouts();

  schedule.forEach(
    (item,displayIndex) => {

      const p =
        PROGRAM[item.programIndex];

      const d =
        document.createElement("div");

      d.className =
        "program-day";

      if(displayIndex === 0){
        d.classList.add("active");
      }

      const dateLabel =
        formatProgramDate(
          item.date
        );

      d.innerHTML = `
        <strong>
          ${dateLabel} — ${p.name}
        </strong>

        <small>
          ${p.focus}
          <br>
          ${p.exercises
            .map(x => x[0])
            .join(" · ")}
        </small>
      `;

      q("programList")
        .appendChild(d);
    }
  );
}


/* -----------------------------
   STREAK
----------------------------- */

function calcStreak(){

  const days =
    [
      ...new Set(
        state.history.map(
          x => x.date
        )
      )
    ]
      .sort()
      .reverse();

  if(!days.length){
    return 0;
  }

  let n = 1;

  let d =
    parseLocalDate(days[0]);

  for(
    let i = 1;
    i < days.length;
    i++
  ){

    d.setDate(
      d.getDate() - 1
    );

    if(
      days[i] ===
      localDateString(d)
    ){
      n++;
    }else{
      break;
    }
  }

  return n;
}


/* -----------------------------
   REP DETECTION
----------------------------- */

function extractRepReport(text){

  const t =
    text
      .toLowerCase()
      .trim()
      .replace(/[!.,]/g," ");

  const patterns = [

    /\b(?:i\s+)?(?:got|did|managed|hit|completed|made)\s+(\d{1,2})\b/,

    /\b(\d{1,2})\s+(?:clean\s+)?reps?\b/,

    /\b(\d{1,2})\s+(?:good|solid|clean)\b/

  ];

  for(
    const pattern of patterns
  ){

    const match =
      t.match(pattern);

    if(match){

      const reps =
        Number(match[1]);

      if(
        Number.isFinite(reps) &&
        reps >= 0 &&
        reps <= 50
      ){
        return reps;
      }
    }
  }

  return null;
}


/* -----------------------------
   FALLBACK COACH
----------------------------- */

function coachFallback(text){

  const t =
    text
      .toLowerCase()
      .trim();

  if(
    /i'?m here|at the gym|ready/
      .test(t)
  ){

    return `You're on ${currentWorkout().name}. Start with ${currentExercise()[0]}. Do a proper warm-up, then give me your first clean set.`;
  }

  if(
    /cooked|tired|exhaust|form/
      .test(t)
  ){

    return "Keep the next set clean. Drop reps before you sacrifice form. Tell me what starts failing and I’ll adjust the target.";
  }

  return `Tell me the reps, how clean they felt, or say “I’m here”. Current exercise: ${currentExercise()[0]}, set ${state.setIndex + 1}.`;
}


/* -----------------------------
   LOGGING SETS
----------------------------- */

function logSet(
  reps = state.repDraft,
  announce = true
){

  const workoutBefore =
    currentWorkout().name;

  const exerciseBefore =
    currentExercise()[0];

  const setNumber =
    state.setIndex + 1;

  const totalSets =
    currentExercise()[1];

  const now =
    new Date();

  const entry = {

    workout:
      workoutBefore,

    exercise:
      exerciseBefore,

    set:
      setNumber,

    reps,

    date:
      localDateString(now),

    time:
      now.toISOString()
  };

  state.history.push(entry);

  if(
    exerciseBefore ===
    "Pull-ups"
  ){

    state.prs.pullups =
      Math.max(
        state.prs.pullups,
        reps
      );
  }

  if(
    exerciseBefore ===
    "Dips"
  ){

    state.prs.dips =
      Math.max(
        state.prs.dips,
        reps
      );
  }

  let result = {

    entry,

    exerciseComplete:
      false,

    sessionComplete:
      false,

    nextExercise:
      exerciseBefore,

    nextSet:
      setNumber + 1
  };

  if(
    state.setIndex + 1 >=
    totalSets
  ){

    state.setIndex = 0;

    result.exerciseComplete =
      true;

    if(
      state.exerciseIndex + 1 >=
      currentWorkout()
        .exercises.length
    ){

      state.exerciseIndex = 0;

      state.workoutIndex =
        (
          state.workoutIndex + 1
        ) %
        PROGRAM.length;

      result.sessionComplete =
        true;

      result.nextExercise =
        currentExercise()[0];

      result.nextSet = 1;

      if(announce){

        state.messages.push({
          role:"coach",
          text:"Session complete. Good work. I've moved you to the next training day."
        });
      }

    }else{

      state.exerciseIndex++;

      result.nextExercise =
        currentExercise()[0];

      result.nextSet = 1;

      if(announce){

        state.messages.push({
          role:"coach",
          text:`Set logged. ${exerciseBefore} complete — next up: ${currentExercise()[0]}.`
        });
      }
    }

  }else{

    state.setIndex++;

    result.nextExercise =
      currentExercise()[0];

    result.nextSet =
      state.setIndex + 1;

    if(announce){

      state.messages.push({
        role:"coach",
        text:`${reps} reps logged. Rest 90 seconds, then set ${state.setIndex + 1}.`
      });
    }
  }

  startTimer(90);

  save();
  render();

  return result;
}


/* -----------------------------
   AI COACH
----------------------------- */

async function sendCoach(text){

  state.messages.push({
    role:"user",
    text
  });

  const reps =
    extractRepReport(text);

  let loggedSet = null;

  if(reps !== null){

    loggedSet =
      logSet(
        reps,
        false
      );
  }

  save();
  renderChat();

  let reply;

  try{

    const payload = {

      message:
        text,

      state:{

        workout:
          currentWorkout(),

        exercise:
          currentExercise(),

        setIndex:
          state.setIndex,

        history:
          state.history
            .slice(-25),

        prs:
          state.prs,

        restSeconds:
          90,

        loggedSet:
          loggedSet
            ? {

                exercise:
                  loggedSet
                    .entry
                    .exercise,

                set:
                  loggedSet
                    .entry
                    .set,

                reps:
                  loggedSet
                    .entry
                    .reps,

                exerciseComplete:
                  loggedSet
                    .exerciseComplete,

                sessionComplete:
                  loggedSet
                    .sessionComplete,

                nextExercise:
                  loggedSet
                    .nextExercise,

                nextSet:
                  loggedSet
                    .nextSet
              }
            : null
      }
    };

    const r =
      await fetch(
        "/api/coach",
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );

    if(!r.ok){
      throw new Error(
        "AI request failed"
      );
    }

    const data =
      await r.json();

    reply =
      data.text ||
      "Tell me how that set felt.";

  }catch(err){

    console.error(
      "Coach request failed:",
      err
    );

    if(loggedSet){

      if(
        loggedSet
          .sessionComplete
      ){

        reply =
          `${loggedSet.entry.reps} reps logged on ${loggedSet.entry.exercise}. Session complete.`;

      }else if(
        loggedSet
          .exerciseComplete
      ){

        reply =
          `${loggedSet.entry.reps} reps logged. ${loggedSet.entry.exercise} complete. Next: ${loggedSet.nextExercise}.`;

      }else{

        reply =
          `${loggedSet.entry.reps} reps logged. Rest 90 seconds, then set ${loggedSet.nextSet}.`;
      }

    }else{

      reply =
        coachFallback(text);
    }
  }

  state.messages.push({
    role:"coach",
    text:reply
  });

  save();
  render();
}


/* -----------------------------
   TIMER
----------------------------- */

function startTimer(seconds){

  clearInterval(timerId);

  timer =
    seconds;

  paintTimer();

  timerId =
    setInterval(
      () => {

        timer--;

        paintTimer();

        if(timer <= 0){

          clearInterval(
            timerId
          );

          q("timerText")
            .textContent =
            "READY";
        }

      },
      1000
    );
}

function paintTimer(){

  q("timerText")
    .textContent =

    `${String(
      Math.floor(
        timer / 60
      )
    ).padStart(2,"0")}:` +

    `${String(
      timer % 60
    ).padStart(2,"0")}`;
}


/* -----------------------------
   TABS
----------------------------- */

document
  .querySelectorAll(".tab")
  .forEach(
    b =>
      b.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".tab"
            )
            .forEach(
              x =>
                x.classList
                  .remove(
                    "active"
                  )
            );

          document
            .querySelectorAll(
              ".panel"
            )
            .forEach(
              x =>
                x.classList
                  .remove(
                    "active"
                  )
            );

          b.classList
            .add("active");

          q(b.dataset.tab)
            .classList
            .add("active");
        }
      )
  );


/* -----------------------------
   CHAT
----------------------------- */

q("chatForm")
  .addEventListener(
    "submit",
    e => {

      e.preventDefault();

      const t =
        q("chatInput")
          .value
          .trim();

      if(!t){
        return;
      }

      q("chatInput")
        .value = "";

      sendCoach(t);
    }
  );


/* -----------------------------
   MANUAL REP CONTROLS
----------------------------- */

q("plusRep")
  .addEventListener(
    "click",
    () => {

      state.repDraft =
        Math.min(
          50,
          state.repDraft + 1
        );

      q("logSet")
        .textContent =
        `Log ${state.repDraft} reps`;

      save();
    }
  );

q("minusRep")
  .addEventListener(
    "click",
    () => {

      state.repDraft =
        Math.max(
          0,
          state.repDraft - 1
        );

      q("logSet")
        .textContent =
        `Log ${state.repDraft} reps`;

      save();
    }
  );

q("logSet")
  .addEventListener(
    "click",
    () =>
      logSet()
  );


/* -----------------------------
   START WORKOUT
----------------------------- */

q("startWorkoutBtn")
  .addEventListener(
    "click",
    () => {

      document
        .querySelector(
          '[data-tab="coach"]'
        )
        .click();

      sendCoach(
        "I'm here"
      );
    }
  );


/* -----------------------------
   RESET
----------------------------- */

q("resetBtn")
  .addEventListener(
    "click",
    () => {

      localStorage
        .removeItem(KEY);

      localStorage
        .removeItem(
          "gymChatStateV1"
        );

      state =
        structuredClone(
          baseState
        );

      save();
      render();
    }
  );


/* -----------------------------
   VOICE
----------------------------- */

const SR =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if(SR){

  const recog =
    new SR();

  recog.lang =
    "en-GB";

  recog.interimResults =
    false;

  q("voiceBtn")
    .addEventListener(
      "click",
      () => {

        q("voiceStatus")
          .textContent =
          "Listening…";

        recog.start();
      }
    );

  recog.onresult =
    e => {

      const t =
        e.results[0][0]
          .transcript;

      q("voiceStatus")
        .textContent =
        `Heard: ${t}`;

      sendCoach(t);
    };

  recog.onerror =
    () => {

      q("voiceStatus")
        .textContent =
        "Voice input unavailable. You can still type.";
    };

  recog.onend =
    () => {

      if(
        q("voiceStatus")
          .textContent ===
        "Listening…"
      ){

        q("voiceStatus")
          .textContent = "";
      }
    };

}else{

  q("voiceBtn")
    .disabled = true;

  q("voiceStatus")
    .textContent =
    "Voice recognition is not available in this browser; typing still works.";
}


/* -----------------------------
   PWA
----------------------------- */

if(
  "serviceWorker" in
  navigator
){

  navigator
    .serviceWorker
    .register("/sw.js")
    .catch(() => {});
}


/* -----------------------------
   START
----------------------------- */

q("logSet").textContent =
  `Log ${state.repDraft} reps`;

render();
paintTimer();
