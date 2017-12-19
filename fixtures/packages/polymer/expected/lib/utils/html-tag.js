import './boot.js';

/**
 * @param {*} value Object to stringify into HTML
 * @return {string} HTML stringified form of `obj`
 */
function htmlValue(value) {
  if (value instanceof HTMLTemplateElement) {
    return /** @type {!HTMLTemplateElement} */(value).innerHTML;
  } else {
    return String(value);
  }
}

export const html = function html(strings, ...values) {
  // use raw strings to preserve literal escapes in strings
  /** @type {!Array<string>} */
  const rawStrings = strings.raw;
  const template = /** @type {!HTMLTemplateElement} */(document.createElement('template'));
  template.innerHTML = values.reduce((acc, v, idx) =>
    acc + htmlValue(v) + rawStrings[idx + 1], rawStrings[0]);
  return template;
};
