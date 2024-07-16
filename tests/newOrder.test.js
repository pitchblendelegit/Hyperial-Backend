const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../models/Order', () => ({
  create: jest.fn(),
  update: jest.fn(),
}));
jest.mock('../models/OrderLine', () => ({
  create: jest.fn(),
}));
jest.mock('../models/VendorMaterial', () => ({
  findByPk: jest.fn(),
}));
jest.mock('../models/Notifications', () => ({
  create: jest.fn(),
}));
jest.mock('../models/Invoice', () => ({
  create: jest.fn(),
}));

const Order = require('../models/Order');
const OrderLine = require('../models/OrderLine');
const VendorMaterial = require('../models/VendorMaterial');
const Notification = require('../models/Notifications');
const Invoice = require('../models/Invoice');

const app = express();
app.use(express.json());

// Import router
const router = require('../routes/order'); // Ganti dengan path router Anda yang sebenarnya
app.use('/api', router);

describe('POST /newOrder', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new order and invoice successfully', async () => {
    const mockOrder = { OrderID: 1, update: jest.fn() };
    Order.create.mockResolvedValue(mockOrder);
    VendorMaterial.findByPk.mockResolvedValue({ Price: 100, VendorId: 1, MaterialName: 'Material A' });

    const res = await request(app)
      .post('/api/newOrder')
      .send({
        VendorID: 1,
        items: [
          { VendorMaterialID: 1, Quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: 'Order dan invoice berhasil dibuat.', orderId: mockOrder.OrderID });
    expect(Order.create).toHaveBeenCalled();
    expect(OrderLine.create).toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalled();
    expect(Invoice.create).toHaveBeenCalled();
  });

  it('should return 400 if vendor material not found', async () => {
    VendorMaterial.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/newOrder')
      .send({
        VendorID: 1,
        items: [
          { VendorMaterialID: 1, Quantity: 2 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'VendorMaterial dengan ID 1 tidak ditemukan.' });
  });

  it('should return 500 if there is a server error', async () => {
    VendorMaterial.findByPk.mockRejectedValue(new Error('Database error'));

    const res = await request(app)
      .post('/api/newOrder')
      .send({
        VendorID: 1,
        items: [
          { VendorMaterialID: 1, Quantity: 2 },
        ],
      });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Gagal membuat order.', error: 'Database error' });
  });
});
