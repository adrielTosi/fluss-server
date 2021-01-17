import isLogged from "../middlewear/isLogged";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@Resolver()
export class PostResolver {
  /**
   * @Posts
   */
  @Query(() => [Post])
  posts(): Promise<Post[]> {
    return Post.find();
  }

  /**
   * @Post
   */
  @Query(() => Post, { nullable: true })
  post(@Arg("id") id: number): Promise<Post | undefined> {
    return Post.findOne({ id });
  }

  /**
   * @CreatePost
   */
  @Mutation(() => Post)
  @UseMiddleware(isLogged)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    return Post.create({
      ...input,
      ownerId: req.session.userId,
    }).save();
  }

  /**
   * @UpdatePost
   */
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg("title", () => String, { nullable: true }) title: string,
    @Arg("id") id: number
  ): Promise<Post | undefined> {
    const post = await Post.findOne(id);

    if (!post) {
      return undefined;
    }

    if (typeof title !== "undefined") {
      Post.update({ id }, { title });
    }
    return post;
  }
  /**
   * @DeletePost
   */
  @Mutation(() => Boolean)
  async deletePost(@Arg("id") id: number): Promise<boolean> {
    try {
      Post.delete(id);
    } catch {
      return false;
    }
    return true;
  }
}
