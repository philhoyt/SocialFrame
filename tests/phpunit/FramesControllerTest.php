<?php
/**
 * Tests for the post-type frames REST controller.
 *
 * @package SocialFrame
 */

declare( strict_types=1 );

/**
 * Covers GET /posts/:id/frames and the dry-run and commit phases of
 * POST /designs/:id/generate.
 */
class FramesControllerTest extends RestTestCase {

	/**
	 * Author who owns the source post.
	 *
	 * @var int
	 */
	private int $author;

	/**
	 * Draft post owned by the author.
	 *
	 * @var int
	 */
	private int $draft;

	/**
	 * Design assigned to posts.
	 *
	 * @var int
	 */
	private int $design;

	/**
	 * Create an author, a draft, and a design assigned to posts.
	 */
	public function set_up(): void {
		parent::set_up();

		$this->author = self::factory()->user->create( [ 'role' => 'author' ] );
		$this->draft  = self::factory()->post->create(
			[
				'post_author' => $this->author,
				'post_status' => 'draft',
				'post_title'  => 'Draft Title',
			]
		);
		$this->design = $this->make_design(
			[
				'title'       => 'Square',
				'fabric_json' => $this->template_json(),
			]
		);
		add_post_meta( $this->design, 'socialframe_post_types', 'post' );

		wp_set_current_user( $this->author );
	}

	/**
	 * Release any lock a test left behind.
	 */
	public function tear_down(): void {
		delete_option( 'socialframe_gen_lock_' . $this->draft . '_' . $this->design );
		parent::tear_down();
	}

	/**
	 * Canvas JSON with a title text field.
	 */
	private function template_json(): string {
		return (string) wp_json_encode(
			[
				'version' => '6.9.1',
				'objects' => [
					[
						'type'      => 'Textbox',
						'text'      => 'Placeholder',
						'fieldName' => 'post.title',
					],
				],
			]
		);
	}

	/**
	 * Generated designs linked to the draft.
	 *
	 * @return int[]
	 */
	private function outputs(): array {
		return get_posts(
			[
				'post_type'   => 'socialframe_graphic',
				'post_status' => 'any',
				'numberposts' => -1,
				'fields'      => 'ids',
				'meta_key'    => 'socialframe_source_post', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'meta_value'  => $this->draft, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			]
		);
	}

	/**
	 * Commit a generate for the draft.
	 *
	 * @param array<string, mixed> $params Extra params.
	 */
	private function commit( array $params = [] ): WP_REST_Response {
		return $this->request(
			'POST',
			'/designs/' . $this->design . '/generate',
			array_merge(
				[
					'post_id'   => $this->draft,
					'imageData' => $this->png_data_uri( 40, 40 ),
				],
				$params
			)
		);
	}

