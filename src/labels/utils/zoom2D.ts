import Transform2D, { identity } from "./transform2D";
import { Selection } from "d3";

type ZoomSourceEvent = MouseEvent | WheelEvent | KeyboardEvent;
type DragArgs = { eventType: "drag" } | {
    eventType: "drag";
    dx?: number;
    dy?: number;
};
type WheelArgs = {
    eventType: "wheel";
};
export type ZoomEvent = (DragArgs | WheelArgs) & {
    transform: Transform2D;
    sourceEvent: ZoomSourceEvent;
};

export type Extent = [[number, number], [number, number]];

type Listeners = {
    [key in "start" | "zoom" | "end"]?: (this: Element, event: ZoomEvent) => void;
};

type Attribute<K, THIS> = {
    (): K;
    (_: K): THIS;
}

export interface Zoom2D {
    (selection: Selection<any, any, any, any>): void;
    setTransform: (_: Transform2D) => void;
    getTransform: () => Transform2D;
    extent: {
        (): Extent;
        (_: Extent): Zoom2D;
    };
    scaleX: Attribute<number, this>;
    scaleY: Attribute<number, this>;
    scaleExtentX: Attribute<[number, number], this>;
    scaleExtentY: Attribute<[number, number], this>;
    translateExtent: {
        (): Extent;
        (_: Extent): Zoom2D;
    };
    constrain: Attribute<typeof defaultConstrain, this>;
    axis: Attribute<("x" | "y")[], this>;
    key: Attribute<boolean, this>;
    filter: Attribute<(event: ZoomSourceEvent) => boolean, this>;
    on: (<T extends keyof Listeners>(typename: T, listener: Listeners[T]) => this) |
        (<T extends keyof Listeners>(typename: T) => Listeners[T]);
}

function defaultFilter(event: ZoomSourceEvent) {
    return (!event.ctrlKey || event.type === 'wheel') && !event.button;
}

function defaultExtent(this: any): [[number, number], [number, number]] {
    let e = this;
    if (e instanceof SVGElement) {
        e = e.ownerSVGElement || e;
        if (e.hasAttribute("viewBox")) {
            e = e.viewBox.baseVal;
            return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
        }
        return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
    }
    return [[0, 0], [e.clientWidth, e.clientHeight]];
}

function defaultTranslateExtent(): Extent {
    return [[-Infinity, -Infinity], [Infinity, Infinity]];
}

function defaultTransform(this: any) {
    return this.__zoom || identity;
}

function defaultWheelDelta(event: WheelEvent) {
    return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
}

function defaultConstrain(transform: Transform2D, extent: Extent, translateExtent: Extent): Transform2D {
    const x = Math.max(
        extent[1][0] - translateExtent[1][0] * transform.kx,
        Math.min(
            extent[0][0] - translateExtent[0][0] * transform.kx,
            transform.x
        )
    );
    const y = Math.max(
        extent[1][1] - translateExtent[1][1] * transform.ky,
        Math.min(
            extent[0][1] - translateExtent[0][1] * transform.ky,
            transform.y
        )
    );

    return new Transform2D(
        x,
        y,
        transform.kx,
        transform.ky,
    );
}

