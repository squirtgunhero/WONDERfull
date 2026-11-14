import { Wordmark } from '../../components/Wordmark';

export const metadata = { title: 'Learn | WONDERfull' };

type Lesson = { id: string; title: string; about: string; steps: string[] };
const LESSONS: Lesson[] = [
  { id: 'first-scene', title: 'Your first scene', about: 'Five minutes from an empty stage to a page you can share.', steps: [
    'On the scene list, pick Starter shapes.',
    'Tap an object in the viewport. Drag the colored handles to move it. Drag empty space to look around.',
    'Open the Selected tab and change its color.',
    'Press Play to try hover, click and scroll, then Edit to carry on.',
    'Open live page shows what a visitor sees.',
  ] },
  { id: 'describe', title: 'Build by describing', about: 'Say what you want and let the scene be built for you.', steps: [
    'Sign in, then type into Describe a scene on the scene list. Mention objects, mood, colors and what should move.',
    'In the editor, use the Describe panel to ask for one change at a time.',
    'Select an object first and say "this" to change only that object.',
    'Every described change is one step. Undo brings the scene back.',
  ] },
  { id: 'materials', title: 'Materials, glass and glow', about: 'Make objects read as metal, plastic, glass or light.', steps: [
    'Roughness near 0 is polished, near 1 is chalky. Metal near 1 with low roughness gives chrome.',
    'For clear glass, set Glass to 1, Roughness under 0.1 and a pale color. Bends light controls the distortion.',
    'Rainbow sheen adds an oil-film shimmer. It suits glass and dark glossy objects.',
    'Glow makes an object emit its color. Turn up Bloom in the Scene tab to let it bleed into the air.',
    'Save this material keeps a look so you can apply it to other objects with one tap.',
  ] },
  { id: 'light', title: 'Light, sky and fog', about: 'Set the mood of the whole scene.', steps: [
    'In the Scene tab, Key light is the sun and Soft light is the even fill. Lower both for night.',
    'Add a Light object where a lamp or window should shine, and set its Brightness and Reach.',
    'Show a sky replaces the flat background with two colors, overhead and horizon.',
    'Fog fades distant objects into a color. Match it to the horizon for depth.',
    'Ambient shadows darken where objects meet. Exposure, Contrast, Saturation and Vignette finish the picture.',
  ] },
  { id: 'states', title: 'Hover and click', about: 'Make objects respond to the pointer.', steps: [
    'Select an object and turn on React when hovered. Set how it grows, lifts, turns or changes color.',
    'Under Active state, set how the object looks when it is switched on.',
    'Turn on Clickable. A click can switch this object, switch another object, open a link, or move the camera.',
    'To make a light switch, give the lamp an active state with a dark color, then make a button that switches the lamp.',
  ] },
  { id: 'scroll', title: 'Scroll and page text', about: 'Turn a scene into a page that unfolds as the visitor scrolls.', steps: [
    'In the Scene tab, turn on Camera moves as the page scrolls and set Orbit, Distance and Rise.',
    'Select an object, turn on Move as the page scrolls, and set where it travels.',
    'In the Page tab, add sections. Each has a heading, text, an optional button, and the stretch of scroll it shows for.',
    'Press Play and drag the Scroll slider to preview.',
  ] },
  { id: 'timeline', title: 'Animate with the timeline', about: 'Pose things at moments in time and let the scene move between them.', steps: [
    'Open the Timeline tab and select an object.',
    'Set a key at 0 seconds. Move the playhead, pose the object in the viewport, and set another key.',
    'For the camera, orbit the viewport to a view and set a camera key.',
    'Choose Loop, Back and forth or Play once. Set Runs on to Page scroll to tie the timeline to scrolling.',
  ] },
  { id: 'cameras', title: 'Saved cameras', about: 'Keep named views and move between them.', steps: [
    'Orbit to a view you like. In the Scene tab, choose Save this view as a camera.',
    'Go looks through a camera. Update stores the current view in it.',
    'Starts on picks the camera the live page opens with.',
    'Give an object a click that moves the camera, and visitors glide to that view when they tap it.',
  ] },
  { id: 'physics', title: 'Physics', about: 'Let things fall, stack and tumble.', steps: [
    'Select an object and set In Play to Falls and collides.',
    'Set platforms and walls to Solid so things land on them. The floor is always solid.',
    'Bounce and Weight change how an object behaves. Gravity is in the Scene tab.',
    'Press Play. Tap a falling object to give it a shove.',
  ] },
  { id: 'groups', title: 'Groups and ready-made objects', about: 'Treat a lamp or a tree as one thing.', steps: [
    'Give several objects the same Group name in the Selected tab.',
    'Select any part and the handles move, turn and resize the whole group. A checkbox switches that off.',
    'In the Objects tab, a group can be copied or deleted whole.',
    'Ready-made drops in a finished object, such as a desk lamp or a trophy, as its own group.',
  ] },
  { id: 'shapes', title: 'Draw, cut and repeat shapes', about: 'Go beyond the ready shapes.', steps: [
    'Add a Drawn shape. In the Selected tab, tap the pad to add corners and drag them to change the outline.',
    'Round the corners into curves turns a rough outline into a smooth one. Depth sets its thickness.',
    'To cut a hole, select the object, and under Cut away pick the object to carve out of it. Move the cutting object to change the cut.',
    'Under Copies, repeat an object in a grid or around a ring.',
    'Shading set to Cartoon with an Outline gives a drawn look. 3D text has six typefaces.',
  ] },
  { id: 'variables', title: 'Variables, live data and games', about: 'Give the scene a memory and let visitors play.', steps: [
    'In the Scene tab, add a variable such as score. Write {score} in any text to show it.',
    'Give an object a click that changes the variable: add to it, set it, or flip it on and off.',
    'Shown when makes an object appear only while a variable is on.',
    'A variable can read a live value from a web address that returns JSON. A click can also send a webhook.',
    'Set Player moves it on an object for arrow key, WASD and touch pad control. Camera follows keeps it in view.',
  ] },
  { id: 'publish', title: 'Publish, embed and export code', about: 'Put the scene in front of people.', steps: [
    'Sign in so the scene is saved to your account, then press Publish in the editor.',
    'Open live page is the link to share.',
    'In the Export tab, Embed gives a frame you can paste into any site builder.',
    'Code gives an HTML or React snippet that runs the scene directly on your own page.',
  ] },
];

export default function Learn() {
  return (
    <div className="wrap">
      <div className="sitebar">
        <Wordmark href="/" />
        <div className="who"><a className="linkbtn quiet" href="/">All scenes</a></div>
      </div>
      <div className="dash-head">
        <h1>Learn</h1>
        <p>Short lessons. Each one takes a few minutes and ends with something working.</p>
      </div>
      <nav className="toc" aria-label="Lessons">
        {LESSONS.map((l) => <a key={l.id} className="linkbtn" href={'#' + l.id}>{l.title}</a>)}
      </nav>
      {LESSONS.map((l) => (
        <section className="lesson" id={l.id} key={l.id}>
          <h2>{l.title}</h2>
          <p>{l.about}</p>
          <ol>{l.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
      ))}
    </div>
  );
}
