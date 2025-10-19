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
}

// Constants
const DEFAULT_MAX_AGE = 3000
const _7days = 604800000
const noop = () => {}
const UNDEFINED = undefined
const $timeout = setTimeout
const $clearTimeout = clearTimeout

const getMax = (a: number, b: number): number => (a > b ? a : b)
const getMin = (a: number, b: number): number => (a < b ? a : b)

/**
 * Makes an object's properties read-only to prevent mutation
 * @param obj - Object to make read-only
 * @param key - Property key to make read-only
 * @param value - Value to assign to the property
 */
const defineReactive = (obj: any, key: string | symbol, value: any) => {
  readonly(value)
  Object.defineProperty(obj, key, {
    get: () => value,
    set: (newValue) => {
      const msg = `[idmp error] The data is read-only, set ${key.toString()}=${JSON.stringify(
        newValue,
      )} is not allow`
      console.error(`%c ${msg}`, 'font-weight: lighter; color: red')
      throw new Error(msg)
    },
  })
}

/**
 * Recursively makes an object and its properties read-only
 * @param obj - Object to make read-only
 * @returns The read-only object
 */
const readonly = <T>(obj: T): T => {
  if (obj == null || typeof obj !== 'object') return obj

  const protoType = Object.prototype.toString.call(obj)
  if (!['[object Object]', '[object Array]'].includes(protoType)) return obj

  const isImmerDraft = (obj: any) => !!obj[Symbol.for('immer-state')]
  if (isImmerDraft(obj)) return obj

  Object.keys(obj).forEach((key) => {
    const configurable = Object.getOwnPropertyDescriptor(obj, key)?.configurable
    if (configurable === UNDEFINED || configurable === true) {
      defineReactive(obj, key, (obj as any)[key])
    }
  })

  return obj
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
      cache[K.timerId] = $timeout(() => {
        flush(globalKey)
      }, maxAge) as unknown as number
    }
  }

  /**
   * Rejects all pending promises with the cached error
   */
  const doRejects = () => {
    const len = cache[K.pendingList].length
    let maxLen
    maxLen = len - maxRetry

    if (maxLen < 0 || !isFinite(len)) {
      maxLen = getMax(1, cache[K.pendingList].length - 3)
    }

    for (let i = 0; i < maxLen; ++i) {
      cache[K.pendingList][i][1](cache[K.rejectionError])
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
          if (cache[K.retryCount] === 0) {
            throw new Error()
          }
        } catch (err: any) {
          const getCodeLine = (stack: string, offset = 0): string => {
            if (typeof globalKey === 'symbol') return ''
            try {
              let arr = (stack as any)
                .split('\n')
                .filter((o: string) => o.includes(':'))

              let idx = Infinity
              $0: for (let key of [
                'idmp/src/index.ts',
                'idmp/',
                'idmp\\',
                'idmp',
              ]) {
                let _idx = arr.length - 1
                $1: for (; _idx >= 0; --_idx) {
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

          callStackLocation = getCodeLine(err.stack, 1).split(' ').pop() || ''
          !cache[K._originalErrorStack] &&
            (cache[K._originalErrorStack] = err.stack)

          if (cache[K._originalErrorStack] !== err.stack) {
            const line1 = getCodeLine(cache[K._originalErrorStack])
            const line2 = getCodeLine(err.stack)

            if (line1 && line2 && line1 !== line2) {
              console.error(
                `[idmp warn] the same key \`${globalKey.toString()}\` may be used multiple times in different places\n(It may be a misjudgment and can be ignored):\nsee https://github.com/ha0z1/idmp?tab=readme-ov-file#implementation \n${[
                  `1.${line1} ${cache[K._originalErrorStack]}`,
                  '------------',
                  `2.${line2} ${err.stack}`,
                ].join('\n')}`,
              )
            }
          }
        }
      }

      if (cache[K.resolvedData]) {
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
        if (signal.aborted) return

        signal.addEventListener('abort', () => {
          reset()
          cache[K.rejectionError] = new DOMException(
            signal.reason,
            'AbortError',
          )
          doRejects()
        })
      }

      if (cache[K.status] === Status.UNSENT) {
        cache[K.status] = Status.OPENING
        cache[K.pendingList].push([resolve, reject])

        cache[K.cachedPromiseFunc]()
          .then((data: T) => {
            if (process.env.NODE_ENV !== 'production') {
              cache[K.resolvedData] = readonly<T>(data)
            } else {
              cache[K.resolvedData] = data
            }
            doResolves()
            cache[K.status] = Status.RESOLVED
          })
          .catch((err: any) => {
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

              $timeout(executePromise, delay)
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

export default idmp
export {
  getOptions,
  idmp,
  type Idmp,
  type IdmpGlobalKey,
  type IdmpOptions,
  type IdmpPromise,
}
