## [0.2.0] - 2026-04-06

> **@kb-labs/commit-plugin** 0.1.0 → 0.2.0 (minor: new features)

### ✨ New Features

- **commit-cli**: Updates commands, manifest, tests, and lockfile to ensure smoother operation and improved reliability for users.
- **general**: Revamps commit plugin pages using SDK hooks and UIKit, enhancing the user experience with a more modern interface.
- **general**: Introduces the commit-pages MF remote, which allows users to pilot the Studio V2 plugin page for better functionality.
- **general**: Adds a helper function to summarize policy violations, enabling users to easily understand and address compliance issues.
- **cli**: Introduces a regenerate handler that simplifies the process of regenerating plans, saving users time and effort.
- **cli**: Adds a patch plan handler that allows users to apply necessary updates seamlessly, improving overall workflow efficiency.
- **commit-cli**: Implements a new git-status handler that delivers more accurate status reports, helping users stay informed about their project status.
- **rest**: Introduces a new scope resolver and handler, which enhances the flexibility and power of API requests for users.
- **cli**: Implements diff and summarize handlers to provide users with clearer insights into changes and summaries of their work.
- **contracts**: Adds new events and routes to commit-contracts, offering users more ways to interact with contracts and track changes.
- **cli**: Introduces a new files handler and workspace resolver, allowing users to manage their files and workspaces more effectively.
- **api**: Implements new REST API handlers that broaden the capabilities of the API, giving users more tools for integration.
- **docs**: Adds architectural decision records to provide users with insights into design choices and reasoning behind features.
- **storage**: Introduces plan storage and history management, enabling users to easily track and manage their project plans over time.
- **core**: Adds core functionalities to the commit, enhancing the foundational features that users rely on for their projects.
- **contracts**: Introduces commit contracts and types, providing users with clearer definitions and structures for their commitments.
- **cli**: Adds new commit-cli commands and setup to streamline user interactions and simplify command execution.
- **cli**: Enhances command output by adding an empty line, improving readability and user experience during command execution.
- **cli**: Integrates the chalk dependency into commit-cli, allowing for improved output formatting and better visual clarity.
- **cli**: Enhances the formatting of output for applied commits, helping users understand the results of their actions more clearly.

### 🐛 Bug Fixes

- **commit-cli**: Removed outdated test files to streamline the codebase, reducing potential confusion and improving overall code quality.  
- **benchmarks**: Updated benchmark results to provide users with the most accurate performance metrics, ensuring informed decision-making based on the latest data.  
- **cli**: Corrected the color reference in the run command, enhancing visual clarity and user experience when executing commands.  
- **cli**: Improved output formatting in the run command to make results easier to read and understand, leading to a smoother user interaction.  
- **commit-core**: Reset the staging area before each commit in apply, ensuring that users have a clean slate for their changes, which minimizes errors and improves the reliability of the commit process.
