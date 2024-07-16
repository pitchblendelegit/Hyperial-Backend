const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../models/User', () => ({
  findOne: jest.fn(),
}));
jest.mock('../models/Vendor', () => ({
  findOne: jest.fn(),
}));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const app = express();
app.use(express.json());

// Import router
const router = require('../routes/authen'); // Ganti dengan path router Anda yang sebenarnya
app.use('/api', router);

describe('Authentication Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /login', () => {
    it('should return 400 if email or password is missing', async () => {
      const res = await request(app).post('/api/login').send({ Email: '' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ valid: false, message: 'Email and password are required' });
    });

    it('should return 401 if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app).post('/api/login').send({ Email: 'test@example.com', Password: 'password' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ valid: false, message: 'Invalid credentials' });
    });

    it('should return 401 if password is invalid', async () => {
      User.findOne.mockResolvedValue({ Email: 'test@example.com', Password: 'hashedpassword' });
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app).post('/api/login').send({ Email: 'test@example.com', Password: 'password' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ valid: false, message: 'Invalid credentials' });
    });

    it('should return 200 and token if login is successful', async () => {
      const mockUser = { UserID: 1, Role: 'user', Email: 'test@example.com', Password: 'hashedpassword' };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token');

      const res = await request(app).post('/api/login').send({ Email: 'test@example.com', Password: 'password' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        valid: true,
        token: 'token',
        role: mockUser.Role,
        vendorId: null,
      });
    });

    it('should return 200 and token with vendorId if vendor login is successful', async () => {
      const mockUser = { UserID: 1, Role: 'vendor', Email: 'test@example.com', Password: 'hashedpassword' };
      const mockVendor = { VendorID: 123 };
      User.findOne.mockResolvedValue(mockUser);
      Vendor.findOne.mockResolvedValue(mockVendor);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token');

      const res = await request(app).post('/api/login').send({ Email: 'test@example.com', Password: 'password' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        valid: true,
        token: 'token',
        role: mockUser.Role,
        vendorId: mockVendor.VendorID,
      });
    });

    it('should return 500 if there is a server error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      User.findOne.mockRejectedValue(new Error('Database error'));

      const res = await request(app).post('/api/login').send({ Email: 'test@example.com', Password: 'password' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ valid: false, error: 'Error logging in', details: 'Database error' });
      expect(consoleSpy).toHaveBeenCalledWith('Error logging in:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('POST /adminLogin', () => {
    it('should return 400 if email or password is missing', async () => {
      const res = await request(app).post('/api/adminLogin').send({ Email: '' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ valid: false, message: 'Email and password are required' });
    });

    it('should return 401 if user not found or not admin', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app).post('/api/adminLogin').send({ Email: 'admin@example.com', Password: 'password' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ valid: false, message: 'Invalid credentials or not an admin' });
    });

    it('should return 401 if password is invalid', async () => {
      User.findOne.mockResolvedValue({ Email: 'admin@example.com', Password: 'hashedpassword', Role: 'admin' });
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app).post('/api/adminLogin').send({ Email: 'admin@example.com', Password: 'password' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ valid: false, message: 'Invalid credentials' });
    });

    it('should return 200 and token if admin login is successful', async () => {
      const mockUser = { UserID: 1, Role: 'admin', Email: 'admin@example.com', Password: 'hashedpassword' };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token');

      const res = await request(app).post('/api/adminLogin').send({ Email: 'admin@example.com', Password: 'password' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        valid: true,
        token: 'token',
        role: mockUser.Role,
      });
    });
  });

  describe('Protected Routes', () => {
    describe('GET /vendor', () => {
      it('should return 403 if not authenticated as vendor', async () => {
        jwt.verify.mockImplementation((token, secret, callback) => {
          callback(null, { Role: 'user' });
        });

        const res = await request(app).get('/api/vendor').set('authorization', 'Bearer token');

        expect(res.status).toBe(403);
      });

      it('should return 200 and vendor data if authenticated as vendor', async () => {
        const mockVendor = { VendorID: 123, VendorName: 'VendorName' };
        jwt.verify.mockImplementation((token, secret, callback) => {
          callback(null, { Role: 'vendor', VendorID: 123 });
        });
        Vendor.findOne.mockResolvedValue(mockVendor);

        const res = await request(app).get('/api/vendor').set('authorization', 'Bearer token');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockVendor);
      });
    });

    describe('GET /proyekManager', () => {
      it('should return 403 if not authenticated as project manager', async () => {
        jwt.verify.mockImplementation((token, secret, callback) => {
          callback(null, { Role: 'user' });
        });

        const res = await request(app).get('/api/proyekManager').set('authorization', 'Bearer token');

        expect(res.status).toBe(403);
      });

      it('should return 200 and user data if authenticated as project manager', async () => {
        const mockUser = { UserID: 1, Username: 'ProjectManager' };
        jwt.verify.mockImplementation((token, secret, callback) => {
          callback(null, { Role: 'ProjectManager', UserID: 1 });
        });
        User.findOne.mockResolvedValue(mockUser);

        const res = await request(app).get('/api/proyekManager').set('authorization', 'Bearer token');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(mockUser);
      });
    });
  });
});
