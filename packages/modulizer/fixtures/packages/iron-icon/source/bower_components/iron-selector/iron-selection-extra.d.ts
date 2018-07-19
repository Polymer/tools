declare namespace Polymer {

  class IronSelection {
    constructor(selectCallback: Function);

    /**
     * If true, multiple selections are allowed.
     */
    multi: boolean;

    /**
     * Retrieves the selected item(s).
     *
     * @returns Returns the selected item(s). If the multi property is true,
     * `get` will return an array, otherwise it will return
     * the selected item or undefined if there is no selection.
     */
    get(): any|any[]|undefined;

    /**
     * Clears all the selection except the ones indicated.
     *
     * @param excludes items to be excluded.
     */
    clear(excludes: any[]|null): void;

    /**
     * Indicates if a given item is selected.
     *
     * @param item The item whose selection state should be checked.
     * @returns Returns true if `item` is selected.
     */
    isSelected(item: any): boolean;

    /**
     * Sets the selection state for a given item to either selected or
     * deselected.
     *
     * @param item The item to select.
     * @param isSelected True for selected, false for deselected.
     */
    setItemSelected(item: any, isSelected: boolean): void;

    /**
     * Sets the selection state for a given item. If the `multi` property
     * is true, then the selected state of `item` will be toggled; otherwise
     * the `item` will be selected.
     *
     * @param item The item to select.
     */
    select(item: any): void;

    /**
     * Toggles the selection state for `item`.
     *
     * @param item The item to toggle.
     */
    toggle(item: any): void;
  }
}
