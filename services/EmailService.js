const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });
  }

  async sendStatusEmail(candidate, job, oldStatus, newStatus, applicationId) {
    try {
      const template = this.getEmailTemplate(newStatus, candidate, job);

      if (!template) {
        console.warn(`No email template found for status: ${newStatus}`);
        return false;
      }

      const mailOptions = {
        from: `"${process.env.COMPANY_NAME || 'HireSphere'}" <${process.env.EMAIL_USER}>`,
        to: candidate.email,
        subject: template.subject,
        html: template.body
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Status email sent to ${candidate.email} for ${newStatus}`);

      await EmailLog.create({
        applicationId,
        candidateId: candidate._id || candidate.id,
        jobId: job._id || job.id,
        emailType: newStatus,
        recipient: candidate.email,
        subject: template.subject,
        status: 'sent',
        sentAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);

      try {
        await EmailLog.create({
          applicationId,
          candidateId: candidate._id || candidate.id,
          jobId: job._id || job.id,
          emailType: newStatus,
          recipient: candidate.email,
          subject: this.getEmailTemplate(newStatus, candidate, job)?.subject || `Status Update: ${newStatus}`,
          status: 'failed',
          errorMessage: error.message,
          sentAt: new Date()
        });
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }

      return false;
    }
  }

  async sendStatusEmailWithRetry(candidate, job, oldStatus, newStatus, applicationId, maxRetries = 3) {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const success = await this.sendStatusEmail(candidate, job, oldStatus, newStatus, applicationId);
        if (success) {
          return true;
        }
      } catch (error) {
        console.error(`Email attempt ${attempts + 1} failed:`, error);
      }

      attempts++;

      if (attempts < maxRetries) {
        const waitTime = Math.pow(2, attempts - 1) * 1000;
        console.log(`Retrying email in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    console.error(`❌ Email failed after ${maxRetries} attempts`);
    return false;
  }

  getEmailTemplate(status, candidate, job) {
    const templates = {
      shortlisted: {
        subject: `Congratulations! You've been shortlisted for ${job.title} at ${process.env.COMPANY_NAME || 'HireSphere'}`,
        body: this.getShortlistedTemplate(candidate, job)
      },
      rejected: {
        subject: `Update on your application for ${job.title} at ${process.env.COMPANY_NAME || 'HireSphere'}`,
        body: this.getRejectedTemplate(candidate, job)
      },
      selected: {
        subject: `Congratulations! Job Offer for ${job.title} at ${process.env.COMPANY_NAME || 'HireSphere'}`,
        body: this.getSelectedTemplate(candidate, job)
      }
    };

    return templates[status.toLowerCase()] || null;
  }

  getShortlistedTemplate(candidate, job) {
    const candidateName = candidate.name || candidate.firstName + ' ' + candidate.lastName;
    const companyName = process.env.COMPANY_NAME || 'HireSphere';
    const companyEmail = process.env.COMPANY_EMAIL || 'careers@hiresphere.com';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Interview Invitation</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
          .header h2 { margin: 10px 0 0 0; font-size: 18px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .congratulations { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; }
          .next-steps { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
          .interview-process { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .contact-info { background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; border-top: 1px solid #dee2e6; }
          .button { display: inline-block; background: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0; }
          .highlight { background: #fff3cd; padding: 2px 6px; border-radius: 3px; }
          ul { padding-left: 20px; }
          ol { padding-left: 20px; }
          .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <h2>You've Been Shortlisted</h2>
          </div>

          <div class="content">
            <div class="congratulations">
              <p>Dear <strong>${candidateName}</strong>,</p>
              <p>We are thrilled to inform you that your application for the <strong class="highlight">${job.title}</strong> position has been <strong>shortlisted</strong> for the next stage of our recruitment process!</p>
              <p>Out of many qualified applicants, your profile stood out and we're excited about the possibility of you joining our team.</p>
            </div>

            <div class="next-steps">
              <h3>🚀 What's Next?</h3>
              <ul>
                <li>Our recruitment team will contact you within <strong>2-3 business days</strong> to schedule your interview</li>
                <li>Please keep an eye on your email (including spam/junk folder) for further instructions</li>
                <li>Ensure your contact information is up to date in your profile</li>
                <li>Prepare any questions you might have about the role or our company</li>
              </ul>
            </div>

            <div class="interview-process">
              <h3>📋 Interview Process Overview</h3>
              <p>Our typical interview process includes:</p>
              <ol>
                <li><strong>Technical/Skill Assessment</strong> - Evaluating your expertise in key areas</li>
                <li><strong>Interview with Hiring Manager</strong> - Discussion about the role and your experience</li>
                <li><strong>HR Discussion</strong> - Final conversation about company culture and benefits</li>
              </ol>
              <p>The entire process usually takes <strong>1-2 weeks</strong> from start to finish.</p>
            </div>

            <div class="contact-info">
              <h3>📞 Questions?</h3>
              <p>If you have any questions about the position or the interview process, please don't hesitate to contact us:</p>
              <p><strong>Email:</strong> <a href="mailto:${companyEmail}">${companyEmail}</a><br>
              <strong>Subject:</strong> Interview Inquiry - ${job.title}</p>
            </div>

            <p>We look forward to speaking with you soon and learning more about how you can contribute to our team!</p>

            <div class="signature">
              <p>Best regards,<br>
              <strong>The ${companyName} Recruitment Team</strong></p>
            </div>
          </div>

          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>For any inquiries, please contact us at <a href="mailto:${companyEmail}">${companyEmail}</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getRejectedTemplate(candidate, job) {
    const candidateName = candidate.name || candidate.firstName + ' ' + candidate.lastName;
    const companyName = process.env.COMPANY_NAME || 'HireSphere';
    const companyEmail = process.env.COMPANY_EMAIL || 'careers@hiresphere.com';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Update</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 300; }
          .content { padding: 40px 30px; }
          .message { background: #f8fafc; padding: 25px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #64748b; }
          .future-opportunities { background: #e0f2fe; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; border-top: 1px solid #dee2e6; }
          .talent-pool { background: #f0f9ff; border: 1px solid #0ea5e9; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Update</h1>
          </div>

          <div class="content">
            <div class="message">
              <p>Dear <strong>${candidateName}</strong>,</p>

              <p>Thank you for your interest in the <strong>${job.title}</strong> position at ${companyName} and for the time and effort you invested in the application process.</p>

              <p>After careful consideration of all applications, we regret to inform you that we have decided to move forward with other candidates whose qualifications more closely match our current requirements for this specific role.</p>

              <p>This decision was not made lightly, as we were genuinely impressed with your background, experience, and the quality of your application.</p>
            </div>

            <div class="future-opportunities">
              <h3>🌟 Future Opportunities</h3>
              <p>We encourage you to apply for future positions at ${companyName} that align with your skills and career interests. Our team is always growing, and we believe your talents could be a great fit for other roles.</p>

              <div class="talent-pool">
                <p><strong>📋 Talent Pool</strong></p>
                <p>We've added your profile to our talent database. If suitable opportunities arise in the future that match your qualifications, we'll reach out to you directly.</p>
              </div>
            </div>

            <p>We wish you the very best in your job search and future career endeavors. Thank you again for considering ${companyName} as a potential employer.</p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p>Best regards,<br>
              <strong>The ${companyName} Recruitment Team</strong></p>
            </div>
          </div>

          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>For any inquiries, please contact us at <a href="mailto:${companyEmail}">${companyEmail}</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getSelectedTemplate(candidate, job) {
    const candidateName = candidate.name || candidate.firstName + ' ' + candidate.lastName;
    const companyName = process.env.COMPANY_NAME || 'HireSphere';
    const companyEmail = process.env.COMPANY_EMAIL || 'careers@hiresphere.com';
    const companyPhone = process.env.COMPANY_PHONE || '+1-555-0123';

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    const deadlineStr = deadline.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Offer</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #00c851 0%, #009624 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 32px; font-weight: 300; }
          .header h2 { margin: 10px 0 0 0; font-size: 20px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .celebration { background: #e8f5e8; border: 2px solid #4caf50; padding: 25px; margin: 20px 0; border-radius: 10px; text-align: center; }
          .offer-details { background: #fff8e1; border: 2px solid #ffc107; padding: 25px; margin: 20px 0; border-radius: 10px; }
          .next-steps { background: #e3f2fd; border: 2px solid #2196f3; padding: 25px; margin: 20px 0; border-radius: 10px; }
          .deadline { background: #ffebee; border: 2px solid #f44336; padding: 20px; margin: 20px 0; border-radius: 10px; font-weight: bold; }
          .contact-info { background: #f3e5f5; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; border-top: 1px solid #dee2e6; }
          .button { display: inline-block; background: #4caf50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0; font-size: 16px; }
          .highlight { background: #fff3cd; padding: 2px 6px; border-radius: 3px; font-weight: bold; }
          .urgent { color: #d32f2f; font-weight: bold; }
          ul { padding-left: 20px; }
          ol { padding-left: 20px; }
          .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }
          .confetti { font-size: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="confetti">🎉</h1>
            <h1>Congratulations!</h1>
            <h2>Job Offer - ${job.title}</h2>
          </div>

          <div class="content">
            <div class="celebration">
              <p>Dear <strong>${candidateName}</strong>,</p>
              <p>We are absolutely delighted to offer you the position of <strong class="highlight">${job.title}</strong> at ${companyName}!</p>
              <p>After a thorough review of your application and interview performance, we believe you are the perfect fit for our team and this role.</p>
            </div>

            <div class="offer-details">
              <h3>📋 Offer Details</h3>
              <ul>
                <li><strong>Position:</strong> ${job.title}</li>
                <li><strong>Department:</strong> ${job.department || 'To be discussed during onboarding'}</li>
                <li><strong>Location:</strong> ${job.location || 'To be discussed'}</li>
                <li><strong>Employment Type:</strong> ${job.jobType || 'Full-time'}</li>
                <li><strong>Start Date:</strong> Flexible - to be discussed</li>
              </ul>
              <p><em>* Compensation package and benefits details will be discussed during your offer call</em></p>
            </div>

            <div class="next-steps">
              <h3>🚀 Next Steps</h3>
              <p>Our HR team will contact you within the next 24 hours to:</p>
              <ol>
                <li>Schedule a call to discuss the offer details and compensation</li>
                <li>Answer any questions you may have</li>
                <li>Begin the formal offer process</li>
              </ol>
              <p>Please ensure you're available for a call in the coming days.</p>
            </div>

            <div class="deadline">
              <h3>⏰ Response Deadline</h3>
              <p class="urgent">Please respond to this offer by <strong>${deadlineStr}</strong> to let us know if you accept this exciting opportunity.</p>
              <p>If you need more time to consider, please let us know and we'll be happy to extend the deadline.</p>
            </div>

            <div class="contact-info">
              <h3>📞 Contact Information</h3>
              <p>For any questions about this offer:</p>
              <p><strong>Email:</strong> <a href="mailto:${companyEmail}">${companyEmail}</a><br>
              <strong>Phone:</strong> <a href="tel:${companyPhone}">${companyPhone}</a></p>
              <p><strong>Subject Line:</strong> Job Offer Response - ${job.title}</p>
            </div>

            <p>We are thrilled about the prospect of you joining our team and believe you will make an incredible contribution to ${companyName}. This is just the beginning of an exciting journey together!</p>

            <p>Welcome to the team! 🎉</p>

            <div class="signature">
              <p>Best regards,<br>
              <strong>The ${companyName} Recruitment Team</strong></p>
            </div>
          </div>

          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>This is an automated job offer notification.</p>
            <p>Please respond directly to <a href="mailto:${companyEmail}">${companyEmail}</a> with your decision.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connected successfully');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = EmailService;