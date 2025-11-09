import * as d3 from "d3";
import Component from "../component";
import { $bookmarks, $transform, $viewMode } from "../store/view";
import { $pixi } from "../store/basic";
import { icons } from "../components";
import { $emitter } from "../store";

export default class BookMarks extends Component {
    static counter: number = 0;

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
        const root = d3.select(this.root);
        const container = (() => {
            let elem: d3.Selection<any, any, any, any> = root.select(".container");
            if (elem.empty()) {
                elem = root.append("xhtml:div")
                .classed("container", true);
            }
            return elem;
        })();
        const bookmarks = $bookmarks.get();

        const bookmarkContainer = (() => {
            let elem: d3.Selection<any, any, any, any> = container.select(".bookmark-container");
            if (elem.empty()) {
                elem = container.append("xhtml:div")
                .classed("bookmark-container", true);
            }
            return elem;
        })();

        bookmarkContainer.selectAll("div.bookmark")
            .data(bookmarks)
            .join("div")
            .classed("bookmark", true)
            .each((d, i, nodes) => {
                const g = nodes[i] as HTMLDivElement;
                const snapshot = (() => {
                    let elem = g.querySelector("div.snapshot");
                    if (!elem) {
                        elem = document.createElement("div");
                        elem.classList.add("snapshot");
                        g.appendChild(elem);
                    }
                    return elem;
                })();
                snapshot.replaceChildren(d.screenshot);

                const description = (() => {
                    let elem = g.querySelector("div.description");
                    if (!elem) {
                        elem = document.createElement("div");
                        elem.classList.add("description");
                        g.appendChild(elem);
                    }
                    return elem;
                })();
                description.textContent = d.name;

                const footer = (() => {
                    let elem = g.querySelector("div.footer");
                    if (!elem) {
                        elem = document.createElement("div");
                        elem.classList.add("footer");
                        g.appendChild(elem);
                    }
                    return elem;
                })();

                const deleteButton = (() => {
                    let elem = g.querySelector("div.delete");
                    if (!elem) {
                        elem = document.createElement("div");
                        elem.classList.add("delete");
                        elem.classList.add("icon");
                        elem.innerHTML = icons.remove("1em", "currentColor");
                        footer.appendChild(elem);
                    }
                    return elem;
                })() as HTMLDivElement;

                deleteButton.onclick = () => {
                    this.remove(d.id);
                }

                const jumpToButton = (() => {
                    let elem = g.querySelector("div.jump-to");
                    if (!elem) {
                        elem = document.createElement("div");
                        elem.classList.add("jump-to");
                        elem.classList.add("icon");
                        elem.innerHTML = icons.enter("1em", "currentColor");
                        footer.appendChild(elem);
                    }
                    return elem;
                })() as HTMLDivElement;

                jumpToButton.onclick = () => {
                    $emitter.emit("book-mark", d.transform);
                }

                g.replaceChildren(
                    snapshot,
                    description,
                    footer,
                );
            });

        const bookmarkAddContainer = (() => {
            let elem: d3.Selection<any, any, any, any> = container.select(".bookmark-add-container");
            if (elem.empty()) {
                elem = container.append("xhtml:div")
                .classed("bookmark-add-container", true);
            }
            return elem;
        })();

        const bookmarkAdd = (() => {
            let elem: d3.Selection<any, any, any, any> = bookmarkAddContainer.select(".bookmark-add-icon");
            if (elem.empty()) {
                elem = bookmarkAddContainer.append("svg")
                    .classed("bookmark-add-icon", true);
                elem.html(icons.add("1em", "currentColor"));
            }
            return elem;
        })();
        bookmarkAddContainer.on("click", () => {
            this.add();
        });
    }

    add() {
        this.snapshot(500, 400).then((canvas) => {
            const bookmark = {
                id: BookMarks.counter++,
                name: `Bookmark ${BookMarks.counter}`,
                transform: $transform.get(),
                screenshot: canvas,
                viewMode: $viewMode.get(),
            }
            $bookmarks.set([...$bookmarks.get(), bookmark]);

            const container = this.root.querySelector(".bookmark-container")!;
            container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
        });
    }

    remove(id?: number) {
        const bookmarks = $bookmarks.get();
        if (id === undefined) id = bookmarks[bookmarks.length - 1]?.id;
        $bookmarks.set(bookmarks.filter(b => b.id !== id));
    }

    async snapshot(width: number = 800, height: number = 800) {
        const div = document.querySelector("div.labels")!;
        const rect = div.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // 将绘制效果缓存到画布中（gpu→cpu）
        const pixi = $pixi.get();
        if (!pixi) return document.createElement('canvas');

        // 创建离屏画布（你也可以直接用 <canvas>）
        const out = document.createElement('canvas');
        out.width  = Math.round(width * dpr);
        out.height = Math.round(height * dpr);
        const ctx = out.getContext('2d')!;
        ctx.scale(dpr, dpr);

        // 可选：统一背景
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);

        const realWidth = Math.min(width, height * (rect.width / rect.height));
        const realHeight = Math.min(height, width * (rect.height / rect.width));
        const realX = (width - realWidth) / 2;
        const realY = (height - realHeight) / 2;

        // 关键：按 DOM 顺序合成（若你有自定义层级，按需要排序）
        const canvasPixi = pixi.renderer.canvas;
        const rectPixi = {
            x: 0,
            y: 0,
            width: canvasPixi.width,
            height: canvasPixi.height
        }
        ctx.drawImage(canvasPixi, rectPixi.x, rectPixi.y, rectPixi.width, rectPixi.height, realX, realY, realWidth, realHeight);

        const canvasKonva = Array.from(div.querySelectorAll('canvas'))[1];
        const _rectKonva = canvasKonva.getBoundingClientRect();
        const rectKonva = {
            x: _rectKonva.x - rect.x,
            y: _rectKonva.y - rect.y,
            width: canvasKonva.width,
            height: canvasKonva.height
        };
        ctx.drawImage(canvasKonva, rectKonva.x, rectKonva.y, rectKonva.width, rectKonva.height, realX, realY, realWidth, realHeight);

        // // 下载
        // const link = document.createElement('a');
        // link.download = `bookmark.png`;
        // link.href = out.toDataURL();
        // link.click();

        return out;
    }

    listenInteraction() {
        let up = true;
        // 添加监听键盘
        document.addEventListener("keydown", (e) => {
            if (!up) return;
            if (e.key === "=" || e.key === "+") {
                this.add();
                up = false;
            }
            if (e.key === "-" || e.key === "_") {
                this.remove();
            }
        });
        document.addEventListener("keyup", (e) => {
            up = true;
        });
        $bookmarks.listen(() => {
            this.render();
        });
    }
}