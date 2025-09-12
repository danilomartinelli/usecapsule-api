export default async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');

  try {
    // Clean up Docker Compose environment
    const environment = (global as any).__TESTCONTAINERS_ENVIRONMENT__;
    if (environment) {
      await environment.down();
      console.log('✅ Docker Compose environment cleaned up');
    }
  } catch (error) {
    console.warn('⚠️ Failed to clean up Docker Compose environment:', error);
  }

  console.log('✅ Global test teardown completed');
}