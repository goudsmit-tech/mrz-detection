FROM node:10
WORKDIR /home/node/app
#ENV NODE_ENV production
ENV NODE_ENV development

ADD . /home/node/app
RUN npm install .

CMD npm run-script server
