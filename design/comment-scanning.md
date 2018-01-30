# Polymer Analyzer - Comment Directives & Comment Annotations
> Author @FredKSchott
> Status: Partial Implementation
> Discussion: https://github.com/Polymer/polymer-analyzer/pull/644
> Last Update: 2017-05-09

> **Update: 05-02-2017 Design Review** After an in-person review session we decided to move forward and implement the polymer-lint directive piece of the design and hold off on the more general-purpose directive scanning. Instead of creating a new general-purpose `Directive` class, the analyzer will have a built in scanner that returns `PolymerLintDirective`s. We can return to this design document in the future when there is a need for scanning/analyzing a second directive type.


## Prototype aka Straw Man
- Analyzer: https://github.com/Polymer/polymer-analyzer/compare/comment-directives
- Linter: https://github.com/Polymer/polymer-linter/compare/comment-directives


## Objective
- To support the analysis of certain instructions documented within source code ("comment directives").
- To support the analysis of polymer-lint comment directives that can enable/disable certain lint rules within a file.


## Goals
- Define a format for comment directives that is as general as possible while still providing some basic parsing & structure (for arguments, etc).
- Define an implementation for scanning that is extensible. Some scanners may be included by default, but consumers should be able to add and distribute their own.
- Documentation (README, docs/ entry, docs site entry, etc) that communicates our directive support, and how a 3rd-party developer could add support for analyzing their own directive.


## Non-Goals
- Define a format for comment directives that are "attached" to existing features. See "What About Attached Comments?" below.


## Background

Our tooling needs the ability to read configuration written into the source code. This is important for a tool like polymer-lint, which needs to be able to support enabling & disabling of rules within individual files:

```js
/* polymer-lint disable: undefined-elements */
customElements.define('vanilla-element1', AnElementThatActuallyExists);
customElements.define('vanilla-element2', IPromiseThisExists);
customElements.define('vanilla-element3', SeriouslyLinterDontBeMad);
/* polymer-lint enable: undefined-elements */
```

Other tools will also benefit from this ability. For example, right now polymer-build asks the user to create and register an empty service worker in development. This way the the auto-generated service worker can overwrite the empty one during build and be loaded instead in production. Instead of all that, the user could just do this:

```html
<!-- @registerServiceWorkerHere -->
```

... and the library would inject the service worker registration in to the production application automatically. No more empty dev-only service worker needed.


## Design Overview

```
/* polymer-lint disable */
/* polymer-lint disable: undefined-elements, rule-2 */
/* polymer-lint enable: undefined-elements */
/* lazy-import: '../some-url/some-file.html' */
<!-- polymer-build:register-service-worker-here -->
```

A comment directive is represented by a single new **Directive** feature type within a document.

```
class Directive extends Feature {
  identifier: string;
  args?: string[];
}
```

- A comment directive may include "arguments", which will be parsed by the scanner.
- A comment directive must exist within its own comment so that the analyzer can properly create a feature that matches that comment node's location.
- Each comment directive will have a pluggable scanner responsible for scanning for it.
- That scanner must be able to detect and parse the comment directive format, and return a set of general **Directive** instances.
- Because of the wide range of possible features these could support, specific comment syntax is lax. However they should follow these guidelines:
  - it is unique enough to never collide with other directive formats.
  - it is formal enough to be matched by substring or RegEx matching.
  - if it takes arguments they should be parsed in the scanning phase.

Here is an example of how the comment directives above could be parsed by their scanners:

```
/* polymer-lint disable */
Directive({identifier: 'polymer-lint', args: ['disable']})
/* polymer-lint disable: undefined-elements, rule-2 */
Directive({identifier: 'polymer-lint', args: ['disable', 'undefined-elements', 'rule-2']})
/* polymer-lint enable: undefined-elements */
Directive({identifier: 'polymer-lint', args: ['enable', 'undefined-elements']})
/* lazy-import: '../some-url/some-file.html' */
Directive({identifier: 'lazy-import', args: ['../some-url/some-file.html']})
<!-- polymer-build:register-service-worker-here -->
Directive({identifier: 'polymer-build:register-service-worker-here', args: null})
```

> Note: `enable`/`disable` is the first argument of the "polymer-lint" directive and not a part of the identifier. It will be common to have a single identifier for all related directives so that consumers can get all relevant directives by identifier. For example, the linter should be able to call `document.getFeatures({kind: 'directive', id: 'polymer-lint'});` and get both "enable" & "disable" directives.


## Implementation Example: Polymer Lint

Here is an overview of how the Linter would work using the comment directive design outlined above.

For the purpose of this example, we’ll denote a Lint Directive as `LintDirective(command: 'enable'|'disable', rules?: string[])` where rules is a list of rules *or rule sets*. If `rules` is undefined, all lint rules will be enabled/disabled.

### In the Analyzer...

1. A new pluggable scanner is added to the analyzer for each language we care to scan for Polymer Lint directives.
1. That scanner knows to look for and match with polymer-lint directives based on its own internal regex.
1. That scanner also knows how to parse the arguments for each directive as a comma-separated list of rules.
1. For each "disable" `LintDirective` found, create a new **`LintDirective('disable', rules)`** with the parsed rules (or undefined if none existed).
1. For each "enable" `LintDirective` found, create a new **`LintDirective('enable', rules)`** with the parsed rules (or undefined if none existed).
1. Return all found `LintDirectives` as scanned features of kind 'directive' and identifier 'polymer-lint'.

### In the Linter...

1. The linter gets all `LintDirectives` for a document before linting a given set of rules.
1. The linter reads those directives and reports warnings correctly based on their configuration.

> This design document focuses on the analysis side of directive analysis, so I'll stop myself from commenting on how the linter will do this internally. There are several possible implementations, and discussing them is outside the scope of this design doc.


## What About Attached Comments?

It is worth highlighting again that comment directives are standalone features, and do not support direct "attachment" to some adjacent feature. This is an intentional design decision to make directive behavior more explicit and easier to use properly.

By requiring comment directives to be standalone features, we are able to leverage the current, pluggable scanner system of the analyzer. Support for scanning directives that are not their own features introduces the following problems:

- Adding a scanner that doesn't return features -- and instead modifies existing features -- would require some amount of modifications to the current analyzer design. We would need to add a new kind of scanner that ran after all others and that could modify existing features.
- Moving the responsibility for scanning attached comments into the already-existing scanners would also require a new concept of "attached" comment and a new system of comment parsers that attached to our already pluggable scanners. This would be a new thing that each scanner author would need to worry about applying properly.
- Moving the responsibility for scanning attached comments completely out of the analyzer and onto consumers would require that each feature includes the full text of its comments for the consumer to analyze.

Disregarding implementation concerns, there are also usability concerns for attached comment directives:

- The source range for a comment directive would be decided by the analyzer, not the code author. The user would have no way of knowing the exact source range they were attaching a directive to until analysis. 3rd-party scanners would make this especially hard to define at scale.
- Supporting multiple behaviors for directives would make them harder to use properly. It would be unclear by reading the code whether a directive was standalone or applied to the source range of some attached feature.

Ultimately, "attached" comment directives would be more work to implement, more difficult to use correctly, and would still be strictly less powerful than standalone directives (there is nothing attached directives could do that standalone directives cold not also do).

If I'm incorrect in this assessment and we later decide that we absolutely need to support attached directives, there should be nothing stopping us from adding that support later on down the road.
