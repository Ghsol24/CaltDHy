'use strict';

const nodemailer = require('nodemailer');
const { validEmail } = require('./emailAddress');

function configuredProvider() {
    const provider = process.env.EMAIL_PROVIDER || (process.env.BREVO_API_KEY ? 'brevo' : 'gmail');
    if (provider === 'brevo' && process.env.BREVO_API_KEY && validEmail(process.env.EMAIL_FROM)) {
        return 'brevo';
    }
    if (provider === 'gmail' && validEmail(process.env.GMAIL_USER) && process.env.GMAIL_PASS) {
        return 'gmail';
    }
    return null;
}

async function sendAccountEmail({ to, subject, html, text }) {
    const provider = configuredProvider();
    if (!provider) throw new Error('Email unavailable.');

    if (provider === 'brevo') {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'api-key': process.env.BREVO_API_KEY
            },
            body: JSON.stringify({
                sender: { name: 'CaltDHy', email: process.env.EMAIL_FROM },
                to: [{ email: to }], subject, htmlContent: html, textContent: text
            }),
            signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) throw new Error('Email delivery rejected.');
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail', logger: false, debug: false,
        disableFileAccess: true, disableUrlAccess: true,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });
    await transporter.sendMail({
        from: '"CaltDHy" <' + process.env.GMAIL_USER + '>', to, subject, html, text
    });
}

module.exports = { configuredProvider, sendAccountEmail };
