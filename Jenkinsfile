pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'ReleaseShield source code is ready.'
            }
        }

        stage('Build and Test') {
            steps {
                echo 'Next: compile the application and run tests.'
            }
        }

        stage('Docker') {
            steps {
                echo 'Next: build the Docker image.'
            }
        }
    }
}