'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSceneRuntime, usesScroll } from '../../lib/runtime';
import { getAssets, getProject, type Project } from '../../lib/store';

function Viewer() {
  const id = useSearchParams().get('id');
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [buffers, setBuffers] = useState<Map<string, ArrayBuffer> | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = id ? await getProject(id).catch(() => null) : null;
      if (!alive) return;
      if (!p) { setMissing(true); return; }
      const assets = await getAssets(p.id).catch(() => new Map<string, ArrayBuffer>());
      if (!alive) return;
      document.title = p.name;
      setBuffers(assets);
      setProject(p);
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!project || !buffers || !canvas.current) return;
    let rt: any = null;
    try { rt = createSceneRuntime(canvas.current, project.data, { buffers, noFetch: true, overlay: overlay.current }); } catch (e) { setMissing(true); }
    return () => { if (rt) rt.dispose(); };
  }, [project, buffers]);

  if (missing) return <div className="viewer"><div className="msg">This page is private or does not exist.</div></div>;
  if (!project) return <div className="viewer" />;
  const scrolls = usesScroll(project.data);
  return (
    <div className="viewer" data-scroll-section={scrolls ? '' : undefined}
      style={{ background: project.data.bg, height: scrolls ? (project.data.scrollLen || 3) * 100 + 'vh' : undefined }}>
      <div className="pin"><canvas ref={canvas} /><div ref={overlay} /></div>
    </div>
  );
}

export default function ViewPage() {
  return <Suspense fallback={null}><Viewer /></Suspense>;
}
