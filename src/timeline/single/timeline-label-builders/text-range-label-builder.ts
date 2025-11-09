import Label from "../timeline-label";
import { LabelBuilder, LabelBuilderAttributes } from "./label-builder";
import SVGTextLength from "../../utils/SVGTextLength";

type TextRangeLabelBuilderAttributes = LabelBuilderAttributes & Pick<TextRangeLabelBuilder, "text" | "subTimelineWidth" | "subTimelineHeight" | "opacity" | "textAlignment" | "textBaseline" | "fontSize" | "paddingVertical">;


const svgTextLength = new SVGTextLength();
const color = "#6f4922";
const bgcolor = "#ab8c70";

/**
 * 用于生成时间轴上的时间段标签，标签的内容为一段文字
 */
export default class TextRangeLabelBuilder extends LabelBuilder<TextRangeLabelBuilder> {
    text!: string;
    subTimelineWidth!: number;
    subTimelineHeight!: number;
    opacity: number = 1;
    textAlignment: "left" | "right" | "center" = "center";
    textBaseline: "top" | "bottom" | "center" = "center";
    fontSize: number = -1;
    paddingVertical: number = -1;
    declare time: [Date, Date];

    protected constructor() { super(); }

    static create(){
        return new TextRangeLabelBuilder();
    }

    attr<T extends keyof TextRangeLabelBuilderAttributes>(property: T, value: this[T]): this;
    attr<T extends keyof TextRangeLabelBuilderAttributes>(property: T): this[T];
    attr<T extends keyof TextRangeLabelBuilderAttributes>(property: T, value?: this[T]) {
        if(value === undefined){
            return this[property];
        }
        this[property] = value;
        return this;
    }

    build(): Label {
        const width = this.subTimelineWidth;
        const height = this.subTimelineHeight;
        const text = this.text;
        const opacity = this.opacity;
        const fontSize = this.fontSize === -1 ? height * 0.4 : this.fontSize;
        const paddingVertical = this.paddingVertical === -1 ? height * 0.2 : this.paddingVertical;
        const textWidth = svgTextLength.visualWidth(text, fontSize) + fontSize * 0.75;
        const importance = this.importance;
        return Label.create()
            .attr("time", this.time)
            // .attr("width", svgTextLength.visualWidth(text, height * 0.4) + height * 0.3)
            .attr("height", height)
            .attr("importance", importance)
            .attr("description", this.debug ? `[time range] ${text}` : "")
            .content((ctx, scale, label) => {
                const boundingBox = label.getBoundingBox(scale, [0, width]);
                ctx.save();
                ctx.translate(boundingBox.x, boundingBox.y);
                ctx.globalAlpha = opacity;

                if (!boundingBox.truncatedX1) {
                    ctx.beginPath();
                    ctx.moveTo(0, paddingVertical);
                    ctx.lineTo(0, height - paddingVertical);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                if (!boundingBox.truncatedX2) {
                    ctx.beginPath();
                    ctx.moveTo(boundingBox.width, paddingVertical);
                    ctx.lineTo(boundingBox.width, height - paddingVertical);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                if (boundingBox.width >= textWidth) {
                    const textBaseline = this.textBaseline;
                    const textAlignment = this.textAlignment;
                    const x = textAlignment === "center" ? boundingBox.width * 0.5 : textAlignment === "left" ? paddingVertical : boundingBox.width - paddingVertical;
                    const y = textBaseline === "center" ? boundingBox.height * 0.5 : textBaseline === "top" ? paddingVertical : boundingBox.height - paddingVertical;
                    ctx.fillStyle = color;
                    ctx.font = `${fontSize}px Source`;
                    ctx.textAlign = textAlignment;
                    ctx.textBaseline = textBaseline === "center" ? "middle" : textBaseline === "top" ? "hanging" : "alphabetic";
                    ctx.fillText(text, x, y);
                }

                ctx.restore();
            })
            // .content((g, scale, label) => {
            //     const boundingBox = label.getBoundingBox(scale, [0, width]);
            //     g.attr("transform", `translate(${boundingBox.x}, ${boundingBox.y})`);
            //     if (!boundingBox.truncatedX1) {
            //         g.append("line")
            //             .attr("x1", 0)
            //             .attr("y1", paddingVertical)
            //             .attr("x2", 0)
            //             .attr("y2", height - paddingVertical)
            //             .attr("stroke", color)
            //             .attr("stroke-width", 1)
            //             .attr("opacity", opacity);
            //     }
            //     if (!boundingBox.truncatedX2) {
            //         g.append("line")
            //             .attr("x1", boundingBox.width)
            //             .attr("y1", paddingVertical)
            //             .attr("x2", boundingBox.width)
            //             .attr("y2", height  - paddingVertical)
            //             .attr("stroke", color)
            //             .attr("stroke-width", 1)
            //             .attr("opacity", opacity);
            //     }

            //     if (boundingBox.width >= textWidth) {
            //         const textBaseline = this.textBaseline;
            //         const textAlignment = this.textAlignment;
            //         const dominantBaseline = textBaseline === "center" ? "middle" : textBaseline === "top" ? "hanging" : "baseline";
            //         const textAnchor = textAlignment === "center" ? "middle" : textAlignment === "left" ? "start" : "end";
            //         const x = textAlignment === "center" ? boundingBox.width * 0.5 : textAlignment === "left" ? paddingVertical : boundingBox.width - paddingVertical;
            //         const y = textBaseline === "center" ? boundingBox.height * 0.5 : textBaseline === "top" ? paddingVertical : boundingBox.height - paddingVertical;
            //         g.append("text")
            //             .attr("x", x)
            //             .attr("y", y)
            //             .attr("text-anchor", textAnchor)
            //             .attr("dominant-baseline", dominantBaseline)
            //             .attr("font-size", label.height * 0.4)
            //             .attr("fill", color)
            //             .attr("opacity", opacity)
            //             .style("user-select", "none")
            //             .text(text);
            //     }
            // })
    }
}