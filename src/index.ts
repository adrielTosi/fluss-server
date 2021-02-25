import "reflect-metadata";
import express from "express";
import Redis from "ioredis";
import session from "express-session";
import redisStore from "connect-redis";
import { buildSchema } from "type-graphql";
import { ApolloServer } from "apollo-server-express";
import path from "path";
import dotenv from "dotenv";

import { __prod__ } from "./constants";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import cors from "cors";

import { createConnection } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import { Fame } from "./entities/Fame";
import { Planet } from "./entities/Planet";
import { Profile } from "./entities/Profile";
import { ProfileResolver } from "./resolvers/profile";

declare module "express-session" {
  interface Session {
    userId: number;
  }
}

const main = async () => {
  // const conn = await createConnection({
  dotenv.config();
  const typeOrmConn = await createConnection({
    type: "postgres",
    database: process.env.DATABASE_NAME,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    logging: true,
    synchronize: true,
    migrations: [path.join(__dirname, "/migrations/*")],
    entities: [Post, User, Fame, Planet, Profile],
  });

  await typeOrmConn.runMigrations();

  // await Fame.delete({});
  // await Post.delete({});
  // await Profile.delete({});
  // await User.delete({});

  const app = express();

  const RedisStore = redisStore(session);
  const redis = new Redis();

  app.use(
    session({
      name: process.env.COOKIE_NAME,
      store: new RedisStore({ client: redis as any, disableTouch: true }), // I had to add this `as any` because the types were incompatible https://github.com/tj/connect-redis/issues/300
      secret: process.env.SESSION_SECRET!,
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

  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver, ProfileResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ req, res, redis }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log("app listen on port: ", port);
  });
};

main().catch((err) => console.error(err));
