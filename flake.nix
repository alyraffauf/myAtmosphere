{
  description = "myAtmosphere - Bluesky Posts Viewer";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        # Build the React app as a Nix package
        myAtmosphere = pkgs.buildNpmPackage rec {
          pname = "myAtmosphere";
          version = "0.0.0";

          src = ./.;

          npmDepsHash = "sha256-0bmL7hib7UjdoIpgfQrq5fhVX6EW12yzzIjx5PSrTJg=";

          # Don't run tests during build
          npmBuildScript = "build";

          # Install phase - copy built files to output
          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/myAtmosphere
            cp -r dist/* $out/share/myAtmosphere/
            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Bluesky Posts Viewer - A React + Vite web application";
            homepage = "https://github.com/alyraffauf/myAtmosphere";
            license = licenses.gpl3Only;
            maintainers = [ ];
            platforms = platforms.all;
          };
        };

        # Nginx configuration for serving the website
        nginxConf = pkgs.writeText "nginx.conf" ''
          worker_processes 1;
          error_log /var/log/nginx/error.log warn;
          pid /tmp/nginx.pid;
          daemon off;

          events {
              worker_connections 1024;
          }

          http {
              include ${pkgs.nginx}/conf/mime.types;
              default_type application/octet-stream;
              access_log /dev/stdout;

              server {
                  listen 80;
                  root ${myAtmosphere}/share/myAtmosphere;
                  index index.html;

                  location / {
                      try_files $uri $uri/ /index.html;
                  }
              }
          }
        '';

        # Docker image with nginx serving the website
        dockerImage = pkgs.dockerTools.buildLayeredImage {
          name = "myAtmosphere";
          tag = "latest";

          contents = [
            pkgs.nginx
            myAtmosphere
          ];

          extraCommands = ''
            mkdir -p tmp etc/nginx var/log/nginx
            cp ${nginxConf} etc/nginx/nginx.conf

            # Create basic passwd file with nobody user
            echo "nobody:x:65534:65534:nobody:/:/sbin/nologin" > etc/passwd
            echo "nobody:x:65534:" > etc/group
            echo "nogroup:x:65534:" >> etc/group

            # Set permissions for log directory
            chmod 755 var/log/nginx
          '';

          config = {
            Cmd = [ "${pkgs.nginx}/bin/nginx" "-c" "/etc/nginx/nginx.conf" ];
            ExposedPorts = {
              "80/tcp" = {};
            };
          };
        };

      in
      {
        packages = {
          default = myAtmosphere;
          myAtmosphere = myAtmosphere;
          docker = dockerImage;
        };

        # Development shell and run command
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            npm-check-updates
          ];

          shellHook = ''
            echo "🚀 myAtmosphere development environment"
            echo "Run 'npm install' to install dependencies"
            echo "Run 'npm run dev' to start development server"
            echo "Run 'nix build' to build the package"
            echo "Run 'nix build .#docker' to build Docker image"
          '';
        };

        # nix run starts the development server
        apps.default = {
          type = "app";
          program = toString (pkgs.writeShellScript "myAtmosphere-dev" ''
            set -e
            echo "🚀 Starting myAtmosphere development server..."
            export PATH="${pkgs.nodejs_20}/bin:$PATH"

            # Install dependencies if node_modules doesn't exist
            if [ ! -d "node_modules" ]; then
              echo "📦 Installing dependencies..."
              npm install
            fi

            # Start development server
            exec npm run dev
          '');
        };

        # Additional apps
        apps.build = {
          type = "app";
          program = toString (pkgs.writeShellScript "myAtmosphere-build" ''
            set -e
            echo "🔨 Building myAtmosphere..."
            export PATH="${pkgs.nodejs_20}/bin:$PATH"
            npm install
            exec npm run build
          '');
        };

        apps.serve = {
          type = "app";
          program = toString (pkgs.writeShellScript "myAtmosphere-serve" ''
            set -e
            echo "🌐 Serving built myAtmosphere..."
            echo "Building first..."
            export PATH="${pkgs.nodejs_20}/bin:$PATH"
            npm install
            npm run build
            echo "Starting local server on http://localhost:3000..."
            exec npm run preview
          '');
        };
      }
    );
}
