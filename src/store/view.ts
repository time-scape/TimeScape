import { atom } from "nanostores";
import { layouts } from "../config";
import { BookMark } from "../types";
import Transform2D from "../labels/utils/transform2D";

/** 当前视图模式（全局/聚焦选中的人物） */
export const $viewMode = atom<"global" | "focused">("global");

/** 时间视图下的布局方法 */
export const $layoutMethod = atom<[keyof typeof layouts, thisArgs: any]>(["default", null]);

/** 书签  */
export const $bookmarks = atom<BookMark[]>([]);

/** 当前时间线的缩放尺度 */
export const $transform = atom<Transform2D>(new Transform2D());