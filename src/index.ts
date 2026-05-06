/**
 * IdmpGlobalKey type - Represents the key used to identify and store promises globally
 * Can be a string, number, symbol, or falsy value (false, null, undefined)
 */
type IdmpGlobalKey = string | number | symbol | false | null | undefined

/**
 * IdmpPromise type - Function that returns a Promise of generic type T
 */
type IdmpPromise<T> = () => Promise<T>

/**
 * Configuration options for IDMP (Intelligent Deduplication of Multiple Promises)
 */
interface IdmpOptions {
  /**
   * Maximum number of retry attempts for failed promises
   * @default 30
   */
  maxRetry?: number

  /**
   * Minimum delay between retry attempts in milliseconds
   * @default 50
   */
  minRetryDelay?: number

  /**
   * Maximum delay between retry attempts in milliseconds
   * @default 5000
   */
  maxRetryDelay?: number

  /**
   * Maximum cache age in milliseconds
   * After this period, the cached promise result will be cleared
   * @default 3000
   * @max 604800000 (7 days)
   */
  maxAge?: number

  signal?: AbortSignal

  /**
   * Function executed before each retry attempt
   * @param err - The error object that caused the retry
   * @param extra - Additional context information
   * @param extra.globalKey - The key identifying this promise in the global store
   * @param extra.retryCount - Current retry attempt number
   */
  onBeforeRetry?: (
    err: any,
    extra: {
      globalKey: IdmpGlobalKey
      retryCount: number
    },
  ) => void
}

/**
 * Internal status enum for promise states
 */
const enum Status {
  /** Promise hasn't been initiated yet */
  UNSENT = 0,
  /** Promise is in progress */
  OPENING = 1,
  /** Promise was aborted (reserved for future use) */
  ABORTED = 2,
  /** Promise was rejected */
  REJECTED = 3,
  /** Promise was resolved successfully */
  RESOLVED = 4,
}

/**
 * Internal keys enum for accessing cache store properties
 */
const enum K {
  retryCount = 0,
  status,
  pendingList,
  resolvedData,
  rejectionError,
  cachedPromiseFunc,
  timerId,
  _originalErrorStack,
  attachedSignals,
}

// Constants
const DEFAULT_MAX_AGE = 3000
const _7days = 604800000
const noop = () => {}
const UNDEFINED = undefined
const $timeout = setTimeout
const $clearTimeout = clearTimeout

/**
 * Best-effort timer.unref() so pending TTL flushes don't keep Node CLI
 * processes alive. No-op in browsers (setTimeout returns a number, no .unref).
 */
const unrefTimer = (id: any): any => {
  /* istanbul ignore if -- jsdom test env: setTimeout returns number, no .unref */
  if (id && typeof (id as any).unref === 'function') {
    try {
      ;(id as any).unref()
    } catch {}
  }
  return id
}

const getMin = (a: number, b: number): number => (a < b ? a : b)

/**
 * Module-level memo of objects that have already been frozen by readonly().
 * Re-walking an already-frozen tree on every idmp() call burns time on
 * Object.getOwnPropertyDescriptor + try/catch per key — the WeakSet lets
 * us bail in O(1) on the hot path. WeakSet so nothing leaks.
 *
 * Only allocated in dev — the entire readonly path is a no-op in production.
 */
/* istanbul ignore next -- production branch (UNDEFINED) is dead in test env */
const _readonlyDone: WeakSet<object> | undefined =
  process.env.NODE_ENV !== 'production' ? new WeakSet() : UNDEFINED

/**
 * Makes an object's properties read-only to prevent mutation
 */
const defineReactive = (
  obj: any,
  key: string | symbol,
  value: any,
  visited: WeakSet<any>,
): boolean => {
  try {
    readonly(value, visited)

    Object.defineProperty(obj, key, {
      configurable: false,
      enumerable: Object.getOwnPropertyDescriptor(obj, key)?.enumerable ?? true,
      get: () => value,
      set: (newValue) => {
        const msg = `[idmp error] The data is read-only, set ${key.toString()}=${JSON.stringify(
          newValue,
        )} is not allow`
        console.error(`%c ${msg}`, 'font-weight: lighter; color: red', newValue)
        throw new Error(msg)
      },
    })
    return true
  } catch {
    /* istanbul ignore next */
    return false
  }
}

/**
 * Recursively makes an object and its properties read-only.
 * Idempotent: if the object was already processed, returns immediately.
 */
