import Component from "../component";
import mapData from "../assets/map.json";
import * as d3 from "d3";
import { bgcolor, color, light_bgcolor, locationColorMap } from "../constants";
import { $allFigures, $dict, $figureLocationInfos, $figures, $locations, $locationSelected } from "../store";
import * as icons from "../components/icons";
import { Figure, Location } from "../types";
import { toTraditional } from 'chinese-simple2traditional'
import { atom, computed } from "nanostores";
import EarthCoordinate from "../utils/EarthCoordinate";
import { LocationIcon } from "../labels/components";

const emptyLocation = locationColorMap.defaultAddress;
const maxDistance = 2000;


const $allDistanceHistogram = computed([
    $allFigures,
    $figureLocationInfos
], (figures, infos) => {
    return d3.bin<Figure, number>()
        .value(d => {
            const { center, locate } = infos.get(d.id)!;
            if (locate === null) return -1;
            return EarthCoordinate.distanceBetween(center, locate);
        })
        .domain([0, maxDistance])
        .thresholds(d3.range(0, maxDistance, 50))
        (figures);
});

const $distanceHistogram = computed([
    $figures,
    $figureLocationInfos,
], (figures, infos) => {
    return d3.bin<Figure, number>()
        .value(d => {
            const { center, locate } = infos.get(d.id)!;
            if (locate === null) return -1;
            return EarthCoordinate.distanceBetween(center, locate);
        })
        .domain([0, maxDistance])
        .thresholds(d3.range(0, maxDistance, 50))
        (figures);
});

const $showAllDataBar = atom<boolean>(true);

let blurLock = false; // 用于锁定输入框的blur事件，防止在点击列表时触发blur事件

export default class LocationFilter extends Component {
    root: SVGElement;
    mapData: any;
    center: { x: number; y: number; width: number; height: number };

    input!: d3.Selection<HTMLInputElement, unknown, null, undefined>;

    constructor(
        root: SVGElement,
        parent: Component,
        baseSize: number
    ) {
        super();
        this.root = root;
        this.parent = parent;
        this.baseSize = baseSize;

        this.mapData = mapData;
        // [88.3, 125.19790699500001, 19.26767, 47]
        this.center = {
            x: 87,
            y: 17,
            width: 127 - 87,
            height: 49 - 17
        }
        // this.mapData = mapData.countries.find(d => d.name === "南宋")!.ds.concat(
        //     [mapData.provinces.filter(d => d.name === "广南西路")[0].ds[0]]
        // );
        // this.center = mapData.countries.find(d => d.name === "南宋")!.bbox;
    }

    setSize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    render() {
        const root = d3.select(this.root);
        const width = this.width,
            height = this.height,
            baseSize = this.baseSize;

        const switchRoot = (() => {
            let elem = root.select<SVGGElement>(".switch");
            if (elem.empty()) {
                elem = root.append("g")
                    .classed("switch", true);
            }
            return elem;
        })();
        const switchX = 0,
            switchY = 0,
            switchWidth = height * 0.67,
            switchHeight = switchWidth * 0.13;
        switchRoot.attr("transform", `translate(${switchX}, ${switchY})`);
        this.renderSwitch(switchRoot, switchWidth, switchHeight);

        const mapRoot = (() => {
            let elem = root.select<SVGSVGElement>(".map");
            if (elem.empty()) {
                elem = root.append("svg")
                    .classed("map", true);
            }
            return elem;
        })();
        const mapX = 0,
            mapY = switchHeight + height * 0.02,
            mapWidth = switchWidth,
            mapHeight = mapWidth;
        mapRoot
            .attr("x", mapX)
            .attr("y", mapY)
            .attr("width", mapWidth)
            .attr("height", mapHeight);
        this.renderMap(mapRoot, mapWidth, mapHeight);

        const locationNameRoot = (() => {
            let elem = root.select<SVGGElement>(".location-name");
            if (elem.empty()) {
                elem = root.append("g")
                    .classed("location-name", true);
            }
            return elem;
        })();
        const locationNameX = mapX,
            locationNameY = mapY + mapHeight,
            locationNameWidth = mapWidth,
            locationNameHeight = height * 0.14;
        locationNameRoot.attr("transform", `translate(${locationNameX}, ${locationNameY})`);
        this.renderLocationName(locationNameRoot, locationNameWidth, locationNameHeight);

        const barchartRoot = (() => {
            let elem = root.select<SVGGElement>(".barchart");
            if (elem.empty()) {
                elem = root.append("g")
                    .classed("barchart", true);
            }
            return elem;
        })();
        const barchartX = mapX + mapWidth + width * 0.02,
            barchartY = mapY,
            barchartWidth = width * 0.98 - mapWidth,
            barchartHeight = height * 0.65;
        barchartRoot.attr("transform", `translate(${barchartX}, ${barchartY})`);
        this.renderBarchart(barchartRoot, barchartWidth, barchartHeight);

    }

