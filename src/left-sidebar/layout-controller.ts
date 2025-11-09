import * as d3 from "d3";
import { bgcolor, color } from "../constants";
import { layouts } from "../config";
import { $layoutMethod, $figuresClicked, $dict } from "../store";
import { Figure } from "../types";
import Component from "../component";
import TitleElement from "../components/title";

export default class LayoutController extends Component {

    root: SVGElement;

    layoutFiguresSelected: {
        figuresUp: Figure[];
        figuresDown: Figure[];
    };

    constructor(
        root: SVGElement,
        parent: Component,
        baseSize: number
    ) {
        super();
        this.root = root;
        this.parent = parent;
        this.baseSize = baseSize;

        this.layoutFiguresSelected = {
            figuresUp: [],
            figuresDown: $figuresClicked.get(),
        }
    }

    setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    render() {
        const width = this.width,
            height = this.height,
            baseSize = this.baseSize * 0.9,
            g = d3.select(this.root);

        const layout = (() => {
            let elem: d3.Selection<any, any, any, any> = g.select(".layout");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("layout", true);
                return elem;
            }
            return elem;
        })();
        layout.attr("transform", `translate(0, ${height})`);
        this.renderLayout(layout, width, height);

        // const figuresElem = (() => {
        //     let elem = g.select<SVGGElement>(".figures-elem");
        //     if (elem.empty()) {
        //         elem = g.append("g")
        //             .classed("figures-elem", true);
        //         return elem;
        //     }
        //     return elem;
        // })();
        // figuresElem.attr("transform", `translate(0, ${baseSize * 5})`);
    }
    renderLayout(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number
    ) {
        const methods = Object.keys(layouts);
        const dict = $dict.get();

        const columns = 3;
        const rows = Math.ceil(methods.length / columns);
        const W = width / columns;
        const w = W * 0.9;
        const dw = (W - w) / 2;
        const H = height / rows;
        const h = H * 0.7;
        const dh = (H - h) / 2;
        

        g.selectAll(".item")
            .data(methods)
            .join("g")
            .classed("item", true)
            .attr("transform", (d, i) => {
                return `translate(${(i % columns) * W + dw}, ${ (Math.floor(i / columns)) * H + dh})`;
            })
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                g.html("");
                const r = h * 0.5;
                // 两个圆组成单选框
                g.append("circle")
                    .attr("cx", h * 0.5)
                    .attr("cy", h * 0.5)
                    .attr("r", r)
                    .style("fill", "none")
                    .style("stroke", color)
                    .style("stroke-width", 1);
                g.append("circle")
                    .attr("cx", h * 0.5)
                    .attr("cy", h * 0.5)
                    .attr("r", r * 0.6)
                    .style("fill", $layoutMethod.value[0] === d ? bgcolor : "#fff")

                // 选择文字
                g.append("text")
                    .attr("x", h + r * 0.6)
                    .attr("y", h * 0.6)
                    .attr("font-size", r * 2)
                    .attr("dominant-baseline", "middle")
                    .style("fill", color)
                    .text(dict[d]);

                g.style("cursor", "pointer")
                g.on("click", () => {
                    const thisArgs = d === "figureSelected" ? this.layoutFiguresSelected : null;
                    $layoutMethod.set([d as any, thisArgs]);
                });
            })
    }

    listenInteraction() {
        $layoutMethod.listen(() => {
            this.render();
        });
        $figuresClicked.listen(() => {
            this.render();
        });
    }
}