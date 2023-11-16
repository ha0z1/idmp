/**
 * @typedef {Object} IdmpOptions
 * @property {number} [maxRetry=30] - Maximum number of retry attempts.
 * @property {number} [maxAge=3000] - Maximum age in milliseconds. The maximum value is 604800000ms (7 days).
 * @property {function} [onBeforeRetry] - Function to be executed before a retry attempt.
 */

export interface IdmpOptions {
  /**
   * Maximum number of retry attempts.
   * @type {number}
   * @default 30
   */
  maxRetry?: number

  /**
   * Maximum age in milliseconds. The maximum value is 604800000ms (7 days).
   * @type {number}
   * @default 3000
   * @max 604800000
   */
  maxAge?: number

  /**
   * Function to be executed before a retry attempt.
   * @type {function}
   * @param {any} err - The error that caused the retry.
   * @param {Object} extra - Additional parameters.
   * @param {GlobalKey} extra.globalKey - The global key.
   * @param {number} extra.retryCount - The current retry count.
   * @returns {void}
   */
  onBeforeRetry?: (
    err: any,
    extra: {
      globalKey: GlobalKey
      retryCount: number
    },
  ) => void
}

type IdmpPromise<T> = () => Promise<T>
const enum Status {
  UNSENT = 0,
  OPENING = 1,
  ABORTED = 2, // TODO
  REJECTED = 3,
  RESOLVED = 4,
}
const enum K {
  retryCount = 0,
  status,
  resData,
  resError,
  pendingList,
  oneCallPromiseFunc,
  _sourceStack,
}

const DEFAULT_MAX_AGE = 3000
const _7days = 604800000
const noop = () => {}
const udf = undefined
const deepFreeze = /* @__PURE__ */ <T>(obj: any): T => {
  if (!obj) return obj
  if (typeof obj !== 'object') return obj

  Object.keys(obj).forEach((property) => {
    if (typeof obj[property] === 'object' && !Object.isFrozen(obj[property])) {
      deepFreeze(obj[property])
    }
  })
  return Object.freeze(obj)
}

const getRange = (maxAge: number) => {
  if (maxAge < 0) return 0
  if (maxAge > _7days) return _7days
  return maxAge
}

let _globalStore: Record<
  string | symbol,
  {
    [K.retryCount]: number
    [K.status]: Status
    [K.resData]: any | undefined
    [K.resError]: Error | undefined
    [K.pendingList]: Array<any>
    [K.oneCallPromiseFunc]: any
    [K._sourceStack]: string
  }
> = {}

type GlobalKey = string | number | symbol | false | null | undefined

const flush = (globalKey: GlobalKey) => {
  if (!globalKey) return
  // if (process.env.NODE_ENV !== 'production') {
  //   if (!_globalStore[globalKey]) {
  //     console.log(
  //       `idmp: The cache for \`${globalKey.toString()}\` does not exist, there is no need to worry. This is just a development message and is considered a normal situation.`,
  //     )
  //   } else {
  //     console.log(
  //       `idmp: The cache for \`${globalKey.toString()}\` has been cleared`,
  //     )
  //   }
  // }
  delete _globalStore[globalKey]
}

const flushAll = () => {
  _globalStore = {}
}

