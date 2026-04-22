import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    const from = process.env.SMTP_FROM || '"DORA SaaS" <no-reply@dorasaas.com>';
    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log('Message sent: %s', info.messageId);
      // If using ethereal.email, log the preview URL
      if (process.env.SMTP_HOST === 'smtp.ethereal.email') {
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}
