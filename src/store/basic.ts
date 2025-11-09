import { atom, computed, ReadableAtom } from "nanostores";
import { zh_dict, en_dict } from "../constants";
import { Application, Renderer } from "pixi.js";

const url = new URL(window.location.href);
const language = url.searchParams.get("lang") === "en" ? "en" : "zh-cn";
const statusIcon = url.searchParams.get("status-icon") === "location" ? "location" : "status";
const locationLine = url.searchParams.get("location-line") === "icon" ? "icon" : "areachart";

/** 语言 */
export const $language = atom<"zh-cn" | "en">(language);

/** 字典 */
export const $dict: ReadableAtom<{
    [key: string]: string;
}> = computed([$language], (language) => {
    return language === "zh-cn" ? zh_dict : en_dict;
});

/** 屏幕尺寸 */
export const $size = atom({
    width: document.getElementById("app")!.clientWidth,
    height: document.getElementById("app")!.clientHeight,
});
window.addEventListener('resize', () => {
    $size.set({
        width: document.getElementById("app")!.clientWidth,
        height: document.getElementById("app")!.clientHeight,
    });
});

/** labels的pixi對象（主要是書籤組件需要截圖） */
export const $pixi = atom<Application<Renderer>|null>(null);

/** 人物状态标签显示的内容 */
export const $statusIcon = atom<"status" | "location">(statusIcon);

/** 人物的地點時間線的顯示方式（指南針圖標的形式還是面積圖的形式） */
export const $locationLine = atom<"icon" | "areachart">(locationLine);