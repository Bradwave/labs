/* Built-in activities for the Predict · Discuss · Compare mode.
   An activity is plain data: tasks made of steps. Every text is { it, en }.
   Keys are sections in the compact form { kind, f | s0, v0, a, end }; see pdc.js for the format.
   The default activity is deliberately open: questions are answered in words (on screen or on paper),
   and the reference only says what it shows, next to what the group wrote. */

const t = (it, en) => ({ it, en });
const open = (it, en, read) => ({ kind: 'open', q: t(it, en), read });

export const ACTIVITIES = [{
  id: 'graphs-and-motion',
  v: 1,
  group: true,
  title: t('Grafici e movimento', 'Graphs and motion'),
  desc: t('Posizione e velocità su una rotaia corta: dal movimento al grafico, dalle parole e dalle equazioni al movimento, dalla velocità alla posizione, e un gioco a ruoli.',
    'Position and velocity on a short track: from movement to graph, from words and equations to movement, from velocity to position, and a role game.'),
  tasks: [
    {
      title: t('Semplici rette', 'Simple lines'),
      setup: { s: [-1, 1], t: [0, 5] },
      steps: [
        { type: 'show', text: t('Muovete la pallina sulla rotaia e osservate il grafico spazio-tempo che si forma. Provate più volte, senza fretta.', 'Move the ball along the track and watch the position-time graph that forms. Try several times, no rush.') },
        { type: 'act', kind: 'move', live: ['s'], clock: true, prompt: t('Cercate di ottenere come grafico spazio-tempo una retta orizzontale.', 'Try to get a horizontal line as the position-time graph.') },
        { type: 'ask', items: [open('Cosa è necessario fare? Perché?', 'What do you need to do? Why?')] },
        { type: 'act', kind: 'move', live: ['s'], clock: true, prompt: t('Ottenete due rette con pendenza positiva diversa, una dopo l’altra.', 'Get two lines with different positive slopes, one after the other.') },
        { type: 'ask', items: [open('Come è necessario muovere la pallina in questo caso? Perché?', 'How do you need to move the ball this time? Why?')] },
        { type: 'act', kind: 'move', live: ['s'], clock: true, prompt: t('Muovete la pallina verso sinistra a velocità costante.', 'Move the ball to the left at constant speed.') },
        { type: 'reflect', prompts: [t('Che grafico si ottiene muovendo la pallina verso sinistra?', 'What graph do you get moving the ball to the left?'), t('Qual è il ruolo della velocità nei moti che avete realizzato?', 'What is the role of velocity in the motions you made?')] }
      ]
    },
    {
      title: t('Partenza e sosta', 'Start and stop'),
      setup: { s: [-1, 1], t: [0, 5] },
      key: [{ kind: 'u', s0: -0.2, v0: 0.2, a: 0, end: 3 }, { kind: 'u', v0: 0, a: 0, end: 5 }],
      steps: [
        { type: 'show', text: t('A partire dalla posizione 0,2 m a sinistra dell’origine, la pallina si muove verso destra per 3 s, raggiunge la posizione 0,4 m e poi resta ferma per 2 s.',
          'Starting 0.2 m to the left of the origin, the ball moves to the right for 3 s, reaches the position 0.4 m and then stays still for 2 s.') },
        { type: 'think', prompt: t('Ognuno disegna sul foglio il grafico spazio-tempo che si aspetta.', 'Everyone sketches on paper the position-time graph they expect.') },
        { type: 'ask', items: [{ kind: 'number', q: t('Dopo quanti secondi la pallina passa per la posizione s = 0?', 'After how many seconds does the ball pass the position s = 0?'), unit: 's', expect: 1 }] },
        { type: 'act', kind: 'move', live: ['s'], clock: true, prompt: t('Muovete la pallina come descritto.', 'Move the ball as described.') },
        { type: 'reveal', graphs: ['s'] },
        { type: 'compare' },
        { type: 'reflect', prompts: [t('Riportate sul foglio il grafico realizzato.', 'Copy the graph you made onto the paper.')] }
      ]
    },
    {
      title: t('La legge che muove le cose', 'The law that moves things'),
      setup: { s: [-1, 1], t: [0, 5] },
      key: [{ kind: 's', f: '-0.6 + 0.3t', end: 5 }],
      steps: [
        { type: 'show', eq: true, text: t('La legge oraria di un moto rettilineo uniforme è', 'The law of a uniform straight-line motion is') },
        { type: 'ask', items: [open('Cosa rappresentano i numeri −0,6 e 0,3?', 'What do the numbers −0.6 and 0.3 represent?'),
          { kind: 'number', q: t('Dopo quanti secondi la pallina si trova nella posizione s = 0,15 m?', 'After how many seconds is the ball at the position s = 0.15 m?'), unit: 's', expect: 2.5 }] },
        { type: 'act', kind: 'move', live: ['s'], clock: true, prompt: t('Muovete la pallina e tracciate il grafico di questa legge.', 'Move the ball and trace the graph of this law.') },
        { type: 'reveal', graphs: ['s'] },
        { type: 'compare' },
        { type: 'reflect', prompts: [t('Descrivete a parole il moto che ha permesso di realizzare il grafico.', 'Describe in words the motion that produced the graph.')] }
      ]
    },
    {
      title: t('Occhio allo spigolo', 'Mind the corner'),
      setup: { s: [-1, 1], t: [0, 5] },
      key: [{ kind: 'u', s0: 0.3, v0: 0.5, a: 0, end: 1 }, { kind: 'u', v0: -0.4, a: 0, end: 5 }],
      steps: [
        { type: 'show', graphs: ['s'], text: t('Il grafico mostra la posizione di una pallina che si muove di moto rettilineo.', 'The graph shows the position of a ball moving along a straight line.') },
        { type: 'act', kind: 'move', live: ['s'], clock: true, prompt: t('Cercate di muovere la pallina in modo da realizzare lo stesso grafico.', 'Try to move the ball so you make the same graph.') },
        { type: 'compare' },
        { type: 'reflect', prompts: [t('Quali difficoltà avete incontrato? Perché?', 'What was difficult? Why?')] }
      ]
    },
    {
      title: t('Prima prevedere, poi verificare', 'Predict first, then test'),
      setup: { s: [-0.5, 1], t: [0, 3] },
      key: [{ kind: 's', f: '0.6 - 0.3t + 0.075t^2', end: 3 }],
      steps: [
        { type: 'show', graphs: ['s'], text: t('Il grafico mostra la posizione di una pallina che si muove di moto rettilineo.', 'The graph shows the position of a ball moving along a straight line.') },
        { type: 'think', prompt: t('Senza usare l’applicazione: ognuno pensa da solo a come cambia la velocità.', 'Without the app: everyone thinks alone about how the velocity changes.') },
        { type: 'ask', items: [
          open('La velocità iniziale è positiva, negativa o nulla? E quella finale? Giustificate le risposte.', 'Is the initial velocity positive, negative or zero? And the final one? Explain.', [{ sign: 'v', at: 0 }, { sign: 'v', at: 3 }]),
          open('Durante il moto la velocità aumenta o diminuisce? Spiegate.', 'During the motion does the velocity increase or decrease? Explain.', [{ trend: 'v', from: 0, to: 3 }]),
          open('Cosa succede all’istante t = 2 s? Perché?', 'What happens at t = 2 s? Why?', [{ sign: 'v', at: 2 }])] },
        { type: 'discuss', prompt: t('Confrontate le risposte nel gruppo. Su cosa non siete d’accordo?', 'Compare your answers in the group. What do you disagree on?') },
        { type: 'act', kind: 'move', live: ['s', 'v'], clock: true, start: 0.6, prompt: t('Ora muovete la pallina per realizzare lo stesso grafico, guardando anche il grafico della velocità.', 'Now move the ball to make the same graph, watching the velocity graph too.') },
        { type: 'reveal', graphs: ['v'] },
        { type: 'compare' },
        { type: 'reflect', prompts: [t('Il grafico della velocità è coerente con le vostre risposte?', 'Is the velocity graph consistent with your answers?'), t('Che tipo di movimento avete dovuto realizzare per ottenere un grafico corretto?', 'What kind of movement did you have to make to get a correct graph?')] }
      ]
    },
    {
      title: t('Moto variabile', 'Changing motion'),
      setup: { s: [-1, 1], t: [0, 2], v: [-2, 0.5] },
      key: [{ kind: 'v', f: '-0.75t', s0: 0.5, end: 2 }],
      steps: [
        { type: 'show', graphs: ['v'], text: t('Il grafico mostra la velocità di una pallina che parte dalla posizione +0,5 m.', 'The graph shows the velocity of a ball that starts at the position +0.5 m.') },
        { type: 'ask', items: [
          open('All’istante iniziale la velocità è positiva, negativa o nulla? E all’istante finale?', 'At the start, is the velocity positive, negative or zero? And at the end?', [{ sign: 'v', at: 0 }, { sign: 'v', at: 2 }]),
          open('Descrivete come varia la velocità nel tempo.', 'Describe how the velocity changes over time.', [{ trend: 'v', from: 0, to: 2 }])] },
        { type: 'think', prompt: t('Che tipo di grafico spazio-tempo vi aspettate? Ognuno lo disegna sul foglio.', 'What kind of position-time graph do you expect? Everyone sketches it on paper.') },
        { type: 'act', kind: 'draw', q: 's', prompt: t('Disegnate qui il grafico spazio-tempo del gruppo.', 'Draw the group’s position-time graph here.') },
        { type: 'act', kind: 'move', live: ['v'], clock: true, start: 0.5, prompt: t('Muovete la pallina in modo da realizzare il grafico della velocità dato.', 'Move the ball so you make the given velocity graph.') },
        { type: 'reveal', graphs: ['s'] },
        { type: 'compare', s0: [0.9, 0.1] },
        { type: 'reflect', prompts: [t('Che tipo di movimento bisogna fare per realizzare il grafico della velocità? Quali difficoltà avete incontrato?', 'What kind of movement do you need to make the velocity graph? What was difficult?'),
          t('Un corpo con una posizione iniziale diversa potrebbe avere lo stesso grafico della velocità?', 'Could a body with a different initial position have the same velocity graph?')] }
      ]
    },
    {
      title: t('Montagne russe', 'Rollercoaster'),
      setup: { s: [-1, 1], t: [0, 4] },
      key: [{ kind: 'u', s0: -0.8, v0: 0, a: 0.25, end: 2 }, { kind: 'u', a: 0, end: 3 }, { kind: 'u', a: -0.5, end: 4 }],
      steps: [
        { type: 'show', graphs: ['s'], text: t('Il grafico mostra la posizione di una pallina che si muove di moto rettilineo.', 'The graph shows the position of a ball moving along a straight line.') },
        { type: 'think', prompt: t('Senza usare l’applicazione: ognuno disegna sul foglio il grafico della velocità.', 'Without the app: everyone sketches the velocity graph on paper.') },
        { type: 'discuss', prompt: t('Confrontate i grafici: dove la velocità aumenta, dove resta costante, dove diminuisce? Se non siete d’accordo, nel passo successivo disegnate anche un’alternativa B.', 'Compare your graphs: where does the velocity increase, stay constant, decrease? If you disagree, draw an alternative B in the next step too.') },
        { type: 'act', kind: 'draw', q: 'v', prompt: t('Disegnate qui il grafico della velocità del gruppo.', 'Draw the group’s velocity graph here.') },
        { type: 'ask', items: [open('L’accelerazione ha sempre lo stesso segno? Descrivete come varia.', 'Does the acceleration always have the same sign? Describe how it changes.',
          [{ sign: 'a', at: 1 }, { sign: 'a', at: 2.5 }, { sign: 'a', at: 3.5 }])] },
        { type: 'reveal', graphs: ['v'] },
        { type: 'compare' },
        { type: 'act', kind: 'move', live: ['s', 'v', 'a'], clock: true, start: -0.8, prompt: t('Realizzate lo stesso grafico spazio-tempo con la pallina, controllando velocità e accelerazione.', 'Make the same position-time graph with the ball, checking velocity and acceleration.') },
        { type: 'reveal', graphs: ['a'] },
        { type: 'compare' },
        { type: 'reflect', prompts: [t('La descrizione dell’accelerazione che avete dato è compatibile con il grafico a‑t?', 'Is the description of the acceleration you gave compatible with the a‑t graph?'),
          t('In quali intervalli di tempo il corpo accelera? In quali rallenta?', 'In which time intervals does the body speed up? In which does it slow down?')] }
      ]
    },
    {
      title: t('Gioco: la funzione nascosta', 'Game: the hidden function'),
      setup: { s: [-1, 1], t: [0, 5] },
      key: 'secret',
      steps: [
        { type: 'show', text: t('Dividetevi in quattro ruoli. 1 sceglie una funzione s(t) e la scrive di nascosto. 2 la legge e spiega a 3 il movimento da fare, senza rivelarla. 3 muove la pallina. 4 guarda il grafico e indovina la funzione.',
          'Split into four roles. 1 picks a function s(t) and enters it secretly. 2 reads it and explains the movement to 3, without revealing it. 3 moves the ball. 4 watches the graph and guesses the function.') },
        { type: 'handover', role: t('1, che sceglie la funzione', '1, who picks the function'), secret: 'enter' },
        { type: 'handover', role: t('2, la guida', '2, the guide'), secret: 'show' },
        { type: 'handover', role: t('3, che muove la pallina', '3, who moves the ball') },
        { type: 'act', kind: 'move', live: ['s'], clock: true, alt: false, prompt: t('2 dà le indicazioni a voce, 3 muove la pallina.', '2 gives directions aloud, 3 moves the ball.') },
        { type: 'handover', role: t('4, che indovina', '4, who guesses') },
        { type: 'act', kind: 'write', prompt: t('4: qual è la funzione? Scrivetela.', '4: what is the function? Write it.') },
        { type: 'reveal', graphs: ['s'], eq: true },
        { type: 'compare' },
        { type: 'reflect', prompts: [t('Il movimento rappresentava bene la funzione? Dove si discostava, e perché?', 'Did the movement represent the function well? Where did it differ, and why?'),
          t('Scambiatevi i ruoli e giocate di nuovo.', 'Swap roles and play again.')] }
      ]
    }
  ]
}];
