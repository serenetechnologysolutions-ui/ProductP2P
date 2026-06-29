jest.mock('../../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../common/eventBus', () => ({ onEvent: jest.fn(), emitEvent: jest.fn() }));

const { pool } = require('../../config/database');
const { receiveStockFromGrn, consumeStock } = require('./inventory.service');

describe('inventory.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('receiveStockFromGrn', () => {
    it('adds accepted quantity to stock for each line with a linked item master', async () => {
      pool.query
        .mockResolvedValueOnce([[{ accepted_quantity: '10.000', item_master_id: 'item-1' }, { accepted_quantity: '5.000', item_master_id: null }]])
        .mockResolvedValueOnce([[{ id: 'wh-default' }]]) // default warehouse lookup
        .mockResolvedValueOnce([[]]) // no existing stock row for item-1
        .mockResolvedValueOnce([]) // insert stock
        .mockResolvedValueOnce([]); // insert movement

      await receiveStockFromGrn({ record_id: 'grn-1' });

      const insertStock = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO inventory_stock'));
      expect(insertStock[1]).toEqual(expect.arrayContaining(['wh-default', 'item-1', 10]));
      // the line with no item_master_id should be skipped entirely
      const movementCalls = pool.query.mock.calls.filter(c => c[0].includes('INSERT INTO stock_movements'));
      expect(movementCalls).toHaveLength(1);
    });

    it('does nothing if there is no default warehouse configured', async () => {
      pool.query
        .mockResolvedValueOnce([[{ accepted_quantity: '10.000', item_master_id: 'item-1' }]])
        .mockResolvedValueOnce([[]]); // no default warehouse

      await receiveStockFromGrn({ record_id: 'grn-1' });

      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('consumeStock', () => {
    it('decrements stock and records an out movement', async () => {
      pool.query
        .mockResolvedValueOnce([[{ id: 'stock-1', quantity_on_hand: '50.000', reorder_level: '10.000', reorder_quantity: '20.000' }]])
        .mockResolvedValueOnce([]) // update stock
        .mockResolvedValueOnce([]); // insert movement

      const result = await consumeStock('wh-1', 'item-1', 20, 'dept-A', 'actor-1');

      expect(result.quantity_on_hand).toBe(30);
      expect(result.reorder_triggered).toBe(false);
    });

    it('throws when requested quantity exceeds what is on hand', async () => {
      pool.query.mockResolvedValueOnce([[{ id: 'stock-1', quantity_on_hand: '5.000', reorder_level: '10.000', reorder_quantity: '20.000' }]]);

      await expect(consumeStock('wh-1', 'item-1', 20, null, 'actor-1')).rejects.toThrow('Insufficient stock');
    });

    it('throws when there is no stock record at all for the item/warehouse', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      await expect(consumeStock('wh-1', 'item-1', 5, null, 'actor-1')).rejects.toThrow('No stock record');
    });

    it('throws on missing required fields', async () => {
      await expect(consumeStock(null, 'item-1', 5, null, 'actor-1')).rejects.toThrow('Missing required fields');
    });
  });
});
