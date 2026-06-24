/**
 * Unit tests for the editor store selectors.
 */
import {
	canUndo,
	canRedo,
	getUndoLabel,
	getRedoLabel,
	getSelectionType,
	getSelectionProps,
	isDirty,
} from '../selectors';

const stateWith = ( overrides ) => ( {
	selection: { type: 'none', objectId: null, properties: {} },
	isDirty: false,
	undoStack: [],
	undoIndex: -1,
	...overrides,
} );

describe( 'editor selectors', () => {
	it( 'canUndo reflects a non-negative undo index', () => {
		expect( canUndo( stateWith( { undoIndex: -1 } ) ) ).toBe( false );
		expect( canUndo( stateWith( { undoIndex: 0 } ) ) ).toBe( true );
	} );

	it( 'canRedo reflects remaining forward history', () => {
		const stack = [ { label: 'a' }, { label: 'b' } ];
		expect(
			canRedo( stateWith( { undoStack: stack, undoIndex: 1 } ) )
		).toBe( false );
		expect(
			canRedo( stateWith( { undoStack: stack, undoIndex: 0 } ) )
		).toBe( true );
	} );

	it( 'returns undo/redo labels or null at the boundaries', () => {
		const stack = [ { label: 'first' }, { label: 'second' } ];
		const state = stateWith( { undoStack: stack, undoIndex: 0 } );
		expect( getUndoLabel( state ) ).toBe( 'first' );
		expect( getRedoLabel( state ) ).toBe( 'second' );

		const atEnd = stateWith( { undoStack: stack, undoIndex: 1 } );
		expect( getRedoLabel( atEnd ) ).toBeNull();

		const atStart = stateWith( { undoStack: stack, undoIndex: -1 } );
		expect( getUndoLabel( atStart ) ).toBeNull();
	} );

	it( 'reads selection fields', () => {
		const state = stateWith( {
			selection: {
				type: 'image',
				objectId: 'z',
				properties: { opacity: 0.5 },
			},
		} );
		expect( getSelectionType( state ) ).toBe( 'image' );
		expect( getSelectionProps( state ) ).toEqual( { opacity: 0.5 } );
	} );

	it( 'reads the dirty flag', () => {
		expect( isDirty( stateWith( { isDirty: true } ) ) ).toBe( true );
	} );
} );
