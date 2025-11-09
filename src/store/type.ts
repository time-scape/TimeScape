import { atom, computed } from "nanostores";

/** 选中的人物类型 */
export const $typeSelected = atom<string | null>(null);