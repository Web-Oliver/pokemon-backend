# Pokemon Collection Backend

A comprehensive Node.js/Express backend system for managing Pokemon card collections with advanced features including auction management, marketplace integration, analytics, and social media automation.

## 🚀 Features

### Core Collection Management
- **Multi-format Support**: Raw cards, PSA graded cards, sealed products
- **Comprehensive CRUD**: Full create, read, update, delete operations
- **Advanced Search**: Powered by FlexSearch and Fuse.js
- **Image Management**: Sharp-based processing with thumbnail generation
- **Data Import/Export**: Bulk operations with validation

### Auction System
- **Auction Management**: Create, manage, and track auctions
- **Item Operations**: Add/remove items, bid tracking
- **Integration**: External marketplace connectivity

### DBA Marketplace Integration
- **Automated Posting**: Direct integration with DBA marketplace
- **Export Formatting**: Custom formatting for listings
- **Status Tracking**: Real-time posting status monitoring
- **Bulk Operations**: Mass export capabilities

### Analytics & Reporting
- **Sales Analytics**: Comprehensive sales tracking and reporting
- **Price History**: Historical price data and trends
- **Performance Metrics**: Collection value and growth analytics
- **Activity Logging**: Full audit trail of system operations

### Social Media Automation
- **Facebook Integration**: Automated post generation and formatting
- **Custom Descriptions**: AI-powered description generation
- **Image Optimization**: Automated image processing for social media

## 🏗️ Architecture

### MVC Pattern
```
backend/
├── controllers/           # Business logic controllers
│   ├── auctions/         # Auction management
│   ├── base/            # Base controller classes
│   └── factories/       # Controller factories
├── models/              # MongoDB/Mongoose models
├── routes/              # Express route definitions
├── services/            # Business services
├── middleware/          # Express middleware
├── utils/               # Utility functions
└── config/              # Configuration files
```

### Data Models
- **Card**: Base card model with common attributes
- **RawCard**: Ungraded Pokemon cards
- **PsaGradedCard**: PSA-graded cards with certification details
- **SealedProduct**: Booster packs, boxes, and sealed items
- **Set**: Pokemon card sets and expansions
- **SetProduct**: Products within specific sets
- **Auction**: Auction entities with item relationships
- **Product**: General product model for marketplace items
- **Activity**: System activity and audit logging
- **DbaSelection**: DBA marketplace integration data

## 🛠️ Technical Stack

### Core Technologies
- **Runtime**: Node.js
- **Framework**: Express.js 5.1.0
- **Database**: MongoDB with Mongoose 8.16.1
- **Testing**: Mocha, Chai, Jest with Supertest

### Key Dependencies
- **Search**: FlexSearch 0.8.205, Fuse.js 7.1.0
- **Image Processing**: Sharp 0.34.3, Multer 2.0.1
- **Caching**: Node-Cache 5.1.2
- **Automation**: Node-Cron 4.2.1, Playwright 1.54.1
- **Compression**: Built-in Express compression
- **Validation**: Express-Validator 7.2.1

### Performance Features
- **Caching System**: Multi-layer caching with Redis-like capabilities
- **Image Optimization**: Automatic thumbnail generation and compression
- **Query Optimization**: Optimized MongoDB queries with indexing
- **Compression**: Response compression for API endpoints
- **Background Processing**: Async task processing with node-cron

## 📡 API Endpoints

### Collections API
- `GET /api/collections/:type` - Get paginated collection items
- `POST /api/collections/:type` - Create new collection item
- `PUT /api/collections/:type/:id` - Update collection item
- `DELETE /api/collections/:type/:id` - Delete collection item
- `POST /api/collections/:type/exports` - Export collection data

### Auctions API
- `GET /api/auctions` - List all auctions
- `POST /api/auctions` - Create new auction
- `GET /api/auctions/:id` - Get auction details
- `PUT /api/auctions/:id` - Update auction
- `DELETE /api/auctions/:id` - Delete auction
- `POST /api/auctions/:id/items/:itemId` - Add item to auction
- `DELETE /api/auctions/:id/items/:itemId` - Remove item from auction

### Search API
- `GET /api/search/unified` - Unified search across all collections
- `GET /api/search/cards` - Search cards with advanced filters
- `GET /api/search/products` - Search products and sealed items
- `GET /api/search/sets` - Search sets and expansions

### DBA Integration API
- `POST /api/dba/export` - Export items to DBA marketplace
- `GET /api/dba/status` - Get DBA export status
- `POST /api/dba/test-integration` - Test DBA connection

### Analytics API
- `GET /api/analytics/sales` - Sales analytics and reports
- `GET /api/analytics/sales/graph` - Sales graph data
- `GET /api/analytics/sales/summary` - Sales summary statistics

