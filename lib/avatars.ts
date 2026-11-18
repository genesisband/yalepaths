const PORTRAITS = ["01.jpg", "02.jpg", "03.jpg", "04.jpg", "05.jpg", "06.jpg", "07.jpg", "08.jpg"];

/** Same portrait for a profile every time, drawn from a small shared set. */
export function avatarFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 33 + id.charCodeAt(index)) >>> 0;
  return `/avatars/${PORTRAITS[hash % PORTRAITS.length]}`;
}
