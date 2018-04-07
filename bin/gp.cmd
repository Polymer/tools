rem GP

rem usage gp Polymer core-item [branch]
rem  Run in a clean directory passing in a GitHub org and repo name
set org=%1
set repo=%2
rem default to master when branch isn't specified
set branch=master
IF NOT [%3] == [] SET branch=%3

rem  make folder (same as input, no checking!)
call mkdir %repo%
call git clone git@github.com:%org%/%repo%.git --single-branch

rem  switch to gh-pages branch
pushd %repo%
call git checkout --orphan gh-pages

rem remove all content
call git rm -rf -q .

rem use bower to install runtime deployment
rem ensure we're getting the latest from the desired branch.
call bower cache clean %repo%
call git show %branch%:bower.json > bower.json

echo { "directory ": "components" }> .bowerrc

call bower install
call bower install %org%/%repo%#%branch%
call git checkout %branch% -- demo
call rmdir "components/%repo%/demo" /s /q
call move demo components/%repo%/

rem  redirect by default to the component folder
echo ^<META http-equiv="refresh" content="0;URL=components/%repo%/"^>>index.html

rem send it all to github
call git add -A .
call git commit -am "seed gh-pages"
call git push -u origin gh-pages --force

popd
