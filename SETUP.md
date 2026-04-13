# QR Code Generator with Email Service

This application generates QR codes for graduation reservations and sends them via email.

## Setup Instructions

### 1. Frontend Setup (Already configured)
The frontend is a React app that displays the form and QR codes.

### 2. Backend Setup (Required for email functionality)

#### Step 1: Install Server Dependencies
Navigate to the server directory and install dependencies:
```bash
cd server
npm install
```

#### Step 2: Configure Email Service
Create a `.env` file in the server directory (copy from `.env.example`):
```
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password
PORT=5000

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**For Gmail Users:**
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App-Specific Password:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows" (or your device)
   - Copy the generated 16-character password
3. Use this password in the `.env` file as `EMAIL_PASSWORD`

**For Other Email Providers:**
Update the transporter configuration in `server/server.js` with your email service details.

#### Step 2b: Configure Supabase (for saving form data)
1. Go to https://supabase.com and create a new project
2. Once created, go to **Settings > API** to find your credentials
3. Copy the **Project URL** and paste it as `SUPABASE_URL` in `.env`
4. Copy the **anon/public key** and paste it as `SUPABASE_ANON_KEY` in `.env`

**Create the database table:**
In Supabase, go to **SQL Editor** and run this query:
```sql
CREATE TABLE registrations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  student_name TEXT NOT NULL,
  student_number TEXT NOT NULL,
  course TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  parent1 TEXT NOT NULL,
  parent2 TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Step 3: Start the Server
From the server directory, run:
```bash
npm start
```
Or for development with auto-reload:
```bash
npm run dev
```

The server should now be running on `http://localhost:5000`

### 3. Running the Application

Open another terminal and start the React frontend:
```bash
npm start
```

The app will open at `http://localhost:3000`

## How to Use

1. Fill in the student information form
2. Enter Parent 1 name (required)
3. Enter Parent 2 name (optional) - leaving blank will generate only 1 QR code
4. Click "Generate QR Code"
5. Click "Send QR Codes to Email" to send them to the student's email
6. You'll receive a confirmation when the email is sent

## Features

- **Optional Parent 2**: Leave Parent 2 field blank to generate only 1 QR code
- **Multiple QR Codes**: If both parents are filled, 2 separate QR codes are generated
- **Email Distribution**: QR codes are automatically attached to the email sent to the student
- **Parent Labels**: Each QR code is labeled with the corresponding parent name in the email
- **Database Storage**: All registration data is automatically saved to Supabase

## Troubleshooting

- **"Failed to send email" error**: Make sure the server is running on port 5000
- **Email not sent**: Check that your `.env` credentials are correct for Gmail (use app-specific password)
- **CORS errors**: Make sure the frontend is making requests to `http://localhost:5000`