const readonly = <T>(obj: T, visited?: WeakSet<any>): T => {
  try {
    if (obj == null || typeof obj !== 'object') return obj

    // Already frozen by a prior idmp() call — skip the whole walk.
    if (_readonlyDone && _readonlyDone.has(obj as any)) return obj

    const protoType = Object.prototype.toString.call(obj)
    if (!['[object Object]', '[object Array]'].includes(protoType)) return obj

    const isImmerDraft = (obj: any) => !!obj[Symbol.for('immer-state')]
    if (isImmerDraft(obj)) return obj

    const proto = Object.getPrototypeOf(obj)
    if (
      proto !== Object.prototype &&
      proto !== Array.prototype &&
      proto !== null
    ) {
      /* istanbul ignore next */
      return obj
    }

    // Initialize visited set on first call
    if (!visited) {
      visited = new WeakSet()
    }

    // Check if object has already been processed to prevent circular references
    if (visited.has(obj)) return obj

    // Mark object as visited before processing
    visited.add(obj)

    Object.keys(obj).forEach((key) => {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key)

        if (!descriptor || descriptor.configurable === false) return
        if (descriptor.get || descriptor.set) return

        defineReactive(obj, key, (obj as any)[key], visited!)
      } catch {}
    })

    // Mark globally so subsequent idmp() calls with the same object skip
    // the entire walk above. Safe even on partial failure — we only get
    // here when the forEach pass completed.
    _readonlyDone && _readonlyDone.add(obj as any)

    return obj
  } catch {
    /* istanbul ignore next */
    return obj
  }
}

/**
 * Ensures maxAge is within valid range (0 to 7 days)
 * @param maxAge - The requested max age in milliseconds
 * @returns A valid max age value
 */
const getRange = (maxAge: number) => {
  if (maxAge < 0) return 0
  if (maxAge > _7days) return _7days
  return maxAge
}

/**
 * Global store for caching promises and their results
 * Contains tracking information for each promise identified by globalKey
 */
let _globalStore: Record<
  string | symbol,
  [
    number, // [K.retryCount]: number
    Status, // [K.status]: Status
    Array<any>, // [K.pendingList]: Array<any>
    any | undefined, // [K.resolvedData]: any | undefined
    any | undefined, // [K.rejectionError]: any | undefined
    any, // [K.cachedPromiseFunc]: any
    number | undefined, // [K.timerId]: number | undefined
    string, // [K._originalErrorStack]: string
    Set<AbortSignal> | undefined, // [K.attachedSignals]: Set<AbortSignal> | undefined
  ]
> = {}

/**
 * Normalizes options, applying defaults as needed
 * @param options - User-provided options
 * @returns Normalized options object
 */
const getOptions = (options?: IdmpOptions) => {
  const {
    maxRetry = 30,
    maxAge: paramMaxAge = DEFAULT_MAX_AGE,
    minRetryDelay = 50,
    maxRetryDelay = 5000,
    onBeforeRetry = noop,
    signal,
  } = options || {}

  const maxAge = getRange(paramMaxAge)
  return {
    maxRetry,
    maxAge,
    minRetryDelay,
    maxRetryDelay,
    onBeforeRetry,
    f: paramMaxAge === 1 / 0, // Infinity
    signal,
  }
}

/**
 * Clears the cached result for a specific key
 * @param globalKey - The key to clear from cache
 */
const flush = (globalKey: IdmpGlobalKey) => {
  if (!globalKey) return
  const cache = _globalStore[globalKey]
  if (!cache) return
  cache[K.timerId] && $clearTimeout(cache[K.timerId])
  ;(_globalStore[globalKey] as unknown) = UNDEFINED
}

/**
 * Clears all cached results
 */
const flushAll = () => {
  for (let key of Object.keys(_globalStore)) {
    flush(key)
  }
  _globalStore = {}
}

/**
 * Main IDMP function - Intelligent Deduplication of Multiple Promises
 *
 * Ensures that multiple calls to the same asynchronous operation (identified by globalKey)
 * will reuse the same promise, avoiding duplicate network requests or operations.
 * Includes automatic retry logic, caching, and request deduplication.
 *
 * @param globalKey - Unique identifier for this promise operation
 * @param promiseFunc - Function that returns the promise to execute
 * @param options - Configuration options
 * @returns Promise resolving to the result of promiseFunc
 *
 * @example
 * ```typescript
 * // Basic usage
 * const data = await idmp('user-123', () => fetchUserData(123));
 *
 * // With options
 * const data = await idmp('user-123', () => fetchUserData(123), {
 *   maxRetry: 5,
 *   maxAge: 60000, // 1 minute cache
 *   onBeforeRetry: (err, {retryCount}) => console.log(`Retry #${retryCount}`)
 * });
 * ```
 */
