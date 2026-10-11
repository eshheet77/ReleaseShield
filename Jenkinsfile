
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {

        // 1. Checkout source code
        stage('Checkout') {
            steps {
                checkout scm
                echo 'ReleaseShield source code checked out successfully.'
            }
        }

        // 2. Build application and run tests
        stage('Build and Test') {
            steps {
                sh 'mvn -B clean package'
            }
        }

        // 3. Verify generated JAR
        stage('Verify JAR') {
            steps {
                sh 'test -f target/releaseshield-0.0.1-SNAPSHOT.jar'
                sh 'ls -lh target/releaseshield-0.0.1-SNAPSHOT.jar'

                echo 'Spring Boot JAR verified successfully.'
            }
        }

        // 4. Build Docker image
        stage('Docker Build') {
            steps {
                sh 'docker build -t releaseshield:${BUILD_NUMBER} -t releaseshield:latest .'
            }
        }

        // 5. Verify Docker image
        stage('Docker Verification') {
            steps {
                sh 'docker image inspect releaseshield:${BUILD_NUMBER}'

                echo 'Docker image created successfully.'
            }
        }

        // 6. Blue-Green Deployment
        stage('Blue-Green Deployment') {
            steps {
                sh '''
                    set -eu

                    echo "=================================="
                    echo "Starting Blue-Green Deployment"
                    echo "=================================="

                    # Detect currently active environment
                    CURRENT=$(docker exec releaseshield-nginx sh -c "grep -Eo 'releaseshield-(blue|green):8080' /etc/nginx/conf.d/default.conf | head -n 1")

                    case "$CURRENT" in
                        *blue*)
                            TARGET=green
                            ;;
                        *green*)
                            TARGET=blue
                            ;;
                        *)
                            echo "ERROR: Could not detect active environment."
                            exit 1
                            ;;
                    esac

                    echo "Currently active: $CURRENT"
                    echo "New deployment target: $TARGET"

                    # Remove old inactive container
                    docker rm -f releaseshield-$TARGET 2>/dev/null || true

                    # Deploy new application version
                    echo "Starting new $TARGET container..."

                    docker run -d \
                        --name releaseshield-$TARGET \
                        --network releaseshield-net \
                        releaseshield:${BUILD_NUMBER}

                    # Wait for new application to become healthy
                    echo "Checking application health..."

                    HEALTHY=0

                    for i in $(seq 1 30); do

                        if docker exec releaseshield-nginx wget -qO- http://releaseshield-$TARGET:8080/actuator/health 2>/dev/null | grep -q '"status":"UP"'; then

                            HEALTHY=1
                            break

                        fi

                        echo "Waiting for application... attempt $i"
                        sleep 2

                    done

                    # Stop deployment if health check fails
                    if [ "$HEALTHY" -ne 1 ]; then

                        echo "ERROR: New environment failed health check."

                        docker rm -f releaseshield-$TARGET || true

                        exit 1

                    fi

                    echo "$TARGET environment is healthy."

                    # Save current Nginx configuration
                    mkdir -p nginx

                    docker exec releaseshield-nginx cat /etc/nginx/conf.d/default.conf > nginx/previous.conf

                    cp nginx/previous.conf nginx/default.conf

                    # Change Nginx upstream to the new environment
                    sed -i "s/server releaseshield-.*:8080;/server releaseshield-$TARGET:8080;/" nginx/default.conf

                    echo "New Nginx configuration:"
                    cat nginx/default.conf

                    # Copy updated configuration into Nginx
                    docker cp nginx/default.conf releaseshield-nginx:/etc/nginx/conf.d/default.conf

                    # Validate Nginx configuration
                    if ! docker exec releaseshield-nginx nginx -t; then

                        echo "ERROR: Nginx configuration invalid. Restoring previous configuration."

                        docker cp nginx/previous.conf releaseshield-nginx:/etc/nginx/conf.d/default.conf

                        exit 1

                    fi

                    # Reload Nginx to switch traffic
                    if ! docker exec releaseshield-nginx nginx -s reload; then

                        echo "ERROR: Nginx reload failed. Rolling back."

                        docker cp nginx/previous.conf releaseshield-nginx:/etc/nginx/conf.d/default.conf

                        docker exec releaseshield-nginx nginx -t

                        docker exec releaseshield-nginx nginx -s reload

                        exit 1

                    fi

                    echo "Nginx traffic switched to $TARGET."

                    # Verify application through Nginx
                    if ! docker exec releaseshield-nginx wget -qO- http://127.0.0.1/actuator/health | grep -q '"status":"UP"'; then

                        echo "ERROR: Post-deployment verification failed."

                        echo "Rolling back to previous environment..."

                        docker cp nginx/previous.conf releaseshield-nginx:/etc/nginx/conf.d/default.conf

                        docker exec releaseshield-nginx nginx -t

                        docker exec releaseshield-nginx nginx -s reload

                        exit 1

                    fi

                    echo "=================================="
                    echo "BLUE-GREEN DEPLOYMENT SUCCESSFUL"
                    echo "Active environment: $TARGET"
                    echo "Previous environment retained for rollback."
                    echo "=================================="
                '''
            }
        }
    }

    post {

        success {
            echo 'ReleaseShield CI/CD pipeline completed successfully!'
            echo 'Application deployed using Blue-Green deployment.'
        }

        failure {
            echo 'ReleaseShield pipeline failed. Check the stage logs.'
        }
    }
}
