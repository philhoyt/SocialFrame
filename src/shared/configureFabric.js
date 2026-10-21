/**
 * Fabric settings every SocialFrame canvas relies on.
 *
 * Shared by the editor and the post editor's renderer so both read and write
 * designs the same way.
 *
 * @param {Object} fabric The Fabric module.
 */
export function configureFabric( fabric ) {
	// Custom properties every object carries through toObject() and clone().
	// Registering them here (rather than passing a list to toObject) is what
	// keeps layer ids, names and template fields on duplicated objects too.
	fabric.FabricObject.customProperties = [
		'id',
		'isArtboard',
		'sfShapeType',
		'name',
		'fieldName',
		// Vertical stack: the artboard's stack, a member's row, an image's box.
		'sfStack',
		'sfStackItem',
		'sfBox',
	];

	// Fabric 7 changed the default origin to center. Every position in the
	// editor, the artboard at 0,0 and the server-side image fill assume the
	// top-left corner, so keep Fabric 6's default for new and loaded objects.
	fabric.FabricObject.ownDefaults.originX = 'left';
	fabric.FabricObject.ownDefaults.originY = 'top';
}
