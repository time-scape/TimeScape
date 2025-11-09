import * as d3 from 'd3';
import { Selection } from 'd3-selection';
import { bgcolor, color, colormap, relationScoreColormap } from '../constants';
import { $dict, $eventSelected, $figuresClicked, $figureContexts, $figureContextWeights, $figureHovered, $figuresSelected, $figuresSelectedColorMap, $historicalContexts, $historicalContextWeights, $keywords, $figures, $language, $locationSelected, $postSelected, $postTree } from '../store';
import SVGTextLength from '../utils/SVGTextLength';
import { atom, computed } from 'nanostores';
import { icons } from '../components';
import { Figure, InstitutionNode, PostNode } from '../types';
import { historicalOverlap } from '../utils/similarity';
import PostParser from '../utils/PostParser';
import TitleElement from '../components/title';

interface Props {
    x: number;
    y: number;
    width: number;
    height: number;
}

type PosX = {
    x: number;
    width: number;
}
type PosY = {
    y: number;
    height: number;
}
type RenderConfig = {
    updateTablePosition?: boolean;
    renderBorder?: boolean;
    renderSearchBox?: boolean;
    renderSelectedFigure?: boolean;
    renderContextController?: boolean;
    renderFigures?: boolean;
}

/** 权重是否被锁定 */
const historicalContextWeightLock = new Array(Object.entries($historicalContextWeights.get()).length).fill(0);
const figureContextWeightLock = new Array(Object.entries($figureContextWeights.get()).length).fill(0);

let oldFiguresSelected: Figure[] = $figuresSelected.get();

/** 详细信息中显示的人物 */
const $figurePinned = atom<Figure | null>(null);

/** 在0或1之间变化，用来触发figureList的重排 */
const $reorder = atom<number>(1);

let lastFigureSets: Set<number> = new Set();

/** 排序过的人物列表 */
let figureList: Figure[] & { idx2OriginIdx: Map<number, number> };
const $figureList = computed([
    $figures,
    $reorder,
    $historicalContexts,
    $figureContexts,
], (figures, reorder, historicalContexts, figureContexts) => {
    let set = new Set(figures.map(f => f.id));
    // 判断set和lastFigureSet是否完全一样
    let allSame = [...lastFigureSets].every(x => set.has(x)) && [...set].every(x => lastFigureSets.has(x));
    if (!reorder && allSame) return figureList;
    lastFigureSets = set;
    let indices: number[];
    if (figureContexts === null) {
        indices = new Array(figures.length).fill(0).map((_, i) => i)
            .sort((a, b) => {
                return historicalContexts[b].weight - historicalContexts[a].weight;
            });
    }
    else {
        const figuresSelected = $figuresSelected.get();
        indices = new Array(figures.length).fill(0).map((_, i) => i)
            .sort((a, b) => {
                const idxA = figuresSelected.indexOf(figures[a]);
                const idxB = figuresSelected.indexOf(figures[b]);
                if (idxA !== -1 && idxB !== -1) {
                    return idxA - idxB;
                }
                else if (idxA !== -1) {
                    return -1;
                }
                else if (idxB !== -1) {
                    return 1;
                }
                return (figureContexts[b].weight - figureContexts[a].weight) || (historicalContexts[b].weight - historicalContexts[a].weight);
            })
    }
    const map = new Map<number, number>();
    indices.forEach((idx, i) => {
        map.set(i, idx);
    });
    const result: Figure[] & { idx2OriginIdx: Map<number, number> } = indices.map(i => figures[i]) as any;
    result.idx2OriginIdx = map;

    figureList = result;
    return result;
});


function generateColorFilter(id: string, color: string) {
  // 解析十六进制颜色为 R, G, B（范围 0-1）
  function hexToRgbNorm(hex: string) {
    hex = hex.replace("#", "");
    if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("");
    }
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  const [r, g, b] = hexToRgbNorm(color);

  // 构造 <filter> 元素
  const svgns = "http://www.w3.org/2000/svg";
  const filter = document.createElementNS(svgns, "filter");
  filter.setAttribute("id", id);

  const fe = document.createElementNS(svgns, "feColorMatrix");
  fe.setAttribute("type", "matrix");

  // 设置颜色映射矩阵，把黑色映射为目标颜色
  // 结果色 = 原色 * matrix
  fe.setAttribute("values", `
    ${r} 0 0 0 0
    0 ${g} 0 0 0
    0 0 ${b} 0 0
    0 0 0 1 0
  `.trim().replace(/\s+/g, " ")); // 压缩空格

  filter.appendChild(fe);
  return filter;
}

const $indices = computed([
    $figureList,
], (figures) => {
    return new Array(figures.length).fill(0).map((_, i) => i);
});

const svgTextLength = new SVGTextLength();

export default class RightSidebar {
    props: Props;
    root: HTMLDivElement | null = null;

    baseSize: number;

    tableX: {
        /** 最左侧x坐标 */
        x0: number;
        /** 姓名最右侧x坐标 */
        x1: number;
        /** 权重指标的x坐标 */
        xWeight: number;
        /** 权重指标的宽度 */
        wWeight: number;
        /** historical context几个指标的x坐标（中点位置） */
        hContext: {
            [key in keyof typeof $historicalContextWeights.value]: number;
        };
        /** historical context几个指标的宽度 */
        whContext: {
            [key in keyof typeof $historicalContextWeights.value]: number;
        };
        /** 分割线x坐标 */
        x2: number;
        /** figure context几个指标的x坐标（中点位置） */
        fContext: {
            [key in keyof typeof $figureContextWeights.value]: number;
        };
        /** figure context几个指标的宽度 */
        wfContext: {
            [key in keyof typeof $figureContextWeights.value]: number;
        };
        /** 最右侧x坐标 */
        x3: number;

        /** head和body之间的padding */
        h0: number;
        /** 一条数据的高度 */
        h: number;
        /** 整个表格的高度（包括上下两端的padding） */
        H: number;
    } = {
        x0: 0,
        x1: 0,
        xWeight: 0,
        wWeight: 0,
        hContext: {} as any,
        whContext: {} as any,
        x2: 0,
        fContext: {} as any,
        wfContext: {} as any,
        x3: 0,

        h0: 0,
        h: 0,
        H: 0,
    }

