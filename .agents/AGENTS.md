# Rules for CaltDHy Workspace

## Git & GitHub Integration
- **GitHub Push on Task Completion**: Whenever you finish modifying the codebase as requested by the user, and once the user explicitly CONFIRMS COMPLETION (e.g., "hoàn thành", "xong rồi", "đã chạy tốt"), you must propose or perform a Git push to GitHub.
- **Push Workflow**:
  1. Stage all changes (`git add .`) and commit them with a descriptive message in Vietnamese or English.
  2. Push the current active branch to the remote repository.
  3. Ask the user if they want to merge the changes into `main` and push the updated `main` branch to GitHub as well, then perform it if confirmed.
