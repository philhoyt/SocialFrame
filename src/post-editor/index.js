import { registerPlugin } from '@wordpress/plugins';

import { FramesPanel } from './FramesPanel';
import './post-editor.css';

registerPlugin( 'socialframe-frames', { render: FramesPanel } );
