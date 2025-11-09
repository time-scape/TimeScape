import * as d3 from "d3";
import Component from "../component";
import { $postSelected, $figures, $allFigures, $postTree } from "../store";
import { icons } from "../components";
import { computed } from "nanostores";
import { Figure, InstitutionNode, PostNode } from "../types";

const $filtered = computed([
    $allFigures,
    $figures,
], (allFigures, figures) => {
    return allFigures.length !== figures.length;
});

export default class PostFilter extends Component {

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
        this.root.setAttribute("width", width.toString());
        this.root.setAttribute("height", height.toString());
    }

    render() {
        const g = d3.select(this.root),
            width = this.width,
            height = this.height;

        const container = (() => {
            let elem = g.select("div.post-filter-container");
            if (elem.empty()) {
                elem = g.append("xhtml:div")
                    .classed("post-filter-container", true)
                    .style("width", "100%")
                    .style("height", "100%")
                    .style("overflow", "auto hidden");
            }
            return elem;
        })();
        container.style("font-size", "12px");

        const postTree = $postTree.get()[0] as InstitutionNode,
            postSelected = $postSelected.get(),
            filtered = $filtered.get();

        const list: any[] = [];
        let p: any = postSelected ?? postTree;

        do {
            list.unshift(p);
        } while (p = p.parent as any, p !== null);
        p = null;
        list.forEach((item, i) => {
            list[i] = p === null ? postTree : p.children.find((child: InstitutionNode) => child.value.name === item.value.name);
            p = list[i];
        });
        
        container.selectAll("div.post-filter-list-wrapper")
            .data(list.filter(d => "children" in d))
            .join("div")
            .classed("post-filter-list-wrapper", true)
            .selectAll("div.post-filter-list")
            .data(d => [d])
            .join("div")
            .classed("post-filter-list", true)
            .each((datum, i, nodes) => {
                const g = d3.select(nodes[i]);
                g.selectAll("div.post-filter-item")
                    .data(datum.children)
                    .join("div")
                    .classed("post-filter-item", true)
                    .classed("post-filter-item-selected", d => list.includes(d))
                    .each((d: any, j, nodes) => {
                        const g = d3.select(nodes[j]);
                        g.html("");
                        const icon = g.append("div")
                            .classed("post-icon", true)
                        if ("children" in d) {
                            icon.html(icons.dictionary("1em" as any, "currentColor"));
                        }
                        g.append("div")
                            .classed("post-name", true)
                            .text(d.value.name);

                        g.append("div")
                            .classed("post-count", true)
                            .html(filtered ? `${d.figFilteredCount}<span class="total">/${d.figCount}</span>` : `${d.figCount}`);
                    })
                    .on("mouseenter", function() {
                        d3.select(this).classed("post-filter-item-hovered", true);
                    })
                    .on("mouseleave", function() {
                        d3.select(this).classed("post-filter-item-hovered", false);
                    })
                    .on("click", (_, d) => {
                        const selected = $postSelected.get()?.value.id === d.value.id ? null : d;
                        $postSelected.set(selected as any);
                        setTimeout(() => {
                            // 将container平滑地滚动到最右侧
                            const node = container.node() as any;
                            node.scrollTo({
                                left: node.scrollWidth ?? 0,
                                behavior: "smooth"
                            });
                        }, 0);
                    })
            })
    }



    listenInteraction() {
        $postTree.listen(() => {
            this.render();
        });
        // $postSelected.listen(() => {
        //     this.render();
        // });
    }
}