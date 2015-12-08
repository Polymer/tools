# How To Enable Travis for your element

## Requirements
- Repository is public
- For "with sauce" instructions, `travis` is installed
  - `gem install travis`, requires ruby

## Instructions
### Enable Travis
1. Log into [travis](https://travis-ci.org) with your github account
1. Navigate to your [profile page](https://travis-ci.org/profile)
1. Click the organization of the repo, and toggle the switch to enable travis the repo.
1. If you have a [Sauce Labs](https://saucelabs.com) Account, follow the "with
   sauce" instructions.
1. Otherwise follow the "without sauce" instructions.

### WCT without Sauce
1. Copy `sample_travis_without_sauce.yml` to your repo as `.travis.yml`
1. Commit and push `.travis.yml`
1. You're done!

### WCT with Sauce
1. Copy `sample_travis_with_sauce.yml` to your repo as `.travis.yml`
1. Install the travis command line module (if you haven't already)
  - `gem install travis`
1. Add the saucelabs enviroment variables using the travis gem
  - `travis encrypt SAUCE_USERNAME=your username --add`
  - `travis encrypt SAUCE_ACCESS_KEY=your access key --add`
1. Commit and push `.travis.yml`
1. You're done!
