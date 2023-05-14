# Container image that runs your code
FROM node:16-bullseye-slim 

RUN npm install -g @google/clasp

# Copies your code file from your action repository to the filesystem path `/` of the container
COPY dist /dist

# Code file to execute when the docker container starts up (`entrypoint.sh`)
ENTRYPOINT ["node", "/dist/index.js"]
