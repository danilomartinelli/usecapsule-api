import { DockerComposeEnvironment, Wait } from 'testcontainers';
import * as path from 'path';

export default async function globalSetup() {
  console.log('🚀 Starting global test setup...');

  try {
    // Start Docker Compose environment for integration tests
    const composeFilePath = path.join(__dirname, '..', 'compose.yml');

    // Only start services needed for testing
    const environment = new DockerComposeEnvironment('.', 'compose.yml')
      .withWaitStrategy('rabbitmq', Wait.forHealthCheck())
      .withStartupTimeout(120000);

    // Store the environment in global state for cleanup
    (global as any).__TESTCONTAINERS_ENVIRONMENT__ = await environment.up([
      'rabbitmq',
    ]);

    console.log('✅ Global test setup completed');
  } catch (error) {
    console.warn(
      '⚠️ Failed to start Docker Compose environment for tests:',
      error,
    );
    console.log('Tests will use TestContainers instead');
  }
}
