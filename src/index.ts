import express from "express";
import redis from "redis";
import session from "express-session";
import redisStore from "connect-redis";
import { MikroORM } from "@mikro-orm/core";
import { buildSchema } from "type-graphql";
import { ApolloServer } from "apollo-server-express";
import "reflect-metadata";

import { __prod__ } from "./constants";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import cors from "cors";

declare module "express-session" {
  interface Session {
    userId: number;
  }
}

const main = async () => {
  const orm = await MikroORM.init();
  const migrator = orm.getMigrator();
  await migrator.up();

  const app = express();
  app.listen(4000, () => {
    console.log("app listen on port 4000");
  });

  const RedisStore = redisStore(session);
  const redisClient = redis.createClient();

  app.use(
    session({
      name: "fluss.sid",
      store: new RedisStore({ client: redisClient, disableTouch: true }),
      secret: "Sll2o955ltoSsslOejnn4E%",
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
        httpOnly: true,
        sameSite: "lax",
        secure: __prod__,
      },
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(cors({ origin: "http://localhost:3000", credentials: true }));

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });
};

main().catch((err) => console.error(err));
