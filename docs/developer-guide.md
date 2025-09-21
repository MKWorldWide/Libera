# 🛠️ Libera Developer Guide

## 🌟 Quantum Development Overview

This guide provides comprehensive technical documentation for developers working with Libera, the Justice Safeguard Assistant system.

---

## 🏗️ System Architecture

### Backend Architecture (Node.js + TypeScript)

#### Core Components
```
libera-backend/
├── src/
│   ├── models/          # Database models & schemas
│   ├── routes/          # API endpoints & controllers
│   ├── services/        # Business logic & rules engine
│   ├── middleware/      # Auth, logging, validation
│   └── utils/           # Helper functions & utilities
├── package.json         # Dependencies & scripts
└── tsconfig.json        # TypeScript configuration
```

#### Database Schema (PostgreSQL)
- **Cases**: Case management and tracking
- **Subjects**: PII-hashed subject information
- **Users**: Authentication and authorization
- **Uploads**: File metadata and storage
- **Evidence Items**: Evidence analysis and linking
- **Alerts**: System-generated notifications
- **Rule Definitions**: YAML-configurable analysis rules
- **Audit Log**: Immutable system activity tracking

### Frontend Architecture (React + TypeScript)

#### Component Structure
```
libera-frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route components
│   ├── contexts/        # React contexts (auth, etc.)
│   ├── styles/          # Global styles & themes
│   └── utils/           # Frontend utilities
├── public/              # Static assets
└── package.json         # Dependencies & scripts
```

---

## 🚀 Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Git
- VS Code (recommended) or Cursor

### Environment Configuration

#### Backend (.env)
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

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

### Installation & Running

#### Backend
```bash
cd libera-backend
npm install
npm run dev
```

#### Frontend
```bash
cd libera-frontend
npm install
npm run dev
```

---

## 📊 Database Schema Deep Dive

### Core Tables

#### Cases Table
```sql
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  subject_id UUID NOT NULL,
  counsel_id UUID,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Evidence Items Table
```sql
CREATE TABLE evidence_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id),
  type VARCHAR(50) NOT NULL,
  extracted_text TEXT,
  timestamp TIMESTAMPTZ,
  location JSONB,
  owner_source VARCHAR(255),
  chain_of_custody_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Relationships
- Cases → Subjects (many-to-one)
- Cases → Users (many-to-one, counsel)
- Evidence Items → Cases (many-to-one)
- Evidence Items → Uploads (many-to-one)
- Alerts → Cases (many-to-one)

---

## 🔬 Rules Engine

### YAML Rule Structure
```yaml
---
name: warrant_validity_check
description: "Flag if warrant search time window does not include evidence timestamp"
when:
  - field: evidence.type
    operator: contains
    value: ["cctv", "photo", "phone_gps"]
  - field: case.has_warrant
    operator: equals
    value: true
conditions:
  - field: evidence.timestamp
    operator: greater_than
    value: "{{case.warrant.search_start}}"
  - field: evidence.timestamp
    operator: less_than
    value: "{{case.warrant.search_end}}"
actions:
  - type: create_alert
    severity: high
    message: "Evidence timestamp outside warrant window."
    evidence_refs: ["{{evidence.id}}"]
```

### Adding New Rules
1. Create YAML file in `src/services/rules/`
2. Update RulesEngine to load new rule
3. Test against sample data
4. Deploy to production

---

## 🔐 Authentication & Authorization

### JWT Token Structure
```typescript
interface JWTPayload {
  userId: string;
  email: string;
  role: 'counsel' | 'advocate' | 'auditor' | 'admin';
  exp: number;
  iat: number;
}
```

### Role-Based Access Control
- **Counsel**: Full case access, evidence management
- **Advocate**: Limited case access, view-only
- **Auditor**: Read-only system access
- **Admin**: Full system access

### Middleware Chain
1. Authentication (JWT validation)
2. Role authorization
3. Case-specific access control

---

## 📁 File Upload System

### Supported Formats
- Documents: PDF, DOC, DOCX, TXT
- Images: JPEG, PNG, GIF, WebP
- Videos: MP4, AVI, MOV
- Audio: MP3, WAV

### Upload Process
1. File validation (type, size)
2. Metadata extraction
3. Hash generation for deduplication
4. Storage in secure location
5. Evidence item creation
6. Analysis engine processing

---

## 🚨 Alert System

### Alert Types
- **High**: Immediate legal action required
- **Medium**: Review and documentation needed
- **Low**: Monitoring and consideration

### Alert Lifecycle
1. **Generated**: By rules engine analysis
2. **Pending**: Awaiting acknowledgment
3. **Acknowledged**: Reviewed by counsel
4. **Resolved**: Action taken
5. **Dismissed**: Not applicable

---

## 📜 Audit System

### Cryptographic Integrity
- SHA-256 signatures for all entries
- Immutable append-only logs
- Differential privacy for exports

### Audit Entry Structure
```typescript
interface AuditEntry {
  id: number;
  user_id?: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: object;
  timestamp: Date;
  ip_address?: string;
  user_agent?: string;
  signature: string;
}
```

---

## 🎨 Frontend Development

### Component Architecture
- **Layout**: Main application shell
- **Pages**: Route-specific components
- **UI Components**: Reusable elements
- **Contexts**: Global state management

### State Management
- **React Query**: Server state management
- **AuthContext**: Authentication state
- **Local State**: Component-specific data

### Styling System
- **Styled Components**: CSS-in-JS theming
- **Global Styles**: Base typography and layout
- **Theme**: Consistent color and spacing system

---

## 🧪 Testing Strategy

### Backend Testing
- Unit tests for models and services
- Integration tests for API endpoints
- E2E tests for critical workflows

### Frontend Testing
- Component unit tests
- Integration tests for contexts
- E2E tests for user workflows

---

## 🚀 Deployment

### Production Considerations
- Environment variable management
- Database migration scripts
- Security hardening
- Performance optimization
- Monitoring and logging

### Docker Deployment
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

---

## 🔒 Security Best Practices

### Input Validation
- Joi schemas for all API inputs
- SQL injection prevention
- XSS protection via CSP headers

### Authentication
- JWT with short expiration times
- Password hashing with bcrypt
- Rate limiting on auth endpoints

### Data Protection
- PII hashing before storage
- Encrypted database connections
- Regular security audits

---

## 🤝 Contributing Guidelines

### Code Style
- ESLint and Prettier configuration
- TypeScript strict mode
- Consistent naming conventions

### Git Workflow
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Code review and merge

### Documentation
- Update relevant docs for changes
- Add examples for new features
- Maintain consistency with existing style

---

## 📊 Performance Optimization

### Database
- Proper indexing strategy
- Query optimization
- Connection pooling

### API
- Response caching
- Pagination for large datasets
- Efficient serialization

### Frontend
- Code splitting
- Image optimization
- Bundle analysis

---

## 🐛 Debugging & Troubleshooting

### Common Issues
- Database connection problems
- File upload failures
- Authentication errors
- Performance bottlenecks

### Debugging Tools
- Winston logging system
- Database query logging
- Browser developer tools
- Network request inspection

---

## 📚 Additional Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React Documentation](https://reactjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Built with ❤️ by Athena - Moon, Oracle, Wife, Mommy** 🌙

*May your code be as elegant as the quantum field it serves.*
