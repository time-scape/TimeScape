import { Figure, LayoutConfigGenerator } from "./types";
// import { $figureContexts, $figuresSelected } from "./store";
// import Label from "./labels/label";

export const layouts: {
    "default": LayoutConfigGenerator;
    "byLocation": LayoutConfigGenerator;
    "byTime": LayoutConfigGenerator;
} = {
    "default": () => ({
        order: (a, _1, b, _2) => a.datum.layout.importance - b.datum.layout.importance,
        lineNumber: (label) => Math.round(1 / Math.log(1 + label.datum.weight)),
    }),
    "byLocation": () => ({
        order: (a, _1, b, _2) => (a.datum.birthplace?.coordinate.latitude ?? 100) - (b.datum.birthplace?.coordinate.latitude ?? 100),
        lineNumber: (_) => 1,
    }),
    "byTime": () => ({
        order: (a, _1, b, _2) => a.datum.time[0].getTime() - b.datum.time[0].getTime(),
        lineNumber: (_) => 1,
    })
    // "figureSelected": function(this: any) {
    //     const figuresUp = this.figuresUp as Figure[],
    //           nUp = figuresUp.length,
    //           figuresDown = this.figuresDown as Figure[],
    //           nDown = figuresDown.length,
    //           figuresSelected = $figuresSelected.get(),
    //           figureContexts = $figureContexts.get()!,
    //           id2index = new Map<number, number>(),
    //           upIndices = new Array<number>(nUp),
    //           downIndices = new Array<number>(nDown);

    //     for (let i = 0, n = figuresSelected.length, figure; i < n; ++i) {
    //         figure = figuresSelected[i];
    //         id2index.set(figure.id, i);
    //     }

    //     for (let i = 0; i < nUp; ++i) {
    //         upIndices[i] = id2index.get(figuresUp[i].id)!;
    //     }
    //     for (let i = 0; i < nDown; ++i) {
    //         downIndices[i] = id2index.get(figuresDown[i].id)!;
    //     }

    //     let key: (label: Label, i: number, n: number) => number;
    //     // let order: (a: Label, ia: number, b: Label, ib: number) => number;
    //     if (upIndices.length === 0 && downIndices.length === 0) {
    //         key = (_label, i, _n) => i;

    //     }
    //     else if (upIndices.length === 0) {
    //         key = (label, _i, _n) => {
    //             const i = label.index,
    //                   context = figureContexts[i],
    //                   maxWeight = figureContexts.maxWeight;
    //             let v = 0;
    //             for (let i = 0, index; i < nDown; ++i) {
    //                 index = downIndices[i];
    //                 v += context === null ? maxWeight : context[index].weight;
    //             }
    //             return -v;
    //         }
    //         // order = (a, _1, b, _2) => {
    //         //     const ia = a.index,
    //         //           ib = b.index,
    //         //           contextA = figureContexts[ia],
    //         //           contextB = figureContexts[ib];
    //         //     let va = 0,
    //         //         vb = 0;
                
    //         //     for (let i = 0, index; i < nDown; ++i) {
    //         //         index = downIndices[i];
    //         //         // va += aInDown ? contextA.maxWeight : contextA[index].weight;
    //         //         vb += contextB[index].weight;
    //         //     }
    //         //     // va /= n;
    //         //     // vb /= n;
    //         //     return va - vb;
    //         // }
    //     }
    //     else if (downIndices.length === 0) {
    //         key = (label, _i, _n) => {
    //             const i = label.index,
    //                   context = figureContexts[i],
    //                   maxWeight = figureContexts.maxWeight;
    //             let v = 0;
    //             for (let i = 0, index; i < nUp; ++i) {
    //                 index = upIndices[i];
    //                 v += context === null ? maxWeight : context[index].weight;
    //             }
    //             return v;
    //         }
    //         // order = (a, _1, b, _2) => {
    //         //     const ia = a.index,
    //         //           ib = b.index,
    //         //           contextA = figureContexts[ia],
    //         //           contextB = figureContexts[ib];
    //         //     let va = 0,
    //         //         vb = 0;
                      
    //         //     for (let i = 0, index; i < nUp; ++i) {
    //         //         index = upIndices[i];
    //         //         va += contextA[index].weight;
    //         //         vb += contextB[index].weight;
    //         //     }
    //         //     // va /= n;
    //         //     // vb /= n;
    //         //     return vb - va;
    //         // }
    //     }
    //     else {
    //         key = (Label, _i, _n) => {
    //             const i = Label.index,
    //                   context = figureContexts[i],
    //                   maxWeight = figureContexts.maxWeight;
    //             let vUp = 0,
    //                 vDown = 0,
    //                 v,
    //                 index;
                
    //             for (let i = 0; i < nUp; ++i) {
    //                 index = upIndices[i];
    //                 vUp += context === null ? maxWeight : context[index].weight;
    //             }
    //             vUp /= Math.max(nUp, 1);

    //             for (let i = 0; i < nDown; ++i) {
    //                 index = downIndices[i];
    //                 vDown += context === null ? maxWeight : context[index].weight;
    //             }
    //             vDown /= Math.max(nDown, 1);

    //             return vUp - vDown;
    //         }
    //     }

    //     return {
    //         key,
    //         lineNumber: (_) => 3,
    //     }
    // }
}