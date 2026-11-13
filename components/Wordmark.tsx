// The WONDERfull logotype: the name's own contrast, heavy capitals into light lowercase.
export function Wordmark({ href }: { href?: string }) {
  const mark = <><b>WONDER</b><span>full</span></>;
  return href ? <a className="wm" href={href} aria-label="WONDERfull, all scenes">{mark}</a> : <span className="wm">{mark}</span>;
}
