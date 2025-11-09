export default function<T> (x: T) {
    return function() {
        return x;
    }
}