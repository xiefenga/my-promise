import { PENDING, FULFILLED, REJECTED } from './states.js'

export default class Promise {

  #PromiseState = PENDING

  #PromiseResult

  #thenables = []

  #catchables = []

  constructor(excutor) {
    if (typeof excutor !== 'function') {
      throw new TypeError(`Promise resolver ${excutor} is not a function`)
    }

    const resolve = value => {
      if (this.#PromiseState === PENDING) {
        this.#PromiseState = FULFILLED
        this.#PromiseResult = value
        queueMicrotask(() => this.#thenables.forEach(onFulfilled => onFulfilled()))
      }
    }

    const reject = reason => {
      if (this.#PromiseState === PENDING) {
        this.#PromiseState = REJECTED
        this.#PromiseResult = reason
        queueMicrotask(() => this.#catchables.forEach(onRejected => onRejected()))
      }
    }

    try {
      excutor(resolve, reject)
    } catch (error) {
      reject(error)
    }
  }

  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value
    onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason }
    const promise = new Promise((resolve, reject) => {
      if (this.#PromiseState === PENDING) {
        this.#thenables.push(() => {
          try {
            const x = onFulfilled(this.#PromiseResult)
            resolvePromise(promise, x, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
        this.#catchables.push(() => {
          try {
            const x = onRejected(this.#PromiseResult)
            resolvePromise(promise, x, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      } else if (this.#PromiseState === FULFILLED) {
        queueMicrotask(() => {
          try {
            const x = onFulfilled(this.#PromiseResult)
            resolvePromise(promise, x, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      } else if (this.#PromiseState === REJECTED) {
        queueMicrotask(() => {
          try {
            const x = onRejected(this.#PromiseResult)
            resolvePromise(promise, x, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      }
    })
    return promise
  }

  catch(onRejected) {
    onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason }
    return this.then(null, onRejected)
  }

  finally(onFinally) {
    onFinally = typeof onFinally === 'function' ? onFinally : () => { }
    return this.then(
      value => Promise.resolve(onFinally()).then(() => value),
      reason => Promise.resolve(onFinally()).then(() => { throw reason })
    )
  }

  static all(promises) {
    let finished = 0
    const num = promises.length
    const results = []
    return new Promise((resolve, reject) => {
      promises.forEach((promise, index) => {
        promise.then((res) => {
          results[index] = res
          if (++finished === num) {
            resolve(results)
          }
        }, reject)
      })
    })
  }

  static allSettled(promises) {
    let finished = 0
    const num = promises.length
    const results = []
    return new Promise((resolve, reject) => {
      promises.forEach((promise, index) => {
        promise.then(
          (res) => {
            results[index] = { status: 'fulfilled', value: res }
            if (++finished === num) {
              resolve(results)
            }
          },
          (error) => {
            results[index] = { status: 'rejected', reason: error }
            if (++finished === num) {
              resolve(results)
            }
          })
      })
    })
  }

  static race(promises) {
    return new Promise((resolve, reject) => {
      promises.forEach((promise) => {
        promise.then(resolve, reject)
      })
    })
  }

  static any(promises) {
    let rejectNum = 0
    const num = promises.length
    const errors = []
    return new Promise((resolve, reject) => {
      promises.forEach((promise, index) => {
        promise.then(
          resolve,
          (error) => {
            errors[index] = error
            if (++rejectNum === num) {
              reject(new AggregateError(errors, 'All promises were rejected'))
            }
          })
      })
    })
  }

  static resolve(value) {
    if (value instanceof Promise) {
      return value
    } else if (typeof value?.then === 'function') {
      return new Promise((resolve, reject) => {
        value.then(resolve, reject)
      })
    } else {
      return new Promise((resolve) => resolve(value))
    }
  }

  static reject(reason) {
    return new Promise((_, reject) => reject(reason))
  }
}

/**
 * 按照 Promise/A+ 实现即可
 * @param {*} promise 
 * @param {*} x 
 * @param {*} resolve 
 * @param {*} reject 
 * @returns 
 */
function resolvePromise(promise, x, resolve, reject) {
  if (promise === x) {
    reject(new TypeError(''))
  } else if (x && (typeof x === 'function' || typeof x === 'object')) {
    let used = false
    try {
      const then = x.then
      if (typeof then === 'function') {
        then.call(x,
          y => {
            if (used) { return }
            used = true
            resolvePromise(promise, y, resolve, reject)
          },
          r => {
            if (used) { return }
            used = true
            reject(r)
          }
        )
      } else {
        resolve(x)
      }
    } catch (error) {
      if (used) { return }
      used = true
      reject(error)
    }
  } else {
    resolve(x)
  }
}