    /** 当前人物列表滚动到的scrollY（用于虚拟滚动） */
    scrollY: number = 0;
    /** 是否临时锁定选中人物的切换 */
    switchLock: boolean = false;

    constructor(props: Partial<Props>) {
        this.props = Object.assign({
            x: 0,
            y: 0,
            width: 100,
            height: 300,
        }, props);
        this.baseSize = Math.min(this.props.width, this.props.height) * 0.042;
    }

    initialize() {
        /** 设置颜色滤镜 */
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        for (const color of colormap) {
            const filter = generateColorFilter(`filter-${color}`, color);
            defs.appendChild(filter);
        }
        this.root!.appendChild(defs);

        this.listenInteraction();
        figureList = $figureList.get();

    }

    setRoot(root: HTMLDivElement) {
        this.root = root;
        // this.updatePosition();
        this.initialize();
    }
    render(
        config: RenderConfig = {}
    ) {
        const root = d3.select(this.root);
        if (root.empty()) return;

        const dict = $dict.get();
        const padding = this.baseSize * 0.3;
        const searchY = this.props.height * 0.01;
        const searchHeight = this.props.height * 0.06;
        const infoTitleY = this.props.height * 0.06;
        const infoY = this.props.height * 0.10;
        const infoHeight = this.props.height * 0.31;

        const listTitleY = this.props.height * 0.42;
        const listY = listTitleY + TitleElement.$height.get() + padding;
        const listTotalHeight = this.props.height * 0.99 - listY;
        const listHeight = this.props.height * 0.45;
        const controllerHeight = listTotalHeight - listHeight;

        if (config.updateTablePosition) {
            this.updateTablePosition();
        }

        if (config.renderBorder) {
            const border = (() => {
                let elem: Selection<any, any, any, any> = root.select(".border");
                if (elem.empty()) {
                    elem = root.append("div")
                        .classed("border", true);
                    return elem;
                }
                return elem;
            })();
            this.renderBorder(border);
        }

        if (config.renderSearchBox) {
            const searchBox = (() => {
                let elem: Selection<any, any, any, any> = root.select(".search-box");
                if (elem.empty()) {
                    elem = root.append("div")
                        .style("position", "absolute")
                        .classed("search-box", true);
                    return elem;
                }
                return elem;
            })();
            searchBox
                .style("width", `${this.props.width - padding * 2}px`)
                .style("height", `${searchHeight}px`)
                .style("left", `${padding}px`)
                .style("top", `${searchY}px`);
            this.renderSearchBox(searchBox, {
                y: searchY,
                height: searchHeight,
            });
        }

        const selectedFigureTitle = (() => {
            let elem: d3.Selection<any, any, any, any> = root.select(".selected-figure-title");
            if (elem.empty()) {
                elem = root.append("div")
                    .style("position", "absolute")
                    .classed("selected-figure-title", true);
            }
            return elem;
        })();
        selectedFigureTitle
            .style("left", `${padding}px`)
            .style("top", `${infoTitleY}px`);

        TitleElement.renderDiv(selectedFigureTitle, dict["selected figure info"], this.props.width - padding * 2);

        if (config.renderSelectedFigure) {
            const obj = (() => {
                let elem: Selection<any, any, any, any> = root.select(".figure-container");
                if (elem.empty()) {
                    elem = root.append("div")
                        .classed("figure-container", true)
                        .style("position", "absolute")
                        .style("overflow", "hidden");
                    return elem;
                }
                return elem;
            })();
            obj
                .style("left", `${padding}px`)
                .style("top", `${infoY}px`)
                .style("width", `${this.props.width - padding * 2}px`)
                .style("height", `${infoHeight}px`);

            const container = (() => {
                let elem: Selection<any, any, any, any> = obj.select(".container-content");
                if (elem.empty()) {
                    elem = obj.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                        .classed("container-content", true)
                        .style("width", "100%")
                        .style("height", "100%")
                        .style("display", "flex")
                        .style("flex-direction", "column")
                        .style("gap", "0.5em");
                    return elem;
                }
                return elem;
            })();
            
            const selectedFigureList = (() => {
                let elem: Selection<any, any, any, any> = container.select(".selected-figures-list");
                if (elem.empty()) {
                    elem = container
                        .append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                        .classed("selected-figures-list", true);
                    return elem;
                }
                return elem;
            })();
            const selectedFigure = (() => {
                let elem: Selection<any, any, any, any> = container.select(".selected-figures");
                if (elem.empty()) {
                    elem = container
                        .append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                        .style("display", "flex")
                        .style("flex-direction", "column")
                        .classed("selected-figures", true);
                    return elem;
                }
                return elem;
            })();
            selectedFigureList
                .style("width", this.props.width - padding * 2 + "px")
                // .style("height", this.props.height * 0.07 + "px")

            selectedFigure
                .style("width", this.props.width - padding * 2 + "px")
                .style("min-height", 0)
                .style("flex-grow", "1");

            this.renderSelectedFigureList(selectedFigureList, {
                y: 0,
                height: this.props.height * 0.07,
            });
            this.renderSelectedFigure(selectedFigure, {
                y: 0,
                height: this.props.height * 0.21,
            });
        }

        const listTitle = (() => {
            let elem: d3.Selection<any, any, any, any> = root.select(".list-title");
            if (elem.empty()) {
                elem = root.append("div")
                    .style("position", "absolute")
                    .classed("list-title", true);
            }
            return elem;
        })();

        listTitle
            .style("left", `${padding}px`)
            .style("top", `${listTitleY}px`);
        TitleElement.renderDiv(listTitle, dict["context info"], this.props.width - padding * 2);

        const obj = (() => {
            let elem: Selection<any, any, any, any> = root.select(".container");
            if (elem.empty()) {
                elem = root.append("div")
                    .style("position", "absolute")
                    .classed("container", true)
                return elem;
            }
            return elem;
        })();

        obj
            .style("left", `${padding}px`)
            .style("top", `${listY}px`)
            .style("width", `${this.props.width - padding * 2}px`)
            .style("height", `${listTotalHeight}px`);

        const container = (() => {
            let elem: Selection<any, any, any, any> = obj.select(".container-content");
            if (elem.empty()) {
                elem = obj.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                    .classed("container-content", true)
                    .style("display", "grid")
                    .style("flex-direction", "column")
                    .style("overflow", "hidden");
                return elem;
            }
            return elem;
        })();
        container
            .style("width", this.props.width - padding * 2 + "px")
            .style("height", listTotalHeight + "px")
            .style("grid-template-columns", `${Math.min(this.tableX.x1, this.props.width * 0.2)}px auto`)
            .style("grid-template-rows", `${controllerHeight}px auto`)
            .style("gap", `${this.baseSize}px ${padding}px`)

        const contextController = (() => {
            let elem: Selection<any, any, any, any> = container.select(".context-controller");
            if (elem.empty()) {
                elem = container.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                    .style("grid-row", "1")
                    .style("grid-column", "2")
                    .style("overflow", "auto hidden")
                    .append("svg")
                    .classed("context-controller", true);
                return elem;
            }
            return elem;
        })();
        const figureNames = (() => {
            let elem: Selection<any, any, any, any> = container.select(".figures");
            if (elem.empty()) {
                elem = container.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                    .style("width", "100%")
                    .style("grid-row", "2")
                    .style("grid-column", "1")
                    .style("overflow", "scroll hidden")
                    .append("svg")
                    .classed("figures", true);
                return elem;
            }
            return elem;
        })();
        const figureBars = (() => {
            let elem: Selection<any, any, any, any> = container.select(".figure-bars");
            if (elem.empty()) {
                elem = container.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                    .style("width", "100%")
                    .style("grid-row", "2")
                    .style("grid-column", "2")
                    .style("overflow", "auto hidden")
                    .append("svg")
                    .classed("figure-bars", true);
                return elem;
            }
            return elem;
        })();

        if (config.renderContextController) {
            contextController
                .attr("x", this.tableX.x1)
                .attr("y", 0)
                .attr("width", this.tableX.x3 - this.tableX.x1)
                .attr("height", controllerHeight);
            this.renderContextController(contextController, {
                y: listY,
                height: controllerHeight,
            });

            d3.select(contextController.node().parentNode)
                .on("scroll", e => {
                    figureBars.node().parentNode.scrollLeft = e.target.scrollLeft;
                });
        }

        if (config.renderFigures) {
            figureNames
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", this.tableX.x1)
                .attr("height", listHeight);
            this.renderFigureNames(figureNames, {
                y: 0,
                height: listHeight,
            });
            figureBars
                .attr("x", this.tableX.x1)
                .attr("y", 0)
                .attr("width", this.tableX.x3 - this.tableX.x1)
                .attr("height", listHeight);
            this.renderFigureBars(figureBars, {
                y: 0,
                height: listHeight,
            });

            d3.select(figureNames.node().parentNode).on("wheel", (e: any) => {
                this.scrollY = Math.min(this.tableX.H - listHeight, Math.max(0, this.scrollY + e.deltaY));
                this.renderFigureNames(figureNames, {
                    y: 0,
                    height: listHeight,
                });
                this.renderFigureBars(figureBars, {
                    y: 0,
                    height: listHeight,
                });
            });
            d3.select(figureBars.node().parentNode)
                .on("wheel", (e: any) => {
                    this.scrollY = Math.min(this.tableX.H - listHeight, Math.max(0, this.scrollY + e.deltaY));
                    this.renderFigureNames(figureNames, {
                        y: 0,
                        height: listHeight,
                    });
                    this.renderFigureBars(figureBars, {
                        y: 0,
                        height: listHeight,
                    });
                })
                .on("scroll", e => {
                    contextController.node().parentNode.scrollLeft = e.target.scrollLeft;
                });
        }
    }

