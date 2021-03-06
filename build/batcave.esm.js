/* Asynchronous versions of array methods */
async function every(array, ...args) {
    const truth = await Promise.all(array.map(...args));
    return array.every((elt, idx) => truth[idx]);
}
async function filter(array, ...args) {
    const truth = await Promise.all(array.map(...args));
    return array.filter((elt, idx) => truth[idx]);
}
function queue(concurrencyLimit = 2) {
    // TODO: use a different data structure for more efficient shift/unshift
    // TODO: support setting action priority (requires better data structure)
    // TODO: support passing a label parameter for each action, so we have queue.remove(fn)
    const queue = [];
    const promises = new WeakMap();
    const running = new Set();
    // starts running the next action in the queue, as long as it doesn't
    // take us over the concurrency limit
    function run() {
        if (running.size >= concurrencyLimit)
            return;
        if (queue.length === 0)
            return;
        const action = queue.shift();
        if (!promises.has(action))
            throw new Error(`Missing promise callbacks for queue action ${action.name}`);
        const { resolve, reject } = promises.get(action);
        running.add(action);
        Promise.resolve()
            .then(action)
            .then(resolve, reject)
            .finally(function cleanup() {
            running.delete(action);
            promises.delete(action);
            run(); // run next action if any are in the queue
        });
    }
    return {
        push(action) {
            const promise = new Promise((resolve, reject) => {
                promises.set(action, { resolve, reject });
            });
            queue.push(action);
            Promise.resolve().then(run);
            return promise;
        },
        clear: () => void (queue.length = 0),
        /** Returns an array of all currently running actions */
        running: () => new Set(running),
    };
}
class TimeoutExpiredError extends Error {
    constructor(func, time) {
        const funcName = func.name || '<anonymous>';
        const msg = `Timeout-wrapped function ${funcName} took longer than ${time}ms to resolve`;
        super(msg);
        this.name = this.constructor.name;
    }
}
/**
 * Wraps a promise-returning function into another asynchronous
 * function which will reject if the original wrapped function
 * takes longer than the specified time to resolve.
 * @param {Function} func
 * The function to wrap.
 * @param {number} [ms=5000]
 * The time to wait before rejecting.
 * @param {object} [options]
 * @param {boolean} [options.rejectOnTimeout]
 * If false, the promise will just be left pending rather than
 * rejecting if the time limit expires.
 */
function timeout(func, ms = 5000, { rejectOnTimeout = true, } = {}) {
    return function timeoutified(...args) {
        return new Promise((resolve, reject) => {
            let overran = false;
            const kill = setTimeout(() => {
                if (rejectOnTimeout)
                    reject(new TimeoutExpiredError(func, ms));
                overran = true;
            }, ms);
            func.apply(this, args)
                .finally(() => clearTimeout(kill))
                .then((ret) => !overran && resolve(ret), (err) => !overran && reject(err));
        });
    };
}

/* Iterator transform methods */
function filter$1(iterator, filterFn, thisArg) {
    return wrap((function* baseFilter() {
        let idx = 0;
        for (const value of iterator) {
            const isPassing = filterFn.call(thisArg, value, idx++);
            if (isPassing)
                yield value;
        }
    })());
}
function map(iterator, mapFn, thisArg) {
    return wrap((function* baseMap() {
        let idx = 0;
        for (const value of iterator)
            yield mapFn.call(thisArg, value, idx++);
    })());
}
function reduce(iterator, reducer, initialValue) {
    let idx = 0;
    let accumulator = initialValue;
    for (const value of iterator) {
        if (idx === 0 && initialValue === undefined) {
            accumulator = value;
            idx += 1;
        }
        else
            accumulator = reducer(accumulator, value, idx++);
    }
    return accumulator;
}
function wrap(iterator) {
    return {
        [Symbol.iterator]: function* () {
            yield* iterator;
        },
        filter: (...args) => filter$1(iterator, ...args),
        map: (...args) => map(iterator, ...args),
        reduce: (reducer, initialValue) => reduce(iterator, reducer, initialValue),
    };
}

export { every as asyncEvery, filter as asyncFilter, queue as asyncQueue, timeout as asyncTimeout, filter$1 as iteratorFilter, map as iteratorMap, reduce as iteratorReduce, wrap as iteratorWrap };