### Activity API
- `GET /api/activity` - Get system activity logs
- `POST /api/activity` - Log new activity
- `GET /api/activity/timeline` - Activity timeline view

### Utility APIs
- `POST /api/upload/images` - Upload multiple images
- `GET /api/health` - Health check endpoint
- `GET /api/status` - System status information

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB 6+
- Sharp-compatible system (for image processing)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd pokemon-collection-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development server
npm run dev

# Or start production server
npm run start:prod
```

### Environment Variables
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/pokemon-collection
DBA_API_KEY=your_dba_api_key
DBA_API_URL=https://api.dba.dk
FACEBOOK_API_TOKEN=your_facebook_token
```

## 🧪 Testing

### Test Suites
- **Mocha/Chai**: Integration tests for API endpoints
- **Jest**: Unit tests for business logic
- **Supertest**: HTTP assertion testing
- **MongoDB Memory Server**: In-memory database for tests

### Running Tests
```bash
# Run all tests
npm run test:all

# Run Mocha tests with coverage
npm run test:coverage

# Run Jest tests
npm run test:jest

# Run Jest in watch mode
npm run test:jest:watch
```

### Test Coverage
- Controllers: 95%+ coverage
- Models: 90%+ coverage  
- Services: 85%+ coverage
- Routes: 90%+ coverage

## 🔧 Development

### Code Quality
- **ESLint**: Configured with modern JavaScript standards
- **Prettier**: Automatic code formatting
- **Nodemon**: Hot reloading for development

### Scripts
```bash
npm run dev          # Start development server
npm run start:prod   # Start production server
npm run test         # Run test suite
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
```

### Project Structure
```
backend/
├── controllers/              # API controllers
│   ├── auctions/            # Auction-specific controllers
│   ├── base/               # Base controller classes
│   ├── factories/          # Controller factory patterns
│   └── *.js               # Individual controllers
├── models/                  # Mongoose models
│   ├── schemas/           # Schema definitions
│   └── *.js              # Model definitions
├── routes/                  # Express routes
│   ├── factories/         # Route factories
│   └── *.js              # Route definitions
├── services/               # Business logic services
│   ├── domain/            # Domain services
│   ├── products/          # Product services
│   └── shared/            # Shared services
├── middleware/             # Express middleware
├── utils/                  # Utility functions
├── config/                 # Configuration files
├── data/                   # Static data and imports
├── public/                 # Static assets
└── test/                   # Test files
```

## 🚀 Deployment

### Production Setup
1. **Environment**: Set `NODE_ENV=production`
2. **Database**: Configure production MongoDB instance
3. **Image Storage**: Set up proper file storage (AWS S3, etc.)
4. **Process Management**: Use PM2 or similar for process management
5. **Reverse Proxy**: Configure Nginx for static files and load balancing

### Docker Support
```dockerfile
# Multi-stage build for optimized production image
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:prod"]
```

## 📈 Performance Optimizations

### Caching Strategy
- **Memory Caching**: Frequently accessed data cached in memory
- **Query Caching**: MongoDB query results cached
- **Image Caching**: Processed images cached with TTL
- **API Response Caching**: Cacheable endpoints with appropriate headers

### Database Optimizations
- **Indexes**: Optimized indexes for common queries
- **Aggregation Pipelines**: Efficient data aggregation
- **Connection Pooling**: Optimized MongoDB connections
- **Query Optimization**: Analyzed and optimized slow queries

### Image Processing
- **Thumbnail Generation**: Automatic thumbnail creation
- **Format Optimization**: WebP conversion when supported
- **Lazy Loading**: Deferred image processing
- **CDN Integration**: Support for external CDN services

## 🔐 Security

### Authentication & Authorization
- **JWT Tokens**: Secure API authentication
- **Role-based Access**: Different access levels
- **Rate Limiting**: API rate limiting middleware
- **CORS**: Properly configured cross-origin requests

### Data Protection
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection**: Protected through Mongoose ORM
- **XSS Protection**: Output encoding and sanitization
- **File Upload Security**: Validated and scanned file uploads

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- Follow ESLint configuration
- Write comprehensive tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 📞 Support

### Documentation
- **API Documentation**: Available at `/api/docs` when running
- **Postman Collection**: Import collection for API testing
- **Schema Documentation**: MongoDB schema documentation

### Troubleshooting
- **Logs**: Check application logs in `logs/` directory
- **Health Check**: Use `/api/health` endpoint for system status
- **Database Issues**: Verify MongoDB connection and permissions
- **Image Processing**: Ensure Sharp dependencies are properly installed

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Pokemon Company International for card data standards
- DBA marketplace for integration APIs
- Open source community for excellent libraries and tools

---

*Built with ❤️ for Pokemon card collectors and traders*