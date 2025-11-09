import { atom } from "nanostores";

/** 选中的权重区间 */
export const $weightSelected = atom<[number, number] | null>(null);