    /** 计算表格中各个格线的位置 */
    updateTablePosition() {
        // 先计算左侧姓名需要预留出的宽度
        const fontSize = this.baseSize;
        const padding = fontSize * 0.3;
        const hWeights = $historicalContextWeights.get();
        const fWeights = $figureContextWeights.get();
        const dict = $dict.get();
        const data = $figureList.get();

        let dx = 0;
        const w0 = Math.max(...data.map(label => {
            const w =  svgTextLength.visualWidth(label.name, fontSize);
            return w;
        }), 0);
        dx += w0;
        const xName = dx;
        dx += padding;

        const wWeight = svgTextLength.visualWidth(dict["weight"], fontSize);
        const xWeight = dx + wWeight * 0.5;
        dx += wWeight + padding;

        const xHistoricalContext: {
            [key in keyof typeof hWeights]: number;
        } = {} as any;
        const wHistoricalContext: {
            [key in keyof typeof hWeights]: number;
        } = {} as any;
        Object.keys(hWeights).forEach(k => {
            const name = dict[k];
            const nameWidth = svgTextLength.visualWidth(name, fontSize);
            const x = dx + nameWidth * 0.5;
            dx += nameWidth + padding;
            xHistoricalContext[k as keyof typeof hWeights] = x;
            wHistoricalContext[k as keyof typeof hWeights] = nameWidth;
        });

        const xSplitline = dx + fontSize * 0.5;
        dx += fontSize;

        const xFigureContext: {
            [key in keyof typeof fWeights]: number;
        } = {} as any;
        const wFigureContext: {
            [key in keyof typeof fWeights]: number;
        } = {} as any;
        Object.keys(fWeights).forEach(k => {
            const name = dict[k];
            const nameWidth = svgTextLength.visualWidth(name, fontSize);
            const x = dx + nameWidth * 0.5;
            dx += nameWidth + padding;
            xFigureContext[k as keyof typeof fWeights] = x;
            wFigureContext[k as keyof typeof fWeights] = nameWidth;
        });

        const totalWidth = dx - padding;

        const h0 = 0;
        const h = fontSize * 2;
        const H = h0 * 2 + h * $figures.get().length;

        this.tableX = {
            x0: padding,
            x1: xName,
            xWeight: xWeight,
            wWeight: wWeight,
            hContext: xHistoricalContext,
            whContext: wHistoricalContext,
            x2: xSplitline,
            fContext: xFigureContext,
            wfContext: wFigureContext,
            x3: totalWidth,

            h0,
            h,
            H,
        }
    }

