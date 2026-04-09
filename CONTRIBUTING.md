# Contributing to KPI Quest 2

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to KPI Quest 2. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## How Can I Contribute?

### Reporting Bugs

- **Search before posting** to see if the bug has already been reported.
- **Use a clear and descriptive title** for the issue.
- **Provide as much detail as possible** in the issue description. Include steps to reproduce, what you expected, what actually happened, and relevant logs or screenshots.

### Suggesting Enhancements

- **Check if it's already suggested**.
- **Describe the motivation** for the enhancement. What problem does it solve?
- **Propose a technical approach** if possible.

### Pull Requests

1. **Fork the repo** and create your branch from `main`.
2. **If you've added code** that should be tested, add tests.
3. **Ensure the test suite passes**.
4. **Update the documentation** if you've changed behavior.
5. **Issue a pull request** into the `main` branch.

## Style Guides

### Code Style

- Use **TypeScript** for all new code.
- Follow the existing **React functional component** patterns.
- Use **Tailwind CSS** for styling.
- Ensure all components are **accessible** (aria labels, keyboard navigation).
- Run `npm run lint` before committing.

### Commit Messages

- Use clear and descriptive commit messages.
- Use the imperative mood in the subject line (e.g., "Add feature X" instead of "Added feature X").

### Documentation

- Update `docs/` for any architectural changes.
- Add/update tutorials in `docs/tutorials/` for user-facing changes.

## Development Environment

### Local Setup

Follow the instructions in the [README](README.md) to set up your local environment.

### Firebase Emulators

If you're working on database or auth changes, it's recommended to use the Firebase Emulators:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Start emulators: `firebase emulators:start`
3. Set `NEXT_PUBLIC_USE_EMULATORS=true` in `.env.local`.

## Questions?

If you have any questions, please open an issue or contact the project maintainers.
