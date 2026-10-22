import { browseLibrary, listShelves, readLibrary, writeLibraryItem } from './store.server';

export const libraryServices = { 'library/read': readLibrary, 'library/write': writeLibraryItem };

/** What the node's body asks while a person picks a shelf: the shelves there are, and what one holds. */
export const libraryActions = { 'library/shelves': listShelves, 'library/browse': browseLibrary };
