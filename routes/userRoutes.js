import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const userRouter = Router();

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

// POST /api/user/register
userRouter.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email and password are required' });
    }

    try {
        const exists = await User.findOne({ $or: [{ email }, { username }] });
        if (exists) {
            return res.status(409).json({ message: 'Username or email already taken' });
        }

        const user = await User.create({ username, email, password });
        const token = signToken(user._id);

        res.status(201).json({ token, user });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// POST /api/user/login
userRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = signToken(user._id);
        res.json({ token, user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// GET /api/user/me
userRouter.get('/me', auth.protect, (req, res) => {
    res.json({ user: req.user });
});

// GET /api/user/all (admin)
// Returns all registered users sorted by creation date.
userRouter.get('/all', auth.protect, auth.adminOnly, async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 }).lean();
        res.json({ users, total: users.length });
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PATCH /api/user/:id/role (admin)
// Promote or demote a user between student and admin roles.
userRouter.patch('/:id/role', auth.protect, auth.adminOnly, async (req, res) => {
    const { role } = req.body;
    if (!['student', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'role must be student or admin' });
    }
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        );
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/user/:id (admin)
userRouter.delete('/:id', auth.protect, auth.adminOnly, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default userRouter;