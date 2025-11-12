pipeline {
    agent any

    environment {
        DOCKER_IMAGE_NAME = 'dubratati987/docker-acquisitions'
        DOCKER_LATEST_TAG = 'jenkins'
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
            steps {
                  branch: 'main', url: 'https://github.com/dubratati987/acquisitions.git'
            }
        }
        // stage('Prepare .env') {
        //   steps {

        //   }

        // }

        // stage('Build Docker Image') {
        //     steps {
        //         echo 'Build Docker Image'
        //         script {
        //             sh "docker compose -f docker-compose.prod.yml up -d --build"
        //         }
        //     }
        // }
    }
}