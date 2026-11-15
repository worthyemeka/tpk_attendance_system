import { FriendshipGifts } from "@/components/friendship-gifts";
import { pageMetadata } from "@/lib/seo";

export const metadata=pageMetadata("/account/friendship");
export default function FriendshipPage(){return <FriendshipGifts/>;}
