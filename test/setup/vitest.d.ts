import 'vitest';
import { TestUser } from './utils/createTestUsers.ts';

declare module 'vitest' {
  export interface TestContext {
    testUser: TestUser;
    anotherUser: TestUser;
  }
}
declare module 'vitest' {
  export interface ProvidedContext {
      testUser: TestUser;
      anotherUser: TestUser;
  }
}