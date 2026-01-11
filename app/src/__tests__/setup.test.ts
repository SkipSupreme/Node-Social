// Sanity test to verify Jest setup works
describe('Jest Setup', () => {
  it('should run tests successfully', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to jest globals', () => {
    expect(jest).toBeDefined();
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
  });
});
