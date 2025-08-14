# Contributing to Task & Trigger

Thank you for your interest in contributing to Task & Trigger! This document provides guidelines and information for contributors.

## Getting Started

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/fvtt-task-and-trigger.git
   cd fvtt-task-and-trigger
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Tests**
   ```bash
   npm test
   ```

4. **Build the Module**
   ```bash
   npm run build
   ```

### Development Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow the coding standards below
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm run validate  # Runs linting, formatting, type checking, tests, and build
   ```

4. **Commit Your Changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### Code Style

- **TypeScript**: Use strict TypeScript with proper typing
- **Formatting**: Run `npm run format` before committing
- **Linting**: Ensure `npm run lint` passes
- **Naming**: Use descriptive names for variables, functions, and classes

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or updates
- `chore:` Maintenance tasks

Example:
```
feat: add calendar integration for task scheduling

- Implements right-click calendar interaction
- Adds date prefilling from Seasons & Stars
- Supports non-Gregorian calendar systems

Closes #123
```

### Testing

- **Unit Tests**: Write tests for all new functionality
- **Coverage**: Maintain test coverage above 80%
- **Integration Tests**: Test Foundry API interactions where possible
- **Test Naming**: Use descriptive test names that explain the behavior

### Documentation

- **Code Comments**: Comment complex logic and public APIs
- **API Documentation**: Update API.md for public API changes
- **README**: Update usage examples when adding features
- **Type Definitions**: Ensure all public interfaces are properly typed

## Architecture Guidelines

### Core Principles

1. **Foundry Integration**: Follow Foundry's patterns and conventions
2. **System Agnostic**: Work with multiple game systems
3. **Error Handling**: Graceful degradation when dependencies are missing
4. **Performance**: Minimize impact on Foundry's performance

### Module Structure

```
src/
├── main.ts              # Module entry point
├── api.ts               # Public API surface
├── task-scheduler.ts    # Core scheduling logic
├── task-manager.ts      # Task management
├── calendar-integration.ts # S&S calendar integration
├── types.ts             # TypeScript definitions
└── ...
```

### Key Guidelines

- **Single Responsibility**: Each class/module has one clear purpose
- **Dependency Injection**: Use the singleton pattern for shared services
- **Event Driven**: Use Foundry's Hook system for module communication
- **Graceful Failures**: Handle missing dependencies gracefully

## Contribution Types

### Bug Fixes

1. **Reproduce the Issue**: Ensure you can reproduce the reported bug
2. **Write a Test**: Add a failing test that demonstrates the bug
3. **Fix the Bug**: Implement the minimal fix required
4. **Verify the Fix**: Ensure the test passes and no regressions occur

### New Features

1. **Discuss First**: Open an issue to discuss the feature before implementing
2. **Design API**: Consider the public API and how it fits with existing code
3. **Implement**: Follow TDD principles where possible
4. **Document**: Update relevant documentation and examples

### Documentation

- Fix typos and improve clarity
- Add examples and use cases
- Update API documentation for changes
- Improve setup and installation instructions

## Review Process

### Pull Request Guidelines

- **Small PRs**: Keep changes focused and reviewable
- **Clear Description**: Explain what, why, and how
- **Tests Included**: All new code should be tested
- **No Breaking Changes**: Avoid breaking changes without discussion

### Review Criteria

- **Code Quality**: Clean, readable, and maintainable code
- **Test Coverage**: Adequate test coverage for changes
- **Performance**: No significant performance regressions
- **Documentation**: Appropriate documentation updates
- **Foundry Compatibility**: Works with supported Foundry versions

## Getting Help

- **Discord**: Join the FoundryVTT Discord for general questions
- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Use GitHub discussions for general questions

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers learn and contribute
- Follow the [Contributor Covenant](https://www.contributor-covenant.org/)

## License

By contributing to Task & Trigger, you agree that your contributions will be licensed under the MIT License.