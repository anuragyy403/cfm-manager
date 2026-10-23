"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintReport() {
  return <Button variant="outline" onClick={() => window.print()}><Printer />Print / Save PDF</Button>;
}
