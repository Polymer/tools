/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

/** TODO(rictic): upstream this file and its tests into the analyzer. */

import {comparePositionAndRange, isPositionInsideRange, ParsedDocument, SourceRange, Warning} from 'polymer-analyzer';


/**
 * A warning that may include information on how to mechanically
 * fix it.
 */
export interface FixableWarning extends Warning {
  /**
   * If the problem has a single automatic fix, this is it.
   *
   * Whether and how much something is 'automatic' can be a bit tricky to
   * delineate. Roughly speaking, if 99% of the time the change solves the
   * issue completely then it should go in `fix`.
   */
  fix?: Edit;
}

/**
 * Represents an action for replacing a range in a document with some text.
 *
 * This is sufficient to represent all operations on text files, including
 * inserting and deleting text (using empty ranges or empty replacement
 * text, respectively).
 */
export interface Replacement {
  range: SourceRange;
  replacementText: string;
}


/**
 * A set of replacements that must all be applied as a single atomic unit.
 */
export type Edit = ReadonlyArray<Replacement>;

export interface EditResult {
  /** The edits that had no conflicts, and are reflected in editedFiles. */
  appliedEdits: Edit[];

  /** Edits that could not be applied due to overlapping ranges. */
  incompatibleEdits: Edit[];

  /** A map from urls to their new contents. */
  editedFiles: Map<string, string>;
}

/**
 * Takes the given edits and, provided there are no overlaps, applies them to
 * the contents loadable from the given loader.
 *
 * If there are overlapping edits, then edits earlier in the array get priority
 * over later ones.
 */
export async function applyEdits(
    edits: Edit[], loader: (url: string) => Promise<ParsedDocument<any, any>>):
    Promise<EditResult> {
  const result: EditResult = {
    appliedEdits: [],
    incompatibleEdits: [],
    editedFiles: new Map()
  };

  const replacementsByFile = new Map<string, Replacement[]>();
  for (const edit of edits) {
    if (canApply(edit, replacementsByFile)) {
      result.appliedEdits.push(edit);
    } else {
      result.incompatibleEdits.push(edit);
    }
  }

  for (const entry of replacementsByFile) {
    const file = entry[0];
    const replacements = entry[1];
    const document = await loader(file);
    let contents = document.contents;
    /**
     * This is the important bit. We know that none of the replacements overlap,
     * so in order for their source ranges in the file to all be valid at the
     * time we apply them, we simply need to apply them starting from the end
     * of the document and working backwards to the beginning.
     */
    replacements.sort((a, b) => {
      const leftEdgeComp =
          comparePositionAndRange(b.range.start, a.range, true);
      if (leftEdgeComp !== 0) {
        return leftEdgeComp;
      }
      return comparePositionAndRange(b.range.end, a.range, false);
    });
    for (const replacement of replacements) {
      const offsets = document.sourceRangeToOffsets(replacement.range);
      contents = contents.slice(0, offsets[0]) + replacement.replacementText +
          contents.slice(offsets[1]);
    }
    result.editedFiles.set(file, contents);
  }

  return result;
}

/**
 * We can apply an edit if none of its replacements overlap with any accepted
 * replacement.
 */
function canApply(
    edit: Edit, replacements: Map<string, Replacement[]>): boolean {
  for (let i = 0; i < edit.length; i++) {
    const replacement = edit[i];
    const fileLocalReplacements =
        replacements.get(replacement.range.file) || [];
    // TODO(rictic): binary search
    for (const acceptedReplacement of fileLocalReplacements) {
      if (doRangesOverlap(replacement.range, acceptedReplacement.range)) {
        return false;
      }
    }
    // Also check consistency between multiple replacements in this edit.
    for (let j = 0; j < i; j++) {
      const acceptedReplacement = edit[j];
      if (doRangesOverlap(replacement.range, acceptedReplacement.range)) {
        return false;
      }
    }
  }

  // Ok, we can be applied to the replacements, so add our replacements in.
  for (const replacement of edit) {
    if (!replacements.has(replacement.range.file)) {
      replacements.set(replacement.range.file, [replacement]);
    } else {
      const fileReplacements = replacements.get(replacement.range.file)!;
      // TODO(rictic): insert in sorted order
      fileReplacements.push(replacement);
    }
  }
  return true;
}

function doRangesOverlap(a: SourceRange, b: SourceRange) {
  if (a.file !== b.file) {
    return false;
  }
  return areRangesEqual(a, b) || isPositionInsideRange(a.start, b, false) ||
      isPositionInsideRange(a.end, b, false) ||
      isPositionInsideRange(b.start, a, false) ||
      isPositionInsideRange(b.end, a, false);
}

function areRangesEqual(a: SourceRange, b: SourceRange) {
  return a.start.line === b.start.line && a.start.column === b.start.column &&
      a.end.line === b.end.line && a.end.column === b.end.column;
}
