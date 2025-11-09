export default class EarthCoordinate {
    private static readonly EARTH_RADIUS = 6371.004;
    private static readonly DEGREE_TO_RADIAN = Math.PI / 180;
    private static readonly RADIAN_TO_DEGREE = 180 / Math.PI;

    /** 经度 */
    readonly longitude!: number;
    /** 纬度 */
    readonly latitude!: number;

    constructor(longitude: number, latitude: number) {
        this.longitude = longitude;
        this.latitude = latitude;
    }

    /**
     * 计算两个地点之间的球面距离（单位：千米）
     * @param another 另一个地点
     */
    distanceTo(another: EarthCoordinate): number {
        const radLat1 = this.latitude * EarthCoordinate.DEGREE_TO_RADIAN;
        const radLat2 = another.latitude * EarthCoordinate.DEGREE_TO_RADIAN;
        const a = radLat1 - radLat2;
        const b = (this.longitude - another.longitude) * EarthCoordinate.DEGREE_TO_RADIAN;
        const s = 2 * Math.asin(
            Math.sqrt(
                Math.pow(Math.sin(a / 2), 2) +
                Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
            )
        );
        return s * EarthCoordinate.EARTH_RADIUS;
    }

    /**
     * 计算当前地点指向另一个地点的方位角（相对于正北方向的夹角，顺时针为正，弧度制）
     * @param another 另一个地点
     * @example
     * new EarthCoordinate(116.404, 39.915).bearingTo(
     *   new EarthCoordinate(116.404, 40.015),
     * ) / Math.PI * 180; // 0
     * new EarthCoordinate(117.404, 39.915).bearingTo(
     *   new EarthCoordinate(116.404, 39.915),
     * ) / Math.PI * 180; // 270.23
     */
    bearingTo(another: EarthCoordinate): number {
        const radLat1 = this.latitude * EarthCoordinate.DEGREE_TO_RADIAN;
        const radLat2 = another.latitude * EarthCoordinate.DEGREE_TO_RADIAN;
        const radLng1 = this.longitude * EarthCoordinate.DEGREE_TO_RADIAN;
        const radLng2 = another.longitude * EarthCoordinate.DEGREE_TO_RADIAN;
        const y = Math.sin(radLng2 - radLng1) * Math.cos(radLat2);
        const x = Math.cos(radLat1) * Math.sin(radLat2) - Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(radLng2 - radLng1);
        return (Math.atan2(y, x) * EarthCoordinate.RADIAN_TO_DEGREE + 360) % 360 * Math.PI / 180;
    }

    static distanceBetween(a: EarthCoordinate, b: EarthCoordinate): number {
        return a.distanceTo(b);
    }

    static bearingBetween(a: EarthCoordinate, b: EarthCoordinate): number {
        return a.bearingTo(b);
    }
}