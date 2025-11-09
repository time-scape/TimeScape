import { atom, computed } from "nanostores";
import { Figure, FigureContextWeights, FiguresSelectedColorMap, FiguresTimeSelected, InstitutionNode, keywordInfos, LocationInfos, LocationSelected, PostNode, PostSelected } from "../types";
import { figureContext } from "../utils/similarity";
import { colormap, locationColorMap } from "../constants";
import EarthCoordinate from "../utils/EarthCoordinate";

export const $figureHovered = atom<Figure | null>(null);
/** 选中的人物（可以有多个） */
export const $figuresClicked = atom<Figure[]>([]);
export const $figuresSelected = computed([
    $figureHovered,
    $figuresClicked,
], (figureHovered, figuresClicked) => {
    if (figureHovered === null) return figuresClicked;
    const index = figuresClicked.findIndex(figure => figure.id === figureHovered.id);
    if (index === -1) {
        return [...figuresClicked, figureHovered];
    }
    return figuresClicked;
});

export function getFigures(
    allFigures: Figure[],
    figuresClicked: Figure[],
    figuresTimeSelected: FiguresTimeSelected,
    weightSelected: [number, number] | null,
    typeSelected: string | null,
    postSelected: PostSelected,
    locationSelected: LocationSelected,
    keywords: string[],
    figureContextWeights: FigureContextWeights,
    viewMode: "global" | "focused",
    keywordInfos: keywordInfos,
    locationInfos: LocationInfos,
) {
    const indices: number[] = [];
    let filtered =  allFigures.filter((f, i) => {
        if (typeSelected && f.type !== typeSelected) return false;
        if (weightSelected && (f.weight < weightSelected[0] || f.weight > weightSelected[1])) return false;
        if (postSelected) {
            const result = f.posts.some(post => {
                const names = [post.name, ...post.institutions.map(inst => inst.name)];
                const index = names.findIndex(name => name === postSelected.value.name);
                if (index === -1) return false;
                let p = postSelected;
                for (let i = index - 1; i >= 0; --i) {
                    if (!("children" in p)) return false;
                    const child = p.children.find(c => c.value.name === names[i]);
                    if (child === undefined) return false;
                    p = child;
                }
                indices.push(i);
                return true;
            });
            if (!result) return false;
        }
        
        const { distance } = locationSelected;
        const { center, locate } = locationInfos.get(f.id)!;
        if (locate === null) {
            // 已经触发了筛选
            if (distance < locationColorMap.maxDistance) return false;
        }
        else {
            const dist = center.distanceTo(locate);
            if (dist > distance) return false;
        }

        // if (postSelected && !f.posts.find(post => posts.has(post.name))) return false;
        if (keywords.length && !keywordInfos.has(f.id)) return false;

        indices.push(i);
        return true;
    });

    if (viewMode === "focused") {
        if (figuresClicked.length === 0) { // 正常是不会触发的
            throw new Error("No figures clicked");
        }
        const figuresClickedSet = new Set<number>(figuresClicked.map(f => f.id));
        const figuresSelected = $figuresSelected.get();
        const figuresClickedIndices = figuresClicked.map(figure => figuresSelected.findIndex(f => f.id === figure.id));
        // const contexts = $figureContexts.get()!;
        filtered = filtered.filter((figure, i) => {
            if (figuresClickedSet.has(figure.id)) return true;
            const context = figureContext(
                figure,
                figuresClicked,
                figuresTimeSelected,
                figureContextWeights,
            );
            for (const idx of figuresClickedIndices) {
                if (context[idx].weight > 0) {
                    return true;
                }
            }
            return false;
        });
    }

    return filtered;
}

/** 给选中的人物分配颜色 */
export function getFiguresSelectedColorMap (this: FiguresSelectedColorMap | undefined, figuresSelected: Figure[]) {
    const map: Map<number, string> = this ?? new Map();
    const colorsAllocated = new Set<string>(map.values());
    
    for (const key of map.keys()) {
        if (figuresSelected.findIndex(figure => figure.id === key) === -1) {
            colorsAllocated.delete(map.get(key)!);
            map.delete(key);
        }
    }

    for (const figure of figuresSelected) {
        if (map.has(figure.id)) continue;
        let colorIndex = 0;
        while (colorsAllocated.has(colormap[colorIndex]) && colorIndex < colormap.length) {
            colorIndex++;
        }
        if (colorIndex >= colormap.length) {
            colorIndex = 0;
        }
        map.set(figure.id, colormap[colorIndex]);
        colorsAllocated.add(colormap[colorIndex]);
    }
    return map;
}
