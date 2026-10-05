"use client";
import {NotificationsInbox} from "@/components/notifications-inbox";
import {useSundayContext} from "@/lib/sunday-context";
export default function NotificationsPage(){
  const sunday=useSundayContext();
  return <NotificationsInbox serviceSessionId={sunday.selectedServiceSessionId||undefined}/>;
}
