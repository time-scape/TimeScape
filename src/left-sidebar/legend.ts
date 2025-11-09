import * as d3 from "d3";
import Component from "../component";

export default class Legend extends Component {
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
        const g = d3.select(this.root),
            width = this.width,
            height = this.height;

        // Render the legend UI here
    }

    listenInteraction() {
        
    }
}