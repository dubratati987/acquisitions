pipeline {

  agent {
    docker {
      // Docker CLI image already includes: docker, buildx, compose v2
      image 'docker:24.0.7-cli'
      args '-u root:root -v /var/run/docker.sock:/var/run/docker.sock'
    }
  }

  environment {
    DOCKER_IMAGE_NAME  = 'dubratati987/docker-acquisitions'
    DOCKER_LATEST_TAG  = 'jenkins'
    WORKSPACE_PATH     = "${env.WORKSPACE}"
    GENERATED_ENV_FILE = "${env.WORKSPACE}/.env.production"

    PUSH_IMAGE = 'true'
    DOCKER_CREDENTIALS_ID = 'docker-hub-creds'
  }

  stages {

    /* ---------------------------------------------------------
     * Install Node (inside docker:cli container)
     * --------------------------------------------------------- */
    stage('Install Node') {
      steps {
        sh '''
          echo "Installing Node.js & npm inside the agent container..."
          apk add --no-cache nodejs npm python3 make g++
          node -v
          npm -v
        '''
      }
    }

    /* ---------------------------------------------------------
     * Pre-flight (System Info + compose availability)
     * --------------------------------------------------------- */
    stage('Pre-flight Checks') {
      parallel {

        stage('System Info') {
          steps {
            sh '''
              echo "Docker version:"
              docker --version

              echo "Docker Compose version:"
              docker compose version

              echo "Node version:"
              node -v
            '''
          }
        }

        stage('Check Buildx') {
          steps {
            sh '''
              echo "Checking buildx..."
              docker buildx version || true
            '''
          }
        }

      }
    }

    /* ---------------------------------------------------------
     * Test using Matrix
     * --------------------------------------------------------- */
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
              sh '''
                echo "Testing Node ${NODE_VERSION} using docker run..."
                docker run --rm node:${NODE_VERSION} node -v
              '''
            }
          }
        }
      }
    }

    /* ---------------------------------------------------------
     * Checkout source code
     * --------------------------------------------------------- */
    stage('Checkout Code') {
      steps {
        git branch: 'main', url: 'https://github.com/dubratati987/acquisitions.git'
      }
    }

    /* ---------------------------------------------------------
     * Prepare .env.production file
     * --------------------------------------------------------- */
    stage('Prepare .env') {
      steps {
        withCredentials([file(credentialsId: 'accquisition-env-file', variable: 'ENV_FILE')]) {
          sh '''
            cp "$ENV_FILE" "$GENERATED_ENV_FILE"
            echo ".env.production created"
          '''
        }
      }
    }

    /* ---------------------------------------------------------
     * Code Quality in Parallel
     * --------------------------------------------------------- */
    stage('Code Quality & Tests') {
      parallel {

        stage('Lint') {
          steps {
            sh '''
              npm ci
              npm run lint
            '''
          }
        }

        stage('Unit Tests') {
          steps {
            sh '''
              npm ci
              npm test
            '''
          }
        }

        stage('Prisma Validate') {
          steps {
            sh '''
              npm ci --omit=dev
              npx prisma validate --schema=prisma/schema.prisma
            '''
          }
        }

      }
    }

    /* ---------------------------------------------------------
     * Build your Docker image locally (host build)
     * --------------------------------------------------------- */
    stage('Build Docker Image (local)') {
      steps {
        sh '''
          echo "Building Docker image using compose..."
          docker compose -f docker-compose.prod.yml build --no-cache
        '''
      }
    }

    /* ---------------------------------------------------------
     * Start services & verify health
     * --------------------------------------------------------- */
    stage('Start Application Services') {
      steps {
        sh '''
          docker compose -f docker-compose.prod.yml up -d
          echo "Waiting 30 seconds to allow services to start..."
          sleep 30
          docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
        '''
      }
    }

    /* ---------------------------------------------------------
     * Health check
     * --------------------------------------------------------- */
    stage('Health Check') {
      steps {
        sh '''
          echo "Running health check..."
          curl -f http://host.docker.internal:3000/health
          echo "Health OK"
        '''
      }
    }

    /* ---------------------------------------------------------
     * Integration Tests
     * --------------------------------------------------------- */
    stage('Integration Tests') {
      steps {
        sh '''
          RANDOM_EMAIL="jenkins_${BUILD_NUMBER}_$RANDOM@example.com"

          echo "Creating random test user: $RANDOM_EMAIL"

          curl -X POST "http://host.docker.internal:3000/api/auth/sign-up" \
            -H "Content-Type: application/json" \
            -d "{\\"name\\":\\"Jenkins CI Test\\",\\"email\\":\\"$RANDOM_EMAIL\\",\\"password\\":\\"123456\\"}" \
            -f
        '''
      }
    }

    /* ---------------------------------------------------------
     * Basic performance check
     * --------------------------------------------------------- */
    stage('Performance Check') {
      steps {
        sh '''
          curl -w "⏱ Time: %{time_total}s\\n" -o /dev/null -s http://host.docker.internal:3000/api/users
        '''
      }
    }

    /* ---------------------------------------------------------
     * Multi-arch Build + Push via Buildx
     * --------------------------------------------------------- */
    stage('Multi-arch Build & Push') {
      when { expression { return env.PUSH_IMAGE == 'true' } }
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDENTIALS_ID,
                                          usernameVariable: 'DOCKER_USER',
                                          passwordVariable: 'DOCKER_PASS')]) {

          sh '''
            set -e

            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin

            builder_name="jenkins-buildx"

            if ! docker buildx inspect ${builder_name} >/dev/null 2>&1; then
              docker buildx create --name ${builder_name} --use
            else
              docker buildx use ${builder_name}
            fi

            echo "Building multi-arch image (amd64 + arm64)..."
            docker buildx build \
              --platform linux/amd64,linux/arm64 \
              -t ${DOCKER_IMAGE_NAME}:${DOCKER_LATEST_TAG} \
              --push .

            docker buildx imagetools inspect ${DOCKER_IMAGE_NAME}:${DOCKER_LATEST_TAG} || true
          '''
        }
      }
    }

  } // stages

  /* ---------------------------------------------------------
   * Cleanup
   * --------------------------------------------------------- */
  post {
    always {
      sh '''
        echo "Stopping services..."
        docker compose -f docker-compose.prod.yml down || true
        docker image prune -f || true
      '''
    }
    success {
      echo "✅ Pipeline succeeded"
    }
    failure {
      sh '''
        echo "❌ Pipeline failed — showing logs"
        docker compose -f docker-compose.prod.yml logs || true
      '''
    }
  }
}
