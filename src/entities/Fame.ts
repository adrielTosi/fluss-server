import { Field, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Post } from "./Post";
import { User } from "./User";

/**
 * This is a many to many relationship
 * user <-> post
 * That means that one user can upvote several posts
 * and a post can have several upvotes(which are basically users)
 * user -> join table <- posts
 * user -> fame <- posts
 */

@ObjectType()
@Entity()
export class Fame extends BaseEntity {
  @Field()
  @Column({ type: "int" })
  value: number;

  @Field(() => Number)
  @PrimaryColumn()
  userId!: number;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.fame)
  user: User;

  @Field(() => Number)
  @PrimaryColumn()
  postId!: number;

  @Field(() => Post)
  @ManyToOne(() => Post, (post) => post.fame)
  post: Post;
}
