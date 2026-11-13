// Read and write nested values by a dotted path such as "mat.color".
export const getP = (o: any, p: string): any => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

export function setP(o: any, p: string, v: any): void {
  const keys = p.split('.');
  let a = o;
  for (let i = 0; i < keys.length - 1; i++) {
    if (a[keys[i]] == null) a[keys[i]] = {};
    a = a[keys[i]];
  }
  a[keys[keys.length - 1]] = v;
}
