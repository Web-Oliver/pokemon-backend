/**
 * Basic Jest Test
 * 
 * Simple test to verify Jest setup is working correctly.
 */

describe('Basic Jest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test');

    expect(result).toBe('test');
  });
});