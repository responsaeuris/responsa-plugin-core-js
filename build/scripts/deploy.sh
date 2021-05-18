#!/bin/bash
set -e # stops on first error

if [[ "${GIT_BRANCH}" == "develop" || "${GIT_BRANCH}" == "master" ]] 
then
    echo "" && echo "***********************************************************" && /_/build/scripts/print-step.sh "PUBLISH TO GITHUB REPO"

    cd /
    git clone --branch $GIT_BRANCH https://$GIT_USERNAME:$GIT_PASSWORD@$GIT_REPO public-repo
    cd /public-repo
    git checkout $GIT_BRANCH

    echo "Add GitHub repo as local repo remote"
    git remote add -t $GIT_BRANCH secondary https://$PUBLIC_GIT_USERNAME:$PUBLIC_GIT_PASSWORD@$PUBLIC_GIT_REPO

    echo "Setting public repo commit infos"
    git config --global user.email "$PUBLIC_GIT_USER_EMAIL"
    git config --global user.name "$PUBLIC_GIT_USERNAME"

    echo "Updating status route"
    /_/build/scripts/pre-build.sh
    cp /_/app/routes/status/statusRoute.js /public-repo/app/routes/status/statusRoute.js

    echo "Committing to public repo"
    git add app/routes/status/statusRoute.js
    git commit -m "$LAST_COMMIT CI fingerprint"

    echo "Pushing to GitHub"
    git push --mirror secondary

    echo "done"

    cd /_
fi