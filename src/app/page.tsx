import { redirect } from "next/navigation";

// Quick Templates is the main page — the advanced editor lives at /editor.
export default function Home() {
  redirect("/simple");
}
