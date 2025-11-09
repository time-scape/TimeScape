import { atom } from "nanostores";
import { domainX, domainY } from "../constants";
import { Figure } from "../types";

/** 时间缩放的范围 */
export const $domainX = atom<[Date, Date]>(domainX);
/** 纵向缩放的范围（归一化成0-1） */
export const $domainY = atom<[number, number]>(domainY);

/** 选中的时间段 */
export const $timeSelected = atom<[Date, Date] | null>(null);
/** 每个选中人物选中的时间段 */
export const $figuresTimeSelected = atom<Map<number, [Date, Date]>>(new Map());

export function figureTimeSelectedListener(figuresClicked: readonly Figure[]) {
    let modified = false;
    const figuresTimeSelected = $figuresTimeSelected.get();
    for (let [id, _] of figuresTimeSelected) {
        if (!figuresClicked.find(figure => figure.id === id)) {
            figuresTimeSelected.delete(id);
            modified = true;
        }
    }
    if (modified) {
        $figuresTimeSelected.set(figuresTimeSelected);
    }
}