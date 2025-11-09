import * as d3 from 'd3';
import { Selection } from 'd3-selection';
import { color, getEmptyLocation } from '../constants';

import Title from './title';
import LayoutController from './layout-controller';
import KeywordSearcher from './keyword-searcher';
import LocationFilter from './location-filter';
import PostFilter from './post-filter';
import TypeFilter from './type-filter';
import Legend from './legend';
import WeightFilter from './weight-filter';
import BookMarks from './book-marks';
import TitleElement from '../components/title';
import { $dict } from '../store';
import layout from '../labels/utils/Interval/layout';


interface Props {
    x: number;
    y: number;
    width: number;
    height: number;
}

type RenderConfig = {
    renderBorder?: any;
    renderTitle?: any;
    renderBookmarks?: any;
    renderLayout?: any;
    renderKeywordSearcher?: any;
    renderWeightFilter?: any;
    renderLocationFilter?: any;
    renderPostFilter?: any;
    renderTypeFilter?: any;
    renderLegend?: any;
}

export default class LeftSidebar {
    props: Props;
    root: SVGGElement | null = null;

    baseSize: number;

    layoutController!: LayoutController;
    title!: Title;
    bookmarks!: BookMarks;
    keywordSearcher!: KeywordSearcher;
    weightFilter!: WeightFilter;
    locationFilter!: LocationFilter;
    postFilter!: PostFilter;
    typeFilter!: TypeFilter;
    legend!: Legend;

    constructor(props: Partial<Props>) {
        this.props = Object.assign({
            x: 0,
            y: 0,
            width: 100,
            height: 300,
        }, props);
        this.baseSize = Math.min(this.props.width, this.props.height) * 0.05;
    }

    initialize() {
        this.listenInteraction();
    }

    setRoot(root: SVGGElement) {
        this.root = root;

        const border = (() => {
            let elem = root.querySelector(".border");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("border");
            }
            return elem;
        })();

