/** @global */
function noReturn() {
}

/** @global */
function returnWithNoArgument() {
  return;
}

/** @global */
function returnValue() {
  return 'foo';
}

/** @global */
function mixedReturnStyle() {
  if (something) {
    return;
  } else {
    return 'foo';
  }
}

/** @global */
function voidWithNonVoidInside() {
  function fd() {
    return 10;
  };
  const fe = function() {
    return 20;
  };
  class c {
    cm() {
      return 30;
    }
  };
  const a = () => {
    return 40;
  };
  const o = {
    om() {
      return 50;
    }
  };
};

/** @global */
async function isAsync() {
}

/** @global */
function* isGenerator() {
}

/**
 * @global
 * @return {string}
 */
function annotationOverride() {
}

/** @global */
const arrowNoReturn = () => {};

/** @global */
const arrowReturnWithNoArgument = () => {
  return;
};

/** @global */
const arrowReturnValueConcise = () => 10;
