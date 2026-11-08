# Predict · Discuss · Compare — design plan

A second way of using Motus 1D Lab, next to free exploration. Students work in groups through **activities**: short exercises that move between different representations of a motion, with predictions committed before anything is revealed. The system is general: a new activity is a new combination of steps, not new code.

## 1. Goals and constraints

- Students move between **registers**:
  - body (moving the cart);
  - words;
  - the motion seen on the track: animation and motion diagram;
  - graphs (s‑t, v‑t, a‑t);
  - equations.
- **Predictions are committed before anything is revealed.** The app controls which registers are visible at each moment.
- **Groups of 3–4 share one device:** one student drives, the others observe and discuss. Predictions and written answers often go on paper; the app is where groups act and test.
- **No scores for students.** The teacher gives feedback while observing the groups. The app shows the comparison and lets groups see where their answer differs, without marks.
- **Retrying is allowed.** Earlier attempts are kept and can be looked at again.
- **Every text exists in Italian and English:** the interface, and the texts of activities.
- **No backend.** Everything works offline once loaded. Progress stays on the device.
- **Readable from a metre away.** Landscape tablet or laptop first; a phone works but is not the target.

## 2. The model: activities, tasks, steps

```
Activity  (a worksheet or a lesson)
 └─ Task  (one exercise)
     ├─ setup   axes, time window, track, object, tools
     ├─ key     the reference motion (optional)
     └─ steps   an ordered list of building blocks
```

Flexibility comes from **steps**: a small set of blocks that can be combined in any order. **Step templates** give the list for common patterns, and **built-in activities** (§5) are ready to use or to copy and adapt.

### 2.1 Task setup

- **Axes and window:** position range (e.g. $[-1, 1]$ m), time window (e.g. $[0, 5]$ s), grid spacing. They can match a paper worksheet exactly.
- **Scene:**
  - horizontal or vertical track;
  - reference frame;
  - position name (s, x…);
  - object: cart or ball.
- **Tools available:** a feature set, as with levels. Only what the task needs.
- **Reference:** an optional label such as "Esercizio 3 / Exercise 3", shown in the header, so a group can find the same exercise on a printed sheet.

### 2.2 The key

What answers are compared against. It can be:

- **fixed:** a motion given as equations, a drawing or a recording, stored in the task;
- **taken from an earlier step:** the group's own recording becomes the key for a later prediction ("predict the graph of the movement you just made"), or a function entered secretly by one student becomes the key in the guessing game;
- **none:** open exploration with questions. Compare then shows the group's own motion in the other registers.

### 2.3 Steps (the building blocks)

| Step | What it does | Main options |
| --- | --- | --- |
| **show** | presents what is given | text; graph(s); equation; animation (play, replay); motion diagram; which registers stay hidden |
| **think** | think-alone pause before the device is used | prompt (e.g. "sketch v‑t on paper"); input locked until "Avanti"; **timer optional**, off by default |
| **ask** | structured questions | single or multiple choice; sign (+ / − / 0); trend (increases / decreases / constant); number with unit; instant or interval marked on a graph; free text "why"; confidence |
| **act** | the group produces something | see 2.4 |
| **discuss** | group pause | prompt, optional points to look at, optional timer; entry of a second answer when the group disagrees (alternative B) |
| **reveal** | shows the key | which registers, in which order (e.g. first v‑t, then a‑t); optional teacher code |
| **compare** | answer next to the key | layers (answer, alternative, earlier attempts, key); differences highlighted (§4); "retry" goes back to the act step |
| **reflect** | closing prompts | text prompts for the paper; "clean view" for copying onto a grid; group board |
| **handover** | "pass the device" and roles | who acts next; private screen (e.g. only the guide sees the secret function) |

### 2.4 `act`: one step, several kinds of answer

| Kind | Register | How | Options |
| --- | --- | --- | --- |
| **move** | body | records the cart, after a countdown | running clock or ticks every second; live graphs on or off (e.g. v‑t visible while moving) |
| **draw** | graph | draws s‑t, v‑t or a‑t (free, lines, parabolas) | given $s_0$ / $v_0$ |
| **dots** | motion diagram | places the object at t = 0, 1, 2… s | number of instants |
| **write** | equations | writes s(t) or v(t), one or more sections | intervals fixed or free; allowed letters |
| **describe** | words | builds a description: direction, faster / slower / constant, stops, turns back | free text alongside |
| **choose** | any | picks among 2–4 graphs, animations or equations | — |

Every answer kind produces the same thing internally: a motion model, or a structured value for `ask` and `describe`. That way `compare` works the same everywhere.

## 3. The flow in a group

A typical task, built from steps:

```
show → think → ask → discuss → act (group answer) → reveal → compare ⟲ retry → reflect
```

