import * as d3 from "d3";
import Component from "../component";
import { $dict, $figureKeywordInfos, $keywords } from "../store";
import { GpuMeshAdapter } from "pixi.js";
import { icons } from "../components";
import { color } from "../constants";

export default class KeywordSearcher extends Component {
    root: SVGGElement;
    constructor(
        root: SVGGElement,
        parent: Component,
        baseSize: number
    ) {
        super();
        this.root = root;
        this.parent = parent;
        this.baseSize = baseSize;

        this.keyboardEnterEvent = this.keyboardEnterEvent.bind(this);
    }

    setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    render() {
        const root = d3.select(this.root);
        const width = this.width;
        const height = this.height;

        const searchBoxRoot = (() => {
            let elem = root.select(".input");
            if (elem.empty()) {
                elem = root.append("xhtml:div")
                    .classed("input", true);
            }
            return elem;
        })();

        this.renderSearchBox(
            searchBoxRoot,
            width,
            height * 0.5,
        );

        const keywordsRoot = (() => {
            let elem = root.select(".keywords");
            if (elem.empty()) {
                elem = root.append("xhtml:div")
                    .classed("keywords", true);
            }
            return elem;
        })();
        keywordsRoot.style("margin-top", "0.5em");
        this.renderKeywords(
            keywordsRoot,
            width,
            height * 0.5,
        );
    }

    renderSearchBox(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number
    ) {
        g.style("width", width + "px")
         .style("height", height + "px")
         .style("font-size", height * 0.4 + "px")

        const placeholder = $dict.get()["请输入关键词"];

        const inputElem = (() => {
            let elem: d3.Selection<HTMLInputElement, any, any, any> = g.select("input");
            if (elem.empty()) {
                elem = g.append("input")
                    .style("type", "text")
                    .style("color", color);
            }
            return elem;
        })();
        inputElem.attr("placeholder", placeholder);
        
        inputElem.on("focus", () => {
            window.addEventListener("keydown", this.keyboardEnterEvent);
        });
        inputElem.on("blur", () => {
            window.removeEventListener("keydown", this.keyboardEnterEvent);
        });

        const iconElem = (() => {
            let elem: d3.Selection<HTMLDivElement, any, any, any> = g.select(".icon");
            if (elem.empty()) {
                elem = g.append("div")
                    .classed("icon", true);
            }
            return elem;
        })();
        iconElem.html(icons.enter("1em" as any, color));
        iconElem.on("click", () => {
            this.submit();
        });
    }

    renderKeywords(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number
    ) {
        g.style("width", width + "px")
         .style("height", height + "px")
         .style("font-size", height * 0.4 + "px");

        const keywords = $keywords.get();

        g.selectAll(".keyword")
            .data(keywords)
            .join("div")
            .classed("keyword", true)
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                g.html("");
                g.append("span")
                    .classed("keyword-text", true)
                    .text(d);
                g.append("div")
                    .classed("keyword-icon", true)
                    .html(icons.close("1em" as any, "#fff"))
                    .on("click", () => {
                        $keywords.set($keywords.get().filter(k => k !== d));
                    });
            })
    }

    keyboardEnterEvent(event: KeyboardEvent) {
        if (event.key === "Enter") {
            this.submit();
        }
    }

    submit() {
        const input = this.root.querySelector("input")!;
        let keyword = input.value;
        if (keyword === "") return;
        input.value = "";

        keyword = keyword.trim().split(/[ ;；\/、,，|]/).join("|");
        const keywords = $keywords.get();
        if (keywords.indexOf(keyword) === -1) {
            $keywords.set([keyword, ...keywords]);
        }
        else {
            $keywords.set([keyword, ...keywords.filter(k => k !== keyword)]);
        }
    }

    listenInteraction() {
        $keywords.listen(() => {
            this.render();
        });
        $figureKeywordInfos.listen((infos) => {
            console.log("infos", infos);
        });
    }
}