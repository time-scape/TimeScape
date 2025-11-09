import { computed } from "nanostores";
import { $size } from "../store";
import * as d3 from "d3";
import { SVGTextLength } from "../labels/utils";
import { color, light_bgcolor } from "../labels/constants";

const svgTextLength = new SVGTextLength();

export default class TitleElement {
    static $height = computed([$size], (size) => size.height * 0.03);
    static renderSVG(
        g: d3.Selection<SVGGElement, any, any, any>,
        title: string,
        width: number,
    ) {
        g.html("");
        const height = TitleElement.$height.get();
        const fontSize = height * 0.6;
        // const textWidth = svgTextLength.visualWidth(title, fontSize);

        g.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .attr("fill", light_bgcolor)
            .attr("stroke", null)
            .attr("rx", height * 0.05)
            .attr("ry", height * 0.05);

        g.append("text")
            .attr("x", "0.3em")
            .attr("y", height / 2)
            .attr("font-size", fontSize)
            .attr("dominant-baseline", "middle")
            .attr("fill", color)
            .attr("dy", "0.1em")
            .text(title);
    }
    static renderDiv(
        container: d3.Selection<any, any, any, any>,
        title: string,
        width: number,
    ) {
        container.html("");
        const height = TitleElement.$height.get();
        const fontSize = height * 0.6;
        // const textWidth = svgTextLength.visualWidth(title, fontSize);
        container.append("div")
            .style("width", width + "px")
            .style("height", height + "px")
            .style("font-size", fontSize + "px")
            .style("line-height", height + "px")
            .style("color", color)
            .style("background-color", light_bgcolor)
            .style("border-radius", height * 0.05 + "px")
            .append("span")
            .style("padding-left", "0.3em")
            .text(title);
    }
}