    renderBorder(g: Selection<any, any, any, any>) {
        const { width, height } = this.props;

        g.html("");
        g.append("div")
            .classed("border", true)
            .style("width", `${width}px`)
            .style("height", `${height}px`)
            .style("position", "absolute")
            .style("left", "0px")
            .style("top", "0px")
            .style("border", `1px solid ${color}`)
            .style("box-sizing", "border-box")
            .style("pointer-events", "none");
    }

    renderSearchBox(
        g: Selection<any, any, any, any>,
        pos: PosY,
    ) {
        const figures = $figures.get();
        const dict = $dict.get();

        let container: Selection<any, any, any, any> = g.select(".search-box-container");
        if (container.empty()) {
            container = g.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                .classed("search-box-container", true)
                .classed("layui-form", true)
                .style("width", "100%")
                .style("height", "100%")
                .style("display", "flex")
                .style("flex-direction", "column")
                .style("gap", "0.5em");
        }
        let searchBox: Selection<any, any, any, any> = container.select(".search-box");
        if (searchBox.empty()) {
            searchBox = container.append("select")
                .classed("search-box", true)
                .attr("lay-search", "{caseSensitive:true}")
                .attr("lay-filter", "figure-search");
        }
        searchBox.selectAll("option")
            .data(figures)
            .join("option")
            .attr("value", d => d.id)
            .text(d => d.name);
        
        searchBox.insert("option", ":first-child")
            .attr("value", "")
            .text(dict["enter figure name"])
            .attr("selected", "selected");

        layui.use(['form'], function(){
            const form = layui.form;
            form.render('select'); // 重新渲染select组件
            form.on('select(figure-search)', (data) => {
                if (data.value === "") return;
                const id = Number.parseInt(data.value);
                const figure = figures.find(f => f.id === id)!;
                const figureClicked = $figuresClicked.get();
                if (figureClicked.find(f => f.id === figure.id) === undefined) {
                    $figuresClicked.set([...figureClicked, figure]);
                }
                $figurePinned.set(figure);
            });
        });
        
    }

