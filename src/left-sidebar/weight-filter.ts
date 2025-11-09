
import { atom, computed } from "nanostores";
import Component from "../component";
import { $allFigures, $figures, $weightSelected } from "../store";
import * as d3 from "d3";
import { Figure } from "../types";
import { bgcolor, color } from "../constants";
import { all } from "mathjs";

const $weightHistogram = computed([
    $figures
], (figures) => {
    return d3.bin<Figure, number>()
        .value(d => d.weight)
        .domain([0, 1])
        .thresholds(d3.range(0, 1, 0.01))
        (figures);
});

const $allWeightHistogram = computed([
    $allFigures,
], (figures) => {
    return d3.bin<Figure, number>()
        .value(d => d.weight)
        .domain([0, 1])
        .thresholds(d3.range(0, 1, 0.01))
        (figures);
});

const $filtered = computed([
    $allFigures,
    $figures,
], (allFigures, figures) => {
    return allFigures.length !== figures.length;
});

const $showAllDataBar = atom<boolean>(true);

export default class WeightFilter extends Component {
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
        const g = d3.select(this.root);
        const width = this.width,
            height = this.height;

        const histogramElem = (() => {
            const elem = g.select(".histogram");
            if (elem.empty()) {
                return g.append("g")
                    .classed("histogram", true);
            }
            return elem;
        })();
        histogramElem.attr("transform", `translate(0, 0)`);
        this.renderHistogram(histogramElem, width, height * 0.7);

        const brushElement = (() => {
            const elem = g.select(".brush");
            if (elem.empty()) {
                return g.append("g")
                    .classed("brush", true);
            }
            return elem;
        })();
        brushElement.attr("transform", `translate(0, ${height * 0.71})`);
        this.renderBrush(brushElement, width, height * 0.29);
    }

    renderHistogram(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number,
    ) {
        const data = $weightHistogram.get(),
              allData = $allWeightHistogram.get(),
              filtered = $filtered.get(),
              showAllDataBar = $showAllDataBar.get(),
              fontSize = this.baseSize * 0.7,
              barWidth = width / allData.length;

        const xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, width]);

        const yScale = d3.scalePow()
            .exponent(0.5)
            .domain([0, d3.max(showAllDataBar ? allData : data, d => d.length)!])
            .range([0, height]);

        const xAxis = (() => {
            let elem: d3.Selection<any, any, any, any> = g.select(".x-axis");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("x-axis", true);
            }
            return elem;
        })();
        xAxis.html("");
        xAxis.attr("transform", `translate(0, ${height})`);
        xAxis.append("line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", 0)
            .attr("y2", 0)
            .style("stroke", color);

        xAxis.selectAll(".tick")
            .data(d3.range(0, 1.0, 0.1).map(d => Number(d.toFixed(1))))
            .join("g")
            .classed("tick", true)
            .attr("transform", d => `translate(${xScale(d)}, 0)`)
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                g.html("");
                g.attr("font-size", fontSize);
                g.append("line")
                    .attr("y2", "0.3em")
                    .attr("stroke-width", 1)
                    .attr("stroke", color);
                g.append("text")
                    .attr("dy", "0.4em")
                    .attr("dominant-baseline", "hanging")
                    .attr("text-anchor", "middle")
                    .style("user-select", "none")
                    .attr("fill", color)
                    .text(d);
            });
        
        const yAxis = (() => {
            let elem: d3.Selection<any, any, any, any> = g.select(".y-axis");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("y-axis", true);
            }
            return elem;
        })();
        yAxis.html("");
        yAxis.attr("transform", `translate(0, 0)`);
        yAxis.append("line")
            .attr("x1", width)
            .attr("x2", width)
            .attr("y1", 0)
            .attr("y2", height)
            .style("stroke", color);
        const tick = yAxis.append("g")
            .classed("tick", true)
            .attr("font-size", fontSize)
            .attr("transform", `translate(${width}, 0)`);
        tick.append("line")
            .attr("x2", "-0.3em")
            .attr("stroke-width", 1)
            .attr("stroke", color);

        tick.append("text")
            .attr("font-size", fontSize)
            .attr("x", "-0.4em")
            .attr("text-anchor", "end")
            .attr("fill", color)
            .attr("dominant-baseline", "middle")
            .style("user-select", "none")
            .text(yScale.domain()[1]);


        const backgroundElem = (() => {
            let elem: d3.Selection<any, any, any, any> = g.select(".background-bar");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("background-bar", true);
            }
            return elem;
        })();
        backgroundElem.selectAll(".background-bar")
            .data(showAllDataBar ? allData : [])
            .join("rect")
            .classed("background-bar", true)
            .attr("transform", d => `translate(${xScale((d.x0! + d.x1!) * 0.5)}, 0)`)
            .attr("x", -barWidth * 0.45)
            .attr("width", barWidth * 0.9)
            .attr("y", d => height - yScale(d.length))
            .attr("height", d => yScale(d.length))
            .attr("fill", "#ccc");

        const foregroundElem = (() => {
            let elem: d3.Selection<any, any, any, any> = g.select(".foreground-bar");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("foreground-bar", true);
            }
            return elem;
        })();
        foregroundElem.selectAll(".bar")
            .data(data)
            .join("rect")
            .classed("bar", true)
            .attr("transform", d => `translate(${xScale((d.x0! + d.x1!) * 0.5)}, 0)`)
            .attr("x", -barWidth * 0.45)
            .attr("width", barWidth * 0.9)
            .attr("y", d => height - yScale(d.length))
            .attr("height", d => yScale(d.length))
            .attr("fill", bgcolor);
            
        g.selectAll(".mask")
            .data([1], (d: any) => d)
            .join("rect")
            .attr("width", width)
            .attr("height", height)
            .style("opacity", 0)
            .attr("cursor", "crosshair")
            .on("click", () => {
                $showAllDataBar.set(!showAllDataBar);
            });

    }

    renderBrush(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number,
    ) {
        const weightSelected = $weightSelected.get();
        const xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, width]);

        const brush = d3.brushX()
            .extent([[0, 0], [width, height]])
            .on("brush", () => {
                g.select(".selection")
                    .attr("fill", bgcolor);
            })
            .on("end", (event) => {
                const selection = event.selection;
                if (selection) {
                    const [x0, x1] = selection.map(xScale.invert);
                    $weightSelected.set([x0, x1]);
                }
                else {
                    $weightSelected.set(null);
                }
            });

        const brushElem = (() => {
            let elem: d3.Selection<any, any, any, any> = g.select(".brush");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("brush", true);
            }
            return elem;
        })();

        brushElem.call(brush);
    }

    listenInteraction() {
        $figures.listen(() => {
            this.render();
        });
        $showAllDataBar.listen(() => {
            this.render();
        });
    }
}