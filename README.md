# Splitly AI

This contains everything you need to run your app locally and deploy to production.


## Run Locally

**Prerequisites:** Node.js v20+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key:
   ```env
   GEMINI_API_KEY=your_key_here
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

## Infrastructure Setup

The following operations were applied to configure the repository:

- **Dependency Management**: `package.json` was verified for the React/Vite stack. Run `npm install` to install them (Node/npm not accessible in the current CLI environment).
- **.gitignore**: A comprehensive `.gitignore` was configured to avoid uploading `node_modules`, `dist`, editor files, and `.env`.
- **Production Deployment**: A GitHub Action workflow (`.github/workflows/deploy.yml`) was added to automatically build and deploy the React Vite application to GitHub Pages whenever changes are pushed to `main`.
