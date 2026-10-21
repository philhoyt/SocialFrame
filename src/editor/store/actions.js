export const setActivePanel = ( panel ) => ( {
	type: 'SET_ACTIVE_PANEL',
	panel,
} );

export const setDesign = ( {
	designId,
	title,
	format,
	postTypes = [],
	sourcePost = 0,
} ) => ( {
	type: 'SET_DESIGN',
	designId,
	title,
	format,
	postTypes,
	sourcePost,
} );

export const setTitle = ( title ) => ( { type: 'SET_TITLE', title } );

export const setPostTypes = ( postTypes ) => ( {
	type: 'SET_POST_TYPES',
	postTypes,
} );

export const setSelection = ( selection ) => ( {
	type: 'SET_SELECTION',
	selection,
} );

export const clearSelection = () => ( { type: 'CLEAR_SELECTION' } );

export const updateSelectionProperties = ( properties ) => ( {
	type: 'UPDATE_SELECTION_PROPERTIES',
	properties,
} );

export const markDirty = () => ( { type: 'MARK_DIRTY' } );

export const markClean = () => ( { type: 'MARK_CLEAN' } );

export const setSaving = ( saving ) => ( { type: 'SET_SAVING', saving } );

export const pushHistory = ( entry ) => ( { type: 'PUSH_HISTORY', entry } );

/**
 * Undo the current history entry.
 *
 * A thunk, not a plain action: entry callbacks dispatch (sync layers, mark
 * dirty), and Redux forbids dispatching from inside a reducer, so the callback
 * runs here and the reducer only moves the history index.
 *
 * @return {(registry: {select: Object, dispatch: (action: Object) => void}) => void} Thunk.
 */
export const undoAction =
	() =>
	( { select, dispatch } ) => {
		const entry = select.getUndoStack()[ select.getUndoIndex() ];
		if ( ! entry ) {
			return;
		}
		entry.undo();
		dispatch( { type: 'UNDO' } );
	};

/**
 * Redo the next history entry. See undoAction() for why this is a thunk.
 *
 * @return {(registry: {select: Object, dispatch: (action: Object) => void}) => void} Thunk.
 */
export const redoAction =
	() =>
	( { select, dispatch } ) => {
		const entry = select.getUndoStack()[ select.getUndoIndex() + 1 ];
		if ( ! entry ) {
			return;
		}
		entry.redo();
		dispatch( { type: 'REDO' } );
	};

export const setLayers = ( layers ) => ( { type: 'SET_LAYERS', layers } );

export const setZoom = ( zoom ) => ( { type: 'SET_ZOOM', zoom } );