	/**
	 * Logged-out users and users without upload_files are refused.
	 */
	public function test_permissions(): void {
		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->commit()->get_status() );
		$this->assertSame( 401, $this->request( 'GET', '/posts/' . $this->draft . '/frames' )->get_status() );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'contributor' ] ) );
		$this->assertSame( 403, $this->commit()->get_status() );
	}

	/**
	 * A user who cannot edit the source post gets a 404 and nothing is created.
	 */
	public function test_cannot_generate_from_post_user_cannot_edit(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'author' ] ) );

		$this->assertSame( 404, $this->commit()->get_status() );
		$this->assertSame( 404, $this->request( 'GET', '/posts/' . $this->draft . '/frames' )->get_status() );
		$this->assertSame( [], $this->outputs() );
	}

	/**
	 * A design not assigned to the post's type is rejected.
	 */
	public function test_unassigned_type_is_rejected(): void {
		delete_post_meta( $this->design, 'socialframe_post_types' );
		add_post_meta( $this->design, 'socialframe_post_types', 'page' );

		$this->assertSame( 400, $this->commit()->get_status() );
		$this->assertSame( [], $this->outputs() );
	}

	/**
	 * A missing design is a 404.
	 */
	public function test_missing_design(): void {
		$res = $this->request(
			'POST',
			'/designs/999999/generate',
			[ 'post_id' => $this->draft ]
		);

		$this->assertSame( 404, $res->get_status() );
	}

	/**
	 * A dry run returns the filled canvas and writes nothing.
	 */
	public function test_dry_run_writes_nothing(): void {
		$res = $this->request(
			'POST',
			'/designs/' . $this->design . '/generate',
			[
				'post_id' => $this->draft,
				'values'  => [ 'post.title' => 'Unsaved Title' ],
			]
		);

		$this->assertSame( 200, $res->get_status() );
		$data   = $res->get_data();
		$canvas = json_decode( $data['fabricJson'], true );
		$this->assertSame( 'Unsaved Title', $canvas['objects'][0]['text'] );
		$this->assertSame( [ 1080, 1080 ], [ $data['width'], $data['height'] ] );
		$this->assertFalse( $data['hasOutput'] );
		$this->assertSame( [], $this->outputs() );
	}

	/**
	 * The first commit creates a linked output; the second updates it in place.
	 */
	public function test_commit_creates_then_replaces(): void {
		$before = get_post_meta( $this->design, 'socialframe_fabric_json', true );

		$first = $this->commit();
		$this->assertSame( 201, $first->get_status() );
		$data = $first->get_data();
		$this->assertTrue( $data['created'] );

		$output   = $data['design']['id'];
		$image_id = $data['imageId'];
		$old_file = get_attached_file( $image_id );
		$this->assertSame( $this->draft, (int) get_post_meta( $output, 'socialframe_source_post', true ) );
		$this->assertSame( $this->design, (int) get_post_meta( $output, 'socialframe_source_design', true ) );
		$this->assertSame( 'Draft Title', json_decode( get_post_meta( $output, 'socialframe_fabric_json', true ), true )['objects'][0]['text'] );
		$this->assertFileExists( $old_file );

		// Filenames carry a timestamp; make sure the second one differs.
		sleep( 1 );
		$second = $this->commit( [ 'values' => [ 'post.title' => 'New Title' ] ] );
		$this->assertSame( 200, $second->get_status() );
		$data = $second->get_data();
		$this->assertFalse( $data['created'] );
		$this->assertSame( $output, $data['design']['id'] );
		$this->assertSame( $image_id, $data['imageId'] );
		$this->assertSame( 'New Title', json_decode( get_post_meta( $output, 'socialframe_fabric_json', true ), true )['objects'][0]['text'] );
		$this->assertFileDoesNotExist( $old_file );
		$this->assertFileExists( get_attached_file( $image_id ) );

		$this->assertSame( [ $output ], $this->outputs() );
		$this->assertSame( $before, get_post_meta( $this->design, 'socialframe_fabric_json', true ), 'Source design is unchanged.' );
	}

	/**
	 * An invalid image on regenerate leaves the existing output untouched.
	 */
	public function test_invalid_image_keeps_existing_output(): void {
		$data   = $this->commit()->get_data();
		$output = $data['design']['id'];
		$json   = get_post_meta( $output, 'socialframe_fabric_json', true );
		$file   = get_attached_file( $data['imageId'] );

		$res = $this->commit(
			[
				'values'    => [ 'post.title' => 'Changed' ],
				'imageData' => 'data:image/png;base64,' . $this->jpeg_base64(),
			]
		);

		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( $json, get_post_meta( $output, 'socialframe_fabric_json', true ) );
		$this->assertSame( $file, get_attached_file( $data['imageId'] ) );
	}

	/**
	 * An invalid image on first generate leaves no output behind.
	 */
	public function test_invalid_image_on_first_generate_creates_nothing(): void {
		$res = $this->commit( [ 'imageData' => 'not-base64!' ] );

		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( [], $this->outputs() );
	}

	/**
	 * A held lock refuses a second commit.
	 */
	public function test_held_lock_returns_409(): void {
		add_option( 'socialframe_gen_lock_' . $this->draft . '_' . $this->design, time(), '', false );

		$this->assertSame( 409, $this->commit()->get_status() );
		$this->assertSame( [], $this->outputs() );
	}

	/**
	 * An image attachment belonging to another design is never replaced.
	 */
	public function test_foreign_attachment_is_not_replaced(): void {
		$output  = $this->commit()->get_data()['design']['id'];
		$foreign = $this->make_image_attachment( 20, 20, $this->make_design() );
		$file    = get_attached_file( $foreign );
		update_post_meta( $output, 'socialframe_image_id', $foreign );

		$data = $this->commit()->get_data();

		$this->assertNotSame( $foreign, $data['imageId'] );
		$this->assertSame( $file, get_attached_file( $foreign ) );
		$this->assertFileExists( $file );
	}

	/**
	 * Frames lists designs assigned to the post's type, with their outputs.
	 */
	public function test_frames_lists_assigned_designs_with_outputs(): void {
		$for_pages = $this->make_design( [ 'fabric_json' => $this->template_json() ] );
		add_post_meta( $for_pages, 'socialframe_post_types', 'page' );

		$res = $this->request( 'GET', '/posts/' . $this->draft . '/frames' );
		$this->assertSame( 200, $res->get_status() );
		$frames = $res->get_data()['frames'];
		$this->assertSame( [ $this->design ], wp_list_pluck( wp_list_pluck( $frames, 'design' ), 'id' ) );
		$this->assertSame( [ 'post.title' ], $frames[0]['fieldNames'] );
		$this->assertNull( $frames[0]['output'] );
		$this->assertFalse( $res->get_data()['truncated'] );

		$generated = $this->commit()->get_data();

		$frames = $this->request( 'GET', '/posts/' . $this->draft . '/frames' )->get_data()['frames'];
		$this->assertSame( $generated['design']['id'], $frames[0]['output']['design']['id'] );
		$this->assertSame( $generated['imageId'], $frames[0]['output']['imageId'] );
		$this->assertNotEmpty( $frames[0]['output']['imageUrl'] );
	}

	/**
	 * A role that edits only a custom type, without core edit_posts, can
	 * list frames, dry-run, generate and regenerate in place for its own
	 * post, but cannot open the design editor or library.
	 */
	public function test_problem_author_generates_from_own_post(): void {
		$problem_author = $this->make_problem_author();
		$problem        = self::factory()->post->create(
			[
				'post_type'   => 'problem',
				'post_author' => $problem_author,
				'post_title'  => 'Crimp Line',
			]
		);
		add_post_meta( $this->design, 'socialframe_post_types', 'problem' );
		wp_set_current_user( $problem_author );

		$frames = $this->request( 'GET', '/posts/' . $problem . '/frames' );
		$this->assertSame( 200, $frames->get_status() );
		$this->assertSame( $this->design, $frames->get_data()['frames'][0]['design']['id'] );
		$this->assertFalse( $frames->get_data()['frames'][0]['design']['canEdit'] );

		$route = '/designs/' . $this->design . '/generate';
		$this->assertSame( 200, $this->request( 'POST', $route, [ 'post_id' => $problem ] )->get_status() );

		$params = [
			'post_id'   => $problem,
			'imageData' => $this->png_data_uri( 40, 40 ),
		];
		$first  = $this->request( 'POST', $route, $params );
		$this->assertSame( 201, $first->get_status() );

		$second = $this->request( 'POST', $route, $params );
		$this->assertSame( 200, $second->get_status() );
		$this->assertSame( $first->get_data()['imageId'], $second->get_data()['imageId'], 'Regenerating replaces the same attachment.' );

		$this->assertSame( 403, $this->request( 'GET', '/designs' )->get_status() );
	}

	/**
	 * The same role gets a 404 for a post of its type it cannot edit.
	 */
	public function test_problem_author_cannot_generate_from_others_post(): void {
		$problem_author = $this->make_problem_author();
		$problem        = self::factory()->post->create(
			[
				'post_type'   => 'problem',
				'post_author' => $this->author,
			]
		);
		add_post_meta( $this->design, 'socialframe_post_types', 'problem' );
		wp_set_current_user( $problem_author );

		$this->assertSame( 404, $this->request( 'GET', '/posts/' . $problem . '/frames' )->get_status() );
		$this->assertSame(
			404,
			$this->request(
				'POST',
				'/designs/' . $this->design . '/generate',
				[
					'post_id'   => $problem,
					'imageData' => $this->png_data_uri( 40, 40 ),
				]
			)->get_status()
		);
	}

	/**
	 * Regenerating replaces the image even when another user created it,
	 * where the attachment's own edit_post would need edit_others_posts.
	 */
	public function test_regenerate_replaces_image_made_by_another_user(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$image_id = $this->commit()->get_data()['imageId'];

		wp_set_current_user( $this->author );
		$this->assertFalse( current_user_can( 'edit_post', $image_id ) );

		$res = $this->commit();
		$this->assertSame( 200, $res->get_status() );
		$this->assertSame( $image_id, $res->get_data()['imageId'] );
	}

	/**
	 * A missing source post is a 404 before the design is looked at, so a
	 * caller cannot tell missing designs from empty ones.
	 */
	public function test_missing_source_post_is_checked_first(): void {
		foreach ( [ $this->design, 999999 ] as $design ) {
			$res = $this->request( 'POST', '/designs/' . $design . '/generate', [ 'post_id' => 999999 ] );
			$this->assertSame( 404, $res->get_status() );
			$this->assertSame( 'post_not_found', $res->get_data()['code'] );
		}
	}

	/**
	 * Subscribers are refused; Authors see that they can open the editor.
	 */
	public function test_subscriber_refused_and_author_can_edit(): void {
		$this->assertTrue( $this->request( 'GET', '/posts/' . $this->draft . '/frames' )->get_data()['frames'][0]['design']['canEdit'] );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );
		$this->assertSame( 403, $this->request( 'GET', '/posts/' . $this->draft . '/frames' )->get_status() );
	}

	/**
	 * The socialframe_can_generate filter refuses even administrators.
	 */
	public function test_filter_refuses_administrator(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		add_filter( 'socialframe_can_generate', '__return_false' );

		$this->assertSame( 403, $this->request( 'GET', '/posts/' . $this->draft . '/frames' )->get_status() );
		$this->assertSame( 403, $this->commit()->get_status() );
		$this->assertSame( [], $this->outputs() );
	}

	/**
	 * The frames route checks its own post, not a post_id passed alongside.
	 */
	public function test_frames_ignores_post_id_param(): void {
		$other = self::factory()->post->create( [ 'post_author' => self::factory()->user->create( [ 'role' => 'author' ] ) ] );
		add_filter( 'socialframe_can_generate', fn( $can, $type, $post_id ) => $post_id !== $other, 10, 3 );

		$res = $this->request( 'GET', '/posts/' . $other . '/frames', [ 'post_id' => $this->draft ] );
		$this->assertSame( 404, $res->get_status() );
	}
}
