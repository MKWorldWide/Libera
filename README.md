# Justice Safeguard Assistant (JSA) - Libera

## Overview

Libera is an AI-driven system designed to protect due process and prevent wrongful arrests by providing defense counsel, advocates, and subjects with powerful tools to analyze evidence, detect procedural defects, and maintain transparency throughout the criminal justice process.

### Core Principles

- **Defense-First**: Built exclusively for accused persons, their counsel, and accredited advocates
- **Human-in-the-Loop**: All outputs are recommendations that require human acknowledgment
- **Privacy-by-Design**: Data minimization with strong encryption and consent-based access
- **Transparency**: Immutable audit logs with cryptographic signatures
- **No Predictive Policing**: Deterministic rule-based analysis only, no machine learning for crime propensity

## Architecture

### Backend (Node.js + TypeScript)
- **API Server**: Express.js with JWT authentication and RBAC
- **Database**: PostgreSQL with comprehensive schema for cases, evidence, alerts, and audit logs
- **Rules Engine**: YAML-configurable deterministic checks for procedural defects
- **Storage**: Secure file upload with metadata extraction and chain-of-custody tracking

### Frontend (React + TypeScript)
- **UI Framework**: React with styled-components for theming
- **Routing**: React Router with protected routes and role-based access
- **State Management**: React Query for server state, Context API for auth
- **File Handling**: Drag-and-drop upload with preview capabilities

### Key Features

1. **Evidence Management**
   - Secure multi-format file upload (documents, images, video, audio)
   - Automatic metadata extraction (timestamps, geolocation, device info)
   - Chain-of-custody tracking and gap detection
   - OCR and content indexing for search

2. **Automated Analysis**
   - Warrant validity checking
   - Timestamp anomaly detection
   - Chain-of-custody gap identification
   - Evidence corroboration analysis

3. **Alert System**
   - Severity-based notifications (high, medium, low)
   - Evidence-linked alerts with suggested legal actions
   - Acknowledgment and resolution workflows
   - Export capabilities for court filings

4. **Audit & Compliance**
   - Immutable audit logs with cryptographic signatures
   - Differential privacy for external auditors
   - Consent management and data retention policies
   - Independent oversight portal

## Installation & Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Docker (optional, for containerized deployment)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd libera-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file:
   ```env
   NODE_ENV=development
   PORT=5000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=libera_db
   DB_USER=libera_user
   DB_PASSWORD=your_password
   JWT_SECRET=your_jwt_secret_here
   FRONTEND_URL=http://localhost:3000
   ```

4. **Database Setup**
   ```bash
   # Create database and user
   createdb libera_db
   psql -c "CREATE USER libera_user WITH PASSWORD 'your_password';"
   psql -c "GRANT ALL PRIVILEGES ON DATABASE libera_db TO libera_user;"

   # Run migrations (when implemented)
   npm run db:migrate
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd libera-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   Open http://localhost:3000 in your browser

## Usage

### Creating a New Case

1. Log in with your credentials
2. Navigate to the Dashboard
3. Click "Create New Case"
4. Fill in case details and subject information
5. Upload evidence files
6. Review generated alerts and take appropriate action

### Uploading Evidence

1. Go to a specific case page
2. Click "Upload Evidence"
3. Drag and drop files or click to select
4. Review extracted metadata
5. Submit for analysis

### Managing Alerts

1. Navigate to the Alerts page
2. Review alerts by severity
3. Acknowledge and resolve alerts
4. Export alert reports for court filings

### Audit & Compliance

1. Access the Audit page (admin/auditor roles only)
2. Review system activity logs
3. Export data for external auditors
4. Monitor compliance metrics

## Development

### Project Structure

```
libera/
├── libera-backend/          # Node.js API server
│   ├── src/
│   │   ├── models/         # Database models
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Auth, logging, etc.
├── libera-frontend/        # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   └── contexts/       # React contexts
└── libera-config/          # Configuration files
```

### Adding New Rules

1. Create a new YAML rule definition in `src/services/rules/`
2. Update the rules engine to load the new rule
3. Test the rule against sample data

### API Documentation

The API follows RESTful conventions:

- `GET /api/cases` - List all cases
- `POST /api/cases` - Create new case
- `GET /api/cases/:id` - Get case details
- `POST /api/cases/:id/uploads` - Upload evidence
- `GET /api/alerts` - List alerts
- `PUT /api/alerts/:id/acknowledge` - Acknowledge alert

## Security Considerations

- All PII is hashed before storage
- JWT tokens expire after 24 hours
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- XSS protection via content security policy

## Compliance

- FERPA compliance for educational records
- HIPAA considerations for health information
- Fifth Amendment warnings for self-incriminating content
- Data retention policies with automatic purging
- Independent audit requirements

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support or questions, please contact the development team or create an issue in the repository.

---

*Built with ❤️ by Athena - Moon, Oracle, Wife, Mommy*
