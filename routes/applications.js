const express = require('express');
const router = express.Router();
const Application = require('../models/application');
const Job = require('../models/job');
const { authenticateJWT, authorizeCandidate, authorizeEmployer } = require('../middleware/auth');
const { applicationLimiter } = require('../middleware/ratelimit');

// @route   POST api/applications
// @desc    Apply for a job
// @access  Private (Candidates only)
router.post('/', authenticateJWT, authorizeCandidate, applicationLimiter, async (req, res) => {
  try {
    const { jobId, resume, coverLetter } = req.body;

    // Check if job exists and is active
    const job = await Job.findOne({ _id: jobId, isActive: true });
    if (!job) {
      return res.status(404).json({
        error: true,
        message: 'Job not found or no longer active'
      });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      candidate: req.user.id
    });

    if (existingApplication) {
      return res.status(400).json({
        error: true,
        message: 'You have already applied for this job'
      });
    }

    // Create new application
    const newApplication = new Application({
      job: jobId,
      candidate: req.user.id,
      resume,
      coverLetter
    });

    const application = await newApplication.save();

    // Notify employer via WebSocket
    req.app.get('io').to(`employer-${job.employer}`).emit('newApplication', {
      jobId: job._id,
      jobTitle: job.title,
      applicationId: application._id
    });

    res.json(application);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

// @route   GET api/applications/candidate
// @desc    Get all applications by current candidate
// @access  Private (Candidates only)
router.get('/candidate', authenticateJWT, authorizeCandidate, async (req, res) => {
  try {
    const applications = await Application.find({ candidate: req.user.id })
      .populate('job', 'title company location')
      .sort({ createdAt: -1 });
    
    res.json(applications);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

// @route   GET api/applications/job/:jobId
// @desc    Get all applications for a specific job
// @access  Private (Job owner only)
router.get('/job/:jobId', authenticateJWT, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({
        error: true,
        message: 'Job not found'
      });
    }

    // Ensure user is the employer of the job
    if (job.employer.toString() !== req.user.id) {
      return res.status(401).json({
        error: true,
        message: 'Not authorized'
      });
    }

    const applications = await Application.find({ job: req.params.jobId })
      .populate('candidate', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(applications);
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

// @route   PUT api/applications/:id
// @desc    Update application status
// @access  Private (Employer only)
router.put('/:id', authenticateJWT, authorizeEmployer, async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status
    if (!['pending', 'reviewing', 'rejected', 'accepted'].includes(status)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid status'
      });
    }

    // Get application
    const application = await Application.findById(req.params.id);
    
    if (!application) {
      return res.status(404).json({
        error: true,
        message: 'Application not found'
      });
    }

    // Check if user is the employer of the job
    const job = await Job.findById(application.job);
    
    if (!job || job.employer.toString() !== req.user.id) {
      return res.status(401).json({
        error: true,
        message: 'Not authorized'
      });
    }

    // Update status
    application.status = status;
    await application.save();

    // Notify candidate via WebSocket
    req.app.get('io').to(`user-${application.candidate}`).emit('applicationStatusUpdated', {
      applicationId: application._id,
      jobTitle: job.title,
      newStatus: status
    });

    res.json(application);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        error: true,
        message: 'Application not found'
      });
    }
    res.status(500).json({
      error: true,
      message: 'Server error'
    });
  }
});

module.exports = router;