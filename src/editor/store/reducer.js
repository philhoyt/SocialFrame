const MAX_HISTORY = 50;

const DEFAULT_STATE = {
	activePanel: null,
	designId: 0,
	designTitle: '',
	format: '',
	selection: {
		type: 'none',
		objectId: null,
		properties: {},
	},
	isDirty: false,
	isSaving: false,
	lastSaved: null,
	undoStack: [],
	undoIndex: -1,
	layers: [],
};

export function reducer( state = DEFAULT_STATE, action ) {
	switch ( action.type ) {
		case 'SET_ACTIVE_PANEL':
			return {
				...state,
				activePanel: state.activePanel === action.panel ? null : action.panel,
			};

		case 'SET_DESIGN':
			return {
				...state,
				designId: action.designId,
				designTitle: action.title,
				format: action.format,
				isDirty: false,
			};

		case 'SET_TITLE':
			return { ...state, designTitle: action.title, isDirty: true };

		case 'SET_SELECTION':
			return { ...state, selection: action.selection };

		case 'CLEAR_SELECTION':
			return {
				...state,
				selection: { type: 'none', objectId: null, properties: {} },
			};

		case 'UPDATE_SELECTION_PROPERTIES':
			return {
				...state,
				selection: {
					...state.selection,
					properties: { ...state.selection.properties, ...action.properties },
				},
			};

		case 'MARK_DIRTY':
			return { ...state, isDirty: true };

		case 'MARK_CLEAN':
			return { ...state, isDirty: false, lastSaved: new Date().toISOString() };

		case 'SET_SAVING':
			return { ...state, isSaving: action.saving };

		case 'PUSH_HISTORY': {
			// Truncate any forward history when a new action is pushed.
			const trimmed = state.undoStack.slice( 0, state.undoIndex + 1 );
			const next    = [ ...trimmed, action.entry ].slice( -MAX_HISTORY );
			return {
				...state,
				undoStack: next,
				undoIndex: next.length - 1,
			};
		}

		case 'UNDO': {
			if ( state.undoIndex < 0 ) return state;
			state.undoStack[ state.undoIndex ].undo();
			return { ...state, undoIndex: state.undoIndex - 1, isDirty: true };
		}

		case 'REDO': {
			if ( state.undoIndex >= state.undoStack.length - 1 ) return state;
			state.undoStack[ state.undoIndex + 1 ].redo();
			return { ...state, undoIndex: state.undoIndex + 1, isDirty: true };
		}

		case 'SET_LAYERS':
			return { ...state, layers: action.layers };

		default:
			return state;
	}
}
