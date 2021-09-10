import Promise from '../src/index.js'
import promisesAplusTests from 'promises-aplus-tests'

Promise.defer = Promise.deferred = function () {
  let dfd = {}
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve
    dfd.reject = reject
  })
  return dfd
}

promisesAplusTests(Promise, (err) => {
  throw new Error(err)
})
