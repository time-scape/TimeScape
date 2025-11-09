import Label from "../timeline-label";
import { LabelBuilder, LabelBuilderAttributes } from "./label-builder";
import SVGTextLength from "../../utils/SVGTextLength";

type TextRangeLabelBuilderAttributes = LabelBuilderAttributes
    & Pick<TextRange2LabelBuilder, "text" | "subTimelineWidth" | "subTimelineHeight" | "opacity" | "rangeOffsetY" | "side" | "maxWidth" | "maxLines">;


const svgTextLength = new SVGTextLength();
const color = "#6f4922";
const bgcolor = "#ab8c70";

export default class TextRange2LabelBuilder extends LabelBuilder<TextRange2LabelBuilder> {
    text!: string;
    subTimelineWidth!: number;
    subTimelineHeight!: number;
    opacity: number = 1;
    rangeOffsetY: number = 0;
    side: "top" | "bottom" = "top";
    maxWidth: number = -1;
    maxLines: number = 1; // maxLines的优先级高于maxWidth
    declare time: [Date, Date];

    protected constructor() { super(); }

    static create(){
        return new TextRange2LabelBuilder();
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
        // const text = this.text;
        const opacity = this.opacity;
        const fontsize = height * 0.36;
        const importance = this.importance;

        let textWidth: number;
        let textHeight: number;
        let texts: string[];

        if (this.maxLines === 1 || this.maxWidth <= 0) {
            texts = [this.text];
            textWidth = svgTextLength.visualWidth(this.text, fontsize);
            textHeight = fontsize;
        }
        else {
            if (this.maxWidth <= 0) {
                throw new Error("maxWidth must be greater than 0");
            }
            texts = svgTextLength.wrap(this.text, this.maxWidth, this.maxLines, "...", fontsize);
            textWidth = texts.length > 1 ? this.maxWidth : svgTextLength.visualWidth(texts[0], fontsize);
            textHeight = texts.length * fontsize * 1.2;
        }

        return Label.create()
            .attr("time", new Date((this.time[0].getTime() + this.time[1].getTime()) / 2))
            .attr("timeRange" as any, this.time)
            .attr("offsetY", height * 0.25)
            .attr("importance", importance)
            // .attr("alignment", "left")
            .attr("width", textWidth)
            .attr("height", textHeight)
            .attr("description", this.debug ? `[time range2] text-${this.text}` : "")
            .tick((ctx, scale, label, context) => {
                const boundingBox = label.getBoundingBox(scale, [0, width]);
                /** 圆角矩形 */
                const timeRange = label.attr("timeRange" as any) as [Date, Date];
                const x = 0;
                const y = this.side === "top" ? this.rangeOffsetY : height - this.rangeOffsetY;
                const rx = boundingBox.height * 0.1;
                const ry = boundingBox.height * 0.1;
                const w = scale(timeRange[1]) - scale(timeRange[0]);
                const h = boundingBox.height * 0.2;
                const W = label.attr("width") ?? 0;

                ctx.save();

                ctx.translate(boundingBox.x + W * 0.5 - w * 0.5, 0);
                ctx.globalAlpha = context.opacity ?? opacity;
                ctx.fillStyle = bgcolor;

                ctx.beginPath();
                ctx.moveTo(x + rx, y);
                ctx.lineTo(w - rx, y);
                ctx.quadraticCurveTo(w, y, w, y + ry);
                ctx.lineTo(w, y + h - ry);
                ctx.quadraticCurveTo(w, y + h, w - rx, y + h);
                ctx.lineTo(x + rx, y + h);
                ctx.quadraticCurveTo(0, y + h, 0, y + h - ry);
                ctx.lineTo(0, y + ry);
                ctx.quadraticCurveTo(0, y, x + rx, y);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            })
            .content((ctx, scale, label) => {
                const boundingBox = label.getBoundingBox(scale, [0, width]);
                ctx.save();
                ctx.translate(boundingBox.x + boundingBox.width * 0.5, boundingBox.y);
                ctx.globalAlpha = opacity;

                // 绘制文字
                for (let i = 0; i < texts.length; ++i) {
                    const text = texts[i];
                    ctx.fillStyle = color;
                    ctx.font = `${fontsize}px Source`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "hanging";
                    ctx.fillText(text, 0, i * fontsize * 1.2);
                }

                ctx.restore();

                // const boundingBox = label.getBoundingBox(scale, [0, width]);
                // g.attr("transform", `translate(${boundingBox.x}, ${boundingBox.y})`)
                //     .attr("opacity", opacity);

                // g.selectAll("text")
                //     .data(texts)
                //     .join("text")
                //     .attr("x", boundingBox.width * 0.5)
                //     .attr("y", (d, i) => i * fontsize * 1.2)
                //     .attr("font-size", fontsize)
                //     .attr("fill", color)
                //     .attr("text-anchor", "middle")
                //     .attr("alignment-baseline", "hanging")
                //     .style("user-select", "none")
                //     .text(d => d);
            });

        // const rangeLabel = Label.create()
        //     .attr("time", this.time)
        //     .attr("offsetY", this.rangeOffsetY)
        //     .attr("importance", importance)
        //     .attr("height", height * 0.08)
        //     .attr("description", this.debug ? `[time range2] range-${this.text}` : "")
        //     .content((g, scale, label) => {
        //         const boundingBox = label.getBoundingBox(scale, [0, width]);
        //         g.attr("transform", `translate(${boundingBox.x}, ${boundingBox.y})`)
        //             .attr("opacity", opacity);
        //         g.append("rect")
        //             .attr("x", 0)
        //             .attr("y", 0)
        //             .attr("width", boundingBox.width)
        //             .attr("height", boundingBox.height)
        //             .attr("rx", boundingBox.height * 0.5)
        //             .attr("ry", boundingBox.height * 0.5)
        //             .attr("fill", bgcolor);
        //     });

        // return [
        //     rangeLabel,
        //     textLabel,
        // ];
    }
}