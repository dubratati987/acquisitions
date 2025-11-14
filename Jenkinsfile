pipeline {
  agent any

  environment {
    DOCKER_IMAGE_NAME  = 'dubratati987/docker-acquisitions'
    DOCKER_LATEST_TAG  = 'jenkins'
    WORKSPACE_PATH     = "${env.WORKSPACE}"
    GENERATED_ENV_FILE = "${env.WORKSPACE}/.env.production"

    PUSH_IMAGE = 'true'
    DOCKER_CREDENTIALS_ID = 'docker-hub-creds'
  }

  stages {

    stage('Pre-flight Checks') {
      parallel {

        stage('Check Docker Compose v2') {
          steps {
            sh '''
              if ! docker compose version > /dev/null 2>&1; then
                echo "Installing Docker Compose v2…"
                mkdir -p ~/.docker/cli-plugins
                curl -SL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64 \
                  -o ~/.docker/cli-plugins/docker-compose
                chmod +x ~/.docker/cli-plugins/docker-compose
              else
                echo "Docker Compose v2 present"
              fi
            '''
          }
        }

        stage('System Info') {
          steps {
            sh '''
              echo "Docker version:"
              docker --version || true

              echo "Node info"
              node -v || true
            '''
          }
        }

      }
    }

    stage('Matrix Quick Test') {
      matrix {
        axes {
          axis {
            name 'NODE_VERSION'
            values '18','20'
          }
        }
        stages {
          stage('Quick Node Test') {
            steps {
              sh '''
                echo "Testing Node ${NODE_VERSION} via docker run..."
                docker run --rm node:${NODE_VERSION} node -v
              '''
            }
          }
        }
      }
    }

    stage('Checkout Code') {
      steps {
        git branch: 'main', url: 'https://github.com/dubratati987/acquisitions.git'
      }
    }

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

    stage('Code Quality & Tests') {
      parallel {

        stage('Lint') {
          steps {
            sh '''
              echo "Running lint..."
              docker run --rm \
                  -v "$WORKSPACE":/app \
                  -w /app \
                  node:18-alpine sh -c "
                npm ci
                npm run lint || (echo 'Lint failed' && exit 1)
              "
            '''
          }
        }

        stage('Unit Tests') {
          steps {
            sh '''
              echo "Running unit tests..."
              docker run --rm \
                  -v "$WORKSPACE":/app \
                  -w /app \
                  node:18-alpine sh -c  "
                npm ci
                npm test || (echo 'Unit tests failed' && exit 1)
              "
            '''
          }
        }

        stage('Prisma Validate') {
          steps {
            sh '''
              echo "Validating Prisma schema..."
              docker run --rm \
                  -v "$WORKSPACE":/app \
                  -w /app \
                  node:18-alpine sh -c  "
                apk add --no-cache python3 make g++ > /dev/null 2>&1 || true
                npm ci --omit=dev
                npx prisma validate --schema=prisma/schema.prisma
              "
            '''
          }
        }

      }
    }

    stage('Build Docker Image (local)') {
      steps {
        echo 'Building docker image (compose build)'
        sh '''
          docker compose -f docker-compose.prod.yml build --no-cache
        '''
      }
    }

    stage('Start Application Services') {
      steps {
        sh '''
          docker compose -f docker-compose.prod.yml up -d
          echo "Waiting 30s for services..."
          sleep 30
          docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
        '''
      }
    }

    stage('Health Check') {
      steps {
        sh '''
          echo "Running health check against host.docker.internal..."
          curl -f http://host.docker.internal:3000/health || { echo "Health check failed"; exit 1; }
          echo "Health OK"
        '''
      }
    }

    stage('Integration Tests') {
      steps {
        sh '''
          echo "Creating random test user..."
          RANDOM_EMAIL="jenkins_${BUILD_NUMBER}_$RANDOM@example.com"
          echo "Generated email: $RANDOM_EMAIL"

          curl -X POST "http://host.docker.internal:3000/api/auth/sign-up" \
            -H "Content-Type: application/json" \
            -d "{\\"name\\":\\"Jenkins CI Test\\",\\"email\\":\\"$RANDOM_EMAIL\\",\\"password\\":\\"123456\\"}" \
            -f || { echo "Create user failed"; exit 1; }
        '''
      }
    }

    stage('Performance Check') {
      steps {
        sh '''
          curl -w "⏱ Time: %{time_total}s\\n" -o /dev/null -s http://host.docker.internal:3000/api/users
        '''
      }
    }

    stage('Multi-arch Build & Push') {
      when { expression { return env.PUSH_IMAGE == 'true' } }
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDENTIALS_ID,
                                          usernameVariable: 'DOCKER_USER',
                                          passwordVariable: 'DOCKER_PASS')]) {

          sh '''
            set -e

            echo "Logging into Docker registry..."
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin

            builder_name="jenkins-buildx"
            if ! docker buildx inspect ${builder_name} > /dev/null 2>&1; then
              docker buildx create --name ${builder_name} --use
            else
              docker buildx use ${builder_name}
            fi

            echo "Building multi-arch image for amd64,arm64 and pushing..."
            docker buildx build --platform linux/amd64,linux/arm64 \
              -t ${DOCKER_IMAGE_NAME}:${DOCKER_LATEST_TAG} \
              --push .

            docker buildx imagetools inspect ${DOCKER_IMAGE_NAME}:${DOCKER_LATEST_TAG} || true
          '''
        }
      }
    }

  } // stages

  post {
    always {
      sh '''
        echo "Cleaning up: docker compose down"
        docker compose -f docker-compose.prod.yml down || true
        docker image prune -f || true
      '''
    }
    success {
      echo "✅ Pipeline succeeded"
    }
    failure {
      sh '''
        echo "Collecting logs for debugging..."
        docker compose -f docker-compose.prod.yml logs || true
      '''
    }
  }
}
