pipeline {

  agent none   // We define agents only inside stages

  environment {
    DOCKER_IMAGE_NAME  = 'dubratati987/docker-acquisitions'
    DOCKER_LATEST_TAG  = 'jenkins'
    WORKSPACE_PATH     = "${env.WORKSPACE}"
    GENERATED_ENV_FILE = "${env.WORKSPACE}/.env.production"
    PUSH_IMAGE         = 'true'
    DOCKER_CREDENTIALS_ID = 'docker-hub-creds'
  }

  stages {

    /* ---------------------------------------------------------
     * Pre-flight (System Info + Docker checks)
     * --------------------------------------------------------- */
    stage('Pre-flight Checks') {
      parallel {

        stage('System Info') {
          agent {
            docker {
              image 'node:18-alpine'
              args "-v ${WORKSPACE}:/app -w /app -v /var/run/docker.sock:/var/run/docker.sock"
            }
          }
          steps {
            sh '''
              echo "Docker version:"
              docker --version

              echo "Docker Compose version:"
              docker compose version || docker-compose version

              echo "Node version:"
              node -v
            '''
          }
        }

        stage('Check Buildx') {
          agent {
            docker {
              image 'node:18-alpine'
              args "-v /var/run/docker.sock:/var/run/docker.sock"
            }
          }
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
     * Matrix Quick Test
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
      agent any
      steps {
        git branch: 'main', url: 'https://github.com/dubratati987/acquisitions.git'
      }
    }

    /* ---------------------------------------------------------
     * Prepare .env.production file
     * --------------------------------------------------------- */
    stage('Prepare .env') {
      agent any
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
     * Debug workspace
     * --------------------------------------------------------- */
    stage('Debug Workspace') {
      agent any
      steps {
        sh '''
          echo "---- LIST workspace -----"
          ls -R "$WORKSPACE"
          echo "-------------------------"
        '''
      }
    }

    /* ---------------------------------------------------------
     * Code Quality (Lint, Unit Tests, Prisma Validate)
     * --------------------------------------------------------- */
    stage('Code Quality & Tests') {
      parallel {

        /* Lint ----------------------------------------------- */
        stage('Lint') {
          agent {
            docker {
              image 'node:18-alpine'
              args "-v ${WORKSPACE}:/app -w /app"
            }
          }
          steps {
            sh '''
              npm ci
              npm run lint
            '''
          }
        }

        /* Unit Tests ----------------------------------------- */
        stage('Unit Tests') {
          agent {
            docker {
              image 'node:18-alpine'
              args "-v ${WORKSPACE}:/app -w /app"
            }
          }
          steps {
            sh '''
              npm ci
              npm test
            '''
          }
        }

        /* Prisma Validate ------------------------------------ */
        stage('Prisma Validate') {
          agent {
            docker {
              image 'node:18-alpine'
              args "-v ${WORKSPACE}:/app -w /app"
            }
          }
          steps {
            sh '''
              apk add --no-cache python3 make g++ >/dev/null 2>&1
              npm ci --omit=dev
              npx prisma validate --schema=prisma/schema.prisma
            '''
          }
        }

      }
    }

    /* ---------------------------------------------------------
     * Build Docker image locally
     * --------------------------------------------------------- */
    stage('Build Docker Image (local)') {
      agent any
      steps {
        sh '''
          echo "Building Docker image using compose..."
          docker compose -f docker-compose.prod.yml build --no-cache
        '''
      }
    }

    /* ---------------------------------------------------------
     * Start services
     * --------------------------------------------------------- */
    stage('Start Application Services') {
      agent any
      steps {
        sh '''
          docker compose -f docker-compose.prod.yml up -d
          echo "Waiting 25 seconds..."
          sleep 25
          docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
        '''
      }
    }

    /* ---------------------------------------------------------
     * Health Check
     * --------------------------------------------------------- */
    stage('Health Check') {
      agent any
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
      agent any
      steps {
        sh '''
          RANDOM_EMAIL="jenkins_${BUILD_NUMBER}_$RANDOM@example.com"

          curl -X POST "http://host.docker.internal:3000/api/auth/sign-up" \
            -H "Content-Type: application/json" \
            -d "{\\"name\\":\\"Jenkins CI Test\\",\\"email\\":\\"$RANDOM_EMAIL\\",\\"password\\":\\"123456\\"}" -f
        '''
      }
    }

    /* ---------------------------------------------------------
     * Performance Check
     * --------------------------------------------------------- */
    stage('Performance Check') {
      agent any
      steps {
        sh '''
          curl -w "⏱ Time: %{time_total}s\\n" -o /dev/null -s http://host.docker.internal:3000/api/users
        '''
      }
    }

    /* ---------------------------------------------------------
     * Multi-arch Build + Push
     * --------------------------------------------------------- */
    stage('Multi-arch Build & Push') {
      when { expression { env.PUSH_IMAGE == 'true' } }
      agent any
      steps {
        withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDENTIALS_ID,
                                          usernameVariable: 'DOCKER_USER',
                                          passwordVariable: 'DOCKER_PASS')]) {

          sh '''
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin

            builder_name="jenkins-buildx"

            if ! docker buildx inspect ${builder_name} >/dev/null 2>&1; then
              docker buildx create --name ${builder_name} --use
            else
              docker buildx use ${builder_name}
            fi

            docker buildx build \
              --platform linux/amd64,linux/arm64 \
              -t ${DOCKER_IMAGE_NAME}:${DOCKER_LATEST_TAG} \
              --push .
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
