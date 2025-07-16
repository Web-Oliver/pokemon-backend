# Pokemon Collection Backend - Project Overview

## Purpose
This is a Node.js backend API for managing a Pokemon card collection. It provides endpoints for managing:
- Pokemon cards (raw cards, PSA graded cards)
- Sealed products (booster packs, boxes)
- Sets and card information
- Sales tracking and analytics
- External listing generation (Facebook, DBA)
- Auctions management

## Tech Stack
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Testing**: Mocha, Chai, Supertest, MongoDB Memory Server
- **Development**: ESLint for linting, NYC for test coverage
- **Authentication**: No authentication layer currently implemented

## Architecture
- RESTful API design
- Controller-based architecture
- Model-View-Controller pattern
- Middleware for error handling
- Test-driven development with comprehensive integration tests