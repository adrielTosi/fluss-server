import { MyContext } from "src/types";
import { Arg, Ctx, Mutation, Query, Resolver } from "type-graphql";
import { Post } from "../entities/Post";

@Resolver()
export class PostResolver {
  /**
   * @Posts
   */
  @Query(() => [Post])
  posts(@Ctx() context: MyContext): Promise<Post[]> {
    return context.em.find(Post, {});
  }

  /**
   * @Post
   */
  @Query(() => Post, { nullable: true })
  post(@Ctx() context: MyContext, @Arg("id") id: number): Promise<Post | null> {
    return context.em.findOne(Post, { id });
  }

  /**
   * @CreatePost
   */
  @Mutation(() => Post)
  async createPost(
    @Ctx() { em }: MyContext,
    @Arg("title") title: string
  ): Promise<Post | null> {
    const post = em.create(Post, { title });
    await em.persistAndFlush(post);
    return post;
  }

  /**
   * @UpdatePost
   */
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("title", () => String, { nullable: true }) title: string,
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    const post = await em.findOne(Post, { id });

    if (!post) {
      return null;
    }

    if (typeof title !== "undefined") {
      post.title = title;
      em.persistAndFlush(post);
    }
    return post;
  }
  /**
   * @DeletePost
   */
  @Mutation(() => Boolean)
  async deletePost(
    @Arg("id") id: number,
    @Ctx() { em }: MyContext
  ): Promise<boolean> {
    try {
      await em.nativeDelete(Post, { id });
    } catch {
      return false;
    }
    return true;
  }
}
