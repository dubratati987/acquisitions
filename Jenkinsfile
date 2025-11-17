pipeline {
  // top-level agent must be docker-capable (has docker CLI/buildx/compose)
  agent {
    docker {
      image 'docker:24.0.7-cli'                    // official docker CLI image
      args  '-u root:root -v /var/run/docker.sock:/var/run/docker.sock'
    }
  }

  environment {
    DOCKER_IMAGE_NAME  = 'dubratati987/docker-acquisitions'
    DOCKER_LATEST_TAG  = 'jenkins'
    GENERATED_ENV_FILE = "${env.WORKSPACE}/.env.production"
    PUSH_IMAGE         = 'true'
    DOCKER_CREDENTIALS_ID = 'docker-hub-creds'
  }

  // options {
  //   // keep build logs for troubleshooting
  //   // timestamps()
  //   // ansiColor('xterm')
  // }

  stages {

    stage('Pre-flight Checks') {
      parallel {
        stage('System Info') {
          steps {
            sh """
              echo "---- System info (agent) ----"
              docker --version || true
              docker compose version || docker-compose version || true
              docker buildx version || true
              echo "WORKSPACE=${env.WORKSPACE}"
            """
          }
        }

        stage('Workspace sanity') {
          steps {
            sh """
              echo "---- Workspace listing ----"
              ls -la "${env.WORKSPACE}" || true
            """
          }
        }
      }
    }

    stage('Matrix Quick Test') {
      matrix {
        axes {
          axis {
            name 'NODE_VERSION'
            values '18', '20'
          }
        }
        stages {
          stage('Quick Node Test') {
            steps {
              sh """
                echo "Running quick Node ${NODE_VERSION} check by launching ephemeral node container..."
                docker run --rm node:${NODE_VERSION} node -v
              """
            }
          }
        }
      }
    }

    stage('Checkout Code') {
      steps {
        // Use default SCM checkout (declarative) or explicit git:
        git branch: 'main', url: 'https://github.com/dubratati987/acquisitions.git'
      }
    }

    stage('Prepare .env') {
      steps {
        withCredentials([file(credentialsId: 'accquisition-env-file', variable: 'ENV_FILE')]) {
          sh """
            cp "$ENV_FILE" "$GENERATED_ENV_FILE"
            echo ".env.production created (len=\$(wc -c < "\${GENERATED_ENV_FILE}"))"

            echo "---- .env (first 10 lines) ----"
            head -n 10 "$GENERATED_ENV_FILE" || true
            echo "--------------------------------"
          """
        }
      }
    }


    stage('Debug Workspace') {
      steps {
        sh """
          echo "---- FULL workspace tree ----"
          ls -R "${env.WORKSPACE}"
          echo "-----------------------------"
        """
      }
    }

    // stage('Code Quality & Tests') {
    //   parallel {

    //     stage('Lint') {
    //       steps {
    //         // run npm inside ephemeral Node container (avoids overlayfs issues)
    //         sh """
    //           echo "Running lint in ephemeral node container..."
    //           docker run --rm -u 0:0 \
    //             -v "${env.WORKSPACE}":/app -w /app \
    //             node:18-alpine sh -c '
    //               set -e
    //               npm ci --no-audit --no-fund
    //               npm run lint
    //             '
    //         """
    //       }
    //     }

    //     stage('Unit Tests') {
    //       steps {
    //         sh """
    //           echo "Running unit tests in ephemeral node container..."
    //           docker run --rm -u 0:0 \
    //             -v "${env.WORKSPACE}":/app -w /app \
    //             node:18-alpine sh -c '
    //               set -e
    //               npm ci --no-audit --no-fund
    //               npm test
    //             '
    //         """
    //       }
    //     }

    //     stage('Prisma Validate') {
    //       steps {
    //         sh """
    //           echo "Validating Prisma schema in ephemeral node container..."
    //           docker run --rm -u 0:0 \
    //             -v "${env.WORKSPACE}":/app -w /app \
    //             node:18-alpine sh -c '
    //               set -e
    //               apk add --no-cache python3 make g++ >/dev/null 2>&1 || true
    //               npm ci --omit=dev --no-audit --no-fund
    //               npx prisma validate --schema=prisma/schema.prisma
    //             '
    //         """
    //       }
    //     }

    //   }
    // }

    stage('Build Docker Image (compose build)') {
      steps {
        sh """
          echo "Building with docker compose (prod)..."
          # use mounted workspace on host; compose file is in workspace
          docker compose -f "${env.WORKSPACE}/docker-compose.prod.yml" build --no-cache
        """
      }
    }

    stage('Start Application Services') {
      steps {
        sh """
          echo "Starting services (compose up -d)..."
          docker compose -f "${env.WORKSPACE}/docker-compose.prod.yml" up -d
          echo "Waiting for services to start..."
          sleep 25
          docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"
        """
      }
    }

    stage('Health Check') {
      steps {
        echo '🩺 Running health checks...'
        script {
          sh """
            echo 'Installing curl...'
            apk update && apk add --no-cache curl
          """
          // Test backend API
          echo "Testing backend API..."
          sh """
            curl -f http://host.docker.internal:3000/health || {
            echo '❌ Backend health check failed'
            exit 1
            }
            echo '✅ Backend is healthy'
          """
        }
      }
    }

    stage('Integration Tests') {
      steps {
        sh """
          RANDOM_EMAIL="jenkins_${env.BUILD_NUMBER}_${new Random()}@example.com"
          echo "Creating random test user: ${RANDOM_EMAIL}"
          curl -sSf -X POST "http://host.docker.internal:3000/api/auth/sign-up" \
            -H "Content-Type: application/json" \
            -d "{\\"name\\":\\"Jenkins CI Test\\",\\"email\\":\\"${RANDOM_EMAIL}\\",\\"password\\":\\"123456\\"}"
        """
      }
    }

    stage('Performance Check') {
      steps {
        sh """
          curl -w "⏱ Time: %{time_total}s\\n" -o /dev/null -s http://host.docker.internal:3000/api/users || true
        """
      }
    }

    stage('Multi-arch Build & Push') {
      when { expression { env.PUSH_IMAGE == 'true' } }
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDENTIALS_ID,
                                          usernameVariable: 'DOCKER_USER',
                                          passwordVariable: 'DOCKER_PASS')]) {
          sh """
            set -e
            echo "Logging into registry..."
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin

            builder_name="jenkins-buildx"
            if ! docker buildx inspect ${builder_name} >/dev/null 2>&1; then
              docker buildx create --name ${builder_name} --use
            else
              docker buildx use ${builder_name}
            fi

            docker buildx build --platform linux/amd64,linux/arm64 \
              -t ${env.DOCKER_IMAGE_NAME}:${env.DOCKER_LATEST_TAG} --push "${env.WORKSPACE}"
          """
        }
      }
    }

  } // stages

  post {
    always {
      sh """
        echo "Cleaning up (compose down)..."
        docker compose -f "${env.WORKSPACE}/docker-compose.prod.yml" down || true
        docker image prune -f || true
      """
    }
    success {
      echo "✅ Pipeline finished successfully"
    }
    failure {
      sh """
        echo "❌ Pipeline failed — collecting logs"
        docker compose -f "${env.WORKSPACE}/docker-compose.prod.yml" logs || true
      """
    }
  }
}
