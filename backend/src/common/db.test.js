function makeFakeConnection() {
  return {
    query: jest.fn().mockResolvedValue([[]]),
    beginTransaction: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
}

jest.mock('../config/database', () => ({ pool: { getConnection: jest.fn() } }));

const { pool } = require('../config/database');
const { withTransaction } = require('./db');

describe('withTransaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('begins, runs the callback with the connection, commits, and releases on success', async () => {
    const conn = makeFakeConnection();
    pool.getConnection.mockResolvedValue(conn);

    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withTransaction(fn);

    expect(result).toBe('ok');
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back, releases, and re-throws the original error (preserving AppError subclass) on failure', async () => {
    const conn = makeFakeConnection();
    pool.getConnection.mockResolvedValue(conn);

    class FakeConflictError extends Error { constructor(msg) { super(msg); this.statusCode = 409; } }
    const fn = jest.fn().mockRejectedValue(new FakeConflictError('duplicate email'));

    await expect(withTransaction(fn)).rejects.toMatchObject({ message: 'duplicate email', statusCode: 409 });

    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('still releases the connection even if rollback itself throws', async () => {
    const conn = makeFakeConnection();
    conn.rollback.mockRejectedValue(new Error('connection already closed'));
    pool.getConnection.mockResolvedValue(conn);

    const fn = jest.fn().mockRejectedValue(new Error('original failure'));

    await expect(withTransaction(fn)).rejects.toThrow('original failure');
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});
