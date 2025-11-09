export default function stringToRandom(str: string): number {
  let h = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h *= 16777619; // FNV prime
  }
  return (h >>> 0) / 0xFFFFFFFF;
}