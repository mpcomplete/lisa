// Generator-based async, based on
// http://www.2ality.com/2015/03/no-promises.html

'use strict';

/**
 * Run the generator object `genObj`,
 * report results via the callbacks in `callbacks`.
 */
function runGenObj(genObj, callbacks) {
  handleOneNext();

  /**
   * Handle one invocation of `next()` or `throw()`:
   * If there was a `prevResult`, it becomes the parameter.
   * What `next()` returns is what we have to run next.
   * The `success` callback triggers another round,
   * with the result assigned to `prevResult`.
   */
  function handleOneNext(prevResult) {
    handleOneYield(yieldNext(prevResult));
  }
  function handleOneThrow(err) {
    handleOneYield(yieldThrow(err));
  }
  function yieldNext(prevResult) {
    return function() {
      return genObj.next(prevResult);
    }
  }
  function yieldThrow(err) {
    return function() {
      return genObj.throw(err);
    }
  }

  // Used by handleOneNext/Throw to handle another iteration of the generator.
  // `yielder` is a function from either yieldNext or yieldThrow.
  function handleOneYield(yielder) {
    try {
      let yielded = yielder(); // may throw
      if (yielded.done) {
        if (yielded.value !== undefined) {
          // Something was explicitly returned:
          // Report the value as a result to the caller
          callbacks.success(yielded.value);
        }
      } else {
        setTimeout(runYieldedValue, 0, yielded.value);
      }
    }
    // Catch unforeseen errors in genObj
    catch (error) {
      if (callbacks) {
        callbacks.failure(error);
      } else {
        throw error;
      }
    }
  }
  function runYieldedValue(yieldedValue) {
    if (yieldedValue === undefined) {
      // If code yields `undefined`, it wants callbacks
      handleOneNext(callbacks);
    } else if (Array.isArray(yieldedValue)) {
      runInParallel(yieldedValue);
    } else {
      // Yielded value is a generator object
      runGenObj(yieldedValue, {
        success(result) {
          handleOneNext(result);
        },
        failure(err) {
          handleOneYield(yieldThrow(err));
        },
      });
    }
  }

  function runInParallel(genObjs) {
    let resultArray = new Array(genObjs.length);
    let resultCountdown = genObjs.length;
    genObjs.forEach(function(genObj, i) {
      runGenObj(genObj, {
        success(result) {
          resultArray[i] = result;
          resultCountdown--;
          if (resultCountdown <= 0) {
            handleOneNext(resultArray);
          }
        },
        failure(err) {
          genObj.throw(err);
        },
      });
    });
  }
}

function run(genFunc) {
  runGenObj(genFunc(), undefined);
}

function* echo(text, delay) {
  const caller = yield;
  if (delay > 100) throw new Error("Test throw");
  if (delay > 50) return caller.failure("Test failure");
  setTimeout(function() { caller.success(text)}, delay);
}

// TODO: remove when I kill all Promises.
function* fromPromise(promise) {
  const caller = yield;
  promise.then(caller.success, caller.failure);
}

// TODO: remove when I kill all Promises.
function toPromise(genObj) {
  return new Promise(function(resolve, reject) {
    run(function*() {
      try {
        resolve(yield genObj);
      } catch(e) {
        reject(e);
      }
    });
  });
}

exports.run = run;
exports.fromPromise = fromPromise;
exports.toPromise = toPromise;
exports.test = function() {
  console.log("right before run");
  run(function*() {
    console.log("begin run");
    console.log(yield echo("first test"));
    try {
      console.log(yield echo("Should fail", 60));
    } catch(e) {
      console.log("I can handle errors", e);
    }
    try {
      console.log(yield echo("Should throw", 200));
    } catch(e) {
      console.log("I can handle errors", e);
    }
    console.log(yield fromPromise(toPromise(echo("in promise"))));
    try {
      yield fromPromise(new Promise(function(resolve, reject) {
        setTimeout(reject, 1000);
      }));
    } catch(e) {
      console.log("caught promise2");
    }
    console.log("after promise2");
    try {
      console.log(yield fromPromise(toPromise(echo("failed promise3", 200))));
    } catch(e) {
      console.log("caught promise3");
    }
    console.log("end run");
  });
  console.log("right after run");
};