    renderSelectedFigureList(
        g: Selection<any, any, any, any>,
        pos: PosY,
    ) {
        const figuresSelected = $figuresSelected.get();
        const colormap = $figuresSelectedColorMap.get();

        const container = (() => {
            let elem: Selection<any, any, any, any> = g.select(".figure-list");
            if (elem.empty()) {
                elem = g.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                    .classed("figure-list", true)
                    .style("display", "flex")
                    .style("gap", "0.5em")
                    .style("flex-direction", "row");
                return elem;
            }
            return elem;
        })();

        container.selectAll("div")
            .data(figuresSelected)
            .join("div")
            .classed("figure-item", true)
            .style("border-color", d => colormap.get(d.id)!)
            .style("font-size", `${this.baseSize}px`)
            .style("background-color", d => $figurePinned.get() === d ? colormap.get(d.id)! : null)
            .style("color", d => $figurePinned.get() === d ? "#fff": colormap.get(d.id)!)
            .text(d => d.name)
            .on("click", (e, d) => {
                $figurePinned.set(d);
            });
    }
    renderSelectedFigure(
        g: Selection<any, any, any, any>,
        posY: PosY,
    ) {
        const figure = $figurePinned.get();
        const keywords = $keywords.get();
        const keywordsReg = new RegExp(keywords.join("|"), "gi");
        const dict = $dict.get();
        if (figure === null) {
            g.html("");
            return;
        }
        const baseSize = this.baseSize,
              locations = figure.locations;
        // g.style("height", "100%");
        const infoElem = (() => {
            let elem: Selection<any, any, any, any> = g.select(".figure-info");
            if (elem.empty()) {
                elem = g.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                    .classed("figure-info", true);
                return elem;
            }
            return elem;
        })();

        infoElem.node().innerText = figure.description;

        // infoElem.selectAll(".alter-name")
        //     .data(Object.keys(figure.alterNames))
        //     .join("div")
        //     .classed("alter-name", true)
        //     .style("font-size", `${this.baseSize}px`)
        //     .each((d, i, nodes) => {
        //         const div = d3.select(nodes[i]);
        //         const c = $figuresSelectedColorMap.get().get(figure.id)!;
        //         div.html("");
        //         div.append("div")
        //             .classed("single-icon", true)
        //             .style("background-color", c)
        //             .text(d);
        //         div.append("div")
        //             .classed("text", true)
        //             .style("font-size", `${this.baseSize}px`)
        //             .style("color", c)
        //             .text(figure.alterNames[d]);
        //     });
        
        const eventsElem = (() => {
            let elem: Selection<any, any, any, any> = g.select(".figure-events");
            if (elem.empty()) {
                elem = g.append(() => document.createElementNS("http://www.w3.org/1999/xhtml", "div"))
                    .classed("figure-events", true);
                return elem;
            }
            return elem;
        })();

        eventsElem.selectAll(".figure-event")
            .data(figure.events)
            .join("div")
            .classed("figure-event", true)
            .style("font-size", `${baseSize}px`)
            .each((d, i, nodes) => {
                const div = d3.select(nodes[i]);
                const location = locations.find((l, i) => {
                    let start = l.time;
                    if (start === null) return false;
                    let end = (i < locations.length - 1 && locations[i + 1]!.time !== null) ? locations[i + 1]!.time! : figure.time[1];
                    return start <= d.time && end > d.time;
                });
                const locationName = location?.name ?? dict["unknown"];
                // const title = `${d.time.getFullYear()}-${d.time.getMonth() + 1}-${d.time.getDate()} ${location}`;
                div.html("");
                div.append("div")
                    .classed("item-timeline", true)
                    .classed("item-timeline-first", i === 0)
                div.append("div")
                    .classed("item-node", true)
                    .style("background-color", bgcolor);
                const title = div.append("div")
                    .classed("event-body", true)
                    .classed("event-title", true)
                    .style("color", bgcolor);

                title.append("span")
                    .classed("event-date", true)
                    .text(`${d.time.getFullYear()}-${d.time.getMonth() + 1}-${d.time.getDate()}`)
                title.append("span")
                    .classed("event-location", true)
                    .style("margin-left", "0.5em")
                    .text(locationName)
                    .on("click", () => {
                        if (!location) return;
                        $locationSelected.set({
                            ...$locationSelected.get(),
                            location,
                        });
                    })

                const text = div.append("div")
                    .classed("event-body", true)
                    .classed("event-text", true)
                    .style("color", "#555");
                if (d.type !== null) {
                    text.append("span")
                        .classed("event-type-icon", true)
                        .style("background-color", color)
                        .text(d.type);
                }
                text.append("span")
                    .html(d.description.replaceAll(keywordsReg, (match) => `<span class="keyword">${match}</span>`));

                const posts = div.append("div")
                    .classed("event-body", true)
                    .classed("event-posts", true);

                posts.selectAll("div")
                    .data(d.posts)
                    .join("div")
                    .classed("event-post", true)
                    .each((post, i, nodes) => {
                        const g = d3.select(nodes[i]);
                        g.html("");
                        const name = g.append("div")
                            .classed("event-post-name", true)
                            .property("--color", PostParser.postColorMap[post.rank])
                            .text(post.name)
                            .on("click", () => {
                                const posts = $postTree.get()[1] as (InstitutionNode | PostNode)[];
                                const p = posts.find(p => p.value.id === post.id)!;
                                if ($postSelected.get()?.value?.id === post.id) {
                                    $postSelected.set(null);
                                } else {
                                    $postSelected.set(p);
                                }
                            })
                            .node();
                        name!.style.setProperty("--color", PostParser.postColorMap[post.rank]);
                        g.selectAll(".event-post-institution")
                            .data(post.institutions)
                            .join("div")
                            .classed("event-post-institution", true)
                            .text(inst => inst.name)
                            .on("click", (e, inst) => {
                                const posts = $postTree.get()[1] as (InstitutionNode | PostNode)[];
                                const p = posts.find(p => p.value.id === inst.id)!;
                                console.log(p, posts, inst);
                                if ($postSelected.get()?.value?.id === inst.id) {
                                    $postSelected.set(null);
                                } else {
                                    $postSelected.set(p);
                                }
                            })
                    });
                if (d.posts.length === 0) {
                    posts.style("display", "none");
                }

                const relatedFigures = div.append("div")
                    .classed("event-body", true)
                    .classed("related-figures", true);
                const colormap = relationScoreColormap;

                
                relatedFigures.selectAll(".related-figure")
                    .data(d.relations)
                    .join("div")
                    .classed("related-figure", true)
                    .each((relation, i, nodes) => {
                        const div = d3.select(nodes[i]);
                        div.html("");
                        div.append("div")
                            .classed("related-type", true)
                            .style("background-color", colormap.get(relation.score) ?? colormap.get(0)!)
                            .text(relation.type);
                        div.append("div")
                            .classed("related-name", true)
                            .text(relation.name)
                            .on("click", () => {
                                const figuresClicked = $figuresClicked.get();
                                const index = figuresClicked.findIndex(f => f.id === relation.id);
                                if (index !== -1) {
                                    this.switchLock = true;
                                    figuresClicked.splice(index, 1);
                                    $figuresClicked.set(figuresClicked.slice());
                                    return;
                                }
                                const figures = $figures.get();
                                const figure = figures.find(f => f.id === relation.id);
                                if (figure) {
                                    this.switchLock = true;
                                    $figuresClicked.set([...figuresClicked, figure]);
                                }
                            })
                        div.append("div")
                            .classed("related-description", true)
                            .text(relation.description);
                    })
            });
    }

    scrollToEvent(eventIdx: number) {
        const figure = $figurePinned.get();
        if (figure === null) {
            return;
        }
        const eventsElem = d3.select(this.root).select(".figure-events");
        const eventElem = eventsElem.selectAll(".figure-event").nodes()[eventIdx] as Element;
        if (eventElem) {
            eventElem.scrollIntoView({ behavior: "smooth", block: "nearest" });
            const observer = new IntersectionObserver((entries, obs) => {
                if (entries[0].isIntersecting) {
                    obs.disconnect();
                    // 背景变成bgcolor然后再变回来，形成一个闪动的提示效果
                    eventElem.querySelector(".event-text")!
                        .animate([
                            { backgroundColor: bgcolor },
                            { backgroundColor: "transparent" }
                        ], {
                            duration: 500,
                            fill: "forwards"
                        });
                }
            }, { threshold: 0.9, });
            observer.observe(eventElem);
        }
    }

