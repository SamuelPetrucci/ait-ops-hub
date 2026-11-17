import { redirect } from "next/navigation";

export default function FollowUpsRedirect() {
  redirect("/crm?followUp=due");
}
