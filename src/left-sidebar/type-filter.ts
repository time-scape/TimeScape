import * as d3 from "d3";
import Component from "../component";
import { $allFigures, $dict, $figures, $language, $typeSelected } from "../store";
import { atom, computed } from "nanostores";
import { color } from "../constants";
import { Figure } from "../types";

/** 所有的人物类型 */
export const $types = computed([
    $allFigures,
], (allFigures) => {
    const types = new Set<string>();
    for (const figure of allFigures) {
        types.add(figure.type);
    }
    return Array.from(types).sort();
});

function getTypeInfos(types: string[], figures: Figure[]) {
    const typeInfos = new Map<string, { count: number }>();
    for (const type of types) {
        typeInfos.set(type, { count: 0 });
    }
    for (const figure of figures) {
        const type = figure.type;
        if (typeInfos.has(type)) {
            typeInfos.get(type)!.count++;
        }
    }
    return Array.from(typeInfos.entries()).map(([type, info]) => ({
        type,
        ...info,
    })).sort((a, b) => b.count - a.count);
}

const $allTypeInfos = computed([
    $types,
    $allFigures,
], (types, figures) => {
    return getTypeInfos(types, figures);
});

const $typeInfos = computed([
    $types,
    $figures,
], (types, figures) => {
    return getTypeInfos(types, figures);
});

const $filtered = computed([
    $allFigures,
    $figures
], (allFigures, figures) => {
    return allFigures.length !== figures.length;
});

const $showAllDataBar = atom<boolean>(true);

export default class TypeFilter extends Component {
    root: SVGElement;

    constructor(
        root: SVGElement,
        parent: Component,
        baseSize: number
    ) {
        super();
        this.root = root;
        this.parent = parent;
        this.baseSize = baseSize;
    }

    setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    render() {
        const allData = $allTypeInfos.get(),
            allDataIndices = new Map(allData.map((d, i) => [d.type, i])),
            data = $typeInfos.get().sort((a, b) => allDataIndices.get(a.type)! - allDataIndices.get(b.type)!),
            showAllDataBar = $showAllDataBar.get(),
            filtered = $filtered.get(),
            selected = $typeSelected.get(),
            language = $language.get(),
            dict = $dict.get();

        const g = d3.select(this.root),
            width = this.width,
            height = this.height,
            barHeight = height / data.length,
            barX = language === "zh-cn" ? barHeight * 2 : barHeight * 3.6,
            barWidth = width - barX,
            xScale = d3.scaleLinear()
                .domain([0, d3.max(showAllDataBar ? allData : data, d => d.count)!])
                .range([0, barWidth]);

        // 背景
        g.selectAll(".background-bar")
            .data(showAllDataBar ? allData : [])
            .join("g")
            .classed("background-bar", true)
            .attr("transform", (d, i) => `translate(0, ${i * barHeight})`)
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                const width = xScale(d.count);
                g.html("");
                g.append("rect")
                    .attr("x", barX)
                    .attr("width", width)
                    .attr("height", barHeight * 0.8)
                    .attr("fill", "#ccc");
            });
        // 前景
        g.selectAll(".bar")
            .data(data)
            .join("g")
            .classed("bar", true)
            .attr("transform", (d, i) => `translate(0, ${i * barHeight})`)
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                const v = selected === null || selected === d.type;
                const width = xScale(d.count);
                const countInBar = width > barWidth - barHeight * 2;
                const count = d.count;
                const totalCount = allData.find(t => t.type === d.type)!.count;
                g.html("");

                g.append("text")
                    .attr("x", barX)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "end")
                    .attr("dx", "-0.3em")
                    .attr("dy", "0.7em")
                    .attr("font-size", barHeight * 0.7)
                    .text(dict[d.type])
                    .style("fill", color);

                g.append("rect")
                    .attr("x", barX)
                    .attr("width", width)
                    .attr("height", barHeight * 0.8)
                    .attr("fill", color);

                g.append("text")
                    .attr("x", barX + width)
                    .attr("dx", countInBar ? "-0.3em" : "0.3em")
                    .attr("text-anchor", countInBar ? "end" : "start")
                    .attr("fill", countInBar ? "#fff" : color)
                    .attr("dominant-baseline", "middle")
                    .attr("dy", "0.7em")
                    .attr("font-size", barHeight * 0.7)
                    .html(showAllDataBar && filtered ? `${count}<tspan font-size="0.6em">/${totalCount}</tspan>` : `${count}`);
                
                g
                    .style("cursor", "pointer")
                    .style("opacity", v ? 1 : 0.3)
                    .on("click", () => {
                        if ($typeSelected.get() === d.type) {
                            $typeSelected.set(null);
                        } else {
                            $typeSelected.set(d.type);
                        }
                    });
            });
    }

    listenInteraction() {
        $typeSelected.listen(() => {
            this.render();
        });
        $figures.listen(() => {
            this.render();
        });
    }
}