- **think** comes before anyone touches the device, so the driver's first stroke doesn't become the group's answer.
- **discuss** prompts point at the delicate moments: "What happens to v when the object turns back?"
- **The group answer** is entered once by the driver, with an optional **alternative B** when the group disagrees. Compare shows which held up.
- **Retry:** from compare, the group can go back and try again. Every attempt is kept, and the latest is shown over the earlier ones.
- **Rotating the driver:** a **handover** step between tasks.
- **Individual use:** the same task without discuss and handover. A setting on the activity can drop them automatically.

**Teacher pacing (optional).** A reveal can require a short code. The code is computed from the task itself, so it works offline. Groups move at their own pace up to the reveal; the teacher, who is going round the groups, gives the code when ready. Codes are listed in a teacher view of the activity.

## 4. Comparison without scores

The comparison shows, it doesn't judge. No marks, percentages or stars. The teacher's feedback in the room does that job.

- **Overlay:** the group's answer, the alternative, earlier attempts (faded) and the key, on the same axes.
- **Differences highlighted on the graphs:**
  - intervals where the slope has the opposite sign;
  - where the difference is largest;
  - a right shape that is shifted in time.
- **Corners:** where the key has a velocity jump, the spot is marked. That's where a hand can't follow, and a natural point for the teacher to ask "why?".
- **Same v‑t, different $s_0$:** the s‑t of the same v‑t starting from two or three other positions, to show that velocity doesn't fix the position.
- **Equations:** any equivalent form counts as the same motion (checked by values at many instants). The overlay shows where a different equation departs from the key.
- **Structured answers:** the key's value is shown next to the group's, e.g. "v at t = 0: you said +, the graph says −", without right/wrong badges.
- **Optional hints:** a task can include short explanatory texts, shown at compare. Off by default, since the teacher is in the room.

## 5. Built-in activities and step templates

**Built-in activities** ship with the app, work offline, and can be used as they are or copied and edited. The first set covers position and velocity graphs on a short track ($[-1, 1]$ m, a few seconds), exercises that also work on paper:

| Exercise | Chain of registers |
| --- | --- |
| Horizontal and sloped lines | body → s‑t, with "why" questions |
| Out, back and stop | words → body → s‑t → paper |
| From the law to the motion | equation → body → words |
| Reproduce a graph with a corner | s‑t → body, then "what was hard, and why?" |
| Predict the velocity, then test | s‑t → questions on v (sign, trend, a given instant) → body with v‑t visible |
| From velocity to position | v‑t → questions → body matching v‑t → s‑t on paper → same v‑t from another $s_0$ |
| From position to velocity and acceleration | s‑t → draw v‑t → describe a → test with v‑t and a‑t visible |
| Guess the function (game) | secret equation → spoken guidance → body → equation guessed |

**Step templates** are the patterns behind them, offered when creating a task: explore with questions, words → body, equation → body, graph → body, predict then test, graph → graph, guessing game, motion diagram. A template only fills in the step list; every task stays editable step by step.

## 6. Screens

- **Start:**
  - two big choices, "Esplora / Explore" (the current app) and "Attività / Activities", which lists the built-in activities and the recent ones;
  - a link that carries an activity opens directly into it;
  - the teacher can lock it.
- **Activity screen:**
  - a header with the task number and title, the reference and step dots;
  - one main area that shows only the registers the step allows;
  - one large "Avanti / Next" button;
  - "Indietro / Back" where retrying makes sense.
- **Readability:**
  - big graphs and text, few controls;
  - a "clean view" with the same scale and grid as the paper, for copying.
- **Group board:** for each task, the given, the group answer and alternative, the attempts, the reflection. Fullscreen to present to the class, and an image to hand in.
- **Progress:** saved on the device per activity, with resume. Reset per task or for the whole activity.

## 7. Format and distribution

- **Format:** an activity is JSON (tasks → setup, key, steps), versioned and validated like share links. Every text field is bilingual, `{ "it": "…", "en": "…" }`; if one language is missing, the other is shown. Short example:

  ```json
  {
    "v": 1, "group": true,
    "title": { "it": "Moto rettilineo", "en": "Straight-line motion" },
    "tasks": [{
      "ref": { "it": "Esercizio 5", "en": "Exercise 5" },
      "title": { "it": "Prevedi la velocità", "en": "Predict the velocity" },
      "setup": { "s": [-0.5, 1], "t": [0, 3], "object": "ball", "tools": ["gV"] },
      "key": { "eq": [{ "kind": "s", "f": "0.6 - 0.3t + 0.075t^2", "end": 3 }] },
      "steps": [
        { "type": "show", "graphs": ["s"] },
        { "type": "think", "prompt": { "it": "Rispondete sul foglio.", "en": "Answer on paper." } },
        { "type": "ask", "items": [
          { "q": { "it": "Velocità iniziale", "en": "Initial velocity" }, "sign": "-" },
          { "q": { "it": "Durante il moto la velocità…", "en": "During the motion the velocity…" }, "trend": "increases" },
          { "q": { "it": "A t = 2 s la velocità è…", "en": "At t = 2 s the velocity is…" }, "sign": "0" } ] },
        { "type": "act", "kind": "move", "live": ["s", "v"], "clock": true },
        { "type": "reveal", "graphs": ["v"] },
        { "type": "compare" },
        { "type": "reflect", "prompts": [{ "it": "Che movimento avete dovuto fare?", "en": "What movement did you have to make?" }] }
      ]
    }]
  }
  ```

  The `think` step has no `timer` here, so it waits for "Avanti".

