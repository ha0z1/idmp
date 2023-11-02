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
  onBeforeRetry?: (
    err: any,
    extra: {
      globalKey: TGlobalKey
      retryCont: number
    },
  ) => void
}

type PromiseIdmp<T> = () => Promise<T>
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

const _globalStore: Record<
  string | symbol,
  {
    [K.retryCont]: number
    [K.status]: Status
    [K.resData]: any | undefined
    [K.resError]: Error | undefined
    [K.pendingList]: Array<any>
    [K.oneCallPromiseFunc]: any
    [K._sourceStack]: string
  }
> = {}

type TGlobalKey = string | number | symbol | false | null | undefined

const flush = (globalKey: TGlobalKey) => {
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

const idmp = <T>(
  globalKey: TGlobalKey,
  promiseFunc: PromiseIdmp<T>,
  options?: IOptions,
): Promise<T> => {
  const {
    maxRetry = 30,
    maxAge: optionMaxAge,
    onBeforeRetry = noop,
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

  const reset = () => {
    cache[K.status] = Status.UNSENT
    // cache[K.pendingList] = []
    cache[K.resData] = udf
    cache[K.resError] = udf
  }

  const doResolves = () => {
    for (let item of cache[K.pendingList]) {
      item[0](cache[K.resData])
    }
    // console.log(111, 'doResolves')

    setTimeout(() => {
      flush(globalKey)
    }, maxAge)
  }

  const doRejects = () => {
    for (let item of cache[K.pendingList]) {
      item[1](cache[K.resError])
    }
    // console.log(111, 'doRejects')
    flush(globalKey)
  }
  const todo = () =>
    new Promise<T>((resolve, reject) => {
      !cache[K.oneCallPromiseFunc] &&
        (cache[K.oneCallPromiseFunc] = promiseFunc)

      if (process.env.NODE_ENV !== 'production') {
        try {
          if (cache[K.retryCont] === 0) {
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
                const idx = arr.findLastIndex(
                  (o: string) =>
                    o.includes('idmp/') ||
                    o.includes('idmp\\') ||
                    o.includes('idmp'),
                )
                const line = arr[idx + 1] || stack
                return line
              } catch {}
              return stack
            }

            console.error(
              `[idmp warn] the same key \`${globalKey.toString()}\` may be used multiple times in different places: \n${[
                `1.${getCodeLine(cache[K._sourceStack])}`,
                `2.${getCodeLine(err.stack)}`,
              ].join('\n')}`,
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
              onBeforeRetry(err, {
                globalKey: globalKey,
                retryCont: cache[K.retryCont],
              })
              reset()

              setTimeout(
                () => {
                  todo()
                },
                (cache[K.retryCont] - 1) * 50,
              )
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

export default idmp
export { _globalStore as g }
