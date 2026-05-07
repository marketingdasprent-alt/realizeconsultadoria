import MarketingEmailTab from "@/components/admin/MarketingEmailTab";

const MarketingPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Marketing</h1>
        <p className="text-muted-foreground mt-1">
          Gestão de comunicações internas e marketing
        </p>
      </div>

      <MarketingEmailTab />
    </div>
  );
};

export default MarketingPage;
