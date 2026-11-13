# Scene Studio

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
| `app/page.tsx` | Scene list, sign in, create from a template, rename, duplicate, delete |
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
| `components/editor/Panel.tsx` | The side panel and its six tabs |
| `components/editor/Fields.tsx` | Renders field definitions as form controls |
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

## Known limits

- The cloud path (sign in, saving to an account, publishing) has not been run end to end yet.
  The database rules were tested directly; the app code that calls them was not.
- The editor is React and TypeScript. The 3D runtime (`lib/runtime.js`) is plain JavaScript
  by design, since it also runs on live pages without the editor.
- Unit tests cover the scene model and undo history. The editor, the 3D runtime and storage
  are checked by browser scripts that are not part of this repository yet.
