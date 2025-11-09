import { atom } from "nanostores";
import { Location, LocationSelected } from "../types";
import { locationColorMap } from "../constants";
import { Figure } from "../types";
import EarthCoordinate from "../utils/EarthCoordinate";
import { capitals, domainX } from "../constants";

/** 选中的地点 */
export const $locationSelected = atom<LocationSelected>({
    location: locationColorMap.defaultAddress,
    mode: "birth",
    distance: 2000,
});

function getCenter(
    figure: Figure,
    locationSelected: LocationSelected,
) {
    if (locationSelected.location.id === -1) {
        return capitals.getCurrent(figure.time[0], figure.time[1]) as Location;
    }
    return locationSelected.location;
}

function getLocate(
    figure: Figure,
    center: EarthCoordinate,
    locationSelected: LocationSelected,
    timeSelected: [Date, Date] | null,
) {
    if (locationSelected.mode ==="been") {
        const [start, end] = timeSelected || domainX;
        if (figure.time[1] < start || figure.time[0] > end) {
            return null;
        }
        let locations: Location[] = figure.locations.filter(location => {
            if (location.time === null) return false;
            if (location.time < start || location.time > end) return false;
            return true;
        })
        if (figure.time[0] > start && figure.time[1] < end && figure.birthplace !== null) {
            locations.push(figure.birthplace);
        }
        // 返回距离最小的location，locations为空集则返回null
        if (locations.length === 0) {
            return null;
        }
        const distances = locations.map(location => {
            return EarthCoordinate.distanceBetween(location.coordinate, center);
        });
        const minIndex = distances.indexOf(Math.min(...distances));
        if (minIndex !== -1) {
            return locations[minIndex];
        }
        return null;
    }
    else { // locationSelected.mode === "birth"
        return figure.birthplace ?? null;
    }
}

export function getFigureLocationInfo (
    figure: Figure,
    timeSelected: [Date, Date] | null,
    locationSelected: LocationSelected,
) {
    const center = getCenter(figure, locationSelected);
    const locate = getLocate(figure, center.coordinate, locationSelected, timeSelected);
    const centerCoordinate = center.coordinate;
    const locateCoordinate = (() => {
        if (locate === null) return null;
        const coordinate = locate.coordinate;
        if (coordinate.latitude === 0 && coordinate.longitude === 0) return null;
        return coordinate;
    })(); 
    return { center: centerCoordinate, locate: locateCoordinate };
}

export function getLocations(figures: Figure[]) {
    const locations: Location[] = [];
    const locationIds = new Set<number>();
    for (const figure of figures) {
        figure.locations.forEach(location => {
            if (!locationIds.has(location.id)) {
                locationIds.add(location.id);
                locations.push(location);
            }
        });
    }
    return locations.sort((a, b) => {
        return a.name.localeCompare(b.name);
    });
}