const idmp = <T>(
  globalKey: IdmpGlobalKey,
  promiseFunc: IdmpPromise<T>,
  options?: IdmpOptions,
): Promise<T> => {
  if (process.env.NODE_ENV !== 'production') {
    options = readonly(options)
  }

  if (!globalKey) {
    return promiseFunc()
  }

  const {
    maxRetry,
    minRetryDelay,
    maxRetryDelay,
    maxAge,
    onBeforeRetry,
    f: isFiniteParamMaxAge,
    signal,
  } = getOptions(options)

  _globalStore[globalKey] = _globalStore[globalKey] || [
    0, // [K.retryCount]: number
    Status.UNSENT, // [K.status]: Status
    [], // [K.pendingList]: Array<any>
  ]

  const cache = _globalStore[globalKey]

  let callStackLocation = ''
  const printLogs = (...msg: any[]) => {
    /* istanbul ignore if -- jsdom env always has window */
    if (typeof window === 'undefined') return
    try {
      if (localStorage.idmp_debug === 'false') return
    } catch {}
    /* istanbul ignore else -- Fallback for envs without console.groupCollapsed */
    if (console.groupCollapsed) {
      console.groupCollapsed(...msg)
      console.log('globalKey:', globalKey)
      console.log('callStackLocation:', callStackLocation)
      console.log('data:', cache[K.resolvedData])
      console.groupEnd()
    } else {
      console.log(...msg)
    }
  }

  /**
   * Resets the promise state for retrying
   */
  const reset = () => {
    cache[K.status] = Status.UNSENT
    cache[K.resolvedData] = cache[K.rejectionError] = UNDEFINED
  }

  /**
   * Resolves all pending promises with the cached result
   */
  const doResolves = () => {
    const len = cache[K.pendingList].length
    for (let i = 0; i < len; ++i) {
      cache[K.pendingList][i][0](cache[K.resolvedData])
      if (process.env.NODE_ENV !== 'production') {
        if (i === 0) {
          printLogs(
            `%c[idmp debug] ${globalKey?.toString()} from origin`,
            'font-weight: lighter',
          )
        } else {
          printLogs(
            `%c[idmp debug] ${globalKey?.toString()} from cache`,
            'color: gray; font-weight: lighter',
          )
        }
      }
    }
    cache[K.pendingList] = []

    if (!isFiniteParamMaxAge) {
      cache[K.timerId] = unrefTimer(
        $timeout(() => {
          flush(globalKey)
        }, maxAge),
      ) as unknown as number
    }
  }

  /**
   * Rejects all pending promises with the cached error.
   * Retry-spawned dummy promises (added to pendingList by re-entered
   * executePromise calls) have their own .catch(noop) attached at the
   * call site, so it is safe to reject every entry here.
   */
  const doRejects = () => {
    const list = cache[K.pendingList]
    cache[K.pendingList] = []
    const len = list.length
    for (let i = 0; i < len; ++i) {
      list[i][1](cache[K.rejectionError])
    }
    flush(globalKey)
  }

  /**
   * Creates and manages the actual promise execution
   */
  const executePromise = () =>
    new Promise<T>((resolve, reject) => {
      !cache[K.cachedPromiseFunc] && (cache[K.cachedPromiseFunc] = promiseFunc)

      if (process.env.NODE_ENV !== 'production') {
        try {
          // Stack capture has two roles:
          //   1. seed `_originalErrorStack` once per cache (first caller),
          //   2. detect "same key reused at a different call site" (subsequent callers).
          // Retries don't need capture — the call site doesn't change between
          // attempts. For symbol keys getCodeLine bails out, so we skip the
          // entire block and avoid paying for Error.stack at all.
          //
          // We also skip recapture when the original stack matches verbatim
          // (the common case: 1000 concurrent calls from the same place all
          // produce identical stacks). Replacing `throw new Error() / catch`
          // with `new Error().stack` removes the unwind cost.
          if (cache[K.retryCount] === 0 && typeof globalKey !== 'symbol') {
            const stack = new Error().stack || ''
            const baseStack = cache[K._originalErrorStack]

            if (!baseStack) {
              cache[K._originalErrorStack] = stack
            }

            // callStackLocation is only consulted by printLogs() in browsers.
            // Compute lazily — most call paths never read it.
            const getCodeLine = (s: string, offset = 0): string => {
              try {
                const arr = s.split('\n').filter((o: string) => o.includes(':'))
                let idx = Infinity
                $0: for (const key of [
                  'idmp/src/index.ts',
                  'idmp/',
                  'idmp\\',
                  'idmp',
                ]) {
                  for (let _idx = arr.length - 1; _idx >= 0; --_idx) {
                    if (arr[_idx].indexOf(key) > -1) {
                      idx = _idx
                      break $0
                    }
                  }
                }
                const line = arr[idx + offset + 1] || ''
                if (line.includes('idmp')) return line
                /* istanbul ignore next */
                return ''
              } catch {
                /* istanbul ignore next */
                return ''
              }
            }

            callStackLocation = getCodeLine(stack, 1).split(' ').pop() || ''

            // Skip the divergence check unless the new stack actually differs
            // from the baseline — saves the parse cost on the hot dedup path.
            if (baseStack && baseStack !== stack) {
              const line1 = getCodeLine(baseStack)
              const line2 = getCodeLine(stack)

              if (line1 && line2 && line1 !== line2) {
                console.error(
                  `[idmp warn] the same key \`${globalKey!.toString()}\` may be used multiple times in different places\n(It may be a misjudgment and can be ignored):\nsee https://github.com/ha0z1/idmp?tab=readme-ov-file#implementation \n${[
                    `1.${line1} ${baseStack}`,
                    '------------',
                    `2.${line2} ${stack}`,
                  ].join('\n')}`,
                )
              }
            }
          }
        } catch {}
      }

      // Cache was already aborted by an earlier signal — reject this caller
      // immediately without scheduling more work.
      if (cache[K.status] === Status.ABORTED) {
        reject(cache[K.rejectionError])
        return
      }

      if (cache[K.status] === Status.RESOLVED) {
        /* istanbul ignore else -- production strips printLogs */
        if (process.env.NODE_ENV !== 'production') {
          printLogs(
            `%c[idmp debug] \`${globalKey?.toString()}\` from cache`,
            'color: gray;font-weight: lighter',
          )
        }
        resolve(cache[K.resolvedData])
        return
      }

      if (signal) {
        if (signal.aborted) {
          // Signal already fired — addEventListener('abort') would never run.
          // Drive the abort path manually.
          cache[K.status] = Status.ABORTED
          cache[K.rejectionError] = new DOMException(
            signal.reason,
            'AbortError',
          )
          // Push first so this caller is rejected by doRejects.
          cache[K.pendingList].push([resolve, reject])
          doRejects()
          return
        }

        // Attach exactly one listener per (cache, signal) pair. Without this
        // dedup, N concurrent callers would attach N listeners that each
        // re-fire doRejects/flush after abort — wasteful and racy.
        if (!cache[K.attachedSignals]) {
          cache[K.attachedSignals] = new Set()
        }
        if (!cache[K.attachedSignals]!.has(signal)) {
          cache[K.attachedSignals]!.add(signal)
          signal.addEventListener(
            'abort',
            () => {
              /* istanbul ignore if -- listener uses { once: true }; same-cache re-entry is unreachable */
              if (cache[K.status] === Status.ABORTED) return
              cache[K.status] = Status.ABORTED
              cache[K.rejectionError] = new DOMException(
                signal.reason,
                'AbortError',
              )
              doRejects()
            },
            { once: true },
          )
        }
      }

      if (cache[K.status] === Status.UNSENT) {
        cache[K.status] = Status.OPENING
        cache[K.pendingList].push([resolve, reject])

        cache[K.cachedPromiseFunc]()
          .then((data: T) => {
            // Bail if the cache was aborted while the promise was in flight —
            // pendingList has already been settled by doRejects.
            if (cache[K.status] === Status.ABORTED) return
            if (process.env.NODE_ENV !== 'production') {
              cache[K.resolvedData] = readonly<T>(data)
            } else {
              cache[K.resolvedData] = data
            }
            doResolves()
            cache[K.status] = Status.RESOLVED
          })
          .catch((err: any) => {
            // Same bail — abort wins over retry.
            if (cache[K.status] === Status.ABORTED) return
            cache[K.status] = Status.REJECTED
            cache[K.rejectionError] = err
            ++cache[K.retryCount]

            if (cache[K.retryCount] > maxRetry) {
              doRejects()
            } else {
              onBeforeRetry(err, {
                globalKey,
                retryCount: cache[K.retryCount],
              })
              reset()
              // Exponential Backoff Algorithm
              const delay = getMin(
                maxRetryDelay,
                minRetryDelay * 2 ** (cache[K.retryCount] - 1),
              )

              // The Promise returned by executePromise() during retry has no
              // external awaiter — its (resolve, reject) get pushed into
              // pendingList and settled when the cache resolves/rejects.
              // Attach noop catch so a rejected dummy doesn't surface as an
              // unhandledRejection.
              unrefTimer(
                $timeout(() => {
                  executePromise().catch(noop)
                }, delay),
              )
            }
          })
      } else if (cache[K.status] === Status.OPENING) {
        cache[K.pendingList].push([resolve, reject])
      }
    })

  return executePromise()
}

/**
 * Clear the cached result for a specific key
 */
idmp.flush = flush

/**
 * Clear all cached results
 */
idmp.flushAll = flushAll

/**
 * Type definition for the idmp function including its methods
 */
type Idmp = typeof idmp
const _s = process.env.NODE_ENV !== 'production' ? _globalStore : UNDEFINED
idmp._s = _s
export default idmp
export {
  getOptions,
  idmp,
  type Idmp,
  type IdmpGlobalKey,
  type IdmpOptions,
  type IdmpPromise,
}
