import { atom } from "nanostores";
import { Figure } from "../types";
import Searcher from "../utils/Searcher";

/** 关键字筛选 */
export const $keywords = atom<string[]>([]);

/** 关键词筛选结果 */
export function getFigureKeywordInfos (
    allFigures: Figure[],
    keywords: string[],
) {
    const search = new Searcher(allFigures);
    const result = search.searchMany(keywords);
    return new Set(result.map(r => r.id));
}