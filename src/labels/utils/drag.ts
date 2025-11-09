import * as PIXI from "pixi.js";

type Handler<T> = (this: T, ...args: any[]) => void;
type Handlers<T> = {
    [k in "start" | "drag" | "end"]: Handler<T> | null
}
type DragObj<T> = {
    on: (event: keyof Handlers<T>, handler: Handler<T>) => DragObj<T>;
    apply: (target: T) => void;
}

export default function drag<T extends PIXI.Container, C>(context: C) {
    const handlers: Handlers<T> = {
        "start": null,
        "drag": null,
        "end": null
    };
    const obj: DragObj<T> = {} as any;

    obj.on = function(event: keyof Handlers<T>, handler: Handler<T>) {
        handlers[event] = handler;
        return obj;
    };

    obj.apply = function(target: T) {
        target.on("mousedown", (event) => {
            let x = event.clientX;
            let y = event.clientY;
            handlers.start?.call(target, {
                x,
                y,
                context,
                sourceEvent: event
            });

            const mousemove = (event: MouseEvent) => {
                let x2 = event.clientX;
                let y2 = event.clientY;
                handlers.drag?.call(target, {
                    x: x2,
                    y: y2,
                    dx: x2 - x,
                    dy: y2 - y,
                    context,
                    sourceEvent: event
                });
            };

            const mouseup = (event: MouseEvent) => {
                let x2 = event.clientX;
                let y2 = event.clientY;
                handlers.end?.call(target, {
                    x: x2,
                    y: y2,
                    dx: x2 - x,
                    dy: y2 - y,
                    context,
                    sourceEvent: event
                });
                window.removeEventListener("mousemove", mousemove);
                window.removeEventListener("mouseup", mouseup);
            };

            window.addEventListener("mousemove", mousemove);

            window.addEventListener("mouseup", mouseup);
        });
    };
    return obj;
}
// export default function drag<T extends PIXI.Container>(
//     this: T,
//     getPosition0: () => [number, number],
//     start: (this: T) => void,
//     drag: (this: T, x: number, y: number) => void,
//     end: (this: T, x: number, y: number) => void,
// ) {
//     let x0: number,
//         y0: number,
//         x1: number,
//         y1: number,
//         x2: number,
//         y2: number,
//         dx: number,
//         dy: number;

//     const mousemove = (e: MouseEvent) => {
//         x2 = e.clientX;
//         y2 = e.clientY;
//         dx = x2 - x1;
//         dy = y2 - y1;
//         drag.call(this, x0 + dx, y0 + dy);
//     }

//     const mouseup = (e: MouseEvent) => {
//         x2 = e.clientX;
//         y2 = e.clientY;
//         dx = x2 - x1;
//         dy = y2 - y1;
//         end.call(this, x0 + dx, y0 + dy);
//         window.removeEventListener("mousemove", mousemove);
//         window.removeEventListener("mouseup", mouseup);
//     }

//     this.on("mousedown", (e) => {
//         [x0, y0] = getPosition0();
//         x1 = e.clientX;
//         y1 = e.clientY;
//         start.call(this);
//         window.addEventListener("mousemove", mousemove);
//         window.addEventListener("mouseup", mouseup)
//     });

//     this.on("mouseenter", (e) => {
//         console.log("enter");
//     })
// }