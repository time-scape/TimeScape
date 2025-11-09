import { atom, computed } from "nanostores";
import { Figure } from "../types";
import EarthCoordinate from "../utils/EarthCoordinate";
import { generateTree } from "./post";
import { getFigureLocationInfo, getLocations } from "./location";
import { getFigureContexts, getHistoricalContexts } from "./contexts";
import { getFigures, getFiguresSelectedColorMap } from "./figure";
import { figureTimeSelectedListener } from "./time";
import { getFigureKeywordInfos } from "./keyword";

import { $language, $dict, $size, $statusIcon, $locationLine } from "./basic";
import { $domainX, $domainY, $timeSelected, $figuresTimeSelected } from "./time";
import { $postSelected } from "./post";
import { $typeSelected } from "./type";
import { $locationSelected } from "./location";
import { $figureHovered, $figuresClicked, $figuresSelected } from "./figure";
import { $eventSelected } from "./event";
import { $historicalContextWeights, $figureContextWeights } from "./contexts";
import { $viewMode, $layoutMethod } from "./view";
import { $weightSelected } from "./weight";
import { $keywords } from "./keyword";
import $emitter from "./signal";


/** 人物数据 */
export const $allFigures = atom<Figure[]>([]);

export {
    $emitter,

    $language,
    $dict,
    $size,
    $statusIcon,
    $locationLine,

    $domainX,
    $domainY,

    $timeSelected,
    $figuresTimeSelected,

    $postSelected,
    $typeSelected,
    $locationSelected,

    $figureHovered,
    $figuresClicked,
    $figuresSelected,

    $eventSelected,
    $weightSelected,
    $keywords,

    $historicalContextWeights,
    $figureContextWeights,

    $viewMode,
    $layoutMethod,
}

// 去掉不是选中状态的人物的时间选中状态
$figuresClicked.listen((figuresClicked) => {
    figureTimeSelectedListener(figuresClicked);
});

/** 每个人物和选中地点的相关数据 */
export const $figureLocationInfos = computed([
    $allFigures,
    $timeSelected,
    $locationSelected,
], (figures, timeSelected, locationSelected) => {
    const result = new Map<number, { center: EarthCoordinate, locate: EarthCoordinate | null }>();
    for (const figure of figures) {
        result.set(figure.id, getFigureLocationInfo(figure, timeSelected, locationSelected));
    }
    return result;
});

/** 关键词筛选结果 */
export const $figureKeywordInfos = computed([
    $allFigures,
    $keywords,
], (allFigures, keywords) => {
    return getFigureKeywordInfos(allFigures, keywords);
});

/**
 * 当前筛选出的人物数据
 * @description 筛选可能由下面的情况触发：
 * @description 1. 在左侧栏选择了某个筛选条件
 * @description 2. 进入个人中心视图/多人中心视图
 */
export const $figures = computed([
    $allFigures,
    $figuresClicked,
    $figuresTimeSelected,
    $weightSelected,
    $typeSelected,
    $postSelected,
    $locationSelected,
    $keywords,
    $figureContextWeights,
    $viewMode,
], (allFigures, figuresClicked, figuresTimeSelected, weightSelected, typeSelected, postSelected, locationSelected, keywords, figureContextWeights, viewMode) => {
    const keywordInfos = $figureKeywordInfos.get();
    const locationInfos = $figureLocationInfos.get();
    return getFigures(
        allFigures,
        figuresClicked,
        figuresTimeSelected,
        weightSelected,
        typeSelected,
        postSelected,
        locationSelected,
        keywords,
        figureContextWeights,
        viewMode,
        keywordInfos,
        locationInfos
    );
});

/** 当前所有的官职（树结构） */
export const $postTree = computed([
    $allFigures,
    $figures,
], (allFigures, figures) => {
    return generateTree(allFigures, figures);
});

/** 人物ID到索引的映射 */
export const $figureId2index = computed([
    $figures,
], (figures) => {
    const map = new Map<number, number>();
    figures.forEach((figure, index) => {
        map.set(figure.id, index);
    });
    return map;
});

/** 所有的地点 */
export const $locations = computed([
    $figures,
], (figures) => getLocations(figures));

/** 给选中的人物分配颜色 */
export const $figuresSelectedColorMap = computed([
    $figuresSelected,
], (figuresSelected): Map<number, string> => {
    return getFiguresSelectedColorMap.call($figuresSelectedColorMap.value, figuresSelected);
});

/** 历史上下文 */
export const $historicalContexts = computed([
    $figures,
    $timeSelected,
    $historicalContextWeights,
], (figures, timeSelected, historicalContextWeights) => {
    return getHistoricalContexts(
        figures,
        timeSelected,
        historicalContextWeights
    );
});

/** 个人上下文 */
export const $figureContexts = computed([
    $figures,
    $figuresSelected,
    $figuresTimeSelected,
    $figureContextWeights,
], (figures, figuresSelected, figuresTimeSelected, figureContextWeights) => {
    return getFigureContexts(figures, figuresSelected, figuresTimeSelected, figureContextWeights);
});