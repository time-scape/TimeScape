import 'layui/dist/css/layui.css';
import 'layui/dist/layui.js';
import "./style.css";

import Timeline from "./timeline";
import Labels from "./labels"
import { getTimelines, getGroups, preprocessData, getLabels } from "./data";
import { $language, $size, $domainX, $domainY, $timeSelected, $figures, $allFigures } from "./store";
import LeftSidebar from "./left-sidebar";
import RightSidebar from "./right-sidebar";

const app = document.getElementById("app")!;
app.innerHTML = `
    <div id="container"></div>
`;
const container = document.getElementById("container") as unknown as SVGElement;


/** 只需要运行一遍的代码 */
async function initialize() {
    const data = await getLabels((p) => {
        // console.log(p);
    });
    console.log(data);
    $allFigures.set(data);
}

async function main() {

    /** 尺寸参数 */
    const width = $size.get().width;
    const height = $size.get().height;

    const leftX = width * 0.01;
    const leftWidth = width * 0.155;
    const labelX = width * 0.17;
    const labelInnerWidth = width * 0.63;
    const rightX = width * 0.805;
    const rightWidth = width * 0.185;

    const y = height * 0.01;
    const innerHeight = height * 0.98;
    const h = innerHeight * 0.035;

    container.setAttribute("width", width.toString() + "px");
    container.setAttribute("height", height.toString() + "px");

    /** 数据准备 */
    const timelines = await getTimelines(labelInnerWidth, h);
    const groups = await getGroups(labelInnerWidth);
    preprocessData(timelines, groups, labelInnerWidth);

    const timelineHeight = timelines.height;
    const labelHeight = innerHeight * 0.98 - timelineHeight;

     /** 绘制左侧边栏（数据筛选） */
     const leftElement = (() => {
        const elem = container.querySelector("svg.left-sidebar");
        if (elem === null) {
            const left = container.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
            left.classList.add("left-sidebar");
            return left;
        }
        return elem as SVGGElement;
    })();
    leftElement.style.position = "absolute";
    leftElement.style.left = leftX + "px";
    leftElement.style.top = y + "px";
    leftElement.style.width = leftWidth + "px";
    leftElement.style.height = innerHeight + "px";
    const leftSideBar = new LeftSidebar({
        x: leftX,
        y: y,
        width: leftWidth,
        height: innerHeight,
    });
    leftSideBar.setRoot(leftElement);
    leftSideBar.render({
        renderBorder: true,
        renderTitle: true,
        renderLayout: true,
        renderBookmarks: true,
        renderKeywordSearcher: true,
        renderWeightFilter: true,
        renderLocationFilter: true,
        renderPostFilter: true,
        renderTypeFilter: true,
        renderLegend: true,
    });

    /** 绘制右侧边栏 */
    const rightElement = (() => {
        const elem = container.querySelector("div.right-sidebar");
        if (elem === null) {
            const right = container.appendChild(document.createElement("div"));
            right.classList.add("right-sidebar");
            return right;
        }
        return elem as HTMLDivElement;
    })();
    rightElement.style.position = "absolute";
    rightElement.style.left = rightX + "px";
    rightElement.style.top = y + "px";
    rightElement.style.width = rightWidth + "px";
    rightElement.style.height = innerHeight + "px";
    const rightSideBar = new RightSidebar({
        x: rightX,
        y: y,
        width: rightWidth,
        height: innerHeight,
    });
    rightSideBar.setRoot(rightElement);
    rightSideBar.render({
        updateTablePosition: true,
        renderBorder: true,
        renderSearchBox: true,
        renderSelectedFigure: true,
        renderContextController: true,
        renderFigures: true,
    });

    /** 绘制时间轴 */
    const timelineElement = (() => {
        const elem = container.querySelector("div.timelines");
        if (elem === null) {
            const timeline = container.appendChild(document.createElement("div"));
            timeline.classList.add("timelines");
            return timeline;
        }
        return elem as HTMLDivElement;
    })();
    const timeline = new Timeline({
        x: labelX,
        y,
        totalWidth: labelInnerWidth,
        totalHeight: innerHeight,
        color: "#6f4922",
        bgcolor: "#ab8c70",
        timelines,
        groups,
    });
    timeline.setRoot(timelineElement);
    timeline.render();
    timeline.renderBrush();
    $figures.listen(() => timeline.render());
    /** resize之后应该保持原先的刷选状态 */
    timeline.zoom($domainX.get());

    /** 绘制标签 */
    const labelElement = (() => {
        const elem = container.querySelector("div.labels");
        if (elem === null) {
            const labels = container.appendChild(document.createElement("div"));
            labels.classList.add("labels");
            return labels;
        }
        return elem as HTMLDivElement;
    })();
    labelElement.style.position = "absolute";
    labelElement.style.left = labelX + "px";
    labelElement.style.top = y + "px";
    labelElement.style.width = labelInnerWidth + "px";
    labelElement.style.height = labelHeight + "px";
    const labels = new Labels({
        x: labelX,
        y,
        width: labelInnerWidth,
        height: labelHeight,
        data: $figures.get(),
    });
    await labels.setRoot(labelElement);
    
    labels.render();
    /** resize之后应该保持原先的刷选状态 */
    labels.zoom($domainX.get(), $domainY.get());

    timeline.setEmit({
        zoom(domain) {
            $domainX.set(domain);
            labels.zoom(domain as [Date, Date], $domainY.get());
        },
        brush(domain, type) {
            type === "end" && $timeSelected.set(domain);
        },
    });
    labels.setEmit({
        zoom(domainX, domainY) {
            $domainX.set(domainX);
            $domainY.set(domainY);
            console.log("labels zoom", domainX, domainY);
            timeline.zoom(domainX as [Date, Date]);
        }
    });
}

initialize().then(() => {
    main();
});

$size.listen(() => {
    main();
});
$language.listen(() => {
    initialize().then(() => {
        main();
    });
});