# Container image that runs your code
FROM node:16-bullseye-slim 

# Copies your code file from your action repository to the filesystem path `/` of the container
COPY dist /dist

RUN npm install -g @google/clasp

# Code file to execute when the docker container starts up (`entrypoint.sh`)
ENTRYPOINT ["node", "/dist/index.js"]
