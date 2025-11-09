import { Selection } from "d3-selection";
import { light_bgcolor, color } from "../constants";
import { $allFigures, $dict, $figures, $language } from "../store";
import Component from "../component";
import * as d3 from "d3";

export default class Title extends Component {
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
        const g = d3.select(this.root),
        width = this.width,
            height = this.height;

        this.renderTitle(g, width, height);
    }

    renderTitle(
        g: Selection<any, any, any, any>,
        width: number,
        height: number
    ) {
        const fontSize = height * 0.3;
        const paddingX = fontSize * 0.5;
        const language = $language.get();
        const dict = $dict.get();
        const figures = $figures.get();
        const allFigures = $allFigures.get();

        g.html("");
        g.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .style("fill", light_bgcolor)
            .style("stroke", color)
            .style("stroke-width", 1);
        g.append("text")
            .attr("x", paddingX)
            .attr("y", fontSize * 1.5)
            .attr("font-size", fontSize)
            // .style("font-weight", "bold")
            .style("fill", color)
            .text(dict["TimeScape"]);

        let innerHTML: string;

        if (language === "zh-cn") {
            innerHTML = figures.length === allFigures.length ?
                `共统计<tspan class="count">${figures.length}</tspan>个人物` :
                `选中了<tspan class="count">${figures.length}</tspan><tspan class="total" font-size="0.6em">/${allFigures.length}</tspan>个人物`;
        }
        else { // language === "en"
            innerHTML = figures.length === allFigures.length ?
                `<tspan class="count">${figures.length}</tspan> figures in total` :
                `<tspan class="count">${figures.length}</tspan><tspan class="total" font-size="0.6em">/${allFigures.length}</tspan> figures selected`;
        }

        g.append("text")
            .attr("x", paddingX)
            .attr("y", fontSize * 2.6)
            .attr("font-size", fontSize * 0.6)
            .style("fill", color)
            .html(innerHTML);
    }

    listenInteraction() {
        $figures.listen(() => {
            this.render();
        });
    }
}