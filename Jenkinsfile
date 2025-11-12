pipeline {
    agent any

    environment {
        DOCKER_IMAGE_NAME = 'dubratati987/docker-acquisitions'
        DOCKER_LATEST_TAG = 'jenkins'

        // Environment file
        WORKSPACE_PATH = "${env.WORKSPACE}"
        GENERATED_ENV_FILE = "${env.WORKSPACE}/.env.production"
    }

    stages {

        stage('Install Docker Compose v2') {
          steps {
            sh '''
              # Check if docker compose v2 is already available
              if ! docker compose version > /dev/null 2>&1; then
                echo "Installing Docker Compose plugin..."

                # Create required folders
                mkdir -p ~/.docker/cli-plugins

                # Download Docker Compose plugin binary
                curl -SL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64 \
                  -o ~/.docker/cli-plugins/docker-compose

                # Make it executable
                chmod +x ~/.docker/cli-plugins/docker-compose

                # Verify install
                docker compose version
              else
                echo "Docker Compose already installed"
              fi
            '''
          }
        }

        stage('Checkout Code') {
            steps {
                echo 'I checkout source code from github...'
                //  Jenkins automatically clones the repo containing this Jenkinsfile
                //    Jenkins automatically pulls GitHub repository
                //    Shows commit hash and branch information
                //    Sets up the workspace for building

                // use the lower-level checkout scm syntax for more control:
                // script {
                //     echo "Building commit: ${env.GIT_COMMIT}"
                //     echo "Branch: ${env.GIT_BRANCH}"
                //     checkout([
                //         $class: 'GitSCM',
                //         branches: [[name: '*/main']],
                //         doGenerateSubmoduleConfigurations: false,
                //         extensions: [],
                //         userRemoteConfigs: [[
                //             // url: 'git@github.com:dubratati987/acquisitions.git'
                //             url: 'https://github.com/dubratati987/acquisitions.git'
                //         ]]
                //     ])
                // }

                // OR
                // Shallow Clone for Faster Builds
                // checkout([
                //     $class: 'GitSCM',
                //     branches: [[name: '*/main']],
                //     extensions: [[$class: 'CloneOption', shallow: true, depth: 1]],
                //     userRemoteConfigs: [[url: 'https://github.com/username/repository.git']]
                // ])


                // OR
                // Checkout a public GitHub repo (no credentials needed)
                // Scripted Pipeline (not Declarative)
                git branch: 'main',
                // credentialsId: 'my-github-token',
                url: 'https://github.com/dubratati987/acquisitions.git'
            }
        }


        stage('Prepare .env') {
          steps {
            // withCredentials([string(credentialsId: 'accquisition-env-file', variable: 'ENV_CONTENT')]) {
            //     writeFile file: "$GENERATED_ENV_FILE", text: "${ENV_CONTENT}"
            //     echo ".env.production file created"
            // }

           
            withCredentials([file(credentialsId: 'accquisition-env-file', variable: 'ENV_FILE')]) {
               sh """
                  cp "$ENV_FILE" "$GENERATED_ENV_FILE"
                  echo ".env.production file created"
                  cat "$GENERATED_ENV_FILE"
                """
            }
          }
        }

        
        stage('Build Docker Image') {
            steps {
                echo 'Build Docker Image'
                script {
                    sh "docker compose -f docker-compose.prod.yml build --no-cache"
                }
            }
        }

        // stage('Generate Prisma Client') {
        //     steps {
        //         echo '📦 Generating Prisma client inside container...'
        //         script {
        //             // Run Prisma generate inside the app container
        //             sh """
        //                 docker compose --env-file "$GENERATED_ENV_FILE" -f docker-compose.prod.yml run --rm app npx prisma generate
        //               """
        //         }
        //     }
        // }

        stage('Start Application Services') {
          steps {
            echo '🚀 Starting accquisition application...'
            script {
              // Start the complete application stack
              sh "docker compose -f docker-compose.prod.yml up -d"

              // Wait for services to be ready
              echo "Waiting for services to start..."
              sleep(time: 30, unit: "SECONDS")

              // Show running containers
              sh '''
                  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
              '''
              // sh "npm run db:migrate"
            }
          }
        }

        stage('Health Check') {
          steps {
            echo '🩺 Running health checks...'
            script {
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
            echo '🧪 Running integration tests...'
            script {
              // Create a test task
              sh '''
                echo "Creating test user..."
                RANDOM_EMAIL="jenkins_test_${RANDOM}@example.com"
                curl -X POST http://host.docker.internal:3000/api/auth/sign-up \
                  -H "Content-Type: application/json" \
                  -d "{\"name\": \"Jenkins CI Test User\", \"email\": \"${RANDOM_EMAIL}\", \"password\": \"123456\"}" \
                  -f || exit 1
              '''
            }
          }
        }

        stage('Performance Check') {
          steps {
            echo '⚡ Running basic performance checks...'
            script {
              // Simple response time check
              sh '''
                echo "Checking API response time..."
                time curl -s http://host.docker.internal:3000/api/users > /dev/null
              '''
            }
          }
        }

 

    }

    post {
      always {
        echo '🧹 Cleaning up resources...'
        script {
          // Always clean up, regardless of build result
          sh '''
          echo "Stopping application containers..."
          docker compose down || true
          echo "Removing test containers..."
          docker rm -f $(docker ps -aq --filter "label=jenkins-test") || true
          echo "Cleaning up unused images..."
          docker image prune -f || true
          '''
        }
      }

      success {
        echo '✅ Pipeline completed successfully!'
        script {
          // Additional success actions
          sh 'echo "Build #${BUILD_NUMBER} succeeded at $(date)"'
        }
      }

      failure {
        echo '❌ Pipeline failed!'
        script {
          // Capture logs for debugging
          sh '''
          echo "Capturing container logs for debugging..."
          docker compose logs || true
          '''
        }
      }

      unstable {
        echo '⚠️ Pipeline completed with warnings'
      }
    }
}