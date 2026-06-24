/**
 * Unit tests for the editor store reducer.
 */
import { reducer } from '../reducer';
import {
	setActivePanel,
	setDesign,
	setTitle,
	setSelection,
	clearSelection,
	updateSelectionProperties,
	markDirty,
	markClean,
	setSaving,
	pushHistory,
	undoAction,
	redoAction,
	setLayers,
	setZoom,
} from '../actions';

// Convenience: run an action against the default (undefined) state.
const fromDefault = ( action ) => reducer( undefined, action );

describe( 'editor reducer', () => {
	it( 'returns a sane default state', () => {
		const state = fromDefault( { type: '@@INIT' } );
		expect( state.designId ).toBe( 0 );
		expect( state.isDirty ).toBe( false );
		expect( state.undoIndex ).toBe( -1 );
		expect( state.selection.type ).toBe( 'none' );
	} );

	it( 'toggles the active panel when the same panel is set twice', () => {
		const opened = fromDefault( setActivePanel( 'text' ) );
		expect( opened.activePanel ).toBe( 'text' );

		const closed = reducer( opened, setActivePanel( 'text' ) );
		expect( closed.activePanel ).toBeNull();

		const switched = reducer( opened, setActivePanel( 'media' ) );
		expect( switched.activePanel ).toBe( 'media' );
	} );

	it( 'sets the design and clears the dirty flag', () => {
		const dirty = reducer(
			{ ...fromDefault( { type: '@@INIT' } ), isDirty: true },
			setDesign( {
				designId: 42,
				title: 'My Design',
				format: 'facebook-post',
			} )
		);
		expect( dirty.designId ).toBe( 42 );
		expect( dirty.designTitle ).toBe( 'My Design' );
		expect( dirty.format ).toBe( 'facebook-post' );
		expect( dirty.isDirty ).toBe( false );
	} );

	it( 'marks dirty when the title changes', () => {
		const state = fromDefault( setTitle( 'Renamed' ) );
		expect( state.designTitle ).toBe( 'Renamed' );
		expect( state.isDirty ).toBe( true );
	} );

	it( 'sets and clears the selection', () => {
		const selected = fromDefault(
			setSelection( {
				type: 'text',
				objectId: 'a1',
				properties: { fontSize: 24 },
			} )
		);
		expect( selected.selection.type ).toBe( 'text' );
		expect( selected.selection.objectId ).toBe( 'a1' );

		const cleared = reducer( selected, clearSelection() );
		expect( cleared.selection.type ).toBe( 'none' );
		expect( cleared.selection.objectId ).toBeNull();
		expect( cleared.selection.properties ).toEqual( {} );
	} );

	it( 'merges selection properties without dropping existing ones', () => {
		const base = fromDefault(
			setSelection( {
				type: 'text',
				objectId: 'a1',
				properties: { fontSize: 24, fill: '#000' },
			} )
		);
		const merged = reducer(
			base,
			updateSelectionProperties( { fill: '#fff', bold: true } )
		);
		expect( merged.selection.properties ).toEqual( {
			fontSize: 24,
			fill: '#fff',
			bold: true,
		} );
	} );

	it( 'tracks dirty/clean and saving flags', () => {
		const dirty = fromDefault( markDirty() );
		expect( dirty.isDirty ).toBe( true );

		const clean = reducer( dirty, markClean() );
		expect( clean.isDirty ).toBe( false );
		expect( typeof clean.lastSaved ).toBe( 'string' );

		const saving = reducer( clean, setSaving( true ) );
		expect( saving.isSaving ).toBe( true );
	} );

	it( 'sets layers and zoom', () => {
		const layers = fromDefault( setLayers( [ { id: 'x' }, { id: 'y' } ] ) );
		expect( layers.layers ).toHaveLength( 2 );

		const zoom = reducer( layers, setZoom( 75 ) );
		expect( zoom.zoom ).toBe( 75 );
	} );

	describe( 'history', () => {
		const entry = ( label ) => ( {
			label,
			undo: jest.fn(),
			redo: jest.fn(),
		} );

		it( 'pushes entries and advances the index', () => {
			let state = fromDefault( pushHistory( entry( 'one' ) ) );
			state = reducer( state, pushHistory( entry( 'two' ) ) );
			expect( state.undoStack ).toHaveLength( 2 );
			expect( state.undoIndex ).toBe( 1 );
		} );

		it( 'truncates forward history when pushing after an undo', () => {
			let state = fromDefault( pushHistory( entry( 'one' ) ) );
			state = reducer( state, pushHistory( entry( 'two' ) ) );
			state = reducer( state, undoAction() ); // index -> 0
			state = reducer( state, pushHistory( entry( 'three' ) ) );
			expect( state.undoStack ).toHaveLength( 2 );
			expect( state.undoStack[ 1 ].label ).toBe( 'three' );
			expect( state.undoIndex ).toBe( 1 );
		} );

		it( 'caps the stack at the maximum history length', () => {
			let state = fromDefault( { type: '@@INIT' } );
			for ( let i = 0; i < 60; i++ ) {
				state = reducer( state, pushHistory( entry( `e${ i }` ) ) );
			}
			expect( state.undoStack ).toHaveLength( 50 );
			expect( state.undoStack[ 0 ].label ).toBe( 'e10' );
			expect( state.undoIndex ).toBe( 49 );
		} );

		it( 'invokes undo()/redo() callbacks and moves the index', () => {
			const e1 = entry( 'one' );
			let state = fromDefault( pushHistory( e1 ) );

			state = reducer( state, undoAction() );
			expect( e1.undo ).toHaveBeenCalledTimes( 1 );
			expect( state.undoIndex ).toBe( -1 );

			state = reducer( state, redoAction() );
			expect( e1.redo ).toHaveBeenCalledTimes( 1 );
			expect( state.undoIndex ).toBe( 0 );
		} );

		it( 'is a no-op when undoing past the start or redoing past the end', () => {
			const empty = fromDefault( { type: '@@INIT' } );
			expect( reducer( empty, undoAction() ) ).toBe( empty );
			expect( reducer( empty, redoAction() ) ).toBe( empty );
		} );
	} );
} );
