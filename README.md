# WONDERfull

A browser-based editor for interactive 3D scenes and pages, built with Next.js and three.js.

## Run it

```
npm install
npm run dev        # http://localhost:3000
```

`npm run build && npm start` runs the production build.
`npm test` runs the unit tests.

## What is here

| Path | What it does |
|---|---|
| `app/page.tsx` | Scene list, sign in, build from a description, create from a template, rename, duplicate, delete |
| `app/edit/page.tsx` | Loads one scene (`/edit?id=...`) and hosts the editor, autosave and the publish switch |
| `app/view/page.tsx` | The live page for one scene (`/view?id=...`), full screen, no editor |
| `lib/runtime.js` | Draws a scene from plain data: states, scroll, timeline, glow, and page sections |
| `lib/scene.js` | The scene model as plain data: object defaults, templates, repair of older scenes |
| `lib/editor/store.ts` | Editor state and every editing action. The one place scene data is changed |
| `lib/editor/defs.ts` | Field definitions for every panel |
| `lib/editor/history.js` | Undo and redo |
| `lib/editor/path.ts` | Read and write nested values by a dotted path |
| `components/editor/Editor.tsx` | The editor for one scene: viewport plus side panel |
| `components/editor/Viewport.tsx` | The 3D view and its on-canvas controls |
| `components/editor/Panel.tsx` | The side panels and their tabs. Wide screens get two panels, narrow screens one |
| `components/editor/Fields.tsx` | Renders field definitions as form controls |
| `app/api/build/route.ts` | `POST /api/build`: turns a description into a scene, or changes the scene sent with it |
| `lib/ai/prompt.js` | What the model is told about scenes, and the tool it answers through |
| `lib/ai/build.js` | The steps of a build: check the request, the account and the daily limit, ask the model, clean the reply |
| `lib/ai/sanitize.js` | Makes a model's reply safe to load: clamps numbers, checks colors and links, drops unknown fields |
| `lib/ai/client.ts` | Browser side of a build request |
| `supabase/migrations/ai_usage.sql` | The daily build counter and its limits |
| `lib/store.ts` | Storage front door. Routes each call to the browser store or the cloud store |
| `lib/local.ts` | Scenes kept in this browser (IndexedDB), used when signed out |
| `lib/cloud.ts` | Scenes in Supabase (table `projects`, storage bucket `assets`), used when signed in |
| `lib/config.ts` | Supabase project address and publishable key |
| `lib/righteous.json` | Righteous font outlines for 3D text (SIL Open Font License) |

## Accounts and publishing

- Signed out, scenes are saved in the browser. Signed in, new scenes are saved to the account.
- A scene in an account is private until its editor's "Publish live page" switch is turned on.
  A published scene's live page opens for anyone with the link.
- Row level security in the database limits every account to its own scenes.
- After deploying, set the Site URL in Supabase (Authentication settings) to the deployed address,
  so the links in confirmation emails come back to the app.

## Look, cameras, physics and code

- Scene tab: sky, fog, ambient shadows, color controls, saved cameras and gravity.
- Selected tab: glass that bends light, saved materials and colors, and physics per object
  ("Falls and collides" or "Solid"). Physics runs in Play and on live pages.
- Pictures (PNG, JPG, WebP, GIF, SVG) import as flat cards next to GLB models.
- Export tab, Code: an HTML or React snippet that runs the scene on any page through
  `/wonderfull-runtime.js`, which `scripts/build-embed.mjs` bundles from `lib/embed.js` before each build.

## Working together

- Sharing: the owner adds people by email (table `project_members`). Members can open and edit the scene
  and its files. Only the owner can publish, delete or share it.
- Live editing: `lib/editor/sync.js` works out what changed per object and folds other people's changes in;
  `lib/editor/transport.ts` carries them over a private Supabase Realtime channel named `scene:<id>`, or
  between tabs of one browser for a scene kept locally. The later change to the same object wins.
- Comments: table `comments`, shown in the Comments tab, optionally pinned to an object.
- The rules for all of this are in `supabase/migrations/collab.sql`.

## Shapes, logic and play

- Drawn shapes (an outline pad in the Selected tab), cutting one object out of another
  (`three-bvh-csg`), copies in a grid or ring, cartoon shading with outlines, six typefaces for
  3D text (`lib/fonts`, made by `scripts/make-fonts.mjs` from open-licensed fonts), and video cards.
- Clay: a ball that is sculpted by dragging across it (`lib/clay.js`). Heights are stored per point,
  measured out from the centre, so a form can bulge and dent but cannot fold over itself.
- Variables shown in text with `{name}`, changed by clicks, optionally read from a web address;
  objects shown only while a variable is on; clicks that send a webhook.
- Player control with arrow keys, WASD or a touch pad, and a camera that follows an object.
- A described build cannot add a webhook or a live data address. Those stay the person's own settings.

## Templates and lessons

- `lib/templates.js` holds the template library (scenes, objects, motion) and the ready-made
  objects the Objects tab can drop into a scene. A unit test checks every template is valid.
- `/learn` is a page of short lessons, one per feature.

## Groups

Objects that share a Group name (set in the Selected tab) are one thing made of parts. They are
listed together, the handles move, turn and resize all of them at once unless that is switched
off, and a group can be copied or deleted whole. Described builds group their own parts.

## Building from a description

Type what you want on the scene list ("Describe a scene") or in the editor's Describe tab, where
it changes the open scene as one step that Undo reverses. With an object selected, "this" means that object.

- It needs one setting on the server: the environment variable `ANTHROPIC_API_KEY`. Without it the
  feature answers that it is not switched on. `WONDERFULL_AI_MODEL` optionally picks the model
  (default `claude-sonnet-5-5`).
- Only signed-in accounts can use it, because every build is billed to that key.
- Limits live in the database function `use_ai_build`: 40 builds a day for one account and 600 a
  day for the whole site, counted in UTC. Change the two numbers in the migration to move them.
- The model never writes to the scene directly. Its reply goes through `lib/ai/sanitize.js` first.
  It cannot create imported models; it can keep, move and resize the ones a scene already has.
- In the editor, the last few requests of the session travel with each new one, so follow-ups like
  "a bit warmer" have context.

## Known limits

- Building from a description has not been run against the real model yet. The request handling,
  the cleaning of replies and the editor flow were tested with a hand-written stand-in reply.

- The cloud path (sign in, saving to an account, publishing) has not been run end to end yet.
  The database rules were tested directly; the app code that calls them was not.
- The editor is React and TypeScript. The 3D runtime (`lib/runtime.js`) is plain JavaScript
  by design, since it also runs on live pages without the editor.
- Unit tests cover the scene model, undo history and the build pipeline. The editor, the 3D runtime and storage
  are checked by browser scripts that are not part of this repository yet.
