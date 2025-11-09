import { domainX } from "../constants";
import {
    HistoricalContexts,
    HistoricalContextWeights,
    FigureContexts,
    FigureContextWeights,
    Figure,
    TimeSelected,
    FiguresTimeSelected
} from "../types";
import { atom } from "nanostores";
import { figureContext, historicalContext } from "../utils/similarity";

/** 历史上下文各部分权重 */
export const $historicalContextWeights = atom<HistoricalContextWeights>({
    time: 0.02,
    posts: 0.08,
    relations: 0.9,
});

/** 个人上下文各部分权重 */
export const $figureContextWeights = atom<FigureContextWeights>({
    time: 0.00,
    posts: 0.06,
    locations: 0.06,
    relations: 0.88,
});

$figureContextWeights.listen(weights => {
    console.log("figureContextWeights", weights);
})

/** 历史上下文 */
export function getHistoricalContexts (
    figures: Figure[],
    timeSelected: TimeSelected,
    historicalContextWeights: HistoricalContextWeights,
) {
    if (timeSelected === null) timeSelected = domainX;
    const contexts = figures.map(figure => {
        return historicalContext(
            figure,
            timeSelected,
            historicalContextWeights,
        );
    }) as HistoricalContexts;
    let maxWeight = -Infinity;
    let minWeight = Infinity;
    contexts.forEach((context, i) => {
        if (context === null) return;
        context.weight = context.r * context._w;
    });

    contexts.forEach(context => {
        if (context === null) return;
        maxWeight = Math.max(maxWeight, context.weight);
        minWeight = Math.min(minWeight, context.weight);
    });
    contexts.maxWeight = maxWeight;
    contexts.minWeight = minWeight;
    contexts._maxW = Math.max(...contexts.map(c => c._w));

    contexts.maxWs = {
        time: Math.max(...contexts.map(c => c.time.weight)),
        posts: Math.max(...contexts.map(c => c.posts.weight)),
        relations: Math.max(...contexts.map(c => c.relations.weight)),
    };

    return contexts as HistoricalContexts;
}

export function getFigureContexts (
    figures: Figure[],
    figuresSelected: Figure[],
    figuresTimeSelected: FiguresTimeSelected,
    figureContextWeights: FigureContextWeights
) {
    if (figuresSelected.length === 0) return null;

    const contexts = figures.map(figure => {
        // if (figuresSelected.findIndex(f => f.id === figure.id) !== -1) return null;
        return figureContext(
            figure,
            figuresSelected,
            figuresTimeSelected,
            figureContextWeights,
        );
    }) as FigureContexts;
    let maxWeight = -Infinity;
    let minWeight = Infinity;
    contexts.forEach(context => {
        if (context === null) return;
        maxWeight = Math.max(maxWeight, context.weight);
        minWeight = Math.min(minWeight, context.weight);
    });
    contexts.maxWeight = maxWeight;
    contexts.minWeight = minWeight;
    contexts.maxWs = {
        time: Math.max(
            ...contexts.map(c => c?.reduce((acc, d) => acc + d.time.weight, 0) ?? 0),
            1
        ),
        posts: Math.max(
            ...contexts.map(c => c?.reduce((acc, d) => acc + d.posts.weight, 0) ?? 0),
            1
        ),
        locations: Math.max(
            ...contexts.map(c => c?.reduce((acc, d) => acc + d.locations.weight, 0) ?? 0),
            1
        ),
        relations: Math.max(
            ...contexts.map(c => c?.reduce((acc, d) => acc + d.relations.weight, 0) ?? 0),
            1
        ),
    };

    return contexts;
}