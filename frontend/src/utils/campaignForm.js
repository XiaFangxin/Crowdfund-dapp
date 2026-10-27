import { parseEther } from "ethers";

const MAX_UINT256 = (1n << 256n) - 1n;
const ETH_AMOUNT = /^\d+(?:\.\d{1,18})?$/;

/** Validate form strings without converting ETH amounts to floating point. */
export function validateCampaignForm(input = {}, { now = Date.now(), isV2 = false, categories = [] } = {}) {
  const values = {
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    goal: String(input.goal ?? "").trim(),
    deadline: String(input.deadline ?? ""),
    categoryId: String(input.categoryId ?? ""),
  };
  const errors = {};

  if (!values.title) errors.title = "Enter a campaign title.";
  else if (values.title.length > 120) errors.title = "Use 120 characters or fewer for the title.";
  if (values.description.length > 2000) errors.description = "Use 2,000 characters or fewer for the description.";

  if (!values.goal) errors.goal = "Enter a funding goal in ETH.";
  else if (!ETH_AMOUNT.test(values.goal)) {
    errors.goal = "Enter an ETH amount with up to 18 decimal places, such as 0.1.";
  } else {
    try {
      const goalWei = parseEther(values.goal);
      if (goalWei <= 0n) errors.goal = "Enter a funding goal greater than 0 ETH.";
      else if (goalWei > MAX_UINT256) errors.goal = "The funding goal exceeds the contract's maximum amount.";
    } catch {
      errors.goal = "The funding goal exceeds the contract's maximum amount.";
    }
  }

  const deadlineSeconds = Math.floor(new Date(values.deadline).getTime() / 1000);
  if (!values.deadline || !Number.isSafeInteger(deadlineSeconds)) {
    errors.deadline = "Choose a valid deadline.";
  } else if (!(deadlineSeconds > now / 1000)) {
    errors.deadline = "Choose a deadline in the future.";
  }

  if (isV2 && (!/^\d+$/.test(values.categoryId) || !categories.some(category =>
    category.active && String(category.id) === values.categoryId))) {
    errors.categoryId = "Select an enabled category.";
  }

  return { values, errors };
}
