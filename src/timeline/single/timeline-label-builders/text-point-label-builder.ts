import Label from "../timeline-label";
import { LabelBuilder, LabelBuilderAttributes } from "./label-builder";
import SVGTextLength from "../../utils/SVGTextLength";

export type TextPointEventType = "科考" | "入仕" | "致仕" | "拜师" | "升官" | "贬官" | "迁转" | "最高官职" | "宰相" | "其他";

type TextPointLabelBuilderAttributes = LabelBuilderAttributes & Pick<TextPointLabelBuilder, "text" | "type" | "subTimelineWidth" | "subTimelineHeight" | "importance" | "opacity" | "maxWidth" | "maxLines">;

const svgTextLength = new SVGTextLength();

const color = "#6f4922";
const bgcolor = "#ab8c70";

export default class TextPointLabelBuilder extends LabelBuilder<TextPointLabelBuilder> {
    text!: string;
    type: TextPointEventType = "其他";
    side: "top" | "bottom" = "bottom";
    subTimelineWidth!: number;
    subTimelineHeight!: number;
    opacity: number = 1;
    maxWidth: number = -1;
    maxLines: number = 1;

    declare time: Date;
    protected constructor() { super(); }
    static create(){
        return new TextPointLabelBuilder();
    }

    attr<T extends keyof TextPointLabelBuilderAttributes>(property: T, value: this[T]): this;
    attr<T extends keyof TextPointLabelBuilderAttributes>(property: T): this[T];
    attr<T extends keyof TextPointLabelBuilderAttributes>(property: T, value?: this[T]) {
        if(value === undefined){
            return this[property];
        }
        this[property] = value;
        return this;
    }

    get fontSize() {
        return this.subTimelineHeight * 0.36;
    }

    build(): Label {
        const fontsize = this.fontSize;
        const width = this.subTimelineWidth;
        const height = this.subTimelineHeight;
        const opacity = this.opacity;
        const importance = this.importance;

        // const text = this.text;
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
            .attr("time", this.time)
            .attr("offsetY", height * 0.25)
            .attr("importance", importance)
            .attr("width", textWidth * 1.2)
            .attr("height", textHeight)
            .attr("description", this.debug ? `[time point] text-${this.text}` : "")
            .tick((ctx, scale, label, context) => {
                const side = context === undefined ? "bottom" : context.side;
                const boundingBox = label.getBoundingBox(scale);
                ctx.save();
                ctx.translate(boundingBox.x, 0);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.globalAlpha = context.opacity ?? opacity;
                ctx.beginPath();
                ctx.moveTo(boundingBox.width * 0.5, 0);
                ctx.lineTo(boundingBox.width * 0.5, (side === "top" ? -height * 0.2 : height * 0.2));
                ctx.stroke();

                ctx.restore();
            })
            .content((ctx, scale, label, context) => {
                const side = context === undefined ? "bottom" : context.side;
                const boundingBox = label.getBoundingBox(scale);
                const offsetY = side === "top" ? -boundingBox.height - fontsize * 1.2 : 0;

                ctx.save();
                ctx.translate(boundingBox.x, boundingBox.y);
                ctx.globalAlpha = opacity;
                ctx.fillStyle = color;
                ctx.font = `${fontsize}px Source`;
                ctx.textAlign = "center";
                ctx.textBaseline = "hanging";
                texts.forEach((d, i) => {
                    ctx.fillText(d, boundingBox.width * 0.5, i * fontsize * 1.2 + offsetY);
                });

                ctx.restore();
                // const side = ctx === undefined ? "bottom" : ctx.side;
                // const boundingBox = label.getBoundingBox(scale);
                // const offsetY = side === "top" ? -boundingBox.height - fontsize * 1.2 : 0;
                // g.attr("transform", `translate(${boundingBox.x}, ${boundingBox.y})`)
                //     .attr("opacity", opacity);
                // g.selectAll("text")
                //     .data(texts)
                //     .join("text")
                //     .attr("x", boundingBox.width * 0.5)
                //     .attr("y", (d, i) => i * fontsize * 1.2 + offsetY)
                //     .attr("font-size", fontsize)
                //     .attr("fill", color)
                //     .attr("text-anchor", "middle")
                //     .attr("alignment-baseline", "hanging")
                //     .style("user-select", "none")
                //     .text(d => d);
            });
        // const tickLabel = Label.create()
        //     .attr("time", this.time)
        //     .attr("importance", importance)
        //     .attr("width", 10)
        //     .attr("height", height * 0.2)
        //     .attr("description", this.debug ? `[time point] line-${this.text}` : "")
        //     .attr("width", 2)
        //     .content((g, scale, label, ctx) => {
        //         const side = ctx === undefined ? "bottom" : ctx.side;
        //         const boundingBox = label.getBoundingBox(scale);
        //         g.attr("transform", `translate(${boundingBox.x}, ${boundingBox.y})`)
        //             .attr("opacity", opacity);
        //         g.append("line")
        //             .attr("x1", 1)
        //             .attr("y1", 0)
        //             .attr("x2", 1)
        //             .attr("y2", height * 0.2 * (side === "top" ? -1 : 1))
        //             .attr("stroke", color)
        //             .attr("stroke-width", 1)
        //             .attr("opacity", 1);
        //     })

        
    }
}