const idmp = <T>(
  globalKey: GlobalKey,
  promiseFunc: IdmpPromise<T>,
  options?: IdmpOptions,
): Promise<T> => {
  if (process.env.NODE_ENV !== 'production') {
    options = deepFreeze(options)
  }

  const {
    maxRetry = 30,
    maxAge: paramMaxAge = DEFAULT_MAX_AGE,
    onBeforeRetry = noop,
  } = options || {}

  const maxAge = getRange(paramMaxAge)

  if (!globalKey) {
    return promiseFunc()
  }

  _globalStore[globalKey] = _globalStore[globalKey] || {
    [K.retryCount]: 0,
    [K.status]: Status.UNSENT,
    [K.pendingList]: [],
  }
  const cache = _globalStore[globalKey]

  const reset = () => {
    cache[K.status] = Status.UNSENT
    cache[K.resData] = udf
    cache[K.resError] = udf
  }

  const doResolves = () => {
    const len = cache[K.pendingList].length
    for (let i = 0; i < len; ++i) {
      cache[K.pendingList][i][0](cache[K.resData])
    }
    cache[K.pendingList] = []

    setTimeout(() => {
      flush(globalKey)
    }, maxAge)
  }

  const doRejects = () => {
    const len = cache[K.pendingList].length - maxRetry
    for (let i = 0; i < len; ++i) {
      cache[K.pendingList][i][1](cache[K.resError])
    }
    flush(globalKey)
  }
  const todo = () =>
    new Promise<T>((resolve, reject) => {
      !cache[K.oneCallPromiseFunc] &&
        (cache[K.oneCallPromiseFunc] = promiseFunc)

      if (process.env.NODE_ENV !== 'production') {
        try {
          if (cache[K.retryCount] === 0) {
            throw new Error()
          }
        } catch (err: any) {
          !cache[K._sourceStack] && (cache[K._sourceStack] = err.stack)

          if (cache[K._sourceStack] !== err.stack) {
            const getCodeLine = (stack: string) => {
              try {
                const arr = (stack as any)
                  .split('\n')
                  .filter((o: string) => o.includes(':'))

                let idx = Infinity

                for (let key of [
                  'idmp/src/index.ts',
                  'idmp/',
                  'idmp\\',
                  'idmp',
                ]) {
                  const _idx = arr.findLastIndex((o: string) => o.includes(key))
                  if (_idx > -1) {
                    idx = _idx
                    break
                  }
                }
                // console.log(idx, 4444444)
                // const idx = arr.findLastIndex(
                //   (o: string) =>
                //     o.includes('idmp/') ||
                //     o.includes('idmp\\') ||
                //     o.includes('idmp'),
                // )
                const line = arr[idx + 1] || ''
                return line
              } catch {}
              return ''
            }
            const line1 = getCodeLine(cache[K._sourceStack])
            const line2 = getCodeLine(err.stack)

            if (line1 && line2 && line1 !== line2) {
              console.error(
                `[idmp warn] the same key \`${globalKey.toString()}\` may be used multiple times in different places: \n${[
                  `1.${line1}`,
                  '------------',
                  `2.${line2}`,
                ].join('\n')}`,
              )
            }
          }
        }
      }

      if (cache[K.resData]) {
        resolve(cache[K.resData])
        return
      }
      if (cache[K.resError]) {
        reject(cache[K.resError])
        return
      }

      if (cache[K.status] === Status.UNSENT) {
        cache[K.status] = Status.OPENING
        cache[K.pendingList].push([resolve, reject])

        cache[K.oneCallPromiseFunc]()
          .then((data: T) => {
            cache[K.status] = Status.RESOLVED
            if (process.env.NODE_ENV !== 'production') {
              cache[K.resData] = deepFreeze<T>(data)
            } else {
              cache[K.resData] = data
            }
            doResolves()
          })
          .catch((err: any) => {
            cache[K.status] = Status.REJECTED
            cache[K.resError] = err
            ++cache[K.retryCount]

            if (cache[K.retryCount] > maxRetry) {
              doRejects()
            } else {
              onBeforeRetry(err, {
                globalKey: globalKey,
                retryCount: cache[K.retryCount],
              })
              reset()

              setTimeout(todo, (cache[K.retryCount] - 1) * 50)
            }
          })
      } else if (cache[K.status] === Status.OPENING) {
        cache[K.pendingList].push([resolve, reject])
      } else if (cache[K.status] === Status.RESOLVED) {
        doResolves()
      } else if (cache[K.status] === Status.REJECTED) {
        doRejects()
      }
    })

  const ret = todo()
  return ret
}

idmp.flush = flush
idmp.flushAll = flushAll

export default idmp
export { _globalStore as g }
