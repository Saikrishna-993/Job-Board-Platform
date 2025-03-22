const express = require('express');
const router = express.Router();
const Job = require('../models/job');
const { authenticateJWT, authorizeEmployer, authorizeAdmin } = require('../middleware/auth');

// @route   POST api/jobs
// @desc    Create a job posting
// @access  Private (Employers only)
router.post('/', authenticateJWT, authorizeEmployer, async (req, res) => {
  try {
    const {
      title,
      description,
      requirements,
      location,
      salary,
      employmentType,
      applicationDeadline
    } = req.body;

    const newJob = new Job({
      title,
      company: req.user.company,
      description,
      requirements,
      location,
      salary,
      employmentType,
      applicationDeadline,
      employer: req.user.id
    });

    const job = await newJob.save();

    // Notify via WebSocket that a new job has been posted
    req.app.get('io').emit('newJob', job);

    res.json(job);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

// @route   GET api/jobs
// @desc    Get all jobs with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    let query = { isActive: true };
    
    // Filter by search term
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }
    
    // Filter by location
    if (req.query.location) {
      query.location = { $regex: req.query.location, $options: 'i' };
    }
    
    // Filter by employment type
    if (req.query.employmentType) {
      query.employmentType = req.query.employmentType;
    }
    
    // Filter by company
    if (req.query.company) {
      query.company = { $regex: req.query.company, $options: 'i' };
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('employer', 'name company');

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalJobs: total
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

// @route   GET api/jobs/:id
// @desc    Get job by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('employer', 'name company');

    if (!job) {
      return res.status(404).json({
        error: true,
        message: 'Job not found'
      });
    }

    res.json(job);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        error: true,
        message: 'Job not found'
      });
    }
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

// @route   PUT api/jobs/:id
// @desc    Update a job posting
// @access  Private (Job owner or Admin)
router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: true,
        message: 'Job not found'
      });
    }

    // Check user is employer of the job or admin
    if (job.employer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        error: true,
        message: 'Not authorized'
      });
    }

    const {
      title,
      description,
      requirements,
      location,
      salary,
      employmentType,
      applicationDeadline,
      isActive
    } = req.body;

    // Build job object
    const jobFields = {};
    if (title) jobFields.title = title;
    if (description) jobFields.description = description;
    if (requirements) jobFields.requirements = requirements;
    if (location) jobFields.location = location;
    if (salary) jobFields.salary = salary;
    if (employmentType) jobFields.employmentType = employmentType;
    if (applicationDeadline) jobFields.applicationDeadline = applicationDeadline;
    if (isActive !== undefined) jobFields.isActive = isActive;

    // Update job
    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      { $set: jobFields },
      { new: true }
    ).populate('employer', 'name company');

    // Notify via WebSocket that a job has been updated
    req.app.get('io').emit('jobUpdated', updatedJob);

    res.json(updatedJob);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        error: true,
        message: 'Job not found'
      });
    }
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

// @route   DELETE api/jobs/:id
// @desc    Delete a job posting
// @access  Private (Job owner or Admin)
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: true,
        message: 'Job not found'
      });
    }

    // Check user is employer of the job or admin
    if (job.employer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({
        error: true,
        message: 'Not authorized'
      });
    }

    await job.remove();

    // Notify via WebSocket that a job has been deleted
    req.app.get('io').emit('jobDeleted', req.params.id);

    res.json({ message: 'Job removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        error: true,
        message: 'Job not found'
      });
    }
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

// @route   GET api/jobs/employer/me
// @desc    Get jobs posted by current employer
// @access  Private (Employers only)
router.get('/employer/me', authenticateJWT, authorizeEmployer, async (req, res) => {
  try {
    const jobs = await Job.find({ employer: req.user.id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

module.exports = router;