        const layoutTitle = (() => {
            let elem = root.querySelector(".layout-title");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("layout-title");
            }
            return elem;
        })();

        const layoutControllerRoot = (() => {
            let elem = root.querySelector<SVGGElement>("g.layout-controller");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("layout-controller");
            }
            return elem;
        })();
        this.layoutController = new LayoutController(
            layoutControllerRoot,
            this as any,
            this.baseSize
        );

        const titleRoot = (() => {
            let elem = root.querySelector<SVGGElement>("g.title");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("title");
            }
            return elem;
        })();
        this.title = new Title(
            titleRoot,
            this as any,
            this.baseSize
        );

        const bookmarkTitle = (() => {
            let elem = root.querySelector(".bookmark-title");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("bookmark-title");
            }
            return elem;
        })();

        const bookmarksRoot = (() => {
            let elem = root.querySelector<SVGForeignObjectElement>("foreignObject.bookmarks");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "foreignObject"));
                elem.classList.add("bookmarks");
            }
            return elem;
        })();
        this.bookmarks = new BookMarks(
            bookmarksRoot,
            this as any,
            this.baseSize
        );

        const filterTitle = (() => {
            let elem = root.querySelector(".filter-title");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("filter-title");
            }
            return elem;
        })();

        const searchBoxRoot = (() => {
            let elem = root.querySelector<SVGForeignObjectElement>("foreignObject.keyword-search-box");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "foreignObject"));
                elem.classList.add("keyword-search-box");
            }
            return elem;
        })();
        this.keywordSearcher = new KeywordSearcher(
            searchBoxRoot,
            this as any,
            this.baseSize
        );

        const weightFilterRoot = (() => {
            let elem = root.querySelector<SVGGElement>("g.weight-filter");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("weight-filter");
            }
            return elem;
        })();
        this.weightFilter = new WeightFilter(
            weightFilterRoot,
            this as any,
            this.baseSize
        );

        const postFilterRoot = (() => {
            let elem = root.querySelector<SVGForeignObjectElement>("foreignObject.post-filter");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "foreignObject"));
                elem.classList.add("post-filter");
            }
            return elem;
        })();
        this.postFilter = new PostFilter(
            postFilterRoot,
            this as any,
            this.baseSize
        );

        const typeFilterRoot = (() => {
            let elem = root.querySelector<SVGGElement>("g.type-filter");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("type-filter");
            }
            return elem;
        })();
        this.typeFilter = new TypeFilter(
            typeFilterRoot,
            this as any,
            this.baseSize
        );

        const legendRoot = (() => {
            let elem = root.querySelector<SVGGElement>("g.legend");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("legend");
            }
            return elem;
        })();
        this.legend = new Legend(
            legendRoot,
            this as any,
            this.baseSize
        );
        
        const LocationFilterRoot = (() => {
            let elem = root.querySelector<SVGGElement>("g.location-filter");
            if (elem === null) {
                elem = root.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g"));
                elem.classList.add("location-filter");
            }
            return elem;
        })();
        this.locationFilter = new LocationFilter(
            LocationFilterRoot,
            this as any,
            this.baseSize
        );

        this.initialize();
    }
    render(
        config: RenderConfig = {}
    ) {
        const root = d3.select(this.root);
        const dict = $dict.get();
        const width = this.props.width,
            height = this.props.height,
            baseSize = this.baseSize,
            paddingX = baseSize * 1.0,
            innerWidth = width - paddingX * 2;
        if (root.empty()) return;

        if (config.renderBorder) {
            const border = (() => {
                let elem: Selection<any, any, any, any> = root.select(".border");
                if (elem.empty()) {
                    elem = root.append("g")
                        .classed("border", true);
                    return elem;
                }
                return elem;
            })();
            this.renderBorder(border);
        }

        if (config.renderTitle) {
            this.title.root.setAttribute("transform", `translate(0, 0)`);
            this.title.setSize(width, baseSize * 8);
            this.title.render();
        }

        const layoutTitle = (() => {
            let elem = root.select<SVGGElement>(".layout-title");
            if (elem.empty()) {
                elem = root.append("g")
                    .classed("layout-title", true);
            }
            return elem;
        })();
        layoutTitle.attr("transform", `translate(${paddingX}, ${baseSize * 8.5})`);
        TitleElement.renderSVG(layoutTitle, dict["layout"], innerWidth);

        if (config.renderLayout) {
            this.layoutController.root.setAttribute("transform", `translate(${paddingX}, ${baseSize * 10})`);
            this.layoutController.setSize(innerWidth, baseSize * 1.3);
            this.layoutController.render();
        }

        const bookmarkTitle = (() => {
            let elem = root.select<SVGGElement>(".bookmark-title");
            if (elem.empty()) {
                elem = root.append("g")
                    .classed("bookmark-title", true);
            }
            return elem;
        })();
        bookmarkTitle.attr("transform", `translate(${paddingX}, ${baseSize * 13})`);
        TitleElement.renderSVG(bookmarkTitle, dict["bookmarks"], innerWidth);

        if (config.renderBookmarks) {
            this.bookmarks.root.setAttribute("width", innerWidth + "px");
            this.bookmarks.root.setAttribute("height", baseSize * 8 + "px");
            this.bookmarks.root.setAttribute("transform", `translate(${paddingX}, ${baseSize * 15.5})`);
            this.bookmarks.setSize(innerWidth, baseSize * 8);
            this.bookmarks.render();
        }

        const filterTitle = (() => {
            let elem = root.select<SVGGElement>(".filter-title");
            if (elem.empty()) {
                elem = root.append("g")
                    .classed("filter-title", true);
            }
            return elem;
        })();
        filterTitle.attr("transform", `translate(${paddingX}, ${baseSize * 24})`);
        TitleElement.renderSVG(filterTitle, dict["data filters"], innerWidth);


        if (config.renderKeywordSearcher) {
            this.keywordSearcher.root.setAttribute("width", innerWidth + "px");
            this.keywordSearcher.root.setAttribute("height", baseSize * 6 + "px");
            this.keywordSearcher.root.setAttribute("transform", `translate(${paddingX}, ${baseSize * 26.5})`);
            this.keywordSearcher.setSize(innerWidth, baseSize * 6);
            this.keywordSearcher.render();
        }
        if (config.renderWeightFilter) {
            this.weightFilter.root.setAttribute("transform", `translate(${paddingX}, ${baseSize * 32})`);
            this.weightFilter.setSize(innerWidth, baseSize * 3);
            this.weightFilter.render();
        }
        if (config.renderLocationFilter) {
            this.locationFilter.root.setAttribute("transform", `translate(${paddingX}, ${baseSize * 36})`);
            this.locationFilter.setSize(innerWidth, baseSize * 11);
            this.locationFilter.render();
        }
        if (config.renderPostFilter) {
            this.postFilter.root.setAttribute("transform", `translate(${paddingX}, ${baseSize * 47})`);
            this.postFilter.setSize(innerWidth, baseSize * 11);
            this.postFilter.render();
        }
        if (config.renderTypeFilter) {
            this.typeFilter.root.setAttribute("transform", `translate(${paddingX}, ${baseSize * 59})`);
            this.typeFilter.setSize(innerWidth, baseSize * 12);
            this.typeFilter.render();
        }
        if (config.renderLegend) {
            this.legend.root.setAttribute("transform", `translate(${paddingX}, ${baseSize * 72})`);
            this.legend.setSize(innerWidth, baseSize * 12);
            this.legend.render();
        }
    }
    renderBorder(g: Selection<any, any, any, any>) {
        const { width, height } = this.props;
        g.html("");
        g.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .style("fill", "none")
            .style("stroke", color)
            .style("stroke-width", 1);
    }

    // updatePosition() {
    //     if (this.root === null) return;
    //     const { x, y, width, height } = this.props;
    //     const root = d3.select(this.root);
    //     root
    //         .attr("x", x)
    //         .attr("y", y)
    //         .attr("width", width)
    //         .attr("height", height)
    // }

    listenInteraction() {
        this.title.listenInteraction();
        this.layoutController.listenInteraction();
        this.bookmarks.listenInteraction();
        this.keywordSearcher.listenInteraction();
        this.weightFilter.listenInteraction();
        this.locationFilter.listenInteraction();
        this.postFilter.listenInteraction();
        this.typeFilter.listenInteraction();
        this.legend.listenInteraction();
    }

    update() {
        
    }
}