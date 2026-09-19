import { PageTitle } from "@/components/admin/ui";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import { requireAdminPage } from "@/lib/auth/session.server";
import { getSiteSettings } from "@/lib/site/settings.server";

export default async function AdminSitePage() {
  await requireAdminPage();
  return (
    <div className="max-w-3xl">
      <PageTitle title="Landing page" description="Edit the public landing page copy and control who can sign up. Changes go live when you save." />
      <SiteSettingsForm settings={await getSiteSettings()} />
    </div>
  );
}
