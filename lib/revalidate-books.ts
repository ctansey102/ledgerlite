import { revalidatePath } from "next/cache";

export function revalidateBooks() {
  revalidatePath("/dashboard");
  revalidatePath("/journal");
  revalidatePath("/accounts");
  revalidatePath("/statements");
  revalidatePath("/subledgers", "layout");
  revalidatePath("/subledgers/ar");
  revalidatePath("/subledgers/ap");
  revalidatePath("/subledgers/fa");
  revalidatePath("/subledgers/cash");
  revalidatePath("/subledgers/inventory");
  revalidatePath("/subledgers/payroll");
  revalidatePath("/subledgers/ar/[customerId]", "page");
  revalidatePath("/subledgers/ap/[vendorId]", "page");
  revalidatePath("/subledgers/fa/[assetId]", "page");
}
