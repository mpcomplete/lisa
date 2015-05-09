// Generator-based async, based on
// http://www.2ality.com/2015/03/no-promises.html

'use strict';

/**
 * Run the generator object `genObj`,
 * report results via the callbacks in `callbacks`.
 */
function run(genObj, callbacks) {
  handleOneNext();

  /**
   * Handle one invocation of `next()` or `throw()`:
   * If there was a `prevResult`, it becomes the parameter.
   * What `next()` returns is what we have to run next.
   * The `success` callback triggers another round,
   * with the result assigned to `prevResult`.
   */
  function handleOneNext(prevResult) {
    handleOneIter(function() {
      return genObj.next(prevResult);
    });
  }
  function handleOneThrow(err) {
    handleOneIter(function() {
      return genObj.throw(err);
    });
  }

  // Used by handleOneNext/Throw to handle another iteration of the generator.
  // `iter` is a function that calls either Generator.next or throw and
  // returns the next yielded value.
  function handleOneIter(iter) {
    try {
      let yielded = iter(); // may throw
      if (yielded.done) {
        if (yielded.value !== undefined) {
          // Something was explicitly returned:
          // Report the value as a result to the caller
          callbacks.success(yielded.value);
        }
      } else {
        setTimeout(runYieldedValue, 0, yielded.value, {
          success(result) { handleOneNext(result); },
          failure(err) { handleOneThrow(err); }
        });
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
  function runYieldedValue(yieldedValue, subCallbacks) {
    if (yieldedValue === undefined) {
      // If code yields `undefined`, it wants callbacks
      handleOneNext(callbacks);
    } else if (Array.isArray(yieldedValue)) {
      runInParallel(yieldedValue);
    } else if ("next" in yieldedValue) {
      // Yielded value is a generator object
      run(yieldedValue, subCallbacks);
    } else if ("then" in yieldedValue) {
      // Yielded value is a promise
      yieldedValue.then(subCallbacks.success, subCallbacks.failure);
    } else {
      throw new Error("Generator yielded unexpected type", yieldedValue);
    }
  }

  function runInParallel(genObjs) {
    let resultArray = new Array(genObjs.length);
    let resultCountdown = genObjs.length;
    genObjs.forEach(function(genObj, i) {
      runYieldedValue(genObj, {
        success(result) {
          resultArray[i] = result;
          resultCountdown--;
          if (resultCountdown <= 0) {
            handleOneNext(resultArray);
          }
        },
        failure(err) {
          handleOneThrow(err);
        },
      });
    });
  }
}

// Simple helper to run the genObj returned by genFunc.
function call(genFunc) {
  run(genFunc());
}

// Simple helper to return a callback which runs the given genFunc
// through the async handler. Used like:
//   element.onChange = Async.cb(function*(newText) {
//      yield updateAsync(newText);
//   });
function cb(genFunc) {
  return function(n_args) {
    run(genFunc.apply(this, arguments));
  };
}

exports.call = call;
exports.cb = cb;
exports.test = function() {
  function* identity(input) {
    return input;
  }

  function* echo(text, delay) {
    const caller = yield;
    if (delay > 100) throw new Error("Test throw");
    if (delay > 50) return caller.failure("Test failure");
    setTimeout(function() { caller.success(text)}, delay);
  }

  console.log("right before run");
  call(function*() {
    console.log("begin run");
    console.log(yield identity("returns immediately"));
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
    try {
      yield new Promise(function(resolve, reject) {
        setTimeout(reject, 1000);
      });
    } catch(e) {
      console.log("caught promise2");
    }
    console.log("end run");
  });
  console.log("right after run");
};
