#!/bin/zsh
# WP-CLI against the `social-frame` Local site. Local's MySQL listens on a socket,
# not TCP, so point mysqli at it. Recreate the symlink if Local changes the
# site id: ln -sfn "~/Library/Application Support/Local/run/<id>/mysql/mysqld.sock" ~/.local-sockets/social-frame.sock
php -d mysqli.default_socket="$HOME/.local-sockets/social-frame.sock" -d error_reporting="E_ALL & ~E_DEPRECATED" "$(command -v wp)" --path="$HOME/Local Sites/social-frame/app/public" "$@"