    renderContextController(
        g: Selection<any, any, any, any>,
        pos: PosY,
    ) {
        const height = pos.height;
        const offsetX = this.tableX.x1;

        const language = $language.get();
        const dict = $dict.get(); 
        const historicalWeights = $historicalContextWeights.get();
        const figureWeights = $figureContextWeights.get();

        const fontSize = language === "zh-cn" ? this.baseSize : this.baseSize * 0.75;
        const historicalContextElem: Selection<any, any, any, any> = (() => {
            const elem = g.select(".historical-context");
            if (elem.empty()) {
                return g.append("g")
                    .classed("historical-context", true);
            }
            return elem;
        })();
        const figureContextElem: Selection<any, any, any, any> = (() => {
            const elem = g.select(".figure-context");
            if (elem.empty()) {
                return g.append("g")
                    .classed("figure-context", true);
            }
            return elem;
        })();

        const hData = Array.from(Object.keys(historicalWeights))
            .map((d) => {
                const name = dict[d];
                const nameWidth = svgTextLength.visualWidth(name, fontSize);
                const value = (historicalWeights as any)[d] as number;
                return {
                    key: d,
                    name,
                    nameWidth,
                    value,
                };
            });

        const fData = Array.from(Object.keys(figureWeights))
            .map((d) => {
                const name = dict[d];
                const nameWidth = svgTextLength.visualWidth(name, fontSize);
                const value = (figureWeights as any)[d] as number;
                return {
                    key: d,
                    name,
                    nameWidth,
                    value,
                };
            });

        let lineY = fontSize * 1.2;
        let lineH = height - fontSize * 2.7;

        const tableX = this.tableX;
        
        if (lineH < 0) {
            throw new Error("Please allocate enough height or smaller width for the right sidebar.");
        }

        function renderSlider<T extends typeof hData[number] | typeof fData[number]>(
            g: Selection<any, any, any, any>,
            parent: Selection<any, any, any, any>,
            d: T,
            i: number,
            data: T[],
            locks: number[],
            end: (data: T[]) => void,
        ) {
            const iconSize = fontSize * 0.8;
            const lockIcon = (() => {
                let elem: Selection<any, any, any, any> = g.select(".lock-icon");
                if (elem.empty()) {
                    elem = g.append("g")
                        .classed("lock-icon", true)
                        .style("cursor", "pointer")
                        .on("click", () => {
                            locks[i] = 1 - locks[i];
                            elem.html(locks[i] ? icons.lock(iconSize, color) : icons.unlock(iconSize, bgcolor));
                        });
                }
                return elem;
            })();
            lockIcon.html(locks[i] ? icons.lock(iconSize, color) : icons.unlock(iconSize, bgcolor));
            lockIcon.attr("transform", `translate(${-iconSize * 0.5}, 0)`);

            const line = (() => {
                let elem: Selection<any, any, any, any> = g.select(".line");
                if (elem.empty()) {
                    elem = g.append("line")
                        .classed("line", true)
                        .style("stroke", color)
                        .style("stroke-width", 1);
                }
                return elem;
            })();
            line
                .attr("x1", 0)
                .attr("y1", lineY)
                .attr("x2", 0)
                .attr("y2", lineY + lineH);

            const slider = (() => {
                let elem: Selection<any, any, any, any> = g.select(".slider");
                if (elem.empty()) {
                    elem = g.append("circle")
                        .classed("slider", true)
                        .style("fill", color)
                        .style("cursor", "pointer")

                    elem.call(
                        d3.drag()
                            .on("drag", (e) => {
                                const y = d3.pointer(e, g)[1] - pos.y;
                                console.log("y", y);
                                
                                const frozenW = data.reduce((acc, _d, i) => {
                                    if (_d.key === d.key || !locks[i]) return acc;
                                    return acc + _d.value;
                                }, 0);

                                const W = data.reduce((acc, _d, i) => {
                                    if (_d.key === d.key || locks[i]) return acc;
                                    return acc + _d.value;
                                }, 0);
                                const min = locks.every((lock, j) => lock || j === i) ? d.value : 0;
                                const max = 1 - frozenW;
                                const value = Math.max(min, Math.min(max, (lineH - y) / lineH));

                                const dv = value - d.value;
                                d.value = value;
                                for (let i = 0; i < data.length; ++i) {
                                    const _d = data[i];
                                    if (_d.key === d.key || locks[i]) {
                                        continue
                                    }
                                    _d.value = _d.value - dv * _d.value / (W || 1);
                                }
                                parent.selectAll(".slider")
                                    .attr("cy", function(d) {
                                        return lineY + lineH * (1 - (d as any).value);
                                    });
                            })
                            .on("end", () => {
                                end(data);
                            })
                    );
                }
                return elem;
            })();
            slider
                .attr("cx", 0)
                .attr("cy", lineY + lineH * (1 - d.value))
                .attr("r", fontSize * 0.3);
        
            const name = (() => {
                let elem: Selection<any, any, any, any> = g.select(".name");
                if (elem.empty()) {
                    elem = g.append("text")
                        .classed("name", true)
                        .style("font-size", fontSize)
                        .style("fill", color);
                }
                return elem;
            })();
            name.attr("x", 0)
                .attr("y", height - fontSize)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .text(d.name);
        }

        const weightElem = (() => {
            let elem: Selection<any, any, any, any> = historicalContextElem.select(".weight-item");
            if (elem.empty()) {
                elem = historicalContextElem.append("g")
                    .classed("weight-item", true)    
            }
            return elem;
        })();
        weightElem
            .attr("transform", `translate(${tableX.xWeight - offsetX}, 0)`)
            .html(`<text x="0" y="${height - fontSize}" text-anchor="middle" dominant-baseline="hanging" style="font-size: ${fontSize}px; fill: ${color}">${dict["weight"]}</text>`);

        historicalContextElem.selectAll(".item")
            .data(hData)
            .join("g")
            .classed("item", true)
            .attr("transform", (d, i) => {
                const x = tableX.hContext[d.key as keyof typeof tableX.hContext];
                // dx += (d.nameWidth + (hData[i + 1]?.nameWidth ?? 0)) * 0.5 + padding;
                return `translate(${x - offsetX}, 0)`;
            })
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                renderSlider(g, historicalContextElem, d, i, hData, historicalContextWeightLock, (data) => {
                    const weights: typeof historicalWeights = {} as any;
                    for (let i = 0; i < data.length; ++i) {
                        (weights as any)[data[i].key] = data[i].value;
                    }
                    this.updateTotalHistoricalContextWeight(weights);
                    $historicalContextWeights.set(weights);
                });
            });

        const splitLine = (() => {
            let elem: Selection<any, any, any, any> = g.select(".split-line");
            if (elem.empty()) {
                elem = g.append("line")
                    .classed("split-line", true)
                    .style("stroke", color)
                    .style("stroke-width", 1);
            }
            return elem;
        })();
        
        splitLine
            .attr("x1", tableX.x2 - offsetX)
            .attr("y1", 0)
            .attr("x2", tableX.x2 - offsetX)
            .attr("y2", height)
            .attr("stroke-dasharray", "5,5");

        figureContextElem.selectAll(".item")
            .data(fData)
            .join("g")
            .classed("item", true)
            .attr("transform", (d, i) => {
                const x = tableX.fContext[d.key as keyof typeof tableX.fContext];
                return `translate(${x - offsetX}, 0)`;
            })
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                renderSlider(g, figureContextElem, d, i, fData, figureContextWeightLock, (data) => {
                    const weights: typeof figureWeights = {} as any;
                    for (let i = 0; i < data.length; ++i) {
                        (weights as any)[data[i].key] = data[i].value;
                    }
                    for (const key of Object.keys(weights)) {
                        if ((weights as any)[key] < 1e-6) {
                            (weights as any)[key] = 0;
                        }
                    }
                    
                    $figureContextWeights.set(weights);
                });
            });
    }

    renderFigureNames(
        g: Selection<any, any, any, any>,
        posY: PosY,
    ) {
        const height = posY.height;
        const data = $figureList.get();
        const indices = $indices.get().filter(i => {
            const h0 = this.tableX.h * i;
            const h1 = this.tableX.h * (i + 1);
            return h1 >= this.scrollY && h0 <= this.scrollY + height;
        });
        const colorMap = $figuresSelectedColorMap.get();
        const figureClicked = $figuresClicked.get();

        g.selectAll(".name")
            .data(indices, (d: any) => d)
            .join("g")
            .classed("name", true)
            .attr("transform", (idx, i) => {
                const x = this.tableX.x0;
                const y = this.tableX.h * (idx as number) - this.scrollY;
                return `translate(${x}, ${y})`;
            })
            .each((idx, i, nodes) => {
                const g = d3.select(nodes[i]);
                const label = data[idx as number];
                const name = (() => {
                    let elem: Selection<any, any, any, any> = g.select(".name");
                    if (elem.empty()) {
                        elem = g.append("text")
                            .classed("name", true)
                            .attr("id", label.name)
                            .attr("dy", "-0.4em")
                            .style("font-size", this.baseSize)
                            .attr("user-select", "none")
                            .style("cursor", "pointer")
                            .on("pointerenter", () => {
                                $reorder.set(0);
                                $figureHovered.set(figureClicked.indexOf(label) === -1 ? label : null);

                                const listenLeave = (e: PointerEvent) => {
                                    const target = e.target as SVGElement;
                                    if (!target.classList.contains("name") || target.id !== label.name) {
                                        $figureHovered.set(null);
                                        $reorder.set(1);

                                        window.removeEventListener("pointermove", listenLeave);
                                    }
                                };
                                window.addEventListener("pointermove", listenLeave);
                            })
                            // .on("pointerleave", () => {
                            //     $figureHovered.set(null);
                            //     $reorder.set(1);
                            // })
                            .on("click", () => {
                                const figureClicked = $figuresClicked.get();
                                const index = figureClicked.findIndex(figure => figure.id === label.id);
                                if (index === -1) {
                                    $figuresClicked.set([...figureClicked, label]);
                                }
                                else {
                                    $figuresClicked.set(figureClicked.filter(figure => figure.id !== label.id));
                                }
                                $reorder.set($reorder.get() === 1 ? 0 : 1);
                            });
                        return elem;
                    }
                    return elem;
                })();
                const c = colorMap.get(label.id) ?? color;
                name
                    .attr("x", 0)
                    .attr("y", this.tableX.h * 0.5)
                    .attr("fill", c)
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "middle")
                    .text(label.name);
            });         
    }

    renderFigureBars (
        g: Selection<any, any, any, any>,
        posY: PosY,
    ) {
        const height = posY.height;
        const tableX = this.tableX;
        const indices = $indices.get().filter(i => {
            const h0 = tableX.h * i;
            const h1 = tableX.h * (i + 1);
            return h1 >= this.scrollY && h0 <= this.scrollY + height;
        });
        const colorMap = $figuresSelectedColorMap.get();
        const historicalWeights = $historicalContextWeights.get();
        const historicalContexts = $historicalContexts.get();
        const figureWeights = $figureContextWeights.get();
        const figureContexts = $figureContexts.get();
        const figureList = $figureList.get();
        const figuresSelected = $figuresSelected.get();
        const dict = $dict.get();
        const fontSize = this.baseSize;
        

        g.selectAll(".bars")
            .data(indices, (d: any) => d)
            .join("g")
            .classed("bars", true)
            .attr("transform", (idx, i) => {
                const y = tableX.h * (idx as number) - this.scrollY;
                return `translate(0, ${y})`;
            })
            .each((idx, i, nodes) => {
                const g = d3.select(nodes[i]);
                const orgIdx = figureList.idx2OriginIdx.get(idx as number)!;
                const historicalContext = historicalContexts[orgIdx];
                const figureContext = figureContexts === null ? null : figureContexts[orgIdx];

                const weightBar = (() => {
                    let elem: Selection<any, any, any, any> = g.select(".weight-bar");
                    if (elem.empty()) {
                        elem = g.append("rect")
                            .classed("weight-bar", true);
                        return elem;
                    }
                    return elem;
                })();
                weightBar
                    .attr("x", tableX.xWeight - tableX.wWeight * 0.5 - this.tableX.x1)
                    .attr("y", 0)
                    .attr("width", tableX.wWeight * historicalContext._w / historicalContexts._maxW)
                    .attr("height", fontSize)
                    .attr("fill", bgcolor);

                g.selectAll(".historical-bar")
                    .data(Object.keys(historicalWeights))
                    .join("g")
                    .classed("historical-bar", true)
                    .attr("transform", (d, j) => {
                        const key = d as keyof typeof historicalWeights;
                        const x = tableX.hContext[key] - tableX.x1;
                        const w = tableX.whContext[key];
                        return `translate(${x - w * 0.5}, 0)`;
                    })
                    .each((d, j, nodes) => {
                        const g = d3.select(nodes[j]);
                        const key = d as keyof typeof historicalWeights;
                        const width = tableX.whContext[key];
                        const r = (historicalContext as any)[d].weight / historicalContexts.maxWs[key];
                        g.html("");
                        g.append("rect")
                            .attr("x", 0)
                            .attr("y", 0)
                            .attr("width", width * r)
                            .attr("height", fontSize)
                            .attr("fill", bgcolor)
                    });
                if (figureContext === null) {
                    g.selectAll(".figure-bar").html("");
                    return;
                }
                else {
                    g.selectAll(".figure-bar")
                        .data(Object.keys(figureWeights))
                        .join("g")
                        .classed("figure-bar", true)
                        .attr("transform", (d, j) => {
                            const key = d as keyof typeof figureWeights;
                            const x = tableX.fContext[key] - tableX.x1;
                            const w = tableX.wfContext[key];
                            return `translate(${x - w * 0.5}, 0)`;
                        })
                        .each((d, j, nodes) => {
                            const g = d3.select(nodes[j]);
                            const key = d as keyof typeof figureWeights;
                            const width = tableX.wfContext[key];
                            let dx = 0;
                            g.selectAll(".sub-bar")
                                .data(figureContext)
                                .join("rect")
                                .classed("sub-bar", true)
                                .each((figureContext, k, nodes) => {
                                    const rect = d3.select(nodes[k]);
                                    const c = colorMap.get(figuresSelected[k].id)!;
                                    const w = width * (figureContext as any)[d].weight / figureContexts!.maxWs[key];
                                    rect.attr("x", dx)
                                        .attr("y", 0)
                                        .attr("width", w)
                                        .attr("height", fontSize)
                                        .attr("fill", c)
                                    dx += w;
                                });
                        });
                }
                
            });
    }
    
    // updatePosition() {
    //     if (this.root === null) return;
    //     const { x, y, width, height } = this.props;
    //     const root = d3.select(this.root);
    //     root
    //         .attr("x", x)
    //         .attr("y", y)
    //         .attr("width", width)
    //         .attr("height", height)
    // }

    updateTotalHistoricalContextWeight(weights: typeof $historicalContextWeights.value) {
        $figures.get().forEach(label => {
            label.totalHistoricalContextWeight = historicalOverlap(label, label.time, weights).weight;
        });
    }

    listenInteraction() {
        $figures.listen(() => {
            this.render({
                renderSearchBox: true,
            })
        })
        $figureList.listen(() => {
            this.render({
                renderFigures: true,
            });
        });
        $figureHovered.listen(() => {
            this.render({
                renderFigures: true,
            });
        });
        $figuresSelected.listen(() => {
            const figuresSelected = $figuresSelected.get();
            if (this.switchLock) {
                this.switchLock = false;
            }
            else {
                if (figuresSelected.length > oldFiguresSelected.length) {
                    $figurePinned.set($figuresSelected.get().at(-1) as any);
                }
                else {
                    if ($figuresSelected.get().indexOf($figurePinned.get() as any) === -1) {
                        $figurePinned.set($figuresSelected.get().length === 0 ? null : $figuresSelected.get()[0]);
                    }
                }
            }
            this.render({
                renderSelectedFigure: true,
            });

            oldFiguresSelected = figuresSelected;
        });

        $figurePinned.listen(() => {
            this.render({
                renderSelectedFigure: true,
            });
        });
        
        $eventSelected.listen(() => {
            const eventSelected = $eventSelected.get();
            if (eventSelected !== null) {
                const figuresSelected = $figuresSelected.get();
                const figure = eventSelected.figure,
                      idx = eventSelected.idx;
                let fig: Figure | undefined;
                if ((fig = figuresSelected.find(f => f.id === figure.id)) !== undefined) {
                    $figurePinned.set(fig);
                    setTimeout(() => {
                        this.scrollToEvent(idx);
                    }, 0);
                }
            }
        });

        $keywords.listen(() => {
            this.render({
                renderSelectedFigure: true,
            });
        })
    }

    update() {
        
    }
}