# Changelog

## 0.1.0 (2025-10-19)


### ⚠ BREAKING CHANGES

* Task execution now uses FoundryVTT macros instead of direct JavaScript strings

### Features

* initial Task & Trigger module implementation ([4171962](https://github.com/rayners/fvtt-task-and-trigger/commit/417196203e02e46d2f54a96b6cf336f2ce50d333))
* macro-based task execution system ([#4](https://github.com/rayners/fvtt-task-and-trigger/issues/4)) ([5d0445f](https://github.com/rayners/fvtt-task-and-trigger/commit/5d0445f322ac02e493d34b1b1a4c3f75b2a238fe))
* setup release-please automation ([19746e1](https://github.com/rayners/fvtt-task-and-trigger/commit/19746e19ca35eff4e661e1e3c11f5d18a67ffbbd))


### Bug Fixes

* resolve CI failures ([403029b](https://github.com/rayners/fvtt-task-and-trigger/commit/403029b96b7dfef29dfdde8528833127f7421b84))


### Miscellaneous Chores

* prepare for initial 0.1.0 release ([30d2d84](https://github.com/rayners/fvtt-task-and-trigger/commit/30d2d8477e7667380c5847465cb77701e97c17ac))

## [0.1.0] - 2025-08-14

### Features

- Initial Task & Trigger module implementation
- Task scheduling with real time and game time support
- Calendar integration with Seasons & Stars (basic implementation)
- Task Manager UI for creating and managing tasks
- Date prefilling from calendar selection with S&S formatting
- Test suite with 285 passing tests (87% pass rate, ongoing development)

### Documentation

- API documentation and usage examples
- Development setup and contributing guidelines

### Build System

- GitHub Actions CI/CD pipeline with automated releases
- TypeScript build system with foundry-dev-tools
- Initial testing and code quality infrastructure