- **Three ways to get an activity:**
  1. **Built in:** bundled with the app. Always available, offline.
  2. **Link:** the whole activity compressed after the `#`, like scene links today. Works offline and needs no server. Long activities make long links and dense QR codes.
  3. **File at a web address (optional):** the JSON is published somewhere public (a website, a code repository), and a short link tells the app where to load it from. Links stay short whatever the size, and editing the file updates the activity for everyone who opens it later. It needs a network connection when opened, and someone has to publish the file. Activities saved on the device after the first load keep working offline.
- **Authoring, in two stages:**
  1. activities written as JSON (the built-in set is made this way);
  2. an editor inside free exploration: "Crea un'attività da qui / Make an activity from here", then choose a step template, set the key from the current motion, edit the steps, and share.
- **Later:** produce a printable worksheet from the same activity, so one source gives both the sheet and the link.

## 8. How it fits the current code

- **Reused:**
  - model, parser and drawing;
  - recording, smoothing and the challenge countdown;
  - the predict drawing;
  - joints, which mark the corners;
  - link encoding, levels and scenes.
- **Generalised:** visibility. Today it is spread over `gshow`, `hid`, `hideA` and predict hiding. A single "register mask", set by the current step, should drive what views draw and what the table shows.
- **New modules:**
  - `activity.js`: schema, validation, loading, built-in activities, step templates;
  - `pdc.js`: the step runner (a state machine), attempts, progress, codes;
  - `steps/*.js`: one renderer per step type;
  - `compare.js`: overlays and difference detection;
  - `board.js`: group board and image.
- **Mode switch:**
  - free exploration stays as it is;
  - the activity screen uses the same canvases with its own layout and the register mask;
  - the current Challenge tab can later become a "graph → body" task; it stays during the transition.

## 9. Stages

1. **Foundation:**
   - activity schema and step runner;
   - steps show, think, ask, act (move, draw), reveal, compare with retry, reflect;
   - task axes and window;
   - recording clock;
   - corner and difference highlighting;
   - bilingual texts;
   - the first built-in activity (position and velocity, §5);
   - loading from a link.
2. **Groups:**
   - discuss with alternative B;
   - group board (fullscreen and image);
   - handover and roles with private screens, which enables the guessing game;
   - teacher reveal codes;
   - the $s_0$ comparison.
3. **More registers:** act dots (motion diagram), write (equations), describe (words), choose.
4. **Authoring:** editor in free exploration; optional loading from a web address.
5. **Later:**
   - printable worksheets;
   - several devices per group;
   - the AR version reading the same activity format.

## 10. Status and decisions

- **Stage 1 is built** (`js/pdc.js`, `js/activities.js`).
- **Stage 2 is built:**
  - alternative B in move and draw steps (dashed, compared separately);
  - handover steps with private screens: `secret: 'enter'` / `'show'`, and `key: 'secret'` for the hidden-function game;
  - `act` kind `write` (an equation s(t)), brought forward from stage 3 for the game;
  - teacher reveal codes (activity flag `codes`, or a switch per activity on the home screen, with a list of codes);
  - group board (image of the task with graphs, comparison, answers and reflection prompts; save or show fullscreen);
  - the $s_0$ comparison.
- **Recording:** a toggle (button or R) or held. The clock starts at the press, so the initial acceleration is part of the record. It stops at the end of the window.
- **Questions:** mostly open (`kind: 'open'`, free text or paper). `read` shows what the reference says next to the group's words.
- **Decided:**
  - no scores for students;
  - retry allowed, attempts kept;
  - question answers locked after a reveal;
  - all texts in Italian and English;
  - think timer optional;
  - free exploration unchanged.
- **Distribution in stage 1:** built-in activities, links and JSON import.

Still open:

- Next: stage 3 (motion-diagram dots, structured description in words, choose), then the authoring editor.
- Loading activities from a web address: needed, or are built-in activities and links enough?
- Optional hints at compare: keep them as an authoring option, or leave them out entirely?
