import "reflect-metadata";
import express from "express";
import Redis from "ioredis";
import session from "express-session";
import redisStore from "connect-redis";
import { buildSchema } from "type-graphql";
import { ApolloServer } from "apollo-server-express";
import path from "path";

import { COOKIE_NAME, __prod__ } from "./constants";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import cors from "cors";

import { createConnection } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";

declare module "express-session" {
  interface Session {
    userId: number;
  }
}

const main = async () => {
  // const conn = await createConnection({
  const typeOrmConn = await createConnection({
    type: "postgres",
    database: "flussdb",
    username: "postgres",
    password: "postgress",
    logging: true,
    synchronize: true,
    migrations: [path.join(__dirname, "/migrations/*")],
    entities: [Post, User],
  });

  await typeOrmConn.runMigrations();

  // await Post.delete({});

  const app = express();
  app.listen(4000, () => {
    console.log("app listen on port 4000");
  });

  const RedisStore = redisStore(session);
  const redis = new Redis();

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis as any, disableTouch: true }), // I had to add this `as any` because the types were incompatible https://github.com/tj/connect-redis/issues/300
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
    context: ({ req, res }): MyContext => ({ req, res, redis }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });
};

main().catch((err) => console.error(err));
