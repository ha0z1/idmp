export interface IOptions {
  /**
   * @default: 30 times
   */
  maxRetry?: number
  /**
   * unit: ms
   * @default: 3000ms
   * @max 604800000ms (7days)
   */
  maxAge?: number
  /**
   *
   * @param err any
   * @returns void
   */
  onBeforeretry?: (err: any, retryCont: number) => void
}

type PromiseCR<T, A> = (...args: A[]) => Promise<T>

const enum Status {
  UNSENT = 0,
  OPENING = 1,
  ABORTED = 2, // TODO
  REJECTED = 3,
  RESOLVED = 4,
}
const enum K {
  retryCont = 0,
  status,
  resData,
  resError,
  pendingList,
  oneCallPromiseFunc,
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

const _globalStore: Record<
  string | symbol,
  {
    [K.retryCont]: number
    [K.status]: Status
    [K.resData]: any | undefined
    [K.resError]: Error | undefined
    [K.pendingList]: Array<any>
    [K.oneCallPromiseFunc]: any
  }
> = {}

const idmp = <T, A>(
  globalKey: string | number | symbol | false | null | undefined,
  promiseFunc: PromiseCR<T, A>,
  options?: IOptions,
): Promise<T> => {
  const {
    maxRetry = 30,
    maxAge: optionMaxAge,
    onBeforeretry = noop,
  } = options || {}
  const maxAge = getRange(optionMaxAge ? optionMaxAge : DEFAULT_MAX_AGE)

  if (!globalKey) {
    return promiseFunc()
  }

  _globalStore[globalKey] = _globalStore[globalKey] || {
    [K.retryCont]: 0,
    [K.status]: Status.UNSENT,
    [K.pendingList]: [],
  }
  const cache = _globalStore[globalKey]

  const todo: PromiseCR<T, A> = () =>
    new Promise((resolve, reject) => {
      !cache[K.oneCallPromiseFunc] &&
        (cache[K.oneCallPromiseFunc] = promiseFunc)

      if (process.env.NODE_ENV !== 'production') {
        try {
          throw new Error()
        } catch (err: any) {
          let errLine = ''
          try {
            errLine = err.stack.split('\n')[5].split(' ').pop().slice(0, -2)
          } catch {}

          if (
            cache[K.oneCallPromiseFunc].toString() !== promiseFunc.toString()
          ) {
            console.error(
              `warn: the same key \`${globalKey.toString()}\` may be used multiple times in different functions. ${errLine}`,
            )
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

      const reset = (deep?: boolean) => {
        if (deep) {
          delete _globalStore[globalKey]
        } else {
          cache[K.status] = Status.UNSENT
          // cache[K.pendingList] = []
          cache[K.resData] = udf
          cache[K.resError] = udf
        }
      }

      const doResolves = () => {
        for (let item of cache[K.pendingList]) {
          item[0](cache[K.resData])
        }
        // console.log(111, 'doResolves')

        setTimeout(() => {
          reset(true)
        }, maxAge)
      }

      const doRejects = () => {
        for (let item of cache[K.pendingList]) {
          item[1](cache[K.resError])
        }
        // console.log(111, 'doRejects')
        reset(true)
      }

      if (cache[K.status] === Status.UNSENT) {
        cache[K.status] = Status.OPENING
        cache[K.pendingList].push([resolve, reject])

        cache[K.oneCallPromiseFunc]()
          .then((data: any) => {
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
            ++cache[K.retryCont]

            if (cache[K.retryCont] > maxRetry) {
              doRejects()
            } else {
              onBeforeretry(err, cache[K.retryCont])
              reset(false)
              setTimeout(() => {
                todo()
              }, 16)
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

export default idmp
export { _globalStore as g }