    renderSwitch(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number,
    ) {
        const locationSelected = $locationSelected.get();
        const dict = $dict.get();
        const supportedModes = ["birth", "been"];

        const dw = width / supportedModes.length,
            w = dw * 0.8;

        g.selectAll(".item")
            .data(supportedModes)
            .join("g")
            .classed("item", true)
            .attr("transform", (_, i) => `translate(${dw * i}, 0)`)
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                const fontSize = height;
                g.html("");

                // 单选框
                g.append("circle")
                    .attr("cx", fontSize * 0.5)
                    .attr("cy", fontSize * 0.5)
                    .attr("r", fontSize * 0.4)
                    .attr("stroke", color)
                    .attr("stroke-width", 1)
                    .attr("fill", "#fff");
                g.append("circle")
                    .attr("cx", fontSize * 0.5)
                    .attr("cy", fontSize * 0.5)
                    .attr("r", fontSize * 0.2)
                    .attr("fill", locationSelected.mode === d ? color : "#fff");
                
                // 文本
                g.append("text")
                    .attr("x", fontSize * 1.2)
                    .attr("y", fontSize * 0.5)
                    .attr("font-size", fontSize)
                    .attr("dominant-baseline", "middle")
                    .attr("fill", color)
                    .text(dict[d]);

                g
                    .style("cursor", "pointer")
                    .on("click", () => {
                        if (locationSelected.mode === d) return;
                        $locationSelected.set({
                            ...locationSelected,
                            mode: d as "birth" | "been"
                        });
                    });
            });
    }

    renderMap(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number,
    ) {
        /** 地点 */
        const mapSize = width;
        const map = this.mapData;
        const center = this.center;
        const locationSelected = $locationSelected.get();
        const location = locationSelected.location;
        const locationElement = (() => {
            let elem = g.select<SVGSVGElement>(".map");
            if (elem.empty()) {
                elem = g.append("svg")
                    .classed("map", true);
            }
            return elem;
        })();
        locationElement
            .attr("width", mapSize)
            .attr("height", mapSize);

        locationElement.html(`
            <defs>
            <clipPath id="clip">
                <rect
                    x="${0}"
                    y="${0}"
                    width="${mapSize}"
                    height="${mapSize}"
                    rx="${mapSize * 0.07}"
                    ry="${mapSize * 0.07}"
                />
            </clipPath>
            </defs>
        `);

        locationElement.append("rect")
            .classed("border", true)
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", mapSize)
            .attr("height", mapSize)
            .attr("rx", mapSize * 0.07)
            .attr("ry", mapSize * 0.07)
            .attr("fill", "#fff")
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1);

        // 定义地理路径生成器
        // 限制到 经度[88, 126], 纬度[19, 47]的范围
        let lng1 = 88;
        let lng2 = 126;
        let lat1 = 19;
        let lat2 = 47;
        const projection = d3.geoMercator().fitExtent(
            [
                [0, 0],
                [mapSize, mapSize]
            ],
            {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {},
                        geometry: {
                            type: "MultiPoint",
                            coordinates: [
                                [lng1, lat1],
                                [lng2, lat1],
                                [lng2, lat2],
                                [lng1, lat2],
                            ]
                        }
                    }
                ]
            },
        );

        const path = d3.geoPath().projection(projection);

        // 加载 GeoJSON 文件
        locationElement.selectAll("path.geojson")
            .data(mapData.features)
            .join("path")
            .classed("geojson", true)
            .attr("d", d => path(d as any))
            .attr("fill", "none")
            .attr("stroke", bgcolor)
            .attr("stroke-width", 0.5);

        const [x, y] = projection([
            location.coordinate.longitude,
            location.coordinate.latitude
        ])!;

        const iconSize = Math.min(width, height) * 0.2;
        locationElement.append("g")
            .classed("location-icon", true)
            .attr("transform", `translate(${x - iconSize * 0.5}, ${y - iconSize})`)
            .html(icons.location(iconSize, color));
    }

    renderLocationName(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number,
    ) {
        const locationSelected = $locationSelected.get();
        const dict = $dict.get();
        const location = locationSelected.location;
        const baseSize = Math.max(12, this.baseSize);

        const lineHeight = Math.min(baseSize * 1.2, height);
        const fontSize = lineHeight * 0.8;

        // 地点文本输入框
        const inputWrapper = (() => {
            let elem = g.select<SVGForeignObjectElement>(".input-wrapper");
            if (elem.empty()) {
                elem = g.append("foreignObject")
                    .classed("input-wrapper", true)
            }
            return elem;
        })();
        inputWrapper
            .attr("width", width)
            .attr("height", lineHeight * 1.5);
        const inputContainer = (() => {
            let elem = inputWrapper.select<any>("div");
            if (elem.empty()) {
                elem = inputWrapper.append("xhtml:div")
                    .style("color", color);
            }
            return elem;
        })();
        inputContainer
            .style("font-size", baseSize + "px");

        const input = (() => {
            let elem = inputContainer.select<any>("input");
            if (elem.empty()) {
                elem = inputContainer.append("input")
                    .attr("type", "text")
                    .attr("placeholder", "输入地点")
                    .style("color", color)
                    .style("text-align", "center");
                    // .property("value", dict[location.name]);
                this.input = elem;
            }
            return elem;
        })();
        input
            .style("font-size", fontSize + "px")
            .style("line-height", lineHeight + "px")
            .property("value", location.name === "[Capital]" ? dict[location.name] : location.name);

        // 选择列表
        const listWrapper = (() => {
            let elem = g.select<SVGForeignObjectElement>(".list-wrapper");
            if (elem.empty()) {
                elem = g.append("foreignObject")
                    .classed("list-wrapper", true);
            }
            return elem;
        })();
        listWrapper
            .attr("y", lineHeight * 1.5)
            .attr("width", width)
            .attr("height", lineHeight * 6.2) // 最多显示6个选项
            .style("display", "none"); // 默认隐藏

        const listContainer = (() => {
            let elem = listWrapper.select<any>("div");
            if (elem.empty()) {
                elem = listWrapper.append("xhtml:div")
                    .style("color", color);
            }
            return elem;
        })();
        listContainer
            .style("padding", "0.1em 0.5em")
            .style("box-sizing", "border-box")
            .style("height", "100%")
            .style("background-color", "#fff")
            .style("max-height", lineHeight * 6.18 + "px")
            .style("overflow-y", "auto")
            .style("border", `1px solid ${color}`)
            .style("border-radius", "0.1em")
            .style("font-size", baseSize + "px")
            .style("line-height", lineHeight + "px");

        input.on("focus", () => {
            listWrapper.style("display", "block");
            listContainer.style("display", "block");
            const v = input.property("value").trim();
            const suggestions = this.getLocationSuggestions(v);
            this._renderLocationSuggestions(listContainer, suggestions);
        });
        input.on("focusout", (e) => {
            if (!blurLock) {
                listWrapper.style("display", "none");
                listContainer.style("display", "none");
            }
        });
        input.on("input", () => {
            const v = input.property("value").trim();
            const suggestions = this.getLocationSuggestions(v);
            input.property("value", v);
            this._renderLocationSuggestions(listContainer, suggestions);
        });
    }

    renderBarchart(
        g: d3.Selection<any, any, any, any>,
        width: number,
        height: number,
    ) {
        const allData = $allDistanceHistogram.get();
        const data = $distanceHistogram.get();
        const showAllDataBar = $showAllDataBar.get();
        const locationSelected = $locationSelected.get();
        const innerWidth = width * 1.0;
        const barWidth = innerWidth / data.length;
        const innerBarWidth = barWidth * 0.95;
        const barHeight = height * 0.7;
        const brushY = height * 0.7;
        const brushHeight = height * 0.3;
        
        const xScale = d3.scaleLinear()
            .domain([data[0].x0!, data[data.length - 1].x1!])
            .range([0, innerWidth]);
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(showAllDataBar ? allData : data, d => d.length)!])
            .range([0, barHeight]);

        g.html("");
        
        // 刻度轴部分
        const axis = (() => {
            let elem = g.select<SVGGElement>(".axis");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("axis", true);
            }
            return elem;
        })();

        const line = (() => {
            let elem = axis.select<SVGLineElement>(".line");
            if (elem.empty()) {
                elem = axis.append("line")
                    .classed("line", true);
            }
            return elem;
        })();
        line
            .attr("x1", 0)
            .attr("y1", brushY)
            .attr("x2", innerWidth)
            .attr("y2", brushY)
            .attr("stroke", color)
            .attr("stroke-width", 1);

        axis.selectAll(".tick")
            .data(d3.range(0, maxDistance, 500))
            .join("g")
            .classed("tick", true)
            .attr("transform", (d, i) => `translate(${xScale(d)}, ${brushY})`)
            .each((d, i, nodes) => {
                // if (d % 200 !== 0) return; // 只显示200的倍数
                const g = d3.select(nodes[i]);
                g.html("");
                g.append("line")
                    .attr("y2", "0.3em")
                    .attr("stroke", color)
                    .attr("stroke-width", 1);
                g.append("text")
                    .attr("x", 0)
                    .attr("y", "1.6em")
                    .attr("font-size", "0.6em")
                    .attr("fill", color)
                    .attr("text-anchor", "middle")
                    .style("user-select", "none")
                    .text(d);
            });

        // 纵向坐标轴（右侧）
        const yAxis = (() => {
            let elem = g.select<SVGGElement>(".y-axis");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("y-axis", true);
            }
            return elem;
        })();
        yAxis
            .attr("transform", `translate(${innerWidth}, 0)`)
            .html("");
        yAxis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", barHeight)
            .attr("stroke", color)
            .attr("stroke-width", 1);
        yAxis.append("line")
            .classed("tick", true)
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", "-0.3em")
            .attr("y2", 0)
            .attr("stroke", color)
            .attr("stroke-width", 1);
        yAxis.append("text")
            .attr("x", "-0.8em")
            .attr("y", "0.1em")
            .attr("font-size", "0.8em")
            .attr("fill", color)
            .attr("text-anchor", "end")
            .style("user-select", "none")
            .text(yScale.domain()[1]);

        // 柱状图部分
        const bars = (() => {
            let elem = g.select<SVGGElement>(".bars");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("bars", true);
            }
            return elem;
        })();
        bars.selectAll(".background-bar")
            .data(showAllDataBar ? allData : [])
            .join("g")
            .classed("background-bar", true)
            .attr("transform", (d, i) => `translate(${i * barWidth}, ${brushY - barHeight})`)
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                const y = yScale(d.length);
                g.html("");
                g.append("rect")
                    .attr("x", 0)
                    .attr("y", barHeight - y)
                    .attr("width", innerBarWidth)
                    .attr("height", y)
                    .attr("fill", "#ccc");
            })
        bars.selectAll(".bar")
            .data(data)
            .join("g")
            .classed("bar", true)
            .attr("transform", (d, i) => `translate(${i * barWidth}, ${brushY - barHeight})`)
            .each((d, i, nodes) => {
                const g = d3.select(nodes[i]);
                const y = yScale(d.length);
                const color = LocationIcon.distanceColorMap(d.x0!);
                g.html("");
                g.append("rect")
                    .attr("x", 0)
                    .attr("y", barHeight - y)
                    .attr("width", innerBarWidth)
                    .attr("height", y)
                    .attr("fill", color);
            });
        bars.selectAll(".mask")
            .data([1])
            .join("rect")
            .classed("mask", true)
            .attr("width", innerWidth)
            .attr("height", barHeight)
            .style("opacity", 0)
            .style("cursor", "crosshair")
            .on("click", () => {
                $showAllDataBar.set(!showAllDataBar);
            })

        // 刷选框
        const brush = (() => {
            let elem = g.select<SVGGElement>(".brush");
            if (elem.empty()) {
                elem = g.append("g")
                    .classed("brush", true);
            }
            return elem;
        })();
        brush
            .attr("transform", `translate(0, ${brushY})`);
        const brushRect = (() => {
            let elem = brush.select<SVGRectElement>(".rect");
            if (elem.empty()) {
                elem = brush.append("rect")
                    .classed("rect", true);
            }
            return elem;
        })();
        brushRect
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", xScale(locationSelected.distance))
            .attr("height", brushHeight)
            .attr("fill", bgcolor)
            .attr("fill-opacity", 0.3)
            .attr("pointer-events", "all");

        const brushMask = (() => {
            let elem = brush.select<SVGRectElement>(".mask");
            if (elem.empty()) {
                elem = brush.append("rect")
                    .classed("mask", true);
            }
            return elem;
        })();
        brushMask
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", innerWidth)
            .attr("height", brushHeight)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .style("cursor", "ew-resize")
            .on("click", (event) => {
                const x = d3.pointer(event, brushMask.node())[0];
                const v = Math.max(0, Math.min(locationColorMap.maxDistance, xScale.invert(x)));
                $locationSelected.set({
                    ...locationSelected,
                    distance: v,
                });
                brushRect.attr("width", x);
            })
            .call(d3.drag()
                .on("drag", (event) => {
                    const x = d3.pointer(event, brushMask.node())[0];
                    brushRect.attr("width", x);
                })
                .on("end", (event) => {
                    const x = d3.pointer(event, brushMask.node())[0];
                    const v = Math.max(1, Math.min(locationColorMap.maxDistance, xScale.invert(x)));
                    $locationSelected.set({
                        ...locationSelected,
                        distance: v,
                    });
                    this.renderBarchart(g, width, height);
                }) as any
            );
    }

    _renderLocationSuggestions(
        g: d3.Selection<any, any, any, any>,
        suggestions: Location[],
    ) {
        g.selectAll("div.item")
            .data(suggestions)
            .join("div")
            .classed("item", true)
            .style("cursor", "pointer")
            .text(d => d.name)
            .on("mouseover", function() {
                d3.select(this).style("background-color", light_bgcolor);
            })
            .on("mouseout", function() {
                d3.select(this).style("background-color", "transparent");
            })
            .on("mousedown", () => {
                blurLock = true; // 锁定输入框的blur事件
            })
            .on("mouseup", () => {
                blurLock = false; // 解锁输入框的blur事件
            })
            .on("click", (e, d) => {
                $locationSelected.set({
                    ...$locationSelected.get(),
                    location: d,
                });
                this.input.property("value", d.name);
                g.style("display", "none");
            });
    }

    getLocationSuggestions(query: string) {
        const dict = $dict.get();
        const empty = emptyLocation as Location;
        empty.name = dict["[Capital]"];
        const locations = [empty].concat($locations.get());
        const traditionalQuery = toTraditional(query);
        return locations.filter(location => location.name.includes(query) || location.name.includes(traditionalQuery));
    }

    listenInteraction() {
        $locationSelected.listen(() => {
            this.render();
        });
        $figures.listen(() => {
            this.render();
        });
        $showAllDataBar.listen(() => {
            this.render();
        });
    }
}