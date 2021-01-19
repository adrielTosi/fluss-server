import isLogged from "../middlewear/isLogged";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Post } from "../entities/Post";
import { getConnection } from "typeorm";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPost {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 80);
  }
  /**
   * @Posts
   *
   * @param limit - How many posts returned per query
   * @param {timestamp} cursor
   *
   * @returns all Posts before the date `cursor` represents
   */
  @Query(() => PaginatedPost) // todo: Review this, looks not so good being data.posts.posts...
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null // actually a date value like `1610814686802`
  ): Promise<PaginatedPost> {
    const realLimit = Math.min(50, limit) + 1;
    const realLimitPlusOne = realLimit + 1;

    const queryBuilder = getConnection()
      .getRepository(Post)
      .createQueryBuilder("p")
      .orderBy(`"createdAt"`, "DESC")
      .take(realLimitPlusOne);

    if (cursor) {
      queryBuilder.where('"createdAt" < :cursor', {
        cursor: new Date(parseInt(cursor)),
      });
    }
    const posts = await queryBuilder.getMany();

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
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
