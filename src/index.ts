import { MikroORM } from "@mikro-orm/core";
import express from "express";
import { buildSchema } from "type-graphql";
import { ApolloServer } from "apollo-server-express";
import "reflect-metadata";

import { __prod__ } from "./constants";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";

const main = async () => {
  const orm = await MikroORM.init();
  const migrator = orm.getMigrator();
  await migrator.up();

  const app = express();
  app.listen(4000, () => {
    console.log("app listen on port 4000");
  });

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver],
      validate: false,
    }),
    context: () => ({ em: orm.em }),
  });

  apolloServer.applyMiddleware({ app });
};

main().catch((err) => console.error(err));
