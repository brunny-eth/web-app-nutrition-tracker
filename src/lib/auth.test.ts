import { describe, it, expect } from 'vitest';
import { 
  hashPassword, 
  verifyPassword, 
  createSessionToken, 
  parseSessionToken 
} from './auth';

describe('Password hashing', () => {
  it('should hash and verify a password correctly', async () => {
    const password = 'testpassword123';
    const hash = await hashPassword(password);
    
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'testpassword123';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword('wrongpassword', hash);
    expect(isValid).toBe(false);
  });

  it('should generate different hashes for same password', async () => {
    const password = 'testpassword123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    expect(hash1).not.toBe(hash2); // Different salts
    
    // But both should verify correctly
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});

describe('Session tokens', () => {
  it('should encode user ID in session token', () => {
    const userId = 'user-123-abc';
    const token = createSessionToken(userId);
    
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should extract user ID from valid token', () => {
    const userId = 'user-456-def';
    const token = createSessionToken(userId);
    
    const extractedId = parseSessionToken(token);
    expect(extractedId).toBe(userId);
  });

  it('should generate unique tokens for same user', () => {
    const userId = 'user-789-ghi';
    const token1 = createSessionToken(userId);
    const token2 = createSessionToken(userId);
    
    expect(token1).not.toBe(token2);
    
    // But both should extract the same user ID
    expect(parseSessionToken(token1)).toBe(userId);
    expect(parseSessionToken(token2)).toBe(userId);
  });

  it('should return null for invalid token', () => {
    expect(parseSessionToken('')).toBe(null);
    expect(parseSessionToken('invalid')).toBe(null);
  });

  it('should handle UUID-style user IDs', () => {
    const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const token = createSessionToken(userId);
    
    const extractedId = parseSessionToken(token);
    expect(extractedId).toBe(userId);
  });
});

describe('Multi-user isolation', () => {
  it('should create distinct tokens for different users', () => {
    const user1Id = 'user-1';
    const user2Id = 'user-2';
    
    const token1 = createSessionToken(user1Id);
    const token2 = createSessionToken(user2Id);
    
    expect(token1).not.toBe(token2);
    expect(parseSessionToken(token1)).toBe(user1Id);
    expect(parseSessionToken(token2)).toBe(user2Id);
  });

  it('should not allow cross-user token parsing', () => {
    const user1Id = 'user-1';
    const user2Id = 'user-2';
    
    const token1 = createSessionToken(user1Id);
    
    // Token 1 should only extract user1's ID
    const extractedId = parseSessionToken(token1);
    expect(extractedId).toBe(user1Id);
    expect(extractedId).not.toBe(user2Id);
  });
});