export default function() {
    let _filter: (event: ZoomSourceEvent) => boolean
            = defaultFilter;
    let _extent: () => Extent
            = defaultExtent;
    let extent: Extent;
    let constrain: (transform: Transform2D, extent: Extent, translateExtent: Extent) => Transform2D
            = defaultConstrain;
    let wheelDelta: (event: WheelEvent) => number
            = defaultWheelDelta;
    // let scaleExtent: [number, number]
    //         = [0, Infinity];
    let scaleExtentX: [number, number]
            = [0, Infinity];
    let scaleExtentY: [number, number]
            = [0, Infinity];
    let axis: ("x" | "y")[]
            = ["x", "y"];
    let _translateExtent: () => Extent
            = defaultTranslateExtent;
    let translateExtent: Extent;
    let key: boolean
            = true;
    let duration = 250,
        wheelDelay = 150,
        clickDistance2 = 0;

    let _scaleX = 1;
    let _scaleY = 1;

    let mousedown: boolean
            = false;
    let wheeltimer: number | null
            = null;
    let transform: Transform2D
            = identity;
    let originX: number
            = 0;
    let originY: number
            = 0;
    let _selection: Selection<any, any, any, any> | null
            = null;
    // let supportedListenerTypes = ["start", "end"];
    let listeners: Listeners = {};
    /** 横向缩放速度 */
    let vx = 0.18;
    /** 纵向缩放速度 */
    let vy = 1;
    const zoom: Zoom2D = function (selection: Selection<any, any, any, any>) {
        _selection = selection;
        // extent = _extent.apply(selection.node());
        // translateExtent = _translateExtent.apply(selection.node());
        selection
            .attr("transform", transform as any)
            .property("__zoom", transform)
            .on("wheel.zoom", wheeled, {passive: false})
            .on("mousedown.zoom", mousedowned)
            .on("mousemove.zoom", mousemoved)
            .on("mouseup.zoom", mouseupped)
            .on("dblclick.zoom", dblclicked)
            .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
    }

    function _setTransform_(_: Transform2D): void;
    function _setTransform_(_: Transform2D) {
        transform = _;
        if (_selection) _selection.property("__zoom", transform);
    }
    zoom.setTransform = _setTransform_;

    function _getTransform_(): Transform2D;
    function _getTransform_(): Transform2D {
        return new Transform2D()
            .scale(transform.kx, transform.ky)
            .translate(transform.x, transform.y);
    }
    zoom.getTransform = _getTransform_;

    function _scaleX_(_: number): typeof zoom;
    function _scaleX_(): number;
    function _scaleX_(_?: number) {
        if (_ === undefined) return _scaleX;
        _scaleX = _;
        return zoom;
    }
    zoom.scaleX = _scaleX_;

    function _scaleY_(_: number): typeof zoom;
    function _scaleY_(): number;
    function _scaleY_(_?: number) {
        if (_ === undefined) return _scaleY;
        _scaleY = _;
        return zoom;
    }
    zoom.scaleY = _scaleY_;

    function _extent_(_: Extent): typeof zoom;
    function _extent_(): Extent;
    function _extent_(_?: Extent) {
        if (_ === undefined) return extent;
        extent = _;
        return zoom;
    }
    zoom.extent = _extent_;

    function _scaleExtentX_(_: [number, number]): typeof zoom;
    function _scaleExtentX_() : [number, number];
    function _scaleExtentX_(_?: [number, number]) {
        if (_ === undefined) return scaleExtentX;
        scaleExtentX = _;
        return zoom;
    }
    zoom.scaleExtentX = _scaleExtentX_;

    function _scaleExtentY_(_: [number, number]): typeof zoom;
    function _scaleExtentY_() : [number, number];
    function _scaleExtentY_(_?: [number, number]) {
        if (_ === undefined) return scaleExtentY;
        scaleExtentY = _;
        return zoom;
    }
    zoom.scaleExtentY = _scaleExtentY_;

    function _translateExtent_(_: Extent): typeof zoom;
    function _translateExtent_(): Extent;
    function _translateExtent_(_?: Extent) {
        if (_ === undefined) return translateExtent;
        translateExtent = _;
        // console.log(
        //     "translateExtent",
        //     [extent[1][1] - translateExtent[1][1] * transform.ky,
        //     extent[0][1] - translateExtent[0][1] * transform.ky],
        // );
        return zoom;
    }
    zoom.translateExtent = _translateExtent_;

    function _constrain_(_: typeof defaultConstrain): typeof zoom;
    function _constrain_(): typeof defaultConstrain;
    function _constrain_(_?: typeof defaultConstrain) {
        if (_ === undefined) return constrain;
        constrain = _;
        return zoom;
    }
    zoom.constrain = _constrain_;

    function _axis_(_: ("x" | "y")[]): typeof zoom;
    function _axis_(): ("x" | "y")[];
    function _axis_(_?: ("x" | "y")[]) {
        if (_ === undefined) return axis;
        axis = _;
        return zoom;
    }
    zoom.axis = _axis_;

    function _key_(_: boolean): typeof zoom;
    function _key_(): boolean;
    function _key_(_?: boolean) {
        if (_ === undefined) return key;
        key = _;
        key ? addKeyListener() : removeKeyListener();
        return zoom;
    }
    zoom.key = _key_;

    function _filter_(_: (event: ZoomSourceEvent) => boolean): typeof zoom;
    function _filter_(): (event: ZoomSourceEvent) => boolean;
    function _filter_(_?: (event: ZoomSourceEvent) => boolean) {
        if (_ === undefined) return _filter;
        _filter = _;
        return zoom;
    }
    zoom.filter = _filter_;

    function _on_<T extends keyof Listeners>(typename: T, listener: Listeners[T]): typeof zoom;
    function _on_<T extends keyof Listeners>(typename: T): Listeners[T];
    function _on_<T extends keyof Listeners>(typename: T, listener?: Listeners[T]) {
        if (listener === undefined) {
            return listeners[typename];
        } else {
            listeners[typename] = listener;
            return zoom;
        }
    }
    zoom.on = _on_;

    function constant(_: any) {
        return function() {
            return _;
        }
    }

    function changeTransform(_transform: Transform2D) {
        transform = _transform;
    }
    function onzoomstart(e: ZoomSourceEvent, args: DragArgs | WheelArgs) {
        _selection!.property("__zoom", transform);
        listeners["start"] && listeners["start"].call(_selection!.node(), {
            ...args,
            transform,
            sourceEvent: e
        });
    }
    function onzoom(e:ZoomSourceEvent, args: DragArgs | WheelArgs) {
        _selection!.property("__zoom", transform);
        listeners["zoom"] && listeners["zoom"].call(_selection!.node(), {
            ...args,
            transform,
            sourceEvent: e
        });
    }
    function onzoomend(e: ZoomSourceEvent, args: DragArgs | WheelArgs) {
        _selection!.property("__zoom", transform);
        listeners["end"] && listeners["end"].call(_selection!.node(), {
            ...args,
            transform,
            sourceEvent: e
        });
    }

    function wheeled(e: WheelEvent) {
        if (!_filter(e)) return;
        e.preventDefault();
        let delta = wheelDelta(e);
        let dkx = 1 + delta * vx;
        let dky = 1 + delta * vy;
        let kx = transform.kx * dkx;
        let ky = transform.ky * dky;
        let offsetX = e.offsetX * _scaleX;
        let offsetY = e.offsetY * _scaleY;
        kx = zoomHorizontally(e) ? Math.max(scaleExtentX[0], Math.min(scaleExtentX[1], kx)) : transform.kx;
        ky = zoomVertically(e) ? Math.max(scaleExtentY[0], Math.min(scaleExtentY[1], ky)) : transform.ky;
        let tx = offsetX - kx * transform.invertX(offsetX);
        let ty = offsetY - ky * transform.invertY(offsetY);
        transform = new Transform2D(tx, ty, kx, ky);
        transform = constrain(
            transform,
            extent,
            translateExtent
        );
        if (wheeltimer) {
            clearTimeout(wheeltimer);
            onzoom(e, {
                eventType: "wheel",
            });
        }
        else {
            onzoomstart(e, {
                eventType: "wheel",
            });
        }
        wheeltimer = setTimeout(() => {
            onzoomend(e, {
                eventType: "wheel",
            });
            wheeltimer = null;
        }, wheelDelay);
    }

    function mousedowned(e: MouseEvent) {
        originX = e.offsetX * _scaleX;
        originY = e.offsetY * _scaleY;
        onzoomstart(e, {
            eventType: "drag",
        });
        mousedown = true;
    }
    function mouseupped(e: MouseEvent) {
        mousedown = false;
        onzoomend(e, {
            eventType: "drag",
        });
    }
    function mousemoved(e: MouseEvent) {
        if (!mousedown || !_filter(e)) return;
        e.preventDefault();

        const offsetX = e.offsetX * _scaleX;
        const offsetY = e.offsetY * _scaleY;

        let dx = zoomHorizontally(e) ? offsetX - originX : 0;
        let dy = zoomVertically(e) ? offsetY - originY : 0;
        transform = transform.translate(dx, dy);
        transform = constrain(
            transform,
            extent,
            translateExtent,
        );
        originX = offsetX;
        originY = offsetY;
        onzoom(e, {
            eventType: "drag",
            dx,
            dy,
        });
    }

    function stopZoom(e: ZoomSourceEvent) {
        return e.ctrlKey;
    }

    function zoomHorizontally(e: ZoomSourceEvent) {
        if (!axis.includes("x")) return false;
        if (key) {
            return keys.size === 0 ||
                ["ArrowLeft", "ArrowRight", "a", "d", "h"].some(d => keys.has(d))
        }
        return true;
    }
    function zoomVertically(e: ZoomSourceEvent) {
        if (!axis.includes("y")) return false;
        if (key) {
            return keys.size === 0 ||
                ["ArrowUp", "ArrowDown", "w", "s", "v"].some(d => keys.has(d))
        }
        return true;
    }

    const keys = new Set();
    const keysSupported = new Set([
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "s",
        "a",
        "d",
        "h",
        "v",
    ]);
    const keyAdd = (e: KeyboardEvent) => {
        if (keys.has(e.key)) return;
        keysSupported.has(e.key) && keys.add(e.key);
    };
    const keyDelete = (e: KeyboardEvent) => {
        keysSupported.has(e.key) && keys.delete(e.key);
    }
    function addKeyListener() {
        window.addEventListener("keydown", keyAdd)
        window.addEventListener("keyup", keyDelete);
    }
    function removeKeyListener() {
        window.removeEventListener("keydown", keyAdd);
        window.removeEventListener("keyup", keyDelete);
    }
    key ? addKeyListener() : removeKeyListener();

    function dblclicked(e: MouseEvent) {}

    return zoom;
}