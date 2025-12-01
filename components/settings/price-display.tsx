import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WaveSpeedModel } from "@/app/(authenticated)/settings/models/page";

// Helper to interpret the raw formula string into human readable pricing
export function PriceDisplay({ model }: { model: WaveSpeedModel }) {
  const { base_price, formula, type } = model;
  
  // Base price seems to be in micro-dollars or specific credits. 
  // Let's assume 1 unit displayed = 1/1,000,000 of the raw value if it's huge, or just display raw if unclear.
  // Actually, usually in these systems, 1 credit = $0.01 or similar.
  // Let's stick to displaying the "Base Price" formatted nicely.
  // If base_price is 560000, it might be $0.56? Let's assume raw units for now.
  
  const formattedBase = (base_price / 1000000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  let pricingText = `${formattedBase} / run`;
  let details = [];

  if (type.includes('video')) {
    // Kling formula: duration / 5 * base
    if (formula.includes('duration') && formula.includes('/ 5')) {
      pricingText = `${formattedBase} / 5s video`;
      details.push({ label: '5s Generation', price: formattedBase });
      details.push({ label: '10s Generation', price: ((base_price * 2) / 1000000).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) });
    }
  } else if (type.includes('image')) {
    // Google formula often checks resolution
    if (formula.includes('resolution') && formula.includes('4k')) {
       pricingText = `${formattedBase} / standard image`;
       details.push({ label: 'Standard', price: formattedBase });
       // Check multiplier for 4k (often around 1.7 or 1.2)
       // We can't parse the formula perfectly safely without an eval, so let's approximate based on text
       if (formula.includes('1.7') || formula.includes('12/7')) {
         const highResPrice = ((base_price * 1.71) / 1000000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
         details.push({ label: '4K Resolution', price: `~${highResPrice}` });
       }
    }
  }

  return (
    <div className="space-y-2">
        <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-primary">{pricingText}</span>
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                Base: {base_price.toLocaleString()} pts
            </Badge>
        </div>
        
        {details.length > 0 && (
            <Table className="mt-2 text-xs">
                <TableHeader>
                    <TableRow className="h-8 hover:bg-transparent">
                        <TableHead className="h-8 pl-0">Condition</TableHead>
                        <TableHead className="h-8 text-right pr-0">Cost</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {details.map((d, i) => (
                        <TableRow key={i} className="h-8 border-b-0 hover:bg-muted/50">
                            <TableCell className="h-8 py-1 pl-0">{d.label}</TableCell>
                            <TableCell className="h-8 py-1 text-right pr-0 font-mono">{d.price}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}
    </div>
  );
}

