export const setActivePanel = ( panel ) => ( { type: 'SET_ACTIVE_PANEL', panel } );

export const setDesign = ( { designId, title, format } ) => ( {
	type: 'SET_DESIGN',
	designId,
	title,
	format,
} );

export const setTitle = ( title ) => ( { type: 'SET_TITLE', title } );

export const setSelection = ( selection ) => ( { type: 'SET_SELECTION', selection } );

export const clearSelection = () => ( { type: 'CLEAR_SELECTION' } );

export const updateSelectionProperties = ( properties ) => ( {
	type: 'UPDATE_SELECTION_PROPERTIES',
	properties,
} );

export const markDirty = () => ( { type: 'MARK_DIRTY' } );

export const markClean = () => ( { type: 'MARK_CLEAN' } );

export const setSaving = ( saving ) => ( { type: 'SET_SAVING', saving } );

export const pushHistory = ( entry ) => ( { type: 'PUSH_HISTORY', entry } );

export const undoAction = () => ( { type: 'UNDO' } );

export const redoAction = () => ( { type: 'REDO' } );

export const setLayers = ( layers ) => ( { type: 'SET_LAYERS', layers } );

export const setZoom = ( zoom ) => ( { type: 'SET_ZOOM', zoom } );
