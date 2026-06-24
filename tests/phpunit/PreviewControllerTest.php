<?php
/**
 * Tests for the Preview REST controller (PRV-01 PNG guard + cleanup hook).
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers preview generation, the PNG-type guard, and delete cleanup.
 */
class PreviewControllerTest extends RestTestCase {

	/**
	 * Use an editor for all preview requests.
	 */
	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
	}

	/**
	 * Resolve the absolute path of a design's preview file.
	 *
	 * @param int $id Design ID.
	 * @return string
	 */
	private function preview_path( int $id ): string {
		$rel = get_post_meta( $id, 'socialframe_preview_path', true );
		return wp_upload_dir()['basedir'] . '/' . $rel;
	}

	/**
	 * A valid PNG is resized, written, and recorded in meta.
	 */
	public function test_preview_valid_png_written(): void {
		$id  = $this->make_design();
		$res = $this->request(
			'POST',
			'/designs/' . $id . '/preview',
			[ 'imageData' => $this->png_data_uri( 800, 600 ) ]
		);

		$this->assertSame( 201, $res->get_status() );
		$rel = get_post_meta( $id, 'socialframe_preview_path', true );
		$this->assertSame( 'socialframe/previews/sf-' . $id . '-preview.png', $rel );
		$this->assertFileExists( $this->preview_path( $id ) );
	}

	/**
	 * A small but valid JPEG is rejected — the PRV-01 guard, since resize_png
	 * would otherwise return sub-width input verbatim.
	 */
	public function test_preview_rejects_small_jpeg(): void {
		$id  = $this->make_design();
		$res = $this->request(
			'POST',
			'/designs/' . $id . '/preview',
			[ 'imageData' => $this->jpeg_base64( 100, 100 ) ]
		);

		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( 'invalid_image', $res->get_data()['code'] );
		$this->assertSame( '', get_post_meta( $id, 'socialframe_preview_path', true ) );
	}

	/**
	 * Non-image bytes are rejected.
	 */
	public function test_preview_rejects_non_image(): void {
		$id  = $this->make_design();
		$res = $this->request(
			'POST',
			'/designs/' . $id . '/preview',
			[ 'imageData' => base64_encode( 'nope' ) ]
		);

		$this->assertSame( 400, $res->get_status() );
	}

	/**
	 * Previewing a non-graphic post returns 404.
	 */
	public function test_preview_404_for_non_graphic(): void {
		$post_id = self::factory()->post->create();
		$res     = $this->request(
			'POST',
			'/designs/' . $post_id . '/preview',
			[ 'imageData' => $this->png_data_uri() ]
		);

		$this->assertSame( 404, $res->get_status() );
	}

	/**
	 * Deleting a design removes its preview file via before_delete_post.
	 */
	public function test_preview_file_cleaned_up_on_delete(): void {
		$id = $this->make_design();
		$this->request(
			'POST',
			'/designs/' . $id . '/preview',
			[ 'imageData' => $this->png_data_uri( 800, 600 ) ]
		);
		$path = $this->preview_path( $id );
		$this->assertFileExists( $path );

		wp_delete_post( $id, true );
		$this->assertFileDoesNotExist( $path );
	}
}
