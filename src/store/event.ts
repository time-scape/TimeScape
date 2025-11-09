import { atom } from "nanostores";
import { EventSelected } from "../types";

/** 选中的事件 */
export const $eventSelected = atom<EventSelected>(null);