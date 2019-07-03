# Changelog

<!-- ## Unreleased -->
<!-- Add new, unreleased items here. -->

## v2.2.0 [10-15-2018]
- Use Github API Pagination to traverse pages

## v2.1.0 [01-10-2018]
- Made `Workspace.determineGitHubRepos()` method public.
- Fixed `excludes` pattern filtering bug.

## v2.0.0 [12-18-2017]
- [BREAKING] `Workspace.init()` options have been moved to the constructor.
- [BREAKING] `Workspace` dependency installation must be called manually via
`Workspace.installBowerDependencies()`.
- [BREAKING] `Workspace` Class is now responsible for setup & initialization only. All
post-setup operations (`pushChangesToGithub`, `commitChanges`, etc.) have been
pulled off as seperate operations.
- `run()`: New batch-running support for running commands across multiple repos.
- Updated README.


## v1.1.0 [10-16-2017]
- Add npm logic

## v1.0.2 [10-05-2017]
- Fix gitRepo.fetch() for when no branchName is given
- Fix gitRepo.getHeadSha() & add tests
- When expanding repo patterns, Filter out repos that don't match the reference branch

## v1.0.1 [10-05-2017]
- Update package.json description
- Add package.json

## v1.0.0 [10-05-2017]
- Initial Release!
