
pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo 'ReleaseShield source code checked out successfully.'
            }
        }

        stage('Build and Test') {
            steps {
                sh 'mvn -B clean package'
            }
        }

        stage('Verify JAR') {
            steps {
                sh 'test -f target/releaseshield-0.0.1-SNAPSHOT.jar'
                sh 'ls -lh target/releaseshield-0.0.1-SNAPSHOT.jar'
                echo 'Spring Boot JAR verified successfully.'
            }
        }

        stage('Docker Build') {
            steps {
                sh 'docker build -t releaseshield:${BUILD_NUMBER} -t releaseshield:latest .'
            }
        }

        stage('Docker Verification') {
            steps {
                sh 'docker image inspect releaseshield:${BUILD_NUMBER}'
                echo 'Docker image created successfully.'
            }
        }
    }

    post {
        success {
            echo 'ReleaseShield CI/CD pipeline completed successfully!'
        }

        failure {
            echo 'ReleaseShield pipeline failed. Check the stage logs.'
        }
    }
}
