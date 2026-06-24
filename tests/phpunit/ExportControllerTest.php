<?php
/**
 * Tests for the Export REST controller (SEC-02 image validation).
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers the PNG-validation guard and the attachment-creation path.
 */
class ExportControllerTest extends RestTestCase {

	/**
	 * Use an editor for all export requests.
	 */
	public function set_up(): void {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
	}

	/**
	 * A valid PNG is written and linked to the design as an attachment.
	 */
	public function test_export_valid_png_creates_attachment(): void {
		$id  = $this->make_design();
		$res = $this->request(
			'POST',
			'/designs/' . $id . '/export',
			[ 'imageData' => $this->png_data_uri( 200, 200 ) ]
		);

		$this->assertSame( 201, $res->get_status() );
		$attachment_id = $res->get_data()['attachmentId'];
		$this->assertSame( 'image/png', get_post_mime_type( $attachment_id ) );
		$this->assertSame( $attachment_id, (int) get_post_meta( $id, 'socialframe_image_id', true ) );
	}

	/**
	 * A thumbnail request resizes large input and still succeeds.
	 */
	public function test_export_thumbnail_path(): void {
		$id  = $this->make_design();
		$res = $this->request(
			'POST',
			'/designs/' . $id . '/export',
			[
				'imageData' => $this->png_data_uri( 1000, 1000 ),
				'thumbnail' => true,
			]
		);

		$this->assertSame( 201, $res->get_status() );
	}

	/**
	 * Valid base64 that is not an image is rejected (SEC-02).
	 */
	public function test_export_rejects_non_image_bytes(): void {
		$id  = $this->make_design();
		$res = $this->request(
			'POST',
			'/designs/' . $id . '/export',
			[ 'imageData' => base64_encode( 'definitely not an image' ) ]
		);

		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( 'invalid_image', $res->get_data()['code'] );
	}

	/**
	 * A valid JPEG submitted as image data is rejected — only PNG is accepted.
	 */
	public function test_export_rejects_valid_jpeg(): void {
		$id  = $this->make_design();
		$res = $this->request(
			'POST',
			'/designs/' . $id . '/export',
			[ 'imageData' => $this->jpeg_base64() ]
		);

		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( 'invalid_image', $res->get_data()['code'] );
	}

	/**
	 * Exporting against a non-graphic post returns 404.
	 */
	public function test_export_404_for_non_graphic(): void {
		$post_id = self::factory()->post->create();
		$res     = $this->request(
			'POST',
			'/designs/' . $post_id . '/export',
			[ 'imageData' => $this->png_data_uri() ]
		);

		$this->assertSame( 404, $res->get_status() );
	}
}
