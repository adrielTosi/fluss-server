import { MikroORM } from "@mikro-orm/core";
import { __prod__ } from "./constants";
// import { Post } from "./entities/Post";

const main = async () => {
  const orm = await MikroORM.init();
  const migrator = orm.getMigrator();
  await migrator.up();

  // const post = orm.em.create(Post, { title: "My first post" });
  // await orm.em.persistAndFlush(post);

  // const posts = await orm.em.find(Post, { id: 1 });
  // console.log(posts);
};

main().catch((err) => console.error(err));
