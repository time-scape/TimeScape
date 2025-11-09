/** 构建一个组件的基类，虚类别 */
export default abstract class Component {

    /** 组件的HTML元素 */
    root!: Element;

    /** 组件的父元素class实例 */
    parent!: any;

    /** 组件大小 */
    width!: number;
    height!: number;
    
    /** 基础大小 */
    baseSize!: number;

    /** 设置大小 */
    abstract setSize(width: number, height: number): void;

    /** 渲染组件 */
    abstract render(): void;

    /** 监听事件 */
    abstract listenInteraction